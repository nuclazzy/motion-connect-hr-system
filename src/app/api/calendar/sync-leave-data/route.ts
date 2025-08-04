import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { googleCalendarService } from '@/lib/googleCalendar'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5분

interface LeaveEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  employeeName?: string
  leaveType?: string
}

// 직원 이름 매칭 함수
function findEmployeeByName(eventTitle: string, employees: any[]): any | null {
  // 이벤트 제목에서 직원 이름 추출
  const possibleNames = [
    eventTitle,
    eventTitle.replace(/연차|반차|시간차|휴가|오전|오후/g, '').trim(),
    eventTitle.split(' ')[0],
    eventTitle.split('_')[0],
    eventTitle.split('-')[0]
  ]

  for (const name of possibleNames) {
    if (!name) continue
    
    // 정확한 이름 매칭
    let employee = employees.find(emp => emp.name === name.trim())
    if (employee) return employee

    // 부분 매칭 (성만으로도 찾기)
    if (name.length >= 2) {
      employee = employees.find(emp => emp.name.includes(name.trim()))
      if (employee) return employee
    }
  }

  return null
}

// 휴가 유형 추출 함수
function extractLeaveType(eventTitle: string): string {
  if (eventTitle.includes('반차')) {
    if (eventTitle.includes('오전')) return '오전 반차'
    if (eventTitle.includes('오후')) return '오후 반차'
    return '반차'
  }
  if (eventTitle.includes('시간차')) return '시간차'
  if (eventTitle.includes('병가')) return '병가'
  if (eventTitle.includes('대체휴가')) return '대체휴가'
  if (eventTitle.includes('보상휴가')) return '보상휴가'
  return '연차' // 기본값
}

// 휴가 사용 시 근무시간 계산 함수
function calculateWorkHours(leaveType: string): number {
  // 모든 휴가는 사용 시 근무시간으로 인정
  if (leaveType.includes('반차')) return 4.0
  if (leaveType.includes('시간차')) return 1.0 // 기본값, 실제로는 별도 처리 필요
  return 8.0 // 연차, 보상휴가, 대체휴가 모두 8시간
}

// 휴가 상태 계산 함수
function getWorkStatus(leaveType: string): string {
  if (leaveType.includes('반차')) return '반차(유급)'
  if (leaveType.includes('시간차')) return '시간차(유급)'
  if (leaveType.includes('병가')) return '병가(유급)'
  if (leaveType.includes('대체휴가')) return '대체휴가(유급)'
  if (leaveType.includes('보상휴가')) return '보상휴가(유급)'
  return '연차(유급)'
}

export async function POST(request: NextRequest) {
  console.log('🔄 Google Calendar 연차 데이터 동기화 시작')
  
  try {
    const supabase = await createServiceRoleClient()
    const body = await request.json()
    const { calendarId, startDate, endDate } = body

    if (!calendarId) {
      return NextResponse.json({ error: 'calendarId가 필요합니다.' }, { status: 400 })
    }

    // 1. 모든 직원 정보 조회
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, name, email, department, position')

    if (employeesError) {
      console.error('❌ 직원 정보 조회 실패:', employeesError)
      return NextResponse.json({ error: '직원 정보 조회 실패' }, { status: 500 })
    }

    console.log(`👥 직원 ${employees?.length}명 조회 완료`)

    // 2. Google Calendar에서 휴가 이벤트 조회
    const timeMin = startDate || new Date().toISOString()
    const timeMax = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 3개월 후까지

    console.log(`📅 Google Calendar 조회: ${timeMin} ~ ${timeMax}`)

    const calendarEvents = await googleCalendarService.getEventsFromCalendar(
      calendarId,
      500, // 최대 500개 이벤트
      timeMin,
      timeMax
      // 검색 쿼리 제거 - 모든 이벤트를 가져와서 필터링
    )

    console.log(`📊 Google Calendar에서 ${calendarEvents.length}개 이벤트 조회`)

    // 3. 휴가 이벤트 필터링 및 직원 매칭
    const leaveEvents: LeaveEvent[] = []
    const matchResults = {
      matched: 0,
      unmatched: 0,
      processed: 0,
      errors: 0
    }

    for (const event of calendarEvents) {
      try {
        matchResults.processed++

        // 휴가 관련 키워드가 포함된 이벤트만 처리
        const leaveKeywords = ['연차', '반차', '휴가', '병가', '시간차', '대체휴가', '보상휴가']
        const isLeaveEvent = leaveKeywords.some(keyword => event.title.includes(keyword))

        if (!isLeaveEvent) continue

        // 직원 이름으로 매칭
        const employee = findEmployeeByName(event.title, employees)
        
        if (employee) {
          matchResults.matched++
          
          const leaveType = extractLeaveType(event.title)
          const startDate = event.start.split('T')[0] // YYYY-MM-DD 형식
          const endDate = event.end.split('T')[0]

          leaveEvents.push({
            id: event.id,
            title: event.title,
            start: startDate,
            end: endDate,
            description: event.description,
            employeeName: employee.name,
            leaveType
          })

          // 4. daily_work_summary에 유급휴가 시간 자동 인정 (8월부터만)
          if (new Date(startDate) >= new Date('2025-08-01')) {
            const workHours = calculateWorkHours(leaveType)
            const workStatus = getWorkStatus(leaveType)

            // 휴가 기간 내 모든 날짜에 대해 처리
            const currentDate = new Date(startDate)
            const endDateObj = new Date(endDate)
            
            while (currentDate <= endDateObj) {
              const workDate = currentDate.toISOString().split('T')[0]
              
              // daily_work_summary에 유급휴가 기록 생성
              const { error: summaryError } = await supabase
                .from('daily_work_summary')
                .upsert({
                  user_id: employee.id,
                  work_date: workDate,
                  basic_hours: workHours,
                  overtime_hours: 0,
                  night_hours: 0,
                  work_status: workStatus,
                  auto_calculated: true,
                  calculated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
              
              if (summaryError) {
                console.error(`❌ ${workDate} 근무시간 인정 실패:`, summaryError)
                matchResults.errors++
              } else {
                console.log(`✅ ${employee.name} - ${workDate} ${workHours}시간 인정`)
              }
              
              currentDate.setDate(currentDate.getDate() + 1)
            }
          }

        } else {
          matchResults.unmatched++
          console.log(`❓ 매칭 실패: "${event.title}" - 직원을 찾을 수 없음`)
        }

      } catch (error) {
        matchResults.errors++
        console.error(`❌ 이벤트 처리 중 오류:`, error)
      }
    }

    console.log('🎉 Google Calendar 연차 데이터 동기화 완료!')
    console.log(`📊 처리 결과:`, matchResults)

    return NextResponse.json({
      success: true,
      message: 'Google Calendar 연차 데이터 동기화 완료',
      results: matchResults,
      leaveEvents: leaveEvents.slice(0, 10), // 처음 10개만 반환
      totalLeaveEvents: leaveEvents.length
    })

  } catch (error) {
    console.error('❌ Google Calendar 동기화 오류:', error)
    return NextResponse.json({ 
      error: 'Google Calendar 동기화 실패',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient()
    
    // 연차 캘린더 설정 조회 (연차 관련 키워드로 검색)
    const { data: leaveCalendars, error } = await supabase
      .from('calendar_configs')
      .select('*')
      .eq('config_type', 'function')
      .or('target_name.ilike.%연차%,target_name.ilike.%leave%,calendar_alias.ilike.%연차%')
      .eq('is_active', true)

    if (error) {
      console.error('❌ 연차 캘린더 설정 조회 실패:', error)
      return NextResponse.json({ error: '연차 캘린더 설정 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({
      leaveCalendars: leaveCalendars || [],
      message: leaveCalendars?.length ? '연차 캘린더를 찾았습니다.' : '연차 캘린더가 설정되지 않았습니다.'
    })

  } catch (error) {
    console.error('❌ 연차 캘린더 조회 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
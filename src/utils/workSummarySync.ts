// daily_work_summary 테이블과 연차/공휴일 동기화 유틸리티

import { supabase } from '@/lib/supabase'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

// Google Calendar 이벤트에서 daily_work_summary로 연차 동기화
export async function syncLeaveToWorkSummary(
  calendarEvents: any[],
  year: number,
  month: number
) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    details: [] as string[]
  }

  try {
    // 먼저 모든 직원 정보 가져오기
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'user')

    if (userError || !users) {
      throw new Error('직원 목록을 가져올 수 없습니다')
    }

    // 직원 이름으로 빠르게 찾을 수 있도록 Map 생성
    const userMap = new Map(users.map(u => [u.name, u.id]))

    for (const event of calendarEvents) {
      try {
        // 이벤트 제목에서 직원 이름과 휴가 타입 추출
        const title = event.summary || event.title || ''
        
        // 다양한 형식 지원: "김철수 연차", "연차: 김철수", "김철수님 연차"
        let employeeName = null
        let leaveType = '연차'
        
        // 패턴 1: "김철수 연차" 또는 "김철수님 연차"
        const pattern1 = title.match(/^([가-힣]{2,4})님?\s+(.*)/)
        if (pattern1) {
          employeeName = pattern1[1]
          leaveType = pattern1[2] || '연차'
        }
        
        // 패턴 2: "연차: 김철수" 또는 "연차 - 김철수"
        if (!employeeName) {
          const pattern2 = title.match(/(.*?)[:：\-]\s*([가-힣]{2,4})/)
          if (pattern2) {
            leaveType = pattern2[1].trim() || '연차'
            employeeName = pattern2[2]
          }
        }

        // 패턴 3: 이름만 있는 경우
        if (!employeeName) {
          const pattern3 = title.match(/([가-힣]{2,4})/)
          if (pattern3) {
            employeeName = pattern3[1]
          }
        }

        if (!employeeName) {
          results.skipped++
          results.details.push(`⚠️ 이름을 찾을 수 없음: ${title}`)
          continue
        }

        // 직원 ID 찾기
        const userId = userMap.get(employeeName)
        if (!userId) {
          results.skipped++
          results.details.push(`⚠️ 직원을 찾을 수 없음: ${employeeName}`)
          continue
        }

        // 휴가 기간 계산
        const startDate = new Date(event.start?.date || event.start?.dateTime || event.start)
        const endDate = new Date(event.end?.date || event.end?.dateTime || event.end)
        
        // Google Calendar의 종료일은 다음날 00:00이므로 하루 빼기
        if (event.start?.date && event.end?.date) {
          endDate.setDate(endDate.getDate() - 1)
        }

        // 반차 확인
        const isHalfDay = title.includes('반차') || title.includes('오전') || title.includes('오후')
        const hours = isHalfDay ? 4.0 : 8.0
        
        // 휴가 타입 정리
        let workStatus = '연차(유급)'
        if (title.includes('병가')) workStatus = '병가(유급)'
        else if (title.includes('경조')) workStatus = '경조사(유급)'
        else if (title.includes('출산')) workStatus = '출산휴가(유급)'
        else if (title.includes('육아')) workStatus = '육아휴직'
        else if (title.includes('반차')) {
          if (title.includes('오전')) workStatus = '오전반차(유급)'
          else if (title.includes('오후')) workStatus = '오후반차(유급)'
          else workStatus = '반차(유급)'
        }

        // 날짜별로 daily_work_summary에 추가
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          // 주말 제외
          if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            // 해당 월에 속하는 날짜만 처리
            if (currentDate.getMonth() + 1 === month && currentDate.getFullYear() === year) {
              const workDate = currentDate.toISOString().split('T')[0]
              
              // 이미 출퇴근 기록이 있는지 확인
              const { data: existing } = await supabase
                .from('daily_work_summary')
                .select('id')
                .eq('user_id', userId)
                .eq('work_date', workDate)
                .single()

              if (!existing) {
                // 새로 추가
                const { error: insertError } = await supabase
                  .from('daily_work_summary')
                  .insert({
                    user_id: userId,
                    work_date: workDate,
                    basic_hours: hours,
                    overtime_hours: 0,
                    night_hours: 0,
                    work_status: workStatus,
                    auto_calculated: false,
                    calculated_at: new Date().toISOString()
                  })

                if (insertError) {
                  results.failed++
                  results.details.push(`❌ ${employeeName} ${workDate} 추가 실패`)
                } else {
                  results.success++
                  results.details.push(`✅ ${employeeName} ${workDate} ${workStatus}`)
                }
              } else {
                results.skipped++
                results.details.push(`⏭️ ${employeeName} ${workDate} 이미 기록 있음`)
              }
            }
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }
      } catch (error) {
        results.failed++
        results.details.push(`❌ 이벤트 처리 오류: ${error}`)
      }
    }

    return results
  } catch (error) {
    console.error('연차 동기화 오류:', error)
    throw error
  }
}

// 공휴일 데이터를 daily_work_summary에 동기화
export async function syncHolidaysToWorkSummary(
  holidays: { [date: string]: string },
  year: number,
  month: number
) {
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    details: [] as string[]
  }

  try {
    // 모든 직원 가져오기
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'user')

    if (userError || !users) {
      throw new Error('직원 목록을 가져올 수 없습니다')
    }

    // 해당 월의 공휴일만 필터링
    const monthHolidays = Object.entries(holidays).filter(([date]) => {
      const holidayDate = new Date(date)
      return holidayDate.getFullYear() === year && holidayDate.getMonth() + 1 === month
    })

    console.log(`📅 ${year}년 ${month}월 공휴일 ${monthHolidays.length}개 처리`)

    for (const [date, holidayName] of monthHolidays) {
      const holidayDate = new Date(date)
      
      // 주말인 공휴일은 제외 (대체휴일이 따로 있음)
      if (holidayDate.getDay() === 0 || holidayDate.getDay() === 6) {
        results.skipped++
        results.details.push(`⏭️ ${date} ${holidayName} (주말)`)
        continue
      }

      // 모든 직원에게 공휴일 적용
      for (const user of users) {
        try {
          // 이미 기록이 있는지 확인
          const { data: existing } = await supabase
            .from('daily_work_summary')
            .select('id, work_status')
            .eq('user_id', user.id)
            .eq('work_date', date)
            .single()

          if (!existing) {
            // 새로 추가
            const { error: insertError } = await supabase
              .from('daily_work_summary')
              .insert({
                user_id: user.id,
                work_date: date,
                basic_hours: 8.0,
                overtime_hours: 0,
                night_hours: 0,
                work_status: `${holidayName}(공휴일)`,
                auto_calculated: false,
                calculated_at: new Date().toISOString()
              })

            if (insertError) {
              results.failed++
            } else {
              results.success++
            }
          } else if (!existing.work_status || existing.work_status === '정상근무') {
            // 정상근무로 되어있으면 공휴일로 업데이트
            const { error: updateError } = await supabase
              .from('daily_work_summary')
              .update({
                work_status: `${holidayName}(공휴일)`,
                basic_hours: 8.0,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.id)

            if (updateError) {
              results.failed++
            } else {
              results.success++
            }
          } else {
            results.skipped++
          }
        } catch (error) {
          results.failed++
        }
      }
      
      results.details.push(`📅 ${date} ${holidayName}: ${users.length}명 처리`)
    }

    return results
  } catch (error) {
    console.error('공휴일 동기화 오류:', error)
    throw error
  }
}

// 월별 자동 동기화 (공휴일 + 연차)
export async function syncMonthlyWorkSummary(
  year: number,
  month: number
) {
  console.log(`🔄 ${year}년 ${month}월 근무 데이터 동기화 시작`)

  const results = {
    holidays: null as any,
    leaves: null as any,
    error: null as string | null
  }

  try {
    // 1. 공휴일 데이터 가져오기
    console.log('📅 공휴일 데이터 가져오기...')
    const holidayResponse = await fetch(`/api/holidays/naver?year=${year}`)
    const holidayData = await holidayResponse.json()
    
    if (holidayData.success && holidayData.holidays) {
      // 공휴일 동기화
      results.holidays = await syncHolidaysToWorkSummary(
        holidayData.holidays,
        year,
        month
      )
      console.log(`✅ 공휴일 동기화 완료: ${results.holidays.success}건`)
    }

    // 2. Google Calendar 연차 데이터 가져오기
    console.log('📅 Google Calendar 연차 데이터 가져오기...')
    const timeMin = new Date(year, month - 1, 1).toISOString()
    const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()
    
    const calendarResponse = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
        timeMin,
        timeMax,
        maxResults: 250
      })
    })

    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json()
      if (calendarData.events && calendarData.events.length > 0) {
        // 연차 동기화
        results.leaves = await syncLeaveToWorkSummary(
          calendarData.events,
          year,
          month
        )
        console.log(`✅ 연차 동기화 완료: ${results.leaves.success}건`)
      }
    }

    return results
  } catch (error) {
    console.error('월별 동기화 오류:', error)
    results.error = error instanceof Error ? error.message : String(error)
    return results
  }
}
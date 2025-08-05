import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUserServer } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5분

interface CSVAttendanceRecord {
  employeeName: string
  workDate: string
  checkInTime?: string
  checkOutTime?: string
  basicHours: number
  overtimeHours: number
  nightHours: number
  substituteHours?: number
  compensatoryHours?: number
  workStatus: string
  hadDinner: boolean
}

// CSV 파싱 함수
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

// 시간 문자열을 TIMESTAMP로 변환
function parseTimeToTimestamp(dateStr: string, timeStr: string): string | null {
  if (!timeStr || timeStr === '-' || timeStr === '') return null
  
  try {
    // "09:00" 형식을 "2025-06-01 09:00:00+09" 형식으로 변환
    const timestamp = `${dateStr} ${timeStr}:00+09`
    return timestamp
  } catch (error) {
    console.error('시간 파싱 오류:', error)
    return null
  }
}

// 근무상태 표준화
function normalizeWorkStatus(status: string): string {
  if (status.includes('정상근무')) return '정상근무'
  if (status.includes('유급휴일')) return '유급휴일'
  if (status.includes('결근')) return '결근'
  if (status.includes('연차')) return '연차(유급)'
  if (status.includes('반차')) return '반차(유급)'
  if (status.includes('시간차')) return '시간차(유급)'
  if (status.includes('병가')) return '병가(유급)'
  if (status.includes('대체휴가')) return '대체휴가(유급)'
  if (status.includes('보상휴가')) return '보상휴가(유급)'
  return status
}

export async function POST(request: NextRequest) {
  console.log('📤 CSV 일괄 업로드 시작')
  
  try {
    // 관리자 권한 확인
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()
    const body = await request.json()
    const { csvData, overwrite = false } = body

    if (!csvData) {
      return NextResponse.json({ error: 'CSV 데이터가 필요합니다.' }, { status: 400 })
    }

    // CSV 파싱
    const lines = csvData.split('\n').filter((line: string) => line.trim())
    const headers = parseCSVLine(lines[0])
    
    console.log('📊 CSV 헤더:', headers)
    console.log(`📝 총 ${lines.length - 1}개 레코드 처리 예정`)

    // 모든 직원 정보 조회
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, name, email')

    if (employeesError) {
      console.error('❌ 직원 정보 조회 실패:', employeesError)
      return NextResponse.json({ error: '직원 정보 조회 실패' }, { status: 500 })
    }

    const results = {
      processed: 0,
      success: 0,
      errors: 0,
      skipped: 0,
      errorMessages: [] as string[]
    }

    // 각 라인 처리
    for (let i = 1; i < lines.length; i++) {
      try {
        results.processed++
        const values = parseCSVLine(lines[i])
        
        if (values.length < 8) {
          results.errors++
          results.errorMessages.push(`라인 ${i + 1}: 컬럼 수 부족`)
          continue
        }

        // CSV 컬럼 매핑 (6월 데이터 기준)
        // 직원명,날짜,요일,근무상태,출근시간,퇴근시간,휴게(분),기본(h),연장(h),야간(h),발생대체(h),발생보상(h),비고
        const record: CSVAttendanceRecord = {
          employeeName: values[0]?.replace(/"/g, ''),
          workDate: values[1],
          checkInTime: values[4] && values[4] !== '' ? values[4] : undefined,
          checkOutTime: values[5] && values[5] !== '' ? values[5] : undefined,
          basicHours: parseFloat(values[7]) || 0,
          overtimeHours: parseFloat(values[8]) || 0,
          nightHours: parseFloat(values[9]) || 0,
          substituteHours: parseFloat(values[10]) || 0,
          compensatoryHours: parseFloat(values[11]) || 0,
          workStatus: normalizeWorkStatus(values[3] || '정상근무'),
          hadDinner: false // CSV에 저녁식사 정보가 없으므로 기본값
        }

        // 직원 매칭
        const employee = employees.find(emp => emp.name === record.employeeName)
        if (!employee) {
          results.errors++
          results.errorMessages.push(`라인 ${i + 1}: 직원 "${record.employeeName}"을 찾을 수 없음`)
          continue
        }

        // 날짜 형식 확인 및 변환
        let workDate: string
        try {
          // "2025-06-03" 형식으로 변환
          if (record.workDate.includes('/')) {
            const parts = record.workDate.split('/')
            workDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
          } else {
            workDate = record.workDate
          }
        } catch (error) {
          results.errors++
          results.errorMessages.push(`라인 ${i + 1}: 날짜 형식 오류 "${record.workDate}"`)
          continue
        }

        // 기존 데이터 확인
        if (!overwrite) {
          const { data: existing } = await supabase
            .from('daily_work_summary')
            .select('id')
            .eq('user_id', employee.id)
            .eq('work_date', workDate)
            .single()

          if (existing) {
            results.skipped++
            continue
          }
        }

        // daily_work_summary 업데이트/삽입
        const { error: summaryError } = await supabase
          .from('daily_work_summary')
          .upsert({
            user_id: employee.id,
            work_date: workDate,
            check_in_time: record.checkInTime ? parseTimeToTimestamp(workDate, record.checkInTime) : null,
            check_out_time: record.checkOutTime ? parseTimeToTimestamp(workDate, record.checkOutTime) : null,
            basic_hours: record.basicHours,
            overtime_hours: record.overtimeHours,
            night_hours: record.nightHours,
            substitute_hours: record.substituteHours || 0,
            compensatory_hours: record.compensatoryHours || 0,
            work_status: record.workStatus,
            had_dinner: record.hadDinner,
            auto_calculated: false, // CSV 데이터는 수동 입력으로 표시
            calculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (summaryError) {
          results.errors++
          results.errorMessages.push(`라인 ${i + 1}: DB 저장 실패 - ${summaryError.message}`)
          console.error(`❌ ${employee.name} ${workDate} 저장 실패:`, summaryError)
        } else {
          results.success++
          console.log(`✅ ${employee.name} ${workDate} 저장 완료`)
        }

      } catch (error) {
        results.errors++
        results.errorMessages.push(`라인 ${i + 1}: 처리 중 오류 - ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        console.error(`❌ 라인 ${i + 1} 처리 오류:`, error)
      }
    }

    console.log('🎉 CSV 일괄 업로드 완료!')
    console.log(`📊 처리 결과:`, results)

    return NextResponse.json({
      success: true,
      message: 'CSV 데이터 업로드 완료',
      results: {
        processed: results.processed,
        success: results.success,
        errors: results.errors,
        skipped: results.skipped,
        errorMessages: results.errorMessages.slice(0, 10) // 처음 10개 오류만 반환
      }
    })

  } catch (error) {
    console.error('❌ CSV 업로드 오류:', error)
    return NextResponse.json({ 
      error: 'CSV 업로드 실패',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
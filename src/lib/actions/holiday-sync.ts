'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { fetchHolidaysFromAPI, initializeHolidayCache, formatDateForHoliday } from '@/lib/holidays'

interface HolidaySyncResult {
  success: boolean
  message: string
  results?: {
    totalFetched: number
    newHolidays: number
    updatedHolidays: number
    processedEmployees: number
    createdWorkRecords: number
    errors: number
  }
  error?: string
}

// 공공데이터포털 API에서 공휴일 데이터를 가져와서 DB에 저장하는 함수
export async function syncHolidaysFromAPI(year: number): Promise<HolidaySyncResult> {
  console.log(`🔄 ${year}년 공휴일 데이터 동기화 시작`)
  
  const supabase = await createServiceRoleClient()
  
  try {
    // 1. 공공데이터포털 API에서 공휴일 데이터 가져오기
    const holidays = await fetchHolidaysFromAPI(year)
    const holidayEntries = Object.entries(holidays)
    
    console.log(`📅 공공데이터포털 API에서 ${holidayEntries.length}개 공휴일 데이터 수신`)
    
    if (holidayEntries.length === 0) {
      return {
        success: false,
        message: `${year}년 공휴일 데이터를 가져올 수 없습니다.`,
        results: {
          totalFetched: 0,
          newHolidays: 0,
          updatedHolidays: 0,
          processedEmployees: 0,
          createdWorkRecords: 0,
          errors: 1
        }
      }
    }
    
    let newHolidays = 0
    let updatedHolidays = 0
    let errors = 0
    
    // 2. 공휴일 데이터를 DB에 저장
    for (const [dateString, holidayName] of holidayEntries) {
      try {
        const { data: existingHoliday, error: selectError } = await supabase
          .from('holidays')
          .select('id')
          .eq('holiday_date', dateString)
          .single()
        
        if (selectError && selectError.code !== 'PGRST116') {
          console.error(`❌ 공휴일 조회 오류 (${dateString}):`, selectError)
          errors++
          continue
        }
        
        if (existingHoliday) {
          // 기존 공휴일 업데이트
          const { error: updateError } = await supabase
            .from('holidays')
            .update({
              holiday_name: holidayName,
              source: 'public_api',
              updated_at: new Date().toISOString()
            })
            .eq('holiday_date', dateString)
          
          if (updateError) {
            console.error(`❌ 공휴일 업데이트 오류 (${dateString}):`, updateError)
            errors++
          } else {
            updatedHolidays++
            console.log(`✅ 공휴일 업데이트: ${dateString} - ${holidayName}`)
          }
        } else {
          // 새 공휴일 추가
          const { error: insertError } = await supabase
            .from('holidays')
            .insert({
              holiday_date: dateString,
              holiday_name: holidayName,
              year: parseInt(dateString.split('-')[0]),
              source: 'public_api',
              is_active: true
            })
          
          if (insertError) {
            console.error(`❌ 공휴일 추가 오류 (${dateString}):`, insertError)
            errors++
          } else {
            newHolidays++
            console.log(`✅ 공휴일 추가: ${dateString} - ${holidayName}`)
          }
        }
        
      } catch (error) {
        console.error(`❌ 공휴일 처리 중 예외 (${dateString}):`, error)
        errors++
      }
    }
    
    // 3. 공휴일 근무시간 데이터 생성 (이번 년도만)
    let processedEmployees = 0
    let createdWorkRecords = 0
    
    if (year === new Date().getFullYear()) {
      console.log('📊 현재 년도 공휴일 근무시간 데이터 생성 중...')
      
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      
      const { data: workResult, error: workError } = await supabase
        .rpc('generate_holiday_work_hours_for_all', {
          start_date: startDate,
          end_date: endDate
        })
      
      if (workError) {
        console.error('❌ 공휴일 근무시간 생성 오류:', workError)
        errors++
      } else if (workResult && workResult.length > 0) {
        processedEmployees = workResult[0].processed_employees || 0
        createdWorkRecords = workResult[0].created_records || 0
        console.log(`✅ 공휴일 근무시간 생성: ${createdWorkRecords}건`)
      }
    }
    
    return {
      success: true,
      message: `${year}년 공휴일 동기화 완료: 신규 ${newHolidays}개, 업데이트 ${updatedHolidays}개`,
      results: {
        totalFetched: holidayEntries.length,
        newHolidays,
        updatedHolidays,
        processedEmployees,
        createdWorkRecords,
        errors
      }
    }
    
  } catch (error) {
    console.error(`❌ ${year}년 공휴일 동기화 실패:`, error)
    return {
      success: false,
      message: `공휴일 동기화 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// 여러 년도의 공휴일을 한번에 동기화하는 함수
export async function syncMultipleYears(years: number[]): Promise<HolidaySyncResult> {
  console.log(`🔄 ${years.length}개 년도 공휴일 일괄 동기화 시작:`, years)
  
  const results = []
  let totalErrors = 0
  let totalNew = 0
  let totalUpdated = 0
  let totalWorkRecords = 0
  
  for (const year of years) {
    const result = await syncHolidaysFromAPI(year)
    results.push({ year, ...result })
    
    if (result.results) {
      totalErrors += result.results.errors
      totalNew += result.results.newHolidays
      totalUpdated += result.results.updatedHolidays
      totalWorkRecords += result.results.createdWorkRecords
    }
  }
  
  const allSuccess = results.every(r => r.success)
  
  return {
    success: allSuccess,
    message: allSuccess 
      ? `전체 동기화 완료: 신규 ${totalNew}개, 업데이트 ${totalUpdated}개, 근무기록 ${totalWorkRecords}건`
      : `일부 동기화 실패: 오류 ${totalErrors}건`,
    results: {
      totalFetched: results.reduce((sum, r) => sum + (r.results?.totalFetched || 0), 0),
      newHolidays: totalNew,
      updatedHolidays: totalUpdated,
      processedEmployees: results.reduce((sum, r) => sum + (r.results?.processedEmployees || 0), 0),
      createdWorkRecords: totalWorkRecords,
      errors: totalErrors
    }
  }
}

// 특정 월의 공휴일 근무시간 재생성 함수
export async function regenerateHolidayWorkHours(year: number, month: number): Promise<HolidaySyncResult> {
  console.log(`🔄 ${year}년 ${month}월 공휴일 근무시간 재생성 시작`)
  
  const supabase = await createServiceRoleClient()
  
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = new Date(year, month, 0).toISOString().split('T')[0] // 해당 월의 마지막 날
    
    const { data: workResult, error: workError } = await supabase
      .rpc('generate_holiday_work_hours_for_all', {
        start_date: startDate,
        end_date: endDate
      })
    
    if (workError) {
      console.error('❌ 공휴일 근무시간 재생성 오류:', workError)
      return {
        success: false,
        message: `${year}년 ${month}월 공휴일 근무시간 재생성 실패`,
        error: workError.message
      }
    }
    
    const result = workResult?.[0] || {
      processed_dates: 0,
      processed_employees: 0,
      created_records: 0,
      updated_records: 0
    }
    
    return {
      success: true,
      message: `${year}년 ${month}월 공휴일 근무시간 재생성 완료: ${result.created_records + result.updated_records}건 처리`,
      results: {
        totalFetched: result.processed_dates,
        newHolidays: 0,
        updatedHolidays: 0,
        processedEmployees: result.processed_employees,
        createdWorkRecords: result.created_records + result.updated_records,
        errors: 0
      }
    }
    
  } catch (error) {
    console.error(`❌ ${year}년 ${month}월 공휴일 근무시간 재생성 실패:`, error)
    return {
      success: false,
      message: `공휴일 근무시간 재생성 중 오류 발생`,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

// 공휴일 현황 조회 함수
export async function getHolidayStatus(year?: number) {
  const supabase = await createServiceRoleClient()
  const targetYear = year || new Date().getFullYear()
  
  try {
    // 공휴일 목록 조회
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('*')
      .eq('year', targetYear)
      .eq('is_active', true)
      .order('holiday_date')
    
    if (holidaysError) throw holidaysError
    
    // 공휴일 근무현황 조회
    const { data: workStatus, error: workError } = await supabase
      .from('holiday_work_status')
      .select('*')
      .gte('work_date', `${targetYear}-01-01`)
      .lte('work_date', `${targetYear}-12-31`)
      .order('work_date', { ascending: false })
      .limit(50)
    
    if (workError) throw workError
    
    return {
      success: true,
      holidays: holidays || [],
      workStatus: workStatus || [],
      summary: {
        totalHolidays: holidays?.length || 0,
        processedWorkRecords: workStatus?.length || 0
      }
    }
    
  } catch (error) {
    console.error('❌ 공휴일 현황 조회 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      holidays: [],
      workStatus: [],
      summary: { totalHolidays: 0, processedWorkRecords: 0 }
    }
  }
}

// 자동 동기화 함수 (현재년도 + 다음년도)
export async function autoSyncHolidays(): Promise<HolidaySyncResult> {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1]
  
  console.log(`🤖 자동 공휴일 동기화 시작: ${years.join(', ')}년`)
  
  return await syncMultipleYears(years)
}
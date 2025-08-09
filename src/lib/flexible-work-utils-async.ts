/**
 * 비동기 버전: 공휴일 API 연동 근무일 유형 확인
 * CapsUploadManager 등 비동기 환경에서 사용
 */

import { isHoliday } from '@/lib/holidays'

/**
 * 요일 및 공휴일 확인 함수 (비동기 공휴일 API 연동)
 * @param workDate 근무날짜 (YYYY-MM-DD)
 * @returns 근무 유형 ('weekday', 'saturday', 'sunday_or_holiday')
 */
export async function getWorkDayTypeAsync(workDate: string): Promise<'weekday' | 'saturday' | 'sunday_or_holiday'> {
  const date = new Date(workDate)
  const dayOfWeek = date.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
  
  if (dayOfWeek === 6) {
    return 'saturday'
  } else if (dayOfWeek === 0) {
    return 'sunday_or_holiday' // 일요일은 보상휴가 대상
  } else {
    // 🎯 공휴일 API 연동하여 공휴일인지 확인 (비동기 버전)
    try {
      const holidayName = await isHoliday(workDate)
      
      if (holidayName) {
        console.log(`📅 Holiday detected: ${workDate} - ${holidayName}`)
        return 'sunday_or_holiday' // 공휴일도 보상휴가 대상 (일요일과 동일)
      }
    } catch (error) {
      console.warn(`⚠️ Holiday check failed for ${workDate}:`, error)
    }
    
    return 'weekday'
  }
}

/**
 * 대체휴가 및 보상휴가 시간 계산 (비동기 공휴일 연동)
 * @param workDate 근무날짜 (YYYY-MM-DD)
 * @param totalWorkHours 총 근무시간
 * @returns {substitute_hours, compensatory_hours}
 */
export async function calculateSubstituteAndCompensatoryHoursWithHoliday(
  workDate: string,
  totalWorkHours: number
): Promise<{ substitute_hours: number; compensatory_hours: number }> {
  const workType = await getWorkDayTypeAsync(workDate)
  
  if (workType === 'saturday') {
    // 토요일 근무 → 대체휴가 지급 (1:1 비율 - 근로기준법)
    const regularHours = Math.min(totalWorkHours, 8)
    const overtimeHours = Math.max(0, totalWorkHours - 8)
    const substitute_hours = regularHours * 1.0 + overtimeHours * 1.5
    
    return {
      substitute_hours: Math.round(substitute_hours * 10) / 10,
      compensatory_hours: 0
    }
  } else if (workType === 'sunday_or_holiday') {
    // 일요일/공휴일 근무 → 보상휴가 지급 (1.5:1 기본)
    const regularHours = Math.min(totalWorkHours, 8)
    const overtimeHours = Math.max(0, totalWorkHours - 8)
    const compensatory_hours = regularHours * 1.5 + overtimeHours * 2.0
    
    return {
      substitute_hours: 0,
      compensatory_hours: Math.round(compensatory_hours * 10) / 10
    }
  } else {
    // 평일 근무 → 대체휴가/보상휴가 없음
    return {
      substitute_hours: 0,
      compensatory_hours: 0
    }
  }
}
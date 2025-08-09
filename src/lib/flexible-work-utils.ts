// 탄력근무제 관련 유틸리티 함수들
// 근무시간관리 웹앱.md 파일의 Google Apps Script 로직을 TypeScript로 이식

import { calculateNetWorkHours, calculateBreakMinutes } from '@/lib/break-time-calculator'

export interface FlexibleWorkSettings {
  start: string // 'YYYY-MM-DD' 형식
  end: string   // 'YYYY-MM-DD' 형식
  standard_weekly_hours: number // 주당 기준 근로시간 (보통 40시간)
}

export interface WorkTimeCalculation {
  basic_hours: number
  overtime_hours: number
  night_hours: number
  substitute_hours: number // 대체휴가 발생시간
  compensatory_hours: number // 보상휴가 발생시간
  dinner_break_detected: boolean
  overtime_threshold_used: number // 8 or 12
  work_type: 'weekday' | 'saturday' | 'sunday_or_holiday' // 근무 유형
}

/**
 * 특정 날짜가 탄력근무제 기간에 해당하는지 확인
 * @param date 확인할 날짜 (YYYY-MM-DD 형식)
 * @param flexSettings 탄력근무제 설정 배열
 * @returns 탄력근무제 기간이면 해당 설정, 아니면 null
 */
export function getFlexibleWorkSetting(
  date: string,
  flexSettings: FlexibleWorkSettings[]
): FlexibleWorkSettings | undefined {
  for (const setting of flexSettings) {
    if (date >= setting.start && date <= setting.end) {
      return setting
    }
  }
  return undefined
}

/**
 * 초과근무 임계값 결정 (DB 설정 기반)
 * @param date 근무 날짜 (YYYY-MM-DD 형식)
 * @param flexSettings 탄력근무제 설정 배열
 * @param overtimeSettings 초과근무 설정 (옵션)
 * @returns 초과근무 임계값 (시간)
 */
export function getOvertimeThreshold(
  date: string,
  flexSettings: FlexibleWorkSettings[],
  overtimeSettings?: OvertimeNightSettings
): number {
  const flexSetting = getFlexibleWorkSetting(date, flexSettings)
  
  if (flexSetting) {
    // 탄력근무제 기간 중에는 12시간 기준
    return 12
  } else if (overtimeSettings?.overtime_threshold) {
    // DB 설정값 사용
    return overtimeSettings.overtime_threshold
  } else {
    // 일반 근무 기간에는 8시간 기준 (기본값)
    return 8
  }
}

/**
 * 초과근무 임계값 결정 (비동기 DB 조회 버전)
 * @param date 근무 날짜 (YYYY-MM-DD 형식)
 * @returns 초과근무 임계값 (시간)
 */
export async function getOvertimeThresholdAsync(date: string): Promise<number> {
  try {
    const [flexSettings, overtimeSettings] = await Promise.all([
      getCurrentFlexibleWorkSettings(),
      getOvertimeNightSettings()
    ])
    
    return getOvertimeThreshold(date, flexSettings, overtimeSettings || undefined)
  } catch (error) {
    console.error('초과근무 임계값 조회 오류:', error)
    return 8 // 기본값
  }
}

/**
 * 야간근무시간 계산 (DB 설정 기반)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)
 * @param overtimeSettings 초과근무 설정 (옵션)
 * @returns 야간근무시간 (시간 단위)
 */
export function calculateNightHours(
  checkInTime: string,
  checkOutTime: string,
  overtimeSettings?: OvertimeNightSettings
): number {
  if (!checkInTime || !checkOutTime) return 0
  
  // DB 설정 또는 기본값 사용
  const nightStart = overtimeSettings?.night_start_time 
    ? parseInt(overtimeSettings.night_start_time.split(':')[0]) 
    : 22 // 22:00
  const nightEnd = overtimeSettings?.night_end_time
    ? parseInt(overtimeSettings.night_end_time.split(':')[0])
    : 6  // 06:00 (다음날)
  
  // 시간을 24시간 형식의 숫자로 변환
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours + minutes / 60
  }
  
  let checkIn = parseTime(checkInTime)
  let checkOut = parseTime(checkOutTime)
  
  // 다음날까지 일한 경우 (퇴근시간이 출근시간보다 작은 경우)
  if (checkOut < checkIn) {
    checkOut += 24
  }
  
  let nightHours = 0
  
  // 22:00-24:00 구간
  if (checkIn < 24 && checkOut > nightStart) {
    const start = Math.max(checkIn, nightStart)
    const end = Math.min(checkOut, 24)
    nightHours += Math.max(0, end - start)
  }
  
  // 00:00-06:00 구간 (다음날)
  if (checkOut > 24) {
    const start = Math.max(checkIn - 24, 0)
    const end = Math.min(checkOut - 24, nightEnd)
    if (end > start) {
      nightHours += end - start
    }
  }
  
  return Math.round(nightHours * 10) / 10 // 소수점 1자리로 반올림
}

/**
 * 저녁식사 시간 자동 감지 (DB 설정 기반)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)  
 * @param totalWorkHours 총 근무시간
 * @param overtimeSettings 초과근무 설정 (옵션)
 * @returns 저녁식사 시간이 감지되었는지 여부
 */
export function detectDinnerBreak(
  checkInTime: string,
  checkOutTime: string,
  totalWorkHours: number,
  overtimeSettings?: OvertimeNightSettings
): boolean {
  // DB 설정 또는 기본값 사용
  const dinnerThreshold = overtimeSettings?.dinner_time_threshold || 8
  
  if (!checkInTime || !checkOutTime || totalWorkHours < dinnerThreshold) {
    return false
  }
  
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours + minutes / 60
  }
  
  const checkIn = parseTime(checkInTime)
  let checkOut = parseTime(checkOutTime)
  
  // 다음날까지 일한 경우
  if (checkOut < checkIn) {
    checkOut += 24
  }
  
  const dinnerTime = 19 // 19:00 (하드코딩 유지, 추후 설정 가능)
  
  // 조건: 설정된 시간 이상 근무 AND 19:00 시점에 회사에 있었던 경우
  const wasAtOfficeAt19 = checkIn <= dinnerTime && checkOut >= dinnerTime
  
  return wasAtOfficeAt19
}

/**
 * 요일 및 공휴일 확인 함수 (하이브리드 공휴일 API 연동)
 * @param workDate 근무날짜 (YYYY-MM-DD)
 * @returns 근무 유형 ('weekday', 'saturday', 'sunday_or_holiday')
 */
export function getWorkDayType(workDate: string): 'weekday' | 'saturday' | 'sunday_or_holiday' {
  const date = new Date(workDate)
  const dayOfWeek = date.getDay() // 0: 일요일, 1: 월요일, ..., 6: 토요일
  
  if (dayOfWeek === 6) {
    return 'saturday'
  } else if (dayOfWeek === 0) {
    return 'sunday_or_holiday' // 일요일은 보상휴가 대상
  } else {
    // 🎯 공휴일 API 연동하여 공휴일인지 확인 (동기 버전)
    try {
      const { isHolidaySync } = require('@/lib/holidays')
      const holidayName = isHolidaySync(workDate)
      
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
 * 대체휴가 및 보상휴가 시간 계산 (DB 설정 기반)
 * 중요: 탄력근무제와 무관하게 토요일/공휴일 근무 시 즉시 지급
 * @param workDate 근무날짜 (YYYY-MM-DD)
 * @param totalWorkHours 총 근무시간
 * @param leaveSettings 대체/보상휴가 설정 (옵션)
 * @returns {substitute_hours, compensatory_hours}
 */
export function calculateSubstituteAndCompensatoryHours(
  workDate: string,
  totalWorkHours: number,
  leaveSettings?: LeaveCalculationSettings
): { substitute_hours: number; compensatory_hours: number } {
  const workType = getWorkDayType(workDate)
  
  if (workType === 'saturday' && leaveSettings?.saturday_substitute_enabled !== false) {
    // 토요일 근무 → 대체휴가 지급 (1:1 비율 - 근로기준법)
    const baseRate = leaveSettings?.saturday_base_rate || 1.0  // 8시간까지 1:1
    const overtimeRate = leaveSettings?.saturday_overtime_rate || 1.5  // 초과분은 1.5:1
    
    const regularHours = Math.min(totalWorkHours, 8)
    const overtimeHours = Math.max(0, totalWorkHours - 8)
    const substitute_hours = regularHours * baseRate + overtimeHours * overtimeRate
    
    return {
      substitute_hours: Math.round(substitute_hours * 10) / 10,
      compensatory_hours: 0
    }
  } else if (workType === 'sunday_or_holiday' && leaveSettings?.sunday_compensatory_enabled !== false) {
    // 일요일/공휴일 근무 → 보상휴가 지급 (DB 설정 또는 기본값)
    const baseRate = leaveSettings?.sunday_base_rate || 1.5
    const overtimeRate = leaveSettings?.sunday_overtime_rate || 2.0
    
    const regularHours = Math.min(totalWorkHours, 8)
    const overtimeHours = Math.max(0, totalWorkHours - 8)
    const compensatory_hours = regularHours * baseRate + overtimeHours * overtimeRate
    
    return {
      substitute_hours: 0,
      compensatory_hours: Math.round(compensatory_hours * 10) / 10
    }
  } else {
    // 평일 근무 또는 설정 비활성화 → 대체휴가/보상휴가 없음
    return {
      substitute_hours: 0,
      compensatory_hours: 0
    }
  }
}

/**
 * 대체휴가 및 보상휴가 시간 계산 (비동기 DB 조회 버전)
 * @param workDate 근무날짜 (YYYY-MM-DD)
 * @param totalWorkHours 총 근무시간
 * @returns {substitute_hours, compensatory_hours}
 */
export async function calculateSubstituteAndCompensatoryHoursAsync(
  workDate: string,
  totalWorkHours: number
): Promise<{ substitute_hours: number; compensatory_hours: number }> {
  try {
    const leaveSettings = await getLeaveCalculationSettings()
    return calculateSubstituteAndCompensatoryHours(workDate, totalWorkHours, leaveSettings || undefined)
  } catch (error) {
    console.error('대체/보상휴가 계산 오류:', error)
    // 오류 시 기본 로직 사용
    return calculateSubstituteAndCompensatoryHours(workDate, totalWorkHours)
  }
}

/**
 * 근무시간 계산 (탄력근무제 고려 + 대체휴가/보상휴가 계산)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)
 * @param workDate 근무 날짜 (YYYY-MM-DD 형식)
 * @param flexSettings 탄력근무제 설정
 * @param lunchBreakMinutes 점심시간 (분)
 * @returns 계산된 근무시간 정보
 */
export function calculateWorkTime(
  checkInTime: string,
  checkOutTime: string,
  workDate: string,
  flexSettings: FlexibleWorkSettings[],
  lunchBreakMinutes: number = 60
): WorkTimeCalculation {
  if (!checkInTime || !checkOutTime) {
    return {
      basic_hours: 0,
      overtime_hours: 0,
      night_hours: 0,
      substitute_hours: 0,
      compensatory_hours: 0,
      dinner_break_detected: false,
      overtime_threshold_used: 8,
      work_type: 'weekday'
    }
  }
  
  const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours + minutes / 60
  }
  
  const checkIn = parseTime(checkInTime)
  let checkOut = parseTime(checkOutTime)
  
  // 다음날까지 일한 경우
  if (checkOut < checkIn) {
    checkOut += 24
  }
  
  // 총 근무시간 (점심시간 제외)
  let totalHours = checkOut - checkIn - (lunchBreakMinutes / 60)
  
  // 저녁식사 시간 감지 및 차감 (DB 설정 적용)
  const dinnerBreakDetected = detectDinnerBreak(checkInTime, checkOutTime, totalHours)
  if (dinnerBreakDetected) {
    totalHours -= 1 // 1시간 차감
  }
  
  // 야간근무시간 계산 (DB 설정 적용)
  const nightHours = calculateNightHours(checkInTime, checkOutTime)
  
  // 초과근무 임계값 결정 (탄력근무제에서만 영향)
  const overtimeThreshold = getOvertimeThreshold(workDate, flexSettings)
  
  // 기본근무시간과 초과근무시간 분리
  const basicHours = Math.min(totalHours, overtimeThreshold)
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold)
  
  // 근무 유형 확인
  const workType = getWorkDayType(workDate)
  
  // 대체휴가/보상휴가 계산 (탄력근무제와 무관하게 적용)
  const { substitute_hours, compensatory_hours } = calculateSubstituteAndCompensatoryHours(
    workDate, 
    totalHours
  )
  
  return {
    basic_hours: Math.max(0, Math.round(basicHours * 10) / 10),
    overtime_hours: Math.round(overtimeHours * 10) / 10,
    night_hours: nightHours,
    substitute_hours,
    compensatory_hours,
    dinner_break_detected: dinnerBreakDetected,
    overtime_threshold_used: overtimeThreshold,
    work_type: workType
  }
}

/**
 * 근무시간 계산 (완전 DB 연동 버전)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)
 * @param workDate 근무 날짜 (YYYY-MM-DD 형식)
 * @param lunchBreakMinutes 점심시간 (분)
 * @returns 계산된 근무시간 정보
 */
export async function calculateWorkTimeAsync(
  checkInTime: string,
  checkOutTime: string,
  workDate: string,
  lunchBreakMinutes: number = 60
): Promise<WorkTimeCalculation> {
  if (!checkInTime || !checkOutTime) {
    return {
      basic_hours: 0,
      overtime_hours: 0,
      night_hours: 0,
      substitute_hours: 0,
      compensatory_hours: 0,
      dinner_break_detected: false,
      overtime_threshold_used: 8,
      work_type: 'weekday'
    }
  }
  
  try {
    // 모든 설정을 병렬로 조회
    const [flexSettings, overtimeSettings, leaveSettings] = await Promise.all([
      getCurrentFlexibleWorkSettings(),
      getOvertimeNightSettings(),
      getLeaveCalculationSettings()
    ])
    
    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours + minutes / 60
    }
    
    const checkIn = parseTime(checkInTime)
    let checkOut = parseTime(checkOutTime)
    
    // 다음날까지 일한 경우
    if (checkOut < checkIn) {
      checkOut += 24
    }
    
    // 🔄 통합된 휴게시간 계산 시스템 사용
    const dinnerBreakDetected = detectDinnerBreak(checkInTime, checkOutTime, checkOut - checkIn, overtimeSettings || undefined)
    const totalHours = calculateNetWorkHours(checkInTime, checkOutTime, dinnerBreakDetected)
    
    // 저녁식사 시간이 이미 차감된 순수 근무시간 사용
    console.log(`📊 ${workDate} 통합 휴게시간 계산:`, {
      checkIn: checkInTime,
      checkOut: checkOutTime,
      totalHours: totalHours.toFixed(2),
      dinnerDetected: dinnerBreakDetected
    })
    
    // calculateNetWorkHours에서 이미 저녁식사 시간이 차감되어 totalHours에 반영됨
    
    // 야간근무시간 계산 (DB 설정 적용)
    const nightHours = calculateNightHours(checkInTime, checkOutTime, overtimeSettings)
    
    // 초과근무 임계값 결정 (탄력근무제 및 DB 설정 적용)
    const overtimeThreshold = getOvertimeThreshold(workDate, flexSettings, overtimeSettings)
    
    // 기본근무시간과 초과근무시간 분리
    const basicHours = Math.min(totalHours, overtimeThreshold)
    const overtimeHours = Math.max(0, totalHours - overtimeThreshold)
    
    // 근무 유형 확인
    const workType = getWorkDayType(workDate)
    
    // 대체휴가/보상휴가 계산 (DB 설정 적용)
    const { substitute_hours, compensatory_hours } = calculateSubstituteAndCompensatoryHours(
      workDate,
      totalHours,
      leaveSettings
    )
    
    return {
      basic_hours: Math.max(0, Math.round(basicHours * 10) / 10),
      overtime_hours: Math.round(overtimeHours * 10) / 10,
      night_hours: nightHours,
      substitute_hours,
      compensatory_hours,
      dinner_break_detected: dinnerBreakDetected,
      overtime_threshold_used: overtimeThreshold,
      work_type: workType
    }
  } catch (error) {
    console.error('근무시간 계산 오류:', error)
    // 오류 시 기본 함수 사용
    return calculateWorkTime(checkInTime, checkOutTime, workDate, getCurrentFlexibleWorkSettingsSync(), lunchBreakMinutes)
  }
}

/**
 * 현재 활성화된 탄력근무제 기간 조회 (DB 연동)
 * @returns 현재 활성화된 탄력근무제 설정
 */
export async function getCurrentFlexibleWorkSettings(): Promise<FlexibleWorkSettings[]> {
  try {
    // Supabase 동적 임포트 (서버/클라이언트 호환성)
    const { supabase } = await import('@/lib/supabase')
    
    const { data, error } = await supabase
      .from('work_policies')
      .select(`
        flexible_work_settings(
          start_date,
          end_date, 
          weekly_standard_hours
        )
      `)
      .eq('policy_type', 'flexible_work')
      .eq('is_active', true)
    
    if (error || !data) {
      console.error('탄력근무제 설정 조회 실패:', error)
      // 실패 시 기본값 반환
      return [
        {
          start: '2025-06-01',
          end: '2025-08-31',
          standard_weekly_hours: 40
        }
      ]
    }
    
    // 데이터 변환
    const settings: FlexibleWorkSettings[] = []
    data.forEach(policy => {
      if (policy.flexible_work_settings) {
        policy.flexible_work_settings.forEach((setting: any) => {
          settings.push({
            start: setting.start_date,
            end: setting.end_date,
            standard_weekly_hours: setting.weekly_standard_hours
          })
        })
      }
    })
    
    return settings.length > 0 ? settings : [
      {
        start: '2025-06-01',
        end: '2025-08-31', 
        standard_weekly_hours: 40
      }
    ]
  } catch (error) {
    console.error('탄력근무제 설정 조회 오류:', error)
    // 오류 시 기본값 반환
    return [
      {
        start: '2025-06-01',
        end: '2025-08-31',
        standard_weekly_hours: 40
      }
    ]
  }
}

/**
 * 현재 활성화된 탄력근무제 기간 조회 (동기 버전 - 하위 호환성)
 * @deprecated DB 연동 버전 사용 권장
 */
export function getCurrentFlexibleWorkSettingsSync(): FlexibleWorkSettings[] {
  return [
    {
      start: '2025-06-01',
      end: '2025-08-31',
      standard_weekly_hours: 40
    }
  ]
}

/**
 * 야간/초과근무 설정 인터페이스
 */
export interface OvertimeNightSettings {
  night_start_time: string // "22:00"
  night_end_time: string   // "06:00"
  night_allowance_rate: number // 1.5 (150%)
  overtime_threshold: number   // 8
  overtime_allowance_rate: number // 1.5 (150%)
  break_minutes_4h: number // 30
  break_minutes_8h: number // 60
  dinner_time_threshold: number // 8
}

/**
 * 대체/보상휴가 설정 인터페이스
 */
export interface LeaveCalculationSettings {
  saturday_substitute_enabled: boolean
  saturday_base_rate: number // 1.0 (토요일 기본 8시간: 1:1 대체휴가)
  saturday_overtime_rate: number // 1.5 (토요일 초과분: 1.5:1 대체휴가)
  sunday_compensatory_enabled: boolean
  sunday_base_rate: number // 1.5 (일요일/공휴일 기본 8시간: 1.5:1 보상휴가)
  sunday_overtime_rate: number // 2.0 (일요일/공휴일 초과분: 2:1 보상휴가)
  holiday_base_rate: number // 1.5 (공휴일 기본 8시간: 1.5:1 보상휴가)
  holiday_overtime_rate: number // 2.0 (공휴일 초과분: 2:1 보상휴가)
  max_substitute_hours: number // 240 (최대 대체휴가 적립 시간)
  max_compensatory_hours: number // 240 (최대 보상휴가 적립 시간)
}

/**
 * 현재 활성화된 야간/초과근무 설정 조회 (DB 연동)
 */
export async function getOvertimeNightSettings(): Promise<OvertimeNightSettings | undefined> {
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const { data, error } = await supabase
      .from('work_policies')
      .select(`
        overtime_night_settings(*)
      `)
      .eq('policy_type', 'overtime_night')
      .eq('is_active', true)
      .limit(1)
    
    if (error || !data || data.length === 0) {
      console.error('야간/초과근무 설정 조회 실패:', error)
      return undefined
    }
    
    const settings = data[0]?.overtime_night_settings?.[0]
    return settings || null
  } catch (error) {
    console.error('야간/초과근무 설정 조회 오류:', error)
    return undefined
  }
}

/**
 * 현재 활성화된 대체/보상휴가 설정 조회 (DB 연동)
 */
export async function getLeaveCalculationSettings(): Promise<LeaveCalculationSettings | undefined> {
  try {
    const { supabase } = await import('@/lib/supabase')
    
    const { data, error } = await supabase
      .from('work_policies')
      .select(`
        leave_calculation_settings(*)
      `)
      .eq('policy_type', 'leave_calculation')
      .eq('is_active', true)
      .limit(1)
    
    if (error || !data || data.length === 0) {
      console.error('대체/보상휴가 설정 조회 실패:', error)
      return undefined
    }
    
    const settings = data[0]?.leave_calculation_settings?.[0]
    return settings || null
  } catch (error) {
    console.error('대체/보상휴가 설정 조회 오류:', error)
    return undefined
  }
}

/**
 * 월별 야간근무 수당 계산 (매월 지급)
 * @param nightHours 야간근무시간
 * @param hourlyRate 시급
 * @param nightRate 야간근무 가산률 (기본 1.5)
 * @returns 야간근무 수당
 */
export function calculateMonthlyNightAllowance(
  nightHours: number,
  hourlyRate: number,
  nightRate: number = 1.5
): number {
  return Math.round(nightHours * hourlyRate * nightRate)
}

/**
 * 3개월 탄력근무제 초과근무 수당 계산
 * @param quarterlyWorkHours 3개월 총 근무시간
 * @param standardWeeklyHours 주당 기준 근로시간 (40시간)
 * @param totalNightHours 3개월 총 야간근무시간 (이미 수당 지급됨)
 * @param totalSubstituteHours 3개월 총 대체휴가 시간 (이미 휴가 지급됨)
 * @param totalCompensatoryHours 3개월 총 보상휴가 시간 (이미 휴가 지급됨)
 * @param hourlyRate 시급
 * @param overtimeRate 초과근무 가산률 (기본 1.5)
 * @returns 지급할 초과근무 수당
 */
export function calculateQuarterlyOvertimeAllowance(
  quarterlyWorkHours: number,
  standardWeeklyHours: number = 40,
  totalNightHours: number = 0,
  totalSubstituteHours: number = 0,
  totalCompensatoryHours: number = 0,
  hourlyRate: number,
  overtimeRate: number = 1.5
): number {
  const totalWeeks = 12 // 3개월 = 12주
  const standardTotalHours = standardWeeklyHours * totalWeeks // 480시간
  
  // 기준시간 초과분 계산
  const excessHours = Math.max(0, quarterlyWorkHours - standardTotalHours)
  
  // 이미 지급된 시간들을 차감 (중복 지급 방지)
  // 1. 야간근무시간 (이미 야간수당으로 지급됨)
  // 2. 대체휴가 시간 (이미 휴가로 지급됨) 
  // 3. 보상휴가 시간 (이미 휴가로 지급됨)
  const alreadyPaidHours = totalNightHours + totalSubstituteHours + totalCompensatoryHours
  const finalOvertimeHours = Math.max(0, excessHours - alreadyPaidHours)
  
  // 초과근무 수당 = 최종 초과시간 × 시급 × 1.5배
  return Math.round(finalOvertimeHours * hourlyRate * overtimeRate)
}
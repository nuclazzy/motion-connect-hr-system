// 탄력근무제 관련 유틸리티 함수들
// 근무시간관리 웹앱.md 파일의 Google Apps Script 로직을 TypeScript로 이식

export interface FlexibleWorkSettings {
  start: string // 'YYYY-MM-DD' 형식
  end: string   // 'YYYY-MM-DD' 형식
  standard_weekly_hours: number // 주당 기준 근로시간 (보통 40시간)
}

export interface WorkTimeCalculation {
  basic_hours: number
  overtime_hours: number
  night_hours: number
  dinner_break_detected: boolean
  overtime_threshold_used: number // 8 or 12
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
): FlexibleWorkSettings | null {
  for (const setting of flexSettings) {
    if (date >= setting.start && date <= setting.end) {
      return setting
    }
  }
  return null
}

/**
 * 초과근무 임계값 결정 (근무시간관리 웹앱.md의 getOvertimeThreshold_ 함수 이식)
 * @param date 근무 날짜 (YYYY-MM-DD 형식)
 * @param flexSettings 탄력근무제 설정 배열
 * @returns 초과근무 임계값 (시간)
 */
export function getOvertimeThreshold(
  date: string,
  flexSettings: FlexibleWorkSettings[]
): number {
  const flexSetting = getFlexibleWorkSetting(date, flexSettings)
  
  if (flexSetting) {
    // 탄력근무제 기간 중에는 12시간 기준
    return 12
  } else {
    // 일반 근무 기간에는 8시간 기준
    return 8
  }
}

/**
 * 야간근무시간 계산 (22:00-06:00)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)
 * @returns 야간근무시간 (시간 단위)
 */
export function calculateNightHours(
  checkInTime: string,
  checkOutTime: string
): number {
  if (!checkInTime || !checkOutTime) return 0
  
  const nightStart = 22 // 22:00
  const nightEnd = 6   // 06:00 (다음날)
  
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
 * 저녁식사 시간 자동 감지 (근무시간관리 웹앱.md 로직 이식)
 * @param checkInTime 출근 시간 (HH:MM 형식)
 * @param checkOutTime 퇴근 시간 (HH:MM 형식)
 * @param totalWorkHours 총 근무시간
 * @returns 저녁식사 시간이 감지되었는지 여부
 */
export function detectDinnerBreak(
  checkInTime: string,
  checkOutTime: string,
  totalWorkHours: number
): boolean {
  if (!checkInTime || !checkOutTime || totalWorkHours < 8) {
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
  
  const dinnerTime = 19 // 19:00
  
  // 조건: 8시간 이상 근무 AND 19:00 시점에 회사에 있었던 경우
  const wasAtOfficeAt19 = checkIn <= dinnerTime && checkOut >= dinnerTime
  
  return wasAtOfficeAt19
}

/**
 * 근무시간 계산 (탄력근무제 고려)
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
      dinner_break_detected: false,
      overtime_threshold_used: 8
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
  
  // 저녁식사 시간 감지 및 차감
  const dinnerBreakDetected = detectDinnerBreak(checkInTime, checkOutTime, totalHours)
  if (dinnerBreakDetected) {
    totalHours -= 1 // 1시간 차감
  }
  
  // 야간근무시간 계산
  const nightHours = calculateNightHours(checkInTime, checkOutTime)
  
  // 초과근무 임계값 결정
  const overtimeThreshold = getOvertimeThreshold(workDate, flexSettings)
  
  // 기본근무시간과 초과근무시간 분리
  const basicHours = Math.min(totalHours, overtimeThreshold)
  const overtimeHours = Math.max(0, totalHours - overtimeThreshold)
  
  return {
    basic_hours: Math.max(0, Math.round(basicHours * 10) / 10),
    overtime_hours: Math.round(overtimeHours * 10) / 10,
    night_hours: nightHours,
    dinner_break_detected: dinnerBreakDetected,
    overtime_threshold_used: overtimeThreshold
  }
}

/**
 * 현재 활성화된 탄력근무제 기간 조회
 * @returns 현재 활성화된 탄력근무제 설정 (2025년 2분기)
 */
export function getCurrentFlexibleWorkSettings(): FlexibleWorkSettings[] {
  // 현재는 하드코딩, 추후 데이터베이스에서 조회하도록 수정 예정
  return [
    {
      start: '2025-06-01',
      end: '2025-08-31',
      standard_weekly_hours: 40
    }
  ]
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
 * @param hourlyRate 시급
 * @param overtimeRate 초과근무 가산률 (기본 1.5)
 * @returns 지급할 초과근무 수당
 */
export function calculateQuarterlyOvertimeAllowance(
  quarterlyWorkHours: number,
  standardWeeklyHours: number = 40,
  totalNightHours: number = 0,
  hourlyRate: number,
  overtimeRate: number = 1.5
): number {
  const totalWeeks = 12 // 3개월 = 12주
  const standardTotalHours = standardWeeklyHours * totalWeeks // 480시간
  
  // 기준시간 초과분 계산
  const excessHours = Math.max(0, quarterlyWorkHours - standardTotalHours)
  
  // 야간근무시간만큼 차감 (이미 야간수당으로 지급됨)
  const finalOvertimeHours = Math.max(0, excessHours - totalNightHours)
  
  // 초과근무 수당 = 최종 초과시간 × 시급 × 1.5배
  return Math.round(finalOvertimeHours * hourlyRate * overtimeRate)
}
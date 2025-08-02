/**
 * 초과근무 보상휴가 계산 로직
 * 근로기준법에 따른 토요일/일요일/공휴일 근무에 대한 보상휴가 계산
 */

interface OvertimeCalculationResult {
  actualWorkHours: number // 실제 근무시간
  compensationHours: number // 지급할 보상휴가 시간
  leaveType: 'substitute' | 'compensatory' // 대체휴가 또는 보상휴가
  breakdown: {
    totalStayHours: number // 총 체류시간
    basicBreakHours: number // 기본 휴게시간 (1시간)
    dinnerBreakHours: number // 저녁식사 휴게시간 (해당 시)
    regularHours: number // 기본 8시간 분량
    overtimeHours: number // 초과 시간
    regularCompensation: number // 기본시간 보상
    overtimeCompensation: number // 초과시간 보상
  }
}

/**
 * 요일 확인 함수
 * @param dateString YYYY-MM-DD 형식의 날짜 문자열
 * @returns 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일)
 */
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString)
  return date.getDay()
}

/**
 * 시간 차이 계산 (시간 단위)
 * @param startTime HH:MM 형식의 시작 시간
 * @param endTime HH:MM 형식의 종료 시간
 * @returns 시간차 (시간 단위)
 */
function calculateHourDifference(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  
  return (endMinutes - startMinutes) / 60
}

/**
 * 초과근무 보상휴가 계산
 * @param workDate 근무일 (YYYY-MM-DD)
 * @param startTime 시작시간 (HH:MM)
 * @param endTime 종료시간 (HH:MM)
 * @param hasDinner 저녁식사 여부 (오후 6시 이후 근무 시)
 * @returns 보상휴가 계산 결과
 */
export function calculateOvertimeLeave(
  workDate: string,
  startTime: string,
  endTime: string,
  hasDinner: boolean = false
): OvertimeCalculationResult {
  
  // 총 체류시간 계산
  const totalStayHours = calculateHourDifference(startTime, endTime)
  
  // 휴게시간 계산
  const basicBreakHours = 1 // 기본 휴게시간 1시간
  const dinnerBreakHours = hasDinner ? 1 : 0 // 저녁식사 시 추가 1시간
  const totalBreakHours = basicBreakHours + dinnerBreakHours
  
  // 실제 근무시간 = 총 체류시간 - 휴게시간
  const actualWorkHours = Math.max(0, totalStayHours - totalBreakHours)
  
  // 요일 확인
  const dayOfWeek = getDayOfWeek(workDate)
  const isSaturday = dayOfWeek === 6 // 토요일
  const isSundayOrHoliday = dayOfWeek === 0 // 일요일 (공휴일 판단은 별도 로직 필요)
  
  // 기본 8시간과 초과시간 분리
  const regularHours = Math.min(actualWorkHours, 8)
  const overtimeHours = Math.max(0, actualWorkHours - 8)
  
  let regularCompensation: number
  let overtimeCompensation: number
  let leaveType: 'substitute' | 'compensatory'
  
  if (isSaturday) {
    // 토요일 - 대체휴가
    leaveType = 'substitute'
    regularCompensation = regularHours * 1.0 // 8시간까지 1.0배
    overtimeCompensation = overtimeHours * 1.5 // 8시간 초과분 1.5배
  } else if (isSundayOrHoliday) {
    // 일요일/공휴일 - 보상휴가
    leaveType = 'compensatory'
    regularCompensation = regularHours * 1.5 // 8시간까지 1.5배
    overtimeCompensation = overtimeHours * 2.0 // 8시간 초과분 2.0배
  } else {
    // 평일은 초과근무 신청 대상이 아님 (예외 처리)
    leaveType = 'compensatory'
    regularCompensation = 0
    overtimeCompensation = 0
  }
  
  const compensationHours = regularCompensation + overtimeCompensation
  
  return {
    actualWorkHours: Math.round(actualWorkHours * 100) / 100, // 소수점 2자리까지
    compensationHours: Math.round(compensationHours * 100) / 100,
    leaveType,
    breakdown: {
      totalStayHours: Math.round(totalStayHours * 100) / 100,
      basicBreakHours,
      dinnerBreakHours,
      regularHours: Math.round(regularHours * 100) / 100,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      regularCompensation: Math.round(regularCompensation * 100) / 100,
      overtimeCompensation: Math.round(overtimeCompensation * 100) / 100
    }
  }
}

/**
 * 보상휴가 타입에 따른 한글명 반환
 */
export function getLeaveTypeName(leaveType: 'substitute' | 'compensatory'): string {
  return leaveType === 'substitute' ? '대체휴가' : '보상휴가'
}

/**
 * 요일에 따른 설명 반환
 */
export function getWorkDayDescription(workDate: string): string {
  const dayOfWeek = getDayOfWeek(workDate)
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  
  return dayNames[dayOfWeek]
}
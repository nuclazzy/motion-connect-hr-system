/**
 * 시간을 휴가 일수로 변환하는 유틸리티
 * 8시간 = 1일 기준으로 계산
 * 예: 4시간->0.5일, 6시간->0.75일, 8시간->1일, 12시간->1.5일, 16시간->2일
 */

export function hoursToLeaveDays(hours: number): number {
  if (hours <= 0) return 0
  
  // 8시간 = 1일 기준으로 계산
  return hours / 8
}

/**
 * 휴가 일수를 시간으로 변환
 * 0.5일 = 4시간, 1일 = 8시간
 */
export function leaveDaysToHours(days: number): number {
  return days * 8
}

/**
 * 대체휴가/보상휴가 상태 확인
 * @param hours 보유 시간
 * @returns 상태 정보
 */
export function getLeaveStatus(hours: number) {
  const days = hoursToLeaveDays(hours)
  const needsAlert = hours >= 4 // 4시간 이상이면 알림 필요
  
  return {
    hours,
    days,
    needsAlert,
    displayText: days > 0 ? `${days}일 (${hours}시간)` : `${hours}시간`
  }
}

/**
 * 휴가 종류별 한글명
 */
export const LEAVE_TYPE_NAMES = {
  substitute: '대체휴가',
  compensatory: '보상휴가',
  annual: '연차',
  sick: '병가'
} as const

/**
 * 시간 단위 휴가 사용 시 차감할 시간 계산
 * @param days 사용할 일수 (0.5, 1, 1.5, 2 등)
 * @returns 차감할 시간
 */
export function calculateHoursToDeduct(days: number): number {
  return leaveDaysToHours(days)
}
/**
 * 시간 관련 유틸리티 함수들
 */

/**
 * "익일 HH:mm:ss" 형식을 "HH:mm:ss" 형식으로 변환
 * 예: "익일 04:45:48" → "28:45:48"
 * @param timeStr 시간 문자열
 * @returns 변환된 시간 문자열
 */
export function convertNextDayTimeFormat(timeStr: string): string {
  if (!timeStr) return timeStr
  
  // "익일" 또는 "(익일" 패턴 확인
  const nextDayMatch = timeStr.match(/\(?익일\s*(\d{2}):(\d{2}):(\d{2})\)?/)
  
  if (nextDayMatch) {
    const hours = parseInt(nextDayMatch[1])
    const minutes = nextDayMatch[2]
    const seconds = nextDayMatch[3]
    
    // 익일 시간은 24시간을 더해서 표시
    const adjustedHours = hours + 24
    
    return `${adjustedHours.toString().padStart(2, '0')}:${minutes}:${seconds}`
  }
  
  return timeStr
}

/**
 * Date 객체에서 자정을 넘는 경우를 고려한 시간 문자열 생성
 * @param date Date 객체
 * @param baseDate 기준일 (출근일)
 * @returns "HH:mm:ss" 형식의 시간 문자열
 */
export function formatTimeWithNextDay(date: Date, baseDate: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()
  
  // 날짜가 다른 경우 확인
  const dateDiff = Math.floor((date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24))
  
  if (dateDiff > 0) {
    // 다음날인 경우 24시간 추가
    const adjustedHours = hours + (24 * dateDiff)
    return `${adjustedHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * 근무시간 계산 (자정 넘는 경우 고려)
 * @param checkIn 출근 시간
 * @param checkOut 퇴근 시간
 * @param breakMinutes 휴게시간 (분)
 * @returns 근무시간 (시간 단위)
 */
export function calculateWorkHoursWithMidnight(
  checkIn: Date | string,
  checkOut: Date | string,
  breakMinutes: number = 0
): number {
  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn
  const checkOutDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut
  
  // 퇴근 시간이 출근 시간보다 이른 경우 다음날로 간주
  let adjustedCheckOut = new Date(checkOutDate)
  if (checkOutDate < checkInDate) {
    adjustedCheckOut.setDate(adjustedCheckOut.getDate() + 1)
  }
  
  const workMilliseconds = adjustedCheckOut.getTime() - checkInDate.getTime()
  const workMinutes = workMilliseconds / (1000 * 60)
  const netWorkMinutes = workMinutes - breakMinutes
  
  return Math.max(0, netWorkMinutes / 60)
}

/**
 * 야간근무 시간 계산 (22:00 ~ 06:00)
 * @param checkIn 출근 시간
 * @param checkOut 퇴근 시간
 * @returns 야간근무 시간 (시간 단위)
 */
export function calculateNightWorkHours(
  checkIn: Date | string,
  checkOut: Date | string
): number {
  const checkInDate = typeof checkIn === 'string' ? new Date(checkIn) : checkIn
  const checkOutDate = typeof checkOut === 'string' ? new Date(checkOut) : checkOut
  
  // 퇴근 시간이 출근 시간보다 이른 경우 다음날로 간주
  let adjustedCheckOut = new Date(checkOutDate)
  if (checkOutDate < checkInDate) {
    adjustedCheckOut.setDate(adjustedCheckOut.getDate() + 1)
  }
  
  let nightMinutes = 0
  const current = new Date(checkInDate)
  
  while (current < adjustedCheckOut) {
    const hour = current.getHours()
    const minute = current.getMinutes()
    
    // 22:00 ~ 23:59 또는 00:00 ~ 05:59
    if (hour >= 22 || hour < 6) {
      // 다음 정각까지의 시간 계산
      const nextHour = new Date(current)
      nextHour.setHours(hour + 1, 0, 0, 0)
      
      const endTime = nextHour > adjustedCheckOut ? adjustedCheckOut : nextHour
      const diffMinutes = (endTime.getTime() - current.getTime()) / (1000 * 60)
      
      nightMinutes += diffMinutes
    }
    
    // 다음 시간으로 이동
    current.setHours(current.getHours() + 1, 0, 0, 0)
  }
  
  return nightMinutes / 60
}

/**
 * 연속 근무 체크 (4시간 이내 재출근)
 * @param lastCheckOut 이전 퇴근 시간
 * @param currentCheckIn 현재 출근 시간
 * @returns 연속 근무 여부
 */
export function isContinuousWork(
  lastCheckOut: Date | string,
  currentCheckIn: Date | string
): boolean {
  const lastOut = typeof lastCheckOut === 'string' ? new Date(lastCheckOut) : lastCheckOut
  const currentIn = typeof currentCheckIn === 'string' ? new Date(currentCheckIn) : currentCheckIn
  
  const diffHours = (currentIn.getTime() - lastOut.getTime()) / (1000 * 60 * 60)
  
  return diffHours >= 0 && diffHours <= 4
}

/**
 * 시간 문자열을 분 단위로 변환
 * "HH:mm:ss" 또는 "28:45:00" 형식 지원
 * @param timeStr 시간 문자열
 * @returns 분 단위 시간
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0
  
  const parts = timeStr.split(':')
  if (parts.length !== 3) return 0
  
  const hours = parseInt(parts[0]) || 0
  const minutes = parseInt(parts[1]) || 0
  const seconds = parseInt(parts[2]) || 0
  
  return hours * 60 + minutes + seconds / 60
}

/**
 * 분 단위를 시간 문자열로 변환
 * @param minutes 분 단위 시간
 * @returns "HH:mm:ss" 형식의 시간 문자열
 */
export function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  const secs = Math.round((minutes % 1) * 60)
  
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
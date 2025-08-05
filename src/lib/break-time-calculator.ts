// 휴게시간 계산 유틸리티
// Google Apps Script 로직 완전 구현

/**
 * 휴게시간을 계산합니다
 * 수정된 로직 구현
 * 
 * 규칙:
 * 1. 오후 12시(12:00) 이후 출근 시: 휴게시간 0분
 * 2. 그 외의 경우: 8시간까지만 단계적으로 부여
 *    - 4시간 이상 8시간 미만: 30분
 *    - 8시간 이상: 60분 (최대)
 * 3. 8시간 초과 시: 저녁식사 여부에 따라 추가 60분 결정
 */
export function calculateBreakMinutes(
  checkInTime: string,
  checkOutTime: string,
  hadDinner: boolean = false
): number {
  if (!checkInTime || !checkOutTime) {
    return 0
  }

  try {
    // 시간 문자열을 Date 객체로 변환
    const checkIn = parseTimeString(checkInTime)
    const checkOut = parseTimeString(checkOutTime)

    // 익일 퇴근 처리
    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }

    // 총 근무 시간 (분 단위)
    const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60)
    const totalHours = totalMinutes / 60

    // 1. 오후 12시 이후 출근 확인
    const checkInHour = checkIn.getHours()
    if (checkInHour >= 12) {
      // 12시 이후 출근 시 휴게시간 0분 (저녁식사 제외)
      return hadDinner ? 60 : 0
    }

    // 2. 기본 휴게시간 계산 (8시간까지만)
    let breakMinutes = 0
    
    if (totalHours >= 4 && totalHours < 8) {
      breakMinutes = 30 // 4시간 이상 8시간 미만: 30분
    } else if (totalHours >= 8) {
      breakMinutes = 60 // 8시간 이상: 60분 (최대)
    }

    // 3. 8시간 초과 시 저녁식사 여부에 따라 추가 1시간
    if (totalHours > 8 && hadDinner) {
      breakMinutes += 60 // 저녁식사 시간 추가
    }

    return breakMinutes

  } catch (error) {
    console.error('휴게시간 계산 오류:', error)
    return hadDinner ? 60 : 0
  }
}

/**
 * 시간 문자열을 Date 객체로 변환
 * 지원 형식: HH:MM:SS, HH:MM, 25:16:00 (익일 시간)
 */
function parseTimeString(timeStr: string): Date {
  const now = new Date()
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // 25:16:00 같은 익일 시간 처리
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':')
    let hours = parseInt(parts[0])
    const minutes = parseInt(parts[1]) || 0
    const seconds = parseInt(parts[2]) || 0

    // 24시 이상인 경우 (익일)
    if (hours >= 24) {
      hours = hours - 24
      baseDate.setDate(baseDate.getDate() + 1)
    }

    baseDate.setHours(hours, minutes, seconds, 0)
    return baseDate
  }

  // 기본 시간 형식 처리
  const time = new Date(`1970-01-01T${timeStr}`)
  baseDate.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0)
  return baseDate
}

/**
 * 순수 근무시간 계산 (총 근무시간 - 휴게시간)
 */
export function calculateNetWorkHours(
  checkInTime: string,
  checkOutTime: string,
  hadDinner: boolean = false
): number {
  if (!checkInTime || !checkOutTime) {
    return 0
  }

  try {
    const checkIn = parseTimeString(checkInTime)
    const checkOut = parseTimeString(checkOutTime)

    // 익일 퇴근 처리
    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }

    // 총 근무 시간 (분 단위)
    const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60)
    
    // 휴게시간 계산
    const breakMinutes = calculateBreakMinutes(checkInTime, checkOutTime, hadDinner)
    
    // 순수 근무시간 (시간 단위, 소수점 1자리)
    const netWorkHours = (totalMinutes - breakMinutes) / 60
    
    return Math.round(netWorkHours * 10) / 10 // 소수점 1자리 반올림
    
  } catch (error) {
    console.error('순수 근무시간 계산 오류:', error)
    return 0
  }
}

/**
 * 수정된 휴게시간 로직 테스트
 */
export function testBreakTimeCalculation() {
  const testCases = [
    // 12시 이후 출근
    { checkIn: '13:00:00', checkOut: '18:00:00', hadDinner: false, expected: 0 },
    { checkIn: '14:30:00', checkOut: '20:00:00', hadDinner: false, expected: 0 },
    { checkIn: '15:00:00', checkOut: '24:00:00', hadDinner: true, expected: 60 },
    
    // 오전 출근 - 8시간까지만 단계적 계산
    { checkIn: '09:00:00', checkOut: '13:00:00', hadDinner: false, expected: 30 }, // 4시간
    { checkIn: '09:00:00', checkOut: '17:00:00', hadDinner: false, expected: 60 }, // 8시간
    { checkIn: '08:00:00', checkOut: '20:00:00', hadDinner: false, expected: 60 }, // 12시간 (8시간 초과, 저녁식사 없음)
    { checkIn: '08:00:00', checkOut: '21:00:00', hadDinner: false, expected: 60 }, // 13시간 (8시간 초과, 저녁식사 없음)
    
    // 8시간 초과 + 저녁식사
    { checkIn: '09:00:00', checkOut: '19:00:00', hadDinner: true, expected: 120 }, // 10시간 + 저녁 (60 + 60)
    { checkIn: '08:00:00', checkOut: '20:00:00', hadDinner: true, expected: 120 }, // 12시간 + 저녁 (60 + 60)
    { checkIn: '14:00:00', checkOut: '22:00:00', hadDinner: true, expected: 60 },  // 12시 이후 + 저녁
    
    // 8시간 정확히
    { checkIn: '09:00:00', checkOut: '17:00:00', hadDinner: true, expected: 60 }, // 8시간 정확히, 저녁식사 없음 (8시간 초과가 아니므로)
  ]

  console.log('🧪 수정된 휴게시간 계산 테스트 시작')
  
  for (const testCase of testCases) {
    const result = calculateBreakMinutes(testCase.checkIn, testCase.checkOut, testCase.hadDinner)
    const passed = result === testCase.expected
    
    console.log(
      `${passed ? '✅' : '❌'} ${testCase.checkIn}-${testCase.checkOut} (저녁:${testCase.hadDinner}) ` +
      `예상:${testCase.expected}분, 실제:${result}분`
    )
  }
}
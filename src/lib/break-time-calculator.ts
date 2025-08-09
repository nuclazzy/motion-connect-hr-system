// 휴게시간 계산 유틸리티
// Google Apps Script 로직 완전 구현

/**
 * 휴게시간을 계산합니다
 * 수정된 로직 구현
 * 
 * 규칙:
 * 1. 점심시간 (12:00~13:00)
 *    - 4시간 미만 근무: 휴게시간 없음
 *    - 5시간 이상 근무: 자동 1시간 차감
 * 2. 저녁시간 (18:00~19:00)
 *    - 저녁식사 플래그(hadDinner)가 true인 경우만 1시간 차감
 *    - 8시간 이상 근무 + 18:00 이전 출근 + 19:00 이후 퇴근 조건 충족 시 플래그 자동 설정
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

    let breakMinutes = 0

    // 1. 점심시간: 5시간 이상 근무 시 1시간 차감
    if (totalHours >= 5) {
      breakMinutes = 60 // 점심시간 1시간
    }

    // 2. 저녁시간: 플래그가 true인 경우만 1시간 추가 차감
    if (hadDinner) {
      breakMinutes += 60 // 저녁시간 1시간 추가
    }

    return breakMinutes

  } catch (error) {
    console.error('휴게시간 계산 오류:', error)
    return hadDinner ? 60 : 0
  }
}

/**
 * 저녁식사 플래그 자동 설정 여부 판단
 * 8시간 이상 근무 + 18:00 이전 출근 + 19:00 이후 퇴근
 */
export function shouldAutoSetDinnerFlag(
  checkInTime: string,
  checkOutTime: string
): boolean {
  if (!checkInTime || !checkOutTime) {
    return false
  }

  try {
    const checkIn = parseTimeString(checkInTime)
    const checkOut = parseTimeString(checkOutTime)

    // 익일 퇴근 처리
    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }

    // 총 근무 시간 확인
    const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60)
    const totalHours = totalMinutes / 60

    // 8시간 이상 근무 확인
    if (totalHours < 8) {
      return false
    }

    // 18:00 이전 출근 확인
    const checkInHour = checkIn.getHours()
    const checkInMinute = checkIn.getMinutes()
    if (checkInHour > 18 || (checkInHour === 18 && checkInMinute > 0)) {
      return false
    }

    // 19:00 이후 퇴근 확인
    const checkOutHour = checkOut.getHours()
    const checkOutMinute = checkOut.getMinutes()
    if (checkOutHour < 19 && checkOut.getDate() === checkIn.getDate()) {
      return false
    }

    return true

  } catch (error) {
    console.error('저녁식사 플래그 판단 오류:', error)
    return false
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
    // 4시간 미만 근무 - 휴게시간 없음
    { checkIn: '09:00:00', checkOut: '12:00:00', hadDinner: false, expected: 0 }, // 3시간
    { checkIn: '09:00:00', checkOut: '12:30:00', hadDinner: false, expected: 0 }, // 3.5시간
    { checkIn: '09:00:00', checkOut: '12:59:00', hadDinner: false, expected: 0 }, // 3시간 59분
    
    // 5시간 이상 근무 - 점심시간 1시간
    { checkIn: '09:00:00', checkOut: '14:00:00', hadDinner: false, expected: 60 }, // 5시간
    { checkIn: '09:00:00', checkOut: '15:00:00', hadDinner: false, expected: 60 }, // 6시간
    { checkIn: '09:00:00', checkOut: '17:00:00', hadDinner: false, expected: 60 }, // 8시간
    { checkIn: '09:00:00', checkOut: '18:00:00', hadDinner: false, expected: 60 }, // 9시간
    
    // 5시간 이상 + 저녁식사 플래그
    { checkIn: '09:00:00', checkOut: '19:00:00', hadDinner: true, expected: 120 }, // 10시간 + 저녁 (60 + 60)
    { checkIn: '08:00:00', checkOut: '20:00:00', hadDinner: true, expected: 120 }, // 12시간 + 저녁 (60 + 60)
    { checkIn: '09:00:00', checkOut: '21:00:00', hadDinner: true, expected: 120 }, // 12시간 + 저녁
    
    // 4시간대 근무 + 저녁식사 플래그 (특수 케이스)
    { checkIn: '16:00:00', checkOut: '20:00:00', hadDinner: true, expected: 60 },  // 4시간 + 저녁 (0 + 60)
    { checkIn: '15:00:00', checkOut: '20:00:00', hadDinner: true, expected: 120 }, // 5시간 + 저녁 (60 + 60)
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
  
  console.log('\n🧪 저녁식사 플래그 자동 설정 테스트')
  
  const dinnerFlagTests = [
    // 조건 충족 케이스
    { checkIn: '09:00:00', checkOut: '19:00:00', expected: true },  // 8시간 이상 + 18:00 이전 출근 + 19:00 이후 퇴근
    { checkIn: '08:00:00', checkOut: '20:00:00', expected: true },
    { checkIn: '10:00:00', checkOut: '21:00:00', expected: true },
    { checkIn: '17:59:00', checkOut: '02:00:00', expected: true },  // 익일 퇴근도 가능
    
    // 조건 미충족 케이스
    { checkIn: '09:00:00', checkOut: '16:00:00', expected: false }, // 8시간 미만
    { checkIn: '18:01:00', checkOut: '02:00:00', expected: false }, // 18:00 이후 출근
    { checkIn: '09:00:00', checkOut: '18:59:00', expected: false },    // 19:00 이전 퇴근
    { checkIn: '13:00:00', checkOut: '20:00:00', expected: false },  // 8시간 미만 (7시간)
  ]
  
  for (const testCase of dinnerFlagTests) {
    const result = shouldAutoSetDinnerFlag(testCase.checkIn, testCase.checkOut)
    const passed = result === testCase.expected
    
    console.log(
      `${passed ? '✅' : '❌'} ${testCase.checkIn}-${testCase.checkOut} ` +
      `예상:${testCase.expected}, 실제:${result}`
    )
  }
}
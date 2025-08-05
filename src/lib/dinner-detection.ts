// 저녁식사 자동 감지 유틸리티
// Google Apps Script 로직 완전 구현

import { calculateNetWorkHours } from './break-time-calculator'

/**
 * 저녁식사 자동 감지 로직
 * Google Apps Script의 정확한 로직 구현
 * 
 * 조건:
 * 1. 순수 근무시간 8시간 이상
 * 2. 출근시간 19:00 이전 (19:00 포함)
 * 3. 퇴근시간 19:00 이후
 * 4. 저녁식사 기록이 없는 경우
 */
export function detectDinnerEligibility(
  checkInTime: string,
  checkOutTime: string,
  currentDinnerStatus: string = '',
  hadDinner: boolean = false
): {
  isDinnerMissing: boolean
  netWorkHours: number
  checkInBefore19: boolean
  checkOutAfter19: boolean
  reason: string
} {
  if (!checkInTime || !checkOutTime) {
    return {
      isDinnerMissing: false,
      netWorkHours: 0,
      checkInBefore19: false,
      checkOutAfter19: false,
      reason: '출퇴근 시간 없음'
    }
  }

  try {
    // 순수 근무시간 계산 (현재 저녁식사 상태 반영)
    const netWorkHours = calculateNetWorkHours(checkInTime, checkOutTime, hadDinner)

    // 시간 파싱
    const checkIn = parseTimeString(checkInTime)
    const checkOut = parseTimeString(checkOutTime)

    // 19:00 기준시간
    const dinnerHourStart = new Date(checkIn)
    dinnerHourStart.setHours(19, 0, 0, 0)

    // 익일 퇴근 처리
    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }

    // 조건 확인
    const checkInBefore19 = checkIn <= dinnerHourStart
    const checkOutAfter19 = checkOut > dinnerHourStart
    const workHours8Plus = netWorkHours >= 8
    const noDinnerRecord = currentDinnerStatus === '' && !hadDinner

    // 저녁식사 누락 판정
    const isDinnerMissing = workHours8Plus && checkInBefore19 && checkOutAfter19 && noDinnerRecord

    let reason = ''
    if (!workHours8Plus) reason = `근무시간 부족 (${netWorkHours}h < 8h)`
    else if (!checkInBefore19) reason = '19시 이후 출근'
    else if (!checkOutAfter19) reason = '19시 이전 퇴근'
    else if (!noDinnerRecord) reason = '저녁식사 기록 있음'
    else if (isDinnerMissing) reason = '저녁식사 추가 가능'
    else reason = '조건 불만족'

    return {
      isDinnerMissing,
      netWorkHours,
      checkInBefore19,
      checkOutAfter19,
      reason
    }

  } catch (error) {
    console.error('저녁식사 감지 오류:', error)
    return {
      isDinnerMissing: false,
      netWorkHours: 0,
      checkInBefore19: false,
      checkOutAfter19: false,
      reason: `계산 오류: ${error}`
    }
  }
}

/**
 * 시간 문자열을 Date 객체로 변환
 */
function parseTimeString(timeStr: string): Date {
  const now = new Date()
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

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
 * 저녁식사 감지 결과를 UI 표시용으로 포맷
 */
export function formatDinnerDetectionResult(
  result: ReturnType<typeof detectDinnerEligibility>
): {
  showButton: boolean
  buttonText: string
  statusText: string
  className: string
} {
  if (result.isDinnerMissing) {
    return {
      showButton: true,
      buttonText: '저녁식사 추가',
      statusText: `저녁식사 기록 누락 (${result.netWorkHours}h 근무)`,
      className: 'missing-record dinner-missing'
    }
  }

  return {
    showButton: false,
    buttonText: '',
    statusText: result.reason,
    className: 'dinner-not-applicable'
  }
}

/**
 * Google Apps Script의 정확한 저녁식사 감지 로직 테스트
 */
export function testDinnerDetection() {
  const testCases = [
    // 저녁식사 감지되는 경우
    {
      checkIn: '09:00:00',
      checkOut: '19:30:00',
      dinnerStatus: '',
      hadDinner: false,
      expected: true,
      description: '정상케이스: 9시-19:30, 8시간+ 근무'
    },
    {
      checkIn: '08:00:00', 
      checkOut: '20:00:00',
      dinnerStatus: '',
      hadDinner: false,
      expected: true,
      description: '장시간 근무: 8시-20시'
    },
    
    // 저녁식사 감지되지 않는 경우
    {
      checkIn: '09:00:00',
      checkOut: '17:00:00',
      dinnerStatus: '',
      hadDinner: false,
      expected: false,
      description: '근무시간 부족: 8시간 미만'
    },
    {
      checkIn: '14:00:00',
      checkOut: '22:00:00',
      dinnerStatus: '',
      hadDinner: false,
      expected: false,
      description: '19시 이후 출근'
    },
    {
      checkIn: '09:00:00',
      checkOut: '18:00:00',
      dinnerStatus: '',
      hadDinner: false,
      expected: false,
      description: '19시 이전 퇴근'
    },
    {
      checkIn: '09:00:00',
      checkOut: '20:00:00',
      dinnerStatus: 'O',
      hadDinner: false,
      expected: false,
      description: '이미 저녁식사 기록 있음'
    },
    {
      checkIn: '09:00:00',
      checkOut: '20:00:00',
      dinnerStatus: '',
      hadDinner: true,
      expected: false,
      description: '저녁식사 플래그 true'
    }
  ]

  console.log('🍽️ 저녁식사 감지 로직 테스트 시작')
  
  for (const testCase of testCases) {
    const result = detectDinnerEligibility(
      testCase.checkIn,
      testCase.checkOut,
      testCase.dinnerStatus,
      testCase.hadDinner
    )
    
    const passed = result.isDinnerMissing === testCase.expected
    const formatted = formatDinnerDetectionResult(result)
    
    console.log(
      `${passed ? '✅' : '❌'} ${testCase.description}`
    )
    console.log(
      `   ${testCase.checkIn}-${testCase.checkOut} → ` +
      `감지:${result.isDinnerMissing}, 이유:${result.reason}`
    )
    
    if (result.isDinnerMissing) {
      console.log(`   UI: "${formatted.buttonText}" 버튼 표시`)
    }
  }
}
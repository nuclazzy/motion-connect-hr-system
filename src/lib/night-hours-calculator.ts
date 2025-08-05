// 야간근무시간 계산 유틸리티
// Google Apps Script 로직 완전 구현 - 30:00 형식 지원

/**
 * 야간근무시간을 계산합니다
 * Google Apps Script의 정확한 로직 구현
 * 
 * 규칙:
 * - 야간시간: 22:00 ~ 06:00 (다음날 06:00, 즉 30:00까지)
 * - 30:00 형식 지원 (다음날 06:00 = 30:00)
 * - 시간당 계산하여 정확한 야간시간 산출
 */
export function calculateNightHours(
  checkInTime: string,
  checkOutTime: string
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

    let nightHours = 0
    const currentTime = new Date(checkIn)

    // 시간별로 루프하면서 야간시간 체크
    while (currentTime < checkOut) {
      const hour = currentTime.getHours()
      
      // 야간시간 판정: 22시 이상 또는 6시 미만
      if (hour >= 22 || hour < 6) {
        nightHours += 1
      }
      
      // 다음 시간으로 이동
      currentTime.setHours(currentTime.getHours() + 1)
    }

    // 소수점 1자리로 반올림
    return Math.round(nightHours * 10) / 10

  } catch (error) {
    console.error('야간근무시간 계산 오류:', error)
    return 0
  }
}

/**
 * 시간 문자열을 Date 객체로 변환
 * 지원 형식: HH:MM:SS, HH:MM, 25:16:00 (익일 시간), 30:00:00 (다음날 06:00)
 */
function parseTimeString(timeStr: string): Date {
  const now = new Date()
  const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (timeStr.includes(':')) {
    const parts = timeStr.split(':')
    let hours = parseInt(parts[0])
    const minutes = parseInt(parts[1]) || 0
    const seconds = parseInt(parts[2]) || 0

    // 24시 이상인 경우 (익일) - 30:00은 다음날 06:00
    if (hours >= 24) {
      const adjustedHours = hours - 24
      baseDate.setDate(baseDate.getDate() + 1)
      baseDate.setHours(adjustedHours, minutes, seconds, 0)
    } else {
      baseDate.setHours(hours, minutes, seconds, 0)
    }

    return baseDate
  }

  // 기본 시간 형식 처리
  const time = new Date(`1970-01-01T${timeStr}`)
  baseDate.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0)
  return baseDate
}

/**
 * 시간을 30:00 형식으로 변환 (다음날 06:00 = 30:00)
 */
export function formatTimeWith30Format(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  // 다음날인 경우 24시간을 더함
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  
  // 자정 이후인 경우 (00:00 ~ 06:00)
  if (hours < 6) {
    const adjustedHours = hours + 24
    return `${adjustedHours}:${minutes}:${seconds}`
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`
}

/**
 * 야간근무 시간대별 상세 분석
 */
export function analyzeNightWorkDetails(
  checkInTime: string,
  checkOutTime: string
): {
  totalNightHours: number
  nightPeriods: Array<{
    start: string
    end: string
    hours: number
    type: '당일야간' | '익일야간'
  }>
} {
  if (!checkInTime || !checkOutTime) {
    return { totalNightHours: 0, nightPeriods: [] }
  }

  try {
    const checkIn = parseTimeString(checkInTime)
    const checkOut = parseTimeString(checkOutTime)

    if (checkOut <= checkIn) {
      checkOut.setDate(checkOut.getDate() + 1)
    }

    const nightPeriods: Array<{
      start: string
      end: string
      hours: number
      type: '당일야간' | '익일야간'
    }> = []

    let totalNightHours = 0
    const currentTime = new Date(checkIn)

    let currentNightStart: Date | null = null
    let currentNightHours = 0

    while (currentTime < checkOut) {
      const hour = currentTime.getHours()
      const isNightTime = hour >= 22 || hour < 6

      if (isNightTime) {
        if (!currentNightStart) {
          currentNightStart = new Date(currentTime)
          currentNightHours = 0
        }
        currentNightHours += 1
        totalNightHours += 1
      } else if (currentNightStart) {
        // 야간시간 종료
        const endTime = new Date(currentTime)
        const isNextDay = currentNightStart.getDate() !== endTime.getDate() ||
                          currentNightStart.getHours() >= 22

        nightPeriods.push({
          start: formatTimeWith30Format(currentNightStart),
          end: formatTimeWith30Format(endTime),
          hours: currentNightHours,
          type: isNextDay ? '익일야간' : '당일야간'
        })

        currentNightStart = null
        currentNightHours = 0
      }

      currentTime.setHours(currentTime.getHours() + 1)
    }

    // 마지막 야간시간 처리
    if (currentNightStart && currentNightHours > 0) {
      const isNextDay = currentNightStart.getDate() !== checkOut.getDate() ||
                        currentNightStart.getHours() >= 22

      nightPeriods.push({
        start: formatTimeWith30Format(currentNightStart),
        end: formatTimeWith30Format(checkOut),
        hours: currentNightHours,
        type: isNextDay ? '익일야간' : '당일야간'
      })
    }

    return {
      totalNightHours: Math.round(totalNightHours * 10) / 10,
      nightPeriods
    }

  } catch (error) {
    console.error('야간근무 상세 분석 오류:', error)
    return { totalNightHours: 0, nightPeriods: [] }
  }
}

/**
 * Google Apps Script의 정확한 야간시간 로직 테스트
 */
export function testNightHoursCalculation() {
  const testCases = [
    // 일반적인 야간근무
    { checkIn: '22:00:00', checkOut: '06:00:00', expected: 8 }, // 22-06시 (8시간)
    { checkIn: '23:00:00', checkOut: '30:00:00', expected: 7 }, // 23-06시 (7시간, 30:00 형식)
    { checkIn: '20:00:00', checkOut: '25:00:00', expected: 3 }, // 22-01시만 야간 (3시간)
    
    // 부분 야간근무
    { checkIn: '21:00:00', checkOut: '23:00:00', expected: 1 }, // 22-23시만 야간 (1시간)
    { checkIn: '02:00:00', checkOut: '08:00:00', expected: 4 }, // 02-06시만 야간 (4시간)
    
    // 야간근무 없음
    { checkIn: '09:00:00', checkOut: '18:00:00', expected: 0 }, // 주간근무
    { checkIn: '06:00:00', checkOut: '22:00:00', expected: 0 }, // 야간시간 제외
    
    // 장시간 근무
    { checkIn: '08:00:00', checkOut: '32:00:00', expected: 8 }, // 24시간 근무 (22-06시만 야간)
  ]

  console.log('🌙 야간근무시간 계산 테스트 시작')
  
  for (const testCase of testCases) {
    const result = calculateNightHours(testCase.checkIn, testCase.checkOut)
    const passed = result === testCase.expected
    
    console.log(
      `${passed ? '✅' : '❌'} ${testCase.checkIn}-${testCase.checkOut} ` +
      `예상:${testCase.expected}시간, 실제:${result}시간`
    )

    if (!passed) {
      // 상세 분석 출력
      const details = analyzeNightWorkDetails(testCase.checkIn, testCase.checkOut)
      console.log('   상세:', details)
    }
  }
}
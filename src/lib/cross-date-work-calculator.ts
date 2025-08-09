/**
 * 자정 넘어가는 근무시간 계산 시스템
 * Critical Issue 해결: 날짜 경계를 넘나드는 근무의 정확한 처리
 */

import { getWorkDayType } from '@/lib/flexible-work-utils'

export interface CrossDateWorkCalculation {
  // 첫날 정보
  firstDate: string
  firstDayType: 'weekday' | 'saturday' | 'sunday_or_holiday'
  firstDayHours: number
  
  // 둘째날 정보  
  secondDate: string
  secondDayType: 'weekday' | 'saturday' | 'sunday_or_holiday'
  secondDayHours: number
  
  // 통합 계산 결과
  totalHours: number
  basicHours: number
  overtimeHours: number
  nightHours: number
  
  // 휴가 지급 (복합 규칙 적용)
  substituteHours: number
  compensatoryHours: number
  
  // 처리 방식
  splitMethod: 'single_day' | 'split_by_date' | 'complex_calculation'
  warnings: string[]
}

/**
 * 날짜 문자열에서 다음 날짜 계산
 */
function getNextDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
}

/**
 * 시간 범위가 자정을 넘는지 확인
 */
export function isCrossDateWork(checkInTime: string, checkOutTime: string): boolean {
  const checkIn = parseTime(checkInTime)
  const checkOut = parseTime(checkOutTime)
  return checkOut < checkIn
}

/**
 * HH:MM 형식을 숫자로 변환
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours + minutes / 60
}

/**
 * 숫자를 HH:MM 형식으로 변환
 */
function formatTime(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * 자정 넘어가는 근무시간을 날짜별로 분할
 */
export async function calculateCrossDateWork(
  workDate: string,
  checkInTime: string,
  checkOutTime: string,
  lunchBreakMinutes: number = 60
): Promise<CrossDateWorkCalculation> {
  
  const warnings: string[] = []
  
  if (!isCrossDateWork(checkInTime, checkOutTime)) {
    // 일반적인 단일 날짜 근무
    return calculateSingleDateWork(workDate, checkInTime, checkOutTime, lunchBreakMinutes)
  }
  
  const secondDate = getNextDate(workDate)
  const checkIn = parseTime(checkInTime)
  const checkOut = parseTime(checkOutTime)
  
  // 자정(24:00) 기준으로 분할
  const midnightSplit = 24
  
  // 첫날 근무시간 (출근 ~ 24:00)
  const firstDayWorkHours = midnightSplit - checkIn
  
  // 둘째날 근무시간 (00:00 ~ 퇴근)
  const secondDayWorkHours = checkOut
  
  // 총 근무시간
  const totalWorkHours = firstDayWorkHours + secondDayWorkHours
  
  // 🎯 복합 규칙 적용: 두 날짜의 성격에 따라 처리
  const firstDayType = getWorkDayType(workDate)
  const secondDayType = getWorkDayType(secondDate)
  
  // 점심시간 차감 (총 근무시간이 4시간 이상일 때만)
  let adjustedTotalHours = totalWorkHours
  if (totalWorkHours >= 4) {
    adjustedTotalHours -= (lunchBreakMinutes / 60)
  }
  
  // 저녁식사시간 차감 (8시간 이상이고 19:00 시점에 근무 중인 경우)
  const dinnerTime = 19
  let dinnerBreakDetected = false
  if (adjustedTotalHours >= 8) {
    // 19:00 시점에 근무 중인지 확인
    if (checkIn <= dinnerTime && (checkOut + 24) >= dinnerTime) {
      adjustedTotalHours -= 1
      dinnerBreakDetected = true
    }
  }
  
  // 야간근무시간 계산 (22:00-06:00)
  let nightHours = 0
  
  // 22:00-24:00 구간 (첫날)
  if (checkIn < 24 && checkIn <= 22) {
    const nightStart = Math.max(checkIn, 22)
    nightHours += 24 - nightStart
  }
  
  // 00:00-06:00 구간 (둘째날)  
  if (checkOut > 0) {
    const nightEnd = Math.min(checkOut, 6)
    nightHours += Math.max(0, nightEnd)
  }
  
  // 🚨 복합 휴가 계산 (가장 복잡한 부분)
  let { substituteHours, compensatoryHours, method, warnings: calcWarnings } = 
    calculateComplexLeaveHours(
      firstDayType, 
      secondDayType, 
      firstDayWorkHours, 
      secondDayWorkHours, 
      adjustedTotalHours
    )
  
  warnings.push(...calcWarnings)
  
  // 초과근무시간 계산 (복합 규칙)
  let basicHours = 0
  let overtimeHours = 0
  
  if (method === 'split_by_date') {
    // 날짜별로 분리 계산
    const firstDayBasic = Math.min(firstDayWorkHours, getOvertimeThreshold(firstDayType))
    const secondDayBasic = Math.min(secondDayWorkHours, getOvertimeThreshold(secondDayType))
    
    basicHours = firstDayBasic + secondDayBasic
    overtimeHours = Math.max(0, adjustedTotalHours - basicHours)
    
  } else {
    // 통합 계산 (보수적 접근)
    const mainThreshold = getOvertimeThreshold(firstDayType)
    basicHours = Math.min(adjustedTotalHours, mainThreshold)
    overtimeHours = Math.max(0, adjustedTotalHours - mainThreshold)
  }
  
  return {
    firstDate: workDate,
    firstDayType,
    firstDayHours: firstDayWorkHours,
    
    secondDate,
    secondDayType,
    secondDayHours: secondDayWorkHours,
    
    totalHours: adjustedTotalHours,
    basicHours: Math.round(basicHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    nightHours: Math.round(nightHours * 10) / 10,
    
    substituteHours: Math.round(substituteHours * 10) / 10,
    compensatoryHours: Math.round(compensatoryHours * 10) / 10,
    
    splitMethod: method,
    warnings
  }
}

/**
 * 단일 날짜 근무 계산 (기존 로직과 호환)
 */
async function calculateSingleDateWork(
  workDate: string,
  checkInTime: string,
  checkOutTime: string,
  lunchBreakMinutes: number
): Promise<CrossDateWorkCalculation> {
  
  const checkIn = parseTime(checkInTime)
  const checkOut = parseTime(checkOutTime)
  const totalWorkHours = checkOut - checkIn - (lunchBreakMinutes / 60)
  
  const workType = getWorkDayType(workDate)
  const overtimeThreshold = getOvertimeThreshold(workType)
  
  const basicHours = Math.min(totalWorkHours, overtimeThreshold)
  const overtimeHours = Math.max(0, totalWorkHours - overtimeThreshold)
  
  // 단일 날짜 휴가 계산
  let substituteHours = 0
  let compensatoryHours = 0
  
  if (workType === 'saturday') {
    substituteHours = totalWorkHours
  } else if (workType === 'sunday_or_holiday') {
    compensatoryHours = totalWorkHours * 1.5
  }
  
  return {
    firstDate: workDate,
    firstDayType: workType,
    firstDayHours: totalWorkHours,
    
    secondDate: workDate,
    secondDayType: workType,
    secondDayHours: 0,
    
    totalHours: totalWorkHours,
    basicHours: Math.round(basicHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    nightHours: 0, // 단순화
    
    substituteHours: Math.round(substituteHours * 10) / 10,
    compensatoryHours: Math.round(compensatoryHours * 10) / 10,
    
    splitMethod: 'single_day',
    warnings: []
  }
}

/**
 * 복합 휴가 계산 (두 날짜에 걸친 근무의 휴가 처리)
 */
function calculateComplexLeaveHours(
  firstDayType: string,
  secondDayType: string,
  firstDayHours: number,
  secondDayHours: number,
  totalHours: number
): {
  substituteHours: number
  compensatoryHours: number
  method: 'single_day' | 'split_by_date' | 'complex_calculation'
  warnings: string[]
} {
  
  const warnings: string[] = []
  
  // 🎯 케이스 1: 둘 다 평일 → 일반 근무
  if (firstDayType === 'weekday' && secondDayType === 'weekday') {
    return {
      substituteHours: 0,
      compensatoryHours: 0,
      method: 'single_day',
      warnings
    }
  }
  
  // 🎯 케이스 2: 한쪽이 토요일 → 복합 계산
  if (firstDayType === 'saturday' || secondDayType === 'saturday') {
    const saturdayHours = firstDayType === 'saturday' ? firstDayHours : secondDayHours
    const otherHours = firstDayType === 'saturday' ? secondDayHours : firstDayHours
    const otherType = firstDayType === 'saturday' ? secondDayType : firstDayType
    
    let substituteHours = saturdayHours // 토요일 부분은 대체휴가
    let compensatoryHours = 0
    
    if (otherType === 'sunday_or_holiday') {
      compensatoryHours = otherHours * 1.5 // 일요일/공휴일 부분은 보상휴가
      warnings.push(`토요일(${saturdayHours.toFixed(1)}h 대체휴가) + 일/공휴일(${otherHours.toFixed(1)}h 보상휴가) 복합 근무`)
    }
    
    return {
      substituteHours,
      compensatoryHours,
      method: 'split_by_date',
      warnings
    }
  }
  
  // 🎯 케이스 3: 한쪽이 일요일/공휴일 → 전체를 보상휴가로 처리 (유리한 조건)
  if (firstDayType === 'sunday_or_holiday' || secondDayType === 'sunday_or_holiday') {
    warnings.push(`일요일/공휴일이 포함된 자정 넘김 근무 - 전체를 보상휴가로 처리`)
    return {
      substituteHours: 0,
      compensatoryHours: totalHours * 1.5, // 전체에 1.5배 적용 (근로자에게 유리)
      method: 'complex_calculation',
      warnings
    }
  }
  
  // 🎯 케이스 4: 둘 다 특수일 → 개별 계산 후 합산
  return {
    substituteHours: 0,
    compensatoryHours: totalHours * 1.5,
    method: 'complex_calculation',
    warnings: [...warnings, '복잡한 휴가 계산 적용됨']
  }
}

/**
 * 근무 유형별 초과근무 임계값 반환
 */
function getOvertimeThreshold(workType: string): number {
  switch (workType) {
    case 'saturday':
    case 'sunday_or_holiday':
      return 8 // 휴일근무는 8시간 기준
    case 'weekday':
    default:
      return 8 // 기본 8시간 (탄력근무제는 별도 처리)
  }
}

/**
 * 자정 넘김 근무의 위험도 평가
 */
export function assessCrossDateWorkRisk(calculation: CrossDateWorkCalculation): {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  riskFactors: string[]
  recommendations: string[]
} {
  
  const risks: string[] = []
  const recommendations: string[] = []
  
  // 총 근무시간이 12시간 초과
  if (calculation.totalHours > 12) {
    risks.push(`장시간 근무 (${calculation.totalHours.toFixed(1)}시간)`)
    recommendations.push('근무시간 단축 또는 휴게시간 증가 필요')
  }
  
  // 야간근무시간이 4시간 초과
  if (calculation.nightHours > 4) {
    risks.push(`장시간 야간근무 (${calculation.nightHours.toFixed(1)}시간)`)
    recommendations.push('야간근무 제한 또는 다음날 휴식 권장')
  }
  
  // 서로 다른 성격의 날짜에 걸친 근무
  if (calculation.firstDayType !== calculation.secondDayType) {
    risks.push(`${calculation.firstDayType} → ${calculation.secondDayType} 복합 근무`)
    recommendations.push('휴가 지급 방식 직원과 사전 협의 필요')
  }
  
  // 경고 메시지가 있는 경우
  if (calculation.warnings.length > 0) {
    risks.push(...calculation.warnings)
  }
  
  // 위험도 레벨 결정
  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
  
  if (calculation.totalHours > 15 || calculation.nightHours > 6) {
    riskLevel = 'critical'
  } else if (calculation.totalHours > 12 || calculation.nightHours > 4 || risks.length > 2) {
    riskLevel = 'high'  
  } else if (calculation.totalHours > 10 || calculation.nightHours > 2 || risks.length > 0) {
    riskLevel = 'medium'
  }
  
  return {
    riskLevel,
    riskFactors: risks,
    recommendations
  }
}
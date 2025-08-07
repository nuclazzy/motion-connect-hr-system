/**
 * 병가 신청 시 연차 사용 권장 헬퍼 함수
 */

export interface SickLeaveRecommendation {
  hasAnnualLeave: boolean
  remainingAnnualDays: number
  recommendationType: 'use_annual' | 'use_sick' | 'no_leave'
  message: string
  isPaid: boolean
}

export function getSickLeaveRecommendation(
  annualDays: number,
  usedAnnualDays: number,
  sickDays: number = 60,
  usedSickDays: number = 0
): SickLeaveRecommendation {
  const remainingAnnualDays = annualDays - usedAnnualDays
  const remainingSickDays = sickDays - usedSickDays
  
  if (remainingAnnualDays > 0) {
    return {
      hasAnnualLeave: true,
      remainingAnnualDays,
      recommendationType: 'use_annual',
      message: `현재 ${remainingAnnualDays}일의 연차가 남아있습니다. 연차 사용 시 유급 휴가가 적용됩니다.`,
      isPaid: true
    }
  }
  
  if (remainingSickDays > 0) {
    return {
      hasAnnualLeave: false,
      remainingAnnualDays: 0,
      recommendationType: 'use_sick',
      message: `병가는 무급 휴가입니다. 진단서는 추후 제출해 주세요. (잔여: ${remainingSickDays}일)`,
      isPaid: false
    }
  }
  
  return {
    hasAnnualLeave: false,
    remainingAnnualDays: 0,
    recommendationType: 'no_leave',
    message: '사용 가능한 휴가가 없습니다.',
    isPaid: false
  }
}

// 병가 기본 지급일 (매년 60일)
export const ANNUAL_SICK_LEAVE_DAYS = 60
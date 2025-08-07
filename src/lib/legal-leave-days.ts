/**
 * 법정 경조사/공가 지급일 관리
 */

export interface LegalLeaveType {
  category: '경조사' | '공가'
  subType: string
  legalDays: number | string
  description?: string
  requiresDocument?: boolean
}

// 법정 경조사 휴가일 (근로기준법 기준)
export const LEGAL_LEAVE_DAYS: LegalLeaveType[] = [
  // 경조사
  {
    category: '경조사',
    subType: '본인 결혼',
    legalDays: 5,
    description: '본인의 결혼',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '자녀 결혼',
    legalDays: 1,
    description: '자녀의 결혼',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '배우자 출산',
    legalDays: 10,
    description: '배우자의 출산 (유급)',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '부모 사망',
    legalDays: 5,
    description: '부모(배우자 부모 포함)의 사망',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '배우자 사망',
    legalDays: 5,
    description: '배우자의 사망',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '자녀 사망',
    legalDays: 5,
    description: '자녀의 사망',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '조부모/외조부모 사망',
    legalDays: 3,
    description: '조부모 또는 외조부모의 사망',
    requiresDocument: true
  },
  {
    category: '경조사',
    subType: '형제자매 사망',
    legalDays: 3,
    description: '형제자매의 사망',
    requiresDocument: true
  },
  
  // 공가
  {
    category: '공가',
    subType: '예비군 훈련',
    legalDays: '실제 훈련일',
    description: '예비군 훈련 참가',
    requiresDocument: true
  },
  {
    category: '공가',
    subType: '민방위 훈련',
    legalDays: '실제 훈련일',
    description: '민방위 훈련 참가',
    requiresDocument: true
  },
  {
    category: '공가',
    subType: '법원 출두',
    legalDays: '실제 출두일',
    description: '법원 증인 출두 등',
    requiresDocument: true
  },
  {
    category: '공가',
    subType: '선거 투표',
    legalDays: 1,
    description: '공직선거 투표 참여',
    requiresDocument: false
  },
  {
    category: '공가',
    subType: '건강검진',
    legalDays: 1,
    description: '법정 건강검진',
    requiresDocument: true
  }
]

/**
 * 특정 경조사/공가 유형의 법정 지급일 조회
 */
export function getLegalLeaveDays(category: string, subType: string): number | string | null {
  const leave = LEGAL_LEAVE_DAYS.find(
    l => l.category === category && l.subType === subType
  )
  return leave ? leave.legalDays : null
}

/**
 * 카테고리별 하위 유형 목록 조회
 */
export function getLeaveSubTypes(category: '경조사' | '공가'): string[] {
  return LEGAL_LEAVE_DAYS
    .filter(l => l.category === category)
    .map(l => l.subType)
}
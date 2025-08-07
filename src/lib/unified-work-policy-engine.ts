/**
 * 통합 근무 정책 엔진
 * WorkPolicyManagement 설정을 기반으로 모든 근무 보상을 통일된 방식으로 계산
 */

import { supabase } from '@/lib/supabase'

// 근무 보상 항목 타입
export interface WorkCompensationItem {
  id?: string
  user_id: string
  work_date: string
  item_type: 'substitute_leave' | 'compensatory_leave' | 'overtime_allowance' | 'night_allowance'
  calculated_hours?: number  // 휴가 시간
  calculated_amount?: number // 수당 금액
  calculation_basis: string  // 계산 근거
  policy_reference: string   // 적용된 정책
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  created_at?: string
  
  // 상세 정보
  work_hours: number
  day_type: 'saturday' | 'sunday' | 'holiday' | 'weekday'
  is_flexible_period: boolean
  hourly_rate?: number
}

// 정책 설정 타입
interface PolicySettings {
  flexible_work: any
  overtime_night: any
  leave_calculation: any
}

export class UnifiedWorkPolicyEngine {
  private static instance: UnifiedWorkPolicyEngine
  private policyCache: PolicySettings | null = null
  private cacheExpiry: number = 0

  static getInstance(): UnifiedWorkPolicyEngine {
    if (!UnifiedWorkPolicyEngine.instance) {
      UnifiedWorkPolicyEngine.instance = new UnifiedWorkPolicyEngine()
    }
    return UnifiedWorkPolicyEngine.instance
  }

  /**
   * 현재 활성화된 정책 설정 조회 (캐싱 지원)
   */
  private async getPolicySettings(): Promise<PolicySettings> {
    const now = Date.now()
    
    // 캐시가 유효하면 재사용 (5분 캐시)
    if (this.policyCache && now < this.cacheExpiry) {
      return this.policyCache
    }

    try {
      // 병렬로 모든 정책 조회
      const [flexibleWork, overtimeNight, leaveCalculation] = await Promise.all([
        supabase.rpc('get_active_flexible_work_settings'),
        supabase.rpc('get_active_overtime_night_settings'),
        supabase.rpc('get_active_leave_calculation_settings')
      ])

      const settings: PolicySettings = {
        flexible_work: flexibleWork.data || {},
        overtime_night: overtimeNight.data || {},
        leave_calculation: leaveCalculation.data || {}
      }

      // 캐시 업데이트
      this.policyCache = settings
      this.cacheExpiry = now + (5 * 60 * 1000) // 5분 후 만료

      return settings
    } catch (error) {
      console.error('정책 설정 조회 오류:', error)
      
      // 기본값 반환
      return {
        flexible_work: { settlement_period_months: 3, weekly_standard_hours: 40 },
        overtime_night: { overtime_threshold_hours: 8, night_allowance_rate: 1.5 },
        leave_calculation: { 
          saturday_substitute_rate: 1.0, 
          sunday_compensatory_rate: 1.5,
          holiday_compensatory_rate: 1.5 
        }
      }
    }
  }

  /**
   * 특정 날짜의 모든 근무 보상 계산
   */
  async calculateWorkCompensation(
    userId: string,
    workDate: string,
    checkInTime: string,
    checkOutTime: string,
    hadDinner: boolean = false
  ): Promise<WorkCompensationItem[]> {
    const policies = await this.getPolicySettings()
    const results: WorkCompensationItem[] = []

    // 요일 및 공휴일 확인
    const dayType = await this.getDayType(workDate)
    const isFlexiblePeriod = await this.isFlexiblePeriod(workDate, policies.flexible_work)
    
    // 총 근무시간 계산
    const workHours = this.calculateActualWorkHours(checkInTime, checkOutTime, hadDinner)
    
    // 직원 정보 조회 (시급 등)
    const { data: userInfo } = await supabase
      .from('users')
      .select('hourly_rate, salary')
      .eq('id', userId)
      .single()

    const hourlyRate = userInfo?.hourly_rate || 0

    // 1. 대체휴가/보상휴가 계산 (주말/공휴일)
    if (dayType !== 'weekday') {
      const leaveItem = this.calculateLeaveCompensation(
        userId, workDate, workHours, dayType, isFlexiblePeriod, policies.leave_calculation
      )
      if (leaveItem) results.push(leaveItem)
    }

    // 2. 평일 초과근무 수당 계산
    if (dayType === 'weekday') {
      const overtimeThreshold = isFlexiblePeriod ? 12 : 8
      if (workHours > overtimeThreshold) {
        const overtimeItem = this.calculateOvertimeAllowance(
          userId, workDate, workHours, overtimeThreshold, hourlyRate, isFlexiblePeriod, policies
        )
        if (overtimeItem) results.push(overtimeItem)
      }
    }

    // 3. 야간근무 수당 계산 (모든 날짜)
    const nightHours = this.calculateNightHours(checkInTime, checkOutTime)
    if (nightHours > 0) {
      const nightItem = this.calculateNightAllowance(
        userId, workDate, nightHours, hourlyRate, policies.overtime_night
      )
      if (nightItem) results.push(nightItem)
    }

    return results
  }

  /**
   * 요일 및 공휴일 타입 확인
   */
  private async getDayType(workDate: string): Promise<'saturday' | 'sunday' | 'holiday' | 'weekday'> {
    const date = new Date(workDate)
    const dayOfWeek = date.getDay()

    if (dayOfWeek === 6) return 'saturday'
    if (dayOfWeek === 0) return 'sunday'

    // 공휴일 확인 (holidays 테이블 조회)
    const { data: holiday } = await supabase
      .from('holidays')
      .select('id')
      .eq('date', workDate)
      .single()

    if (holiday) return 'holiday'
    return 'weekday'
  }

  /**
   * 탄력근무제 기간 확인
   */
  private async isFlexiblePeriod(workDate: string, flexSettings: any): Promise<boolean> {
    if (!flexSettings.start_date || !flexSettings.end_date) return false
    
    return workDate >= flexSettings.start_date && workDate <= flexSettings.end_date
  }

  /**
   * 실제 근무시간 계산 (휴게시간 제외)
   */
  private calculateActualWorkHours(checkIn: string, checkOut: string, hadDinner: boolean): number {
    const [inHour, inMin] = checkIn.split(':').map(Number)
    const [outHour, outMin] = checkOut.split(':').map(Number)
    
    const inMinutes = inHour * 60 + inMin
    const outMinutes = outHour * 60 + outMin
    
    let totalMinutes = outMinutes - inMinutes
    
    // 기본 휴게시간 1시간 차감
    totalMinutes -= 60
    
    // 저녁식사 시간 차감 (30분)
    if (hadDinner) {
      totalMinutes -= 30
    }
    
    return Math.max(0, totalMinutes / 60)
  }

  /**
   * 야간 근무시간 계산 (22:00-06:00)
   */
  private calculateNightHours(checkIn: string, checkOut: string): number {
    // 간단 구현 - 실제로는 더 정교한 계산 필요
    const [inHour] = checkIn.split(':').map(Number)
    const [outHour] = checkOut.split(':').map(Number)
    
    let nightHours = 0
    
    // 22시 이후 시작
    if (inHour >= 22) {
      nightHours += Math.min(outHour <= 6 ? outHour + 24 - inHour : 24 - inHour, 8)
    }
    
    // 06시 이전 종료
    if (outHour <= 6 && inHour < 22) {
      nightHours += outHour
    }
    
    return Math.max(0, nightHours)
  }

  /**
   * 대체휴가/보상휴가 계산
   */
  private calculateLeaveCompensation(
    userId: string,
    workDate: string,
    workHours: number,
    dayType: 'saturday' | 'sunday' | 'holiday' | 'weekday',
    isFlexiblePeriod: boolean,
    leaveSettings: any
  ): WorkCompensationItem | null {
    if (dayType === 'weekday') return null

    let itemType: 'substitute_leave' | 'compensatory_leave'
    let rate: number
    let policyReference: string

    if (dayType === 'saturday') {
      itemType = 'substitute_leave'
      rate = leaveSettings.saturday_substitute_rate || 1.0
      policyReference = '토요일 근무 대체휴가 정책'
    } else {
      itemType = 'compensatory_leave'
      rate = dayType === 'sunday' 
        ? (leaveSettings.sunday_compensatory_rate || 1.5)
        : (leaveSettings.holiday_compensatory_rate || 1.5)
      policyReference = `${dayType === 'sunday' ? '일요일' : '공휴일'} 근무 보상휴가 정책`
    }

    // 8시간 기준으로 계산
    const regularHours = Math.min(workHours, 8)
    const overtimeHours = Math.max(0, workHours - 8)
    
    const regularCompensation = regularHours * rate
    const overtimeCompensation = overtimeHours * (rate + 0.5) // 초과분은 추가 0.5배
    
    const totalHours = regularCompensation + overtimeCompensation

    return {
      user_id: userId,
      work_date: workDate,
      item_type: itemType,
      calculated_hours: totalHours,
      calculation_basis: `근무 ${workHours}h (기본 ${regularHours}h×${rate} + 초과 ${overtimeHours}h×${rate + 0.5})`,
      policy_reference: policyReference,
      status: 'pending',
      work_hours: workHours,
      day_type: dayType,
      is_flexible_period: isFlexiblePeriod
    }
  }

  /**
   * 평일 초과근무 수당 계산
   */
  private calculateOvertimeAllowance(
    userId: string,
    workDate: string,
    workHours: number,
    threshold: number,
    hourlyRate: number,
    isFlexiblePeriod: boolean,
    policies: PolicySettings
  ): WorkCompensationItem | null {
    const overtimeHours = workHours - threshold
    if (overtimeHours <= 0) return null

    const overtimeRate = policies.overtime_night.overtime_allowance_rate || 1.5
    const amount = overtimeHours * hourlyRate * overtimeRate

    const policyReference = isFlexiblePeriod 
      ? '3개월 탄력근무제 초과근무 정책 (정산 시 지급)'
      : '일반 근무제 초과근무 정책 (즉시 지급)'

    return {
      user_id: userId,
      work_date: workDate,
      item_type: 'overtime_allowance',
      calculated_amount: amount,
      calculation_basis: `초과근무 ${overtimeHours}h × 시급 ${hourlyRate}원 × ${overtimeRate}배`,
      policy_reference: policyReference,
      status: isFlexiblePeriod ? 'pending' : 'approved', // 탄력근무제는 정산 시까지 대기
      work_hours: workHours,
      day_type: 'weekday',
      is_flexible_period: isFlexiblePeriod,
      hourly_rate: hourlyRate
    }
  }

  /**
   * 야간근무 수당 계산
   */
  private calculateNightAllowance(
    userId: string,
    workDate: string,
    nightHours: number,
    hourlyRate: number,
    nightSettings: any
  ): WorkCompensationItem | null {
    if (nightHours <= 0) return null

    const nightRate = nightSettings.night_allowance_rate || 1.5
    const amount = nightHours * hourlyRate * nightRate

    return {
      user_id: userId,
      work_date: workDate,
      item_type: 'night_allowance',
      calculated_amount: amount,
      calculation_basis: `야간근무 ${nightHours}h × 시급 ${hourlyRate}원 × ${nightRate}배`,
      policy_reference: '야간근무 수당 정책 (22:00-06:00)',
      status: 'approved', // 야간수당은 즉시 지급
      work_hours: nightHours,
      day_type: 'weekday',
      is_flexible_period: false,
      hourly_rate: hourlyRate
    }
  }

  /**
   * 정책 캐시 무효화 (WorkPolicyManagement에서 설정 변경 시 호출)
   */
  invalidateCache(): void {
    this.policyCache = null
    this.cacheExpiry = 0
  }
}

// 싱글톤 인스턴스 내보내기
export const workPolicyEngine = UnifiedWorkPolicyEngine.getInstance()
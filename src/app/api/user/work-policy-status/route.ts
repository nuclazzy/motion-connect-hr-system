import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUserServer } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

// 현재 사용자의 근무정책 상태 조회 API
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserServer(request)
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: '인증이 필요합니다.' 
      }, { status: 401 })
    }

    const supabase = await createServiceRoleClient()
    
    // 현재 날짜
    const today = new Date().toISOString().split('T')[0]
    
    // 1. 현재 활성화된 탄력근무제 정책 조회
    const { data: flexibleWorkPolicies, error: flexibleError } = await supabase
      .from('work_policies')
      .select(`
        id,
        policy_name,
        is_active,
        effective_start_date,
        effective_end_date,
        flexible_work_settings!inner (
          id,
          period_name,
          start_date,
          end_date,
          standard_work_hours,
          core_time_required,
          core_start_time,
          core_end_time,
          weekly_standard_hours,
          overtime_threshold,
          is_active
        )
      `)
      .eq('policy_type', 'flexible_work')
      .eq('is_active', true)
      .eq('flexible_work_settings.is_active', true)
      .lte('effective_start_date', today)
      .or(`effective_end_date.is.null,effective_end_date.gte.${today}`)
      .lte('flexible_work_settings.start_date', today)
      .gte('flexible_work_settings.end_date', today)

    if (flexibleError) {
      console.error('❌ 탄력근무제 정책 조회 오류:', flexibleError)
      // DB 테이블이 없는 경우에도 처리
      if (flexibleError.code === 'PGRST116' || flexibleError.message.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: {
            flexibleWorkActive: false,
            activeFlexibleWorkPolicy: null,
            overtimePolicy: null,
            leavePolicy: null
          }
        })
      }
    }

    // 2. 현재 활성화된 야간/초과근무 정책 조회
    const { data: overtimePolicies } = await supabase
      .from('work_policies')
      .select(`
        id,
        policy_name,
        overtime_night_settings!inner (
          id,
          setting_name,
          night_start_time,
          night_end_time,
          night_allowance_rate,
          overtime_threshold,
          overtime_allowance_rate,
          is_active
        )
      `)
      .eq('policy_type', 'overtime')
      .eq('is_active', true)
      .eq('overtime_night_settings.is_active', true)
      .lte('effective_start_date', today)
      .or(`effective_end_date.is.null,effective_end_date.gte.${today}`)
      .limit(1)

    // 3. 현재 활성화된 대체/보상휴가 정책 조회
    const { data: leavePolicies } = await supabase
      .from('work_policies')
      .select(`
        id,
        policy_name,
        leave_calculation_settings!inner (
          id,
          setting_name,
          saturday_substitute_enabled,
          saturday_base_rate,
          saturday_overtime_rate,
          sunday_compensatory_enabled,
          sunday_base_rate,
          sunday_overtime_rate,
          holiday_base_rate,
          holiday_overtime_rate,
          is_active
        )
      `)
      .eq('policy_type', 'leave_calculation')
      .eq('is_active', true)
      .eq('leave_calculation_settings.is_active', true)
      .lte('effective_start_date', today)
      .or(`effective_end_date.is.null,effective_end_date.gte.${today}`)
      .limit(1)

    // 활성화된 탄력근무제 정책이 있는지 확인
    const activeFlexibleWork = flexibleWorkPolicies && flexibleWorkPolicies.length > 0 
      ? flexibleWorkPolicies[0] 
      : null

    const result = {
      success: true,
      data: {
        flexibleWorkActive: !!activeFlexibleWork,
        activeFlexibleWorkPolicy: activeFlexibleWork,
        overtimePolicy: overtimePolicies && overtimePolicies.length > 0 ? overtimePolicies[0] : null,
        leavePolicy: leavePolicies && leavePolicies.length > 0 ? leavePolicies[0] : null
      }
    }

    console.log('✅ 근무정책 상태 조회 성공:', {
      userId: user.id,
      userName: user.name,
      flexibleWorkActive: result.data.flexibleWorkActive,
      policyName: activeFlexibleWork?.policy_name || 'N/A'
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ 근무정책 상태 조회 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 근무정책 관리 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const policyType = searchParams.get('type') // 'flexible_work', 'overtime', 'leave_calculation'

    console.log('🔍 근무정책 조회 요청:', { policyType })

    let query = supabase
      .from('work_policies')
      .select(`
        *,
        flexible_work_settings(*),
        overtime_night_settings(*),
        leave_calculation_settings(*)
      `)
      .order('created_at', { ascending: false })

    if (policyType) {
      query = query.eq('policy_type', policyType)
    }

    const { data: policies, error } = await query

    if (error) {
      console.error('❌ 근무정책 조회 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '근무정책 조회에 실패했습니다.' 
      }, { status: 500 })
    }

    console.log('✅ 근무정책 조회 성공:', policies?.length || 0, '건')

    return NextResponse.json({
      success: true,
      data: policies || []
    })

  } catch (error) {
    console.error('❌ 근무정책 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 근무정책 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient()
    const body = await request.json()
    const { 
      policyName, 
      policyType, 
      effectiveStartDate, 
      effectiveEndDate,
      settings 
    } = body

    console.log('📝 근무정책 생성 요청:', { policyName, policyType })

    // 1. 기본 정책 생성
    const { data: policy, error: policyError } = await supabase
      .from('work_policies')
      .insert({
        policy_name: policyName,
        policy_type: policyType,
        effective_start_date: effectiveStartDate,
        effective_end_date: effectiveEndDate,
        is_active: true
      })
      .select()
      .single()

    if (policyError) {
      console.error('❌ 정책 생성 오류:', policyError)
      return NextResponse.json({ 
        success: false, 
        error: '정책 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    // 2. 정책 유형별 상세 설정 생성
    let detailSettings = null

    if (policyType === 'flexible_work' && settings?.flexibleWork) {
      const { data: flexSettings, error: flexError } = await supabase
        .from('flexible_work_settings')
        .insert({
          policy_id: policy.id,
          ...settings.flexibleWork
        })
        .select()
        .single()

      if (flexError) {
        console.error('❌ 탄력근무 설정 생성 오류:', flexError)
        return NextResponse.json({ 
          success: false, 
          error: '탄력근무 설정 생성에 실패했습니다.' 
        }, { status: 500 })
      }
      detailSettings = flexSettings
    }

    if (policyType === 'overtime' && settings?.overtime) {
      const { data: overtimeSettings, error: overtimeError } = await supabase
        .from('overtime_night_settings')
        .insert({
          policy_id: policy.id,
          ...settings.overtime
        })
        .select()
        .single()

      if (overtimeError) {
        console.error('❌ 야간초과근무 설정 생성 오류:', overtimeError)
        return NextResponse.json({ 
          success: false, 
          error: '야간초과근무 설정 생성에 실패했습니다.' 
        }, { status: 500 })
      }
      detailSettings = overtimeSettings
    }

    if (policyType === 'leave_calculation' && settings?.leaveCalculation) {
      const { data: leaveSettings, error: leaveError } = await supabase
        .from('leave_calculation_settings')
        .insert({
          policy_id: policy.id,
          ...settings.leaveCalculation
        })
        .select()
        .single()

      if (leaveError) {
        console.error('❌ 휴가계산 설정 생성 오류:', leaveError)
        return NextResponse.json({ 
          success: false, 
          error: '휴가계산 설정 생성에 실패했습니다.' 
        }, { status: 500 })
      }
      detailSettings = leaveSettings
    }

    console.log('✅ 근무정책 생성 완료:', policy.id)

    return NextResponse.json({
      success: true,
      data: {
        policy,
        settings: detailSettings
      },
      message: '근무정책이 생성되었습니다.'
    })

  } catch (error) {
    console.error('❌ 근무정책 생성 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}
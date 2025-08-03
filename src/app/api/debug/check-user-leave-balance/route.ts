import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    const serviceRoleSupabase = await createServiceRoleClient()

    console.log('🔍 사용자 휴가 데이터 상세 조회:', userId)

    // 사용자 정보와 휴가 데이터 조회
    const { data: userData, error: userError } = await serviceRoleSupabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('❌ 사용자 조회 실패:', userError)
      return NextResponse.json({ 
        success: false, 
        error: '사용자를 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    // 휴가 데이터 조회
    const { data: leaveData, error: leaveError } = await serviceRoleSupabase
      .from('leave_days')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (leaveError || !leaveData) {
      console.error('❌ 휴가 데이터 조회 실패:', leaveError)
      return NextResponse.json({ 
        success: false, 
        error: '휴가 데이터를 찾을 수 없습니다.',
        user_info: {
          id: userData.id,
          name: userData.name,
          email: userData.email
        }
      }, { status: 404 })
    }

    const leaveTypes = leaveData.leave_types || {}

    // 각 휴가 타입별 상세 정보
    const analysis = {
      user_info: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        hire_date: userData.hire_date
      },
      leave_data: {
        annual_days: leaveTypes.annual_days || 0,
        used_annual_days: leaveTypes.used_annual_days || 0,
        remaining_annual_days: (leaveTypes.annual_days || 0) - (leaveTypes.used_annual_days || 0),
        
        sick_days: leaveTypes.sick_days || 0,
        used_sick_days: leaveTypes.used_sick_days || 0,
        remaining_sick_days: (leaveTypes.sick_days || 0) - (leaveTypes.used_sick_days || 0),
        
        substitute_leave_hours: leaveTypes.substitute_leave_hours || 0,
        compensatory_leave_hours: leaveTypes.compensatory_leave_hours || 0
      },
      raw_leave_types: leaveTypes,
      data_created_at: leaveData.created_at,
      data_updated_at: leaveData.updated_at
    }

    console.log('📊 휴가 데이터 분석 결과:', analysis)

    // 문제점 체크
    const issues = []
    
    if (!leaveTypes.hasOwnProperty('substitute_leave_hours')) {
      issues.push('substitute_leave_hours 필드가 존재하지 않음')
    }
    
    if (!leaveTypes.hasOwnProperty('compensatory_leave_hours')) {
      issues.push('compensatory_leave_hours 필드가 존재하지 않음')
    }
    
    if (leaveTypes.substitute_leave_hours === undefined || leaveTypes.substitute_leave_hours === null) {
      issues.push('substitute_leave_hours 값이 null/undefined')
    }
    
    if (leaveTypes.compensatory_leave_hours === undefined || leaveTypes.compensatory_leave_hours === null) {
      issues.push('compensatory_leave_hours 값이 null/undefined')
    }

    return NextResponse.json({
      success: true,
      analysis,
      issues,
      suggestions: issues.length > 0 ? [
        '관리자가 [관리자 > 직원 관리]에서 대체휴가/보상휴가 시간을 지급해주세요',
        '또는 migration을 실행하여 필드를 초기화해주세요'
      ] : ['휴가 데이터가 정상적으로 설정되어 있습니다']
    })

  } catch (error) {
    console.error('❌ 휴가 데이터 체크 오류:', error)
    return NextResponse.json({
      success: false,
      error: '휴가 데이터 조회 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminUserId = authorization.replace('Bearer ', '')
    
    const supabase = await createServiceRoleClient()
    
    // 관리자 권한 확인
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { employeeId } = await request.json()

    if (!employeeId) {
      return NextResponse.json({ 
        success: false, 
        error: '직원 ID가 필요합니다.' 
      }, { status: 400 })
    }

    console.log('🎁 샘플 시간 단위 휴가 지급:', employeeId)

    // 직원 휴가 데이터 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .eq('user_id', employeeId)
      .single()
    
    if (leaveError || !leaveData) {
      console.error('휴가 데이터 조회 오류:', leaveError)
      return NextResponse.json({ 
        success: false, 
        error: '직원의 휴가 데이터를 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    const currentLeaveTypes = leaveData.leave_types || {}

    // 샘플 시간 지급 (테스트용)
    const updatedLeaveTypes = {
      ...currentLeaveTypes,
      substitute_leave_hours: (currentLeaveTypes.substitute_leave_hours || 0) + 16, // 2일치
      compensatory_leave_hours: (currentLeaveTypes.compensatory_leave_hours || 0) + 8  // 1일치
    }

    // Supabase 데이터 업데이트 (JSON 필드와 별도 컬럼 모두 업데이트)
    const updateData: any = {
      leave_types: updatedLeaveTypes,
      substitute_leave_hours: updatedLeaveTypes.substitute_leave_hours,
      compensatory_leave_hours: updatedLeaveTypes.compensatory_leave_hours,
      updated_at: new Date().toISOString()
    }
    
    const { error: updateError } = await supabase
      .from('leave_days')
      .update(updateData)
      .eq('user_id', employeeId)

    if (updateError) {
      console.error('휴가 데이터 업데이트 오류:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: '휴가 데이터 업데이트에 실패했습니다.' 
      }, { status: 500 })
    }

    console.log('✅ 샘플 시간 단위 휴가 지급 완료:', {
      substitute_leave_hours: `${currentLeaveTypes.substitute_leave_hours || 0} → ${updatedLeaveTypes.substitute_leave_hours}`,
      compensatory_leave_hours: `${currentLeaveTypes.compensatory_leave_hours || 0} → ${updatedLeaveTypes.compensatory_leave_hours}`
    })

    return NextResponse.json({
      success: true,
      message: '샘플 시간 단위 휴가가 지급되었습니다.',
      data: {
        substitute_leave: {
          previous: currentLeaveTypes.substitute_leave_hours || 0,
          added: 16,
          total: updatedLeaveTypes.substitute_leave_hours
        },
        compensatory_leave: {
          previous: currentLeaveTypes.compensatory_leave_hours || 0,
          added: 8,
          total: updatedLeaveTypes.compensatory_leave_hours
        }
      }
    })

  } catch (error) {
    console.error('샘플 시간 단위 휴가 지급 오류:', error)
    return NextResponse.json(
      { success: false, error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

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
    
    const { employeeId, leaveType, hours, reason } = await request.json()

    console.log('⏰ 시간 단위 휴가 지급 요청:', { employeeId, leaveType, hours, reason })

    // 입력 검증
    if (!employeeId || !leaveType || !hours || !reason) {
      return NextResponse.json({ 
        success: false, 
        error: '필수 정보가 누락되었습니다.' 
      }, { status: 400 })
    }

    if (hours <= 0 || hours > 24) {
      return NextResponse.json({ 
        success: false, 
        error: '시간은 1~24 사이여야 합니다.' 
      }, { status: 400 })
    }

    if (!['substitute', 'compensatory'].includes(leaveType)) {
      return NextResponse.json({ 
        success: false, 
        error: '유효하지 않은 휴가 종류입니다.' 
      }, { status: 400 })
    }

    // Supabase에서 직원 휴가 데이터 조회
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

    // 시간 추가
    const fieldName = leaveType === 'substitute' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
    const currentHours = leaveData.leave_types[fieldName] || 0
    const newHours = currentHours + hours

    // Supabase 데이터 업데이트 (JSON 필드와 별도 컬럼 모두 업데이트)
    const updateData: any = {
      leave_types: {
        ...leaveData.leave_types,
        [fieldName]: newHours
      },
      updated_at: new Date().toISOString()
    }
    
    // 별도 컬럼도 함께 업데이트
    if (fieldName === 'substitute_leave_hours') {
      updateData.substitute_leave_hours = newHours
    } else if (fieldName === 'compensatory_leave_hours') {
      updateData.compensatory_leave_hours = newHours
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

    const leaveTypeName = leaveType === 'substitute' ? '대체휴가' : '보상휴가'

    console.log(`✅ ${leaveTypeName} ${hours}시간 지급 완료: ${currentHours}시간 → ${newHours}시간`)

    return NextResponse.json({
      success: true,
      message: `${leaveTypeName} ${hours}시간이 지급되었습니다.`,
      data: {
        previousHours: currentHours,
        addedHours: hours,
        totalHours: newHours
      }
    })

  } catch (error) {
    console.error('시간 단위 휴가 지급 오류:', error)
    return NextResponse.json(
      { success: false, error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
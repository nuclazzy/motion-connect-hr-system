import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authorization header에서 관리자 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()
    
    // 관리자 권한 확인
    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const { leaveType, adjustmentType, amount } = await request.json()
    const { userId } = await params
    const employeeId = userId

    console.log('🔧 휴가 일수 조정 요청:', { employeeId, leaveType, adjustmentType, amount })

    if (!leaveType || typeof amount !== 'number') {
      return NextResponse.json(
        { error: '휴가 유형과 조정 일수가 필요합니다.' },
        { status: 400 }
      )
    }

    // adjustmentType 유효성 검사 (연차/병가의 경우)
    if (['annual_leave', 'sick_leave'].includes(leaveType) && adjustmentType && !['granted', 'used'].includes(adjustmentType)) {
      return NextResponse.json(
        { error: '조정 유형은 granted 또는 used여야 합니다.' },
        { status: 400 }
      )
    }

    // 유효한 휴가 유형 확인
    const validLeaveTypes = ['annual_leave', 'sick_leave', 'substitute_leave_hours', 'compensatory_leave_hours']
    if (!validLeaveTypes.includes(leaveType)) {
      return NextResponse.json(
        { error: '유효하지 않은 휴가 유형입니다.' },
        { status: 400 }
      )
    }

    // Supabase에서 휴가 데이터 조회
    const { data: userLeaveData, error: fetchError } = await supabase
      .from('leave_days')
      .select('leave_types, substitute_leave_hours, compensatory_leave_hours')
      .eq('user_id', employeeId)
      .single()

    if (fetchError || !userLeaveData) {
      console.error('❌ 직원 휴가 정보 조회 실패:', fetchError)
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('🔧 조회된 사용자 휴가 데이터:', {
      substitute_leave_hours: userLeaveData.substitute_leave_hours,
      compensatory_leave_hours: userLeaveData.compensatory_leave_hours,
      leave_types: userLeaveData.leave_types
    })

    // 조정 로직 분기
    let updatedLeaveTypes = { ...userLeaveData.leave_types }
    let adjustmentDetails = {}

    if (['annual_leave', 'sick_leave'].includes(leaveType) && adjustmentType) {
      // 연차/병가의 경우 granted 또는 used 별도 조정
      const baseType = leaveType === 'annual_leave' ? 'annual' : 'sick'
      const targetField = adjustmentType === 'granted' ? `${baseType}_days` : `used_${baseType}_days`
      
      const currentValue = updatedLeaveTypes[targetField] || 0
      const newValue = currentValue + amount
      
      // 음수 방지
      if (newValue < 0) {
        return NextResponse.json(
          { error: `${targetField} 값이 음수가 될 수 없습니다. 현재: ${currentValue}, 조정 요청: ${amount}` },
          { status: 400 }
        )
      }
      
      updatedLeaveTypes[targetField] = newValue
      adjustmentDetails = {
        field: targetField,
        previousValue: currentValue,
        newValue
      }
    } else {
      // 대체휴가/보상휴가의 경우 새 필드 또는 기존 필드에서 조회
      let currentValue = 0
      let updateField = ''
      
      if (leaveType === 'substitute_leave_hours') {
        currentValue = userLeaveData.substitute_leave_hours || userLeaveData.leave_types[leaveType] || 0
        updateField = 'substitute_leave_hours'
      } else if (leaveType === 'compensatory_leave_hours') {
        currentValue = userLeaveData.compensatory_leave_hours || userLeaveData.leave_types[leaveType] || 0
        updateField = 'compensatory_leave_hours'
      } else {
        // 기존 leave_types 내 필드
        currentValue = userLeaveData.leave_types[leaveType] || 0
        updateField = leaveType
      }
      
      const newValue = currentValue + amount
      
      // 음수 방지
      if (newValue < 0) {
        return NextResponse.json(
          { error: `휴가 잔여량이 부족합니다. 현재: ${currentValue}, 조정 요청: ${amount}` },
          { status: 400 }
        )
      }
      
      // 새 필드 업데이트 또는 기존 필드 업데이트
      if (updateField === 'substitute_leave_hours' || updateField === 'compensatory_leave_hours') {
        // 새 필드에 업데이트하고 leave_types에도 동기화
        updatedLeaveTypes[leaveType] = newValue
      } else {
        updatedLeaveTypes[leaveType] = newValue
      }
      
      adjustmentDetails = {
        field: updateField,
        previousValue: currentValue,
        newValue
      }
    }
    
    // 업데이트할 데이터 준비
    const updateData: any = { leave_types: updatedLeaveTypes }
    
    // 시간 단위 휴가의 경우 새 필드도 업데이트
    if (leaveType === 'substitute_leave_hours') {
      updateData.substitute_leave_hours = updatedLeaveTypes[leaveType]
    } else if (leaveType === 'compensatory_leave_hours') {
      updateData.compensatory_leave_hours = updatedLeaveTypes[leaveType]
    }
    
    console.log('🔧 업데이트할 데이터:', {
      employeeId,
      leaveType,
      updateData,
      updatedLeaveTypes
    })
    
    const { error: updateError } = await supabase
      .from('leave_days')
      .update(updateData)
      .eq('user_id', employeeId)

    if (updateError) {
      console.error('❌ 휴가 일수 업데이트 실패:', updateError)
      return NextResponse.json(
        { error: '휴가 일수 조정에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ 휴가 일수 조정 완료:', {
      employeeId,
      leaveType,
      adjustmentType,
      adjustmentDetails,
      adjustment: amount
    })
    
    // 데이터 일관성 검증
    if (leaveType === 'substitute_leave_hours' || leaveType === 'compensatory_leave_hours') {
      const jsonValue = updateData.leave_types[leaveType]
      const columnValue = updateData[leaveType]
      console.log('📋 데이터 일관성 검증:', {
        leaveType,
        jsonValue,
        columnValue,
        isConsistent: jsonValue === columnValue
      })
    }

    return NextResponse.json({
      success: true,
      message: '휴가 일수가 성공적으로 조정되었습니다.',
      data: {
        leaveType,
        adjustmentType,
        adjustment: amount,
        ...adjustmentDetails
      }
    })

  } catch (error) {
    console.error('❌ 휴가 일수 조정 예외:', error)
    return NextResponse.json(
      { error: '휴가 일수 조정 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
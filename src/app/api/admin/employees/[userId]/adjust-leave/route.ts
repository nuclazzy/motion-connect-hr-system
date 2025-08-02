import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { leaveType, amount } = await request.json()
    const { userId } = await params
    const employeeId = userId

    console.log('🔧 휴가 일수 조정 요청:', { employeeId, leaveType, amount })

    if (!leaveType || typeof amount !== 'number') {
      return NextResponse.json(
        { error: '휴가 유형과 조정 일수가 필요합니다.' },
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
      .select('leave_types')
      .eq('user_id', employeeId)
      .single()

    if (fetchError || !userLeaveData) {
      console.error('❌ 직원 휴가 정보 조회 실패:', fetchError)
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 현재 값 조회 및 새 값 계산
    const currentValue = userLeaveData.leave_types[leaveType] || 0
    const newValue = currentValue + amount

    // 음수 방지 (휴가 일수/시간은 0 이하로 내려갈 수 없음)
    if (newValue < 0) {
      return NextResponse.json(
        { error: `휴가 잔여량이 부족합니다. 현재: ${currentValue}, 조정 요청: ${amount}` },
        { status: 400 }
      )
    }

    // Supabase 데이터 업데이트
    const updatedLeaveTypes = {
      ...userLeaveData.leave_types,
      [leaveType]: newValue
    }
    
    const { error: updateError } = await supabase
      .from('leave_days')
      .update({ leave_types: updatedLeaveTypes })
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
      before: currentValue,
      adjustment: amount,
      after: newValue
    })

    return NextResponse.json({
      success: true,
      message: '휴가 일수가 성공적으로 조정되었습니다.',
      data: {
        leaveType,
        previousValue: currentValue,
        adjustment: amount,
        newValue
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
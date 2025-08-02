import { NextRequest, NextResponse } from 'next/server'
import { getLocalLeaveData, updateLocalLeaveData } from '@/lib/localLeaveData'

export async function POST(request: NextRequest) {
  try {
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

    // 직원 휴가 데이터 조회
    const localLeaveData = getLocalLeaveData()
    const employeeLeaveData = localLeaveData[employeeId]
    
    if (!employeeLeaveData) {
      return NextResponse.json({ 
        success: false, 
        error: '직원의 휴가 데이터를 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    // 시간 추가
    const fieldName = leaveType === 'substitute' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
    const currentHours = employeeLeaveData.leave_types[fieldName] || 0
    const newHours = currentHours + hours

    // 데이터 업데이트
    updateLocalLeaveData(employeeId, {
      ...employeeLeaveData,
      leave_types: {
        ...employeeLeaveData.leave_types,
        [fieldName]: newHours
      },
      updated_at: new Date().toISOString()
    })

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
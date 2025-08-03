import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Helper function to send notification to employee
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendEmployeeNotification(supabase: any, userId: string, message: string, link?: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      message,
      link,
      is_read: false
    })
  } catch (error) {
    console.error('직원 알림 전송 실패:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { employeeId, leaveType, days, reason, validUntil } = await request.json()
    
    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminUserId = authorization.replace('Bearer ', '')
    
    const serviceRoleSupabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: adminUser } = await serviceRoleSupabase
      .from('users')
      .select('role, name')
      .eq('id', adminUserId)
      .single()

    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 대상 직원 정보 조회
    const { data: employee, error: employeeError } = await serviceRoleSupabase
      .from('users')
      .select('id, name, department, position')
      .eq('id', employeeId)
      .single()

    if (employeeError || !employee) {
      return NextResponse.json({ error: '직원 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 입력값 검증
    const parsedDays = parseFloat(days)
    if (parsedDays <= 0 || parsedDays > 30) {
      return NextResponse.json({ error: '휴가 일수는 0일 초과 30일 이하로 입력해주세요.' }, { status: 400 })
    }

    const validLeaveTypes = ['compensatory', 'substitute', 'special', 'reward', 'other']
    if (!validLeaveTypes.includes(leaveType)) {
      return NextResponse.json({ error: '유효하지 않은 휴가 종류입니다.' }, { status: 400 })
    }

    // 현재 직원의 휴가 데이터 조회
    const { data: leaveDaysData, error: leaveDaysError } = await serviceRoleSupabase
      .from('leave_days')
      .select('leave_types')
      .eq('user_id', employeeId)
      .single()

    if (leaveDaysError || !leaveDaysData) {
      return NextResponse.json({ error: '직원의 휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaveTypes = leaveDaysData.leave_types as Record<string, any>

    // 특별휴가 필드 이름 결정
    const fieldMap: Record<string, string> = {
      compensatory: 'compensatory_days',
      substitute: 'substitute_days', 
      special: 'special_days',
      reward: 'reward_days',
      other: 'other_days'
    }

    const fieldName = fieldMap[leaveType]
    
    // 기존 특별휴가 데이터 가져오기 (없으면 0)
    const currentSpecialLeave = leaveTypes[fieldName] || 0
    const updatedSpecialLeave = currentSpecialLeave + parsedDays

    // 휴가 데이터 업데이트
    const updatedLeaveTypes = {
      ...leaveTypes,
      [fieldName]: updatedSpecialLeave
    }

    const { error: updateError } = await serviceRoleSupabase
      .from('leave_days')
      .update({ leave_types: updatedLeaveTypes })
      .eq('user_id', employeeId)

    if (updateError) {
      console.error('휴가 데이터 업데이트 실패:', updateError)
      return NextResponse.json({ error: '휴가 지급에 실패했습니다.' }, { status: 500 })
    }

    // form_requests 테이블에 특별휴가 지급 기록 남기기
    const requestData = {
      employeeId,
      employeeName: employee.name,
      leaveType,
      days: parsedDays,
      reason,
      validUntil: validUntil || null,
      grantedBy: adminUserId,
      grantedByName: adminUser.name
    }

    const { error: recordError } = await serviceRoleSupabase
      .from('form_requests')
      .insert({
        user_id: employeeId,
        form_type: '특별휴가 지급',
        status: 'approved',
        request_data: requestData,
        submitted_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
        processed_by: adminUserId
      })

    if (recordError) {
      console.error('특별휴가 지급 기록 실패:', recordError)
      // 기록 실패는 치명적이지 않으므로 계속 진행
    }

    // 휴가 종류 한글명
    const leaveTypeNames: Record<string, string> = {
      compensatory: '보상휴가',
      substitute: '대체휴가',
      special: '특별휴가',
      reward: '포상휴가',
      other: '기타휴가'
    }

    const leaveTypeName = leaveTypeNames[leaveType] || '특별휴가'

    // 직원에게 알림 전송
    const notificationMessage = validUntil 
      ? `${leaveTypeName} ${parsedDays}일이 지급되었습니다. (유효기간: ${validUntil}까지)`
      : `${leaveTypeName} ${parsedDays}일이 지급되었습니다.`

    await sendEmployeeNotification(
      serviceRoleSupabase,
      employeeId,
      notificationMessage,
      '/user'
    )

    // 대체휴가인 경우 즉시 사용 권고 알림 추가
    if (leaveType === 'substitute') {
      await sendEmployeeNotification(
        serviceRoleSupabase,
        employeeId,
        `대체휴가가 지급되었습니다. 지급된 휴가는 가급적 해당 주에 사용하는 것을 권고드립니다.`,
        '/user'
      )
    }

    console.log(`💰 [특별휴가지급] ${employee.name}님에게 ${leaveTypeName} ${parsedDays}일 지급`)

    return NextResponse.json({ 
      success: true, 
      message: `${employee.name}님에게 ${leaveTypeName} ${parsedDays}일이 지급되었습니다.`,
      updatedBalance: updatedSpecialLeave
    })

  } catch (error) {
    console.error('특별휴가 지급 API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
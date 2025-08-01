import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper function to calculate leave days
function calculateLeaveDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5
  }
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const timeDiff = end.getTime() - start.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // 당일 포함
  
  return daysDiff
}

export async function POST(request: NextRequest) {
  try {
    const { formType, requestData } = await request.json()
    const supabase = await createClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // 휴가 신청일 경우, 잔여 일수 확인 로직
    if (formType === '휴가 신청서') {
      const { data: leaveDaysData, error: leaveDaysError } = await supabase
        .from('leave_days')
        .select('leave_types')
        .eq('user_id', userId)
        .single()

      if (leaveDaysError || !leaveDaysData) {
        return NextResponse.json({ error: '휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
      }

      const isHalfDay = requestData.휴가형태?.includes('반차')
      const daysToDeduct = calculateLeaveDays(requestData.시작일, requestData.종료일, isHalfDay)
      const leaveTypes = leaveDaysData.leave_types as Record<string, { total: number; used: number }>
      
      // 휴가 타입에 따른 키 결정
      let leaveTypeKey = 'annual'
      if (requestData.휴가형태 === '병가') {
        leaveTypeKey = 'sick'
      }

      // 잔여 일수 계산
      const totalDays = leaveTypes[leaveTypeKey]?.total || 0
      const usedDays = leaveTypes[leaveTypeKey]?.used || 0
      const remainingDays = totalDays - usedDays

      if (remainingDays < daysToDeduct) {
        return NextResponse.json({ 
          error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${remainingDays}일, 신청: ${daysToDeduct}일)` 
        }, { status: 400 })
      }
    }

    // form_requests 테이블에 기록
    const { error: insertError } = await supabase.from('form_requests').insert({
      user_id: userId,
      form_type: formType,
      status: 'pending',
      request_data: requestData,
      submitted_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('Error inserting form request:', insertError)
      return NextResponse.json({ error: '신청서 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Request submitted successfully.' })
  } catch (error) {
    console.error('Form request API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // URL에서 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let query = supabase
      .from('form_requests')
      .select(`
        *,
        users!inner(name, department, position)
      `)

    // 관리자인지 확인
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (currentUser?.role === 'admin') {
      // 관리자는 모든 요청 조회 가능
      if (userId) {
        query = query.eq('user_id', userId)
      }
    } else {
      // 일반 사용자는 자신의 요청만 조회 가능
      query = query.eq('user_id', session.user.id)
    }

    const { data: requests, error } = await query.order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching form requests:', error)
      return NextResponse.json({ error: '신청 내역을 조회할 수 없습니다.' }, { status: 500 })
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Form requests GET API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// GET: 테스트용 엔드포인트
export async function GET() {
  return NextResponse.json({ 
    message: 'Minimal approve-request API is working',
    timestamp: new Date().toISOString(),
    status: 'ready'
  })
}

// POST: 최소 기능 승인/거절 처리
export async function POST(request: NextRequest) {
  console.log('🔍 Minimal approve-request API called')
  
  try {
    // 1. 기본 파라미터 파싱
    const body = await request.json()
    const { requestId, action, adminNote } = body
    
    console.log('📋 Parameters:', { requestId, action, adminNote })
    
    // 2. 기본 검증
    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Missing requestId or action' }, 
        { status: 400 }
      )
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action' }, 
        { status: 400 }
      )
    }

    // 3. Authorization 검증 (간단하게)
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const adminUserId = authorization.replace('Bearer ', '')
    console.log('👤 Admin User ID:', adminUserId)

    // 4. Supabase 연결
    const supabase = await createServiceRoleClient()
    
    // 5. 요청 조회
    const { data: formRequest, error: requestError } = await supabase
      .from('form_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      console.error('❌ Request not found:', requestError)
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    console.log('📄 Form request found:', formRequest.form_type)

    // 6. 승인일 경우 휴가일수 차감 처리
    if (action === 'approve' && formRequest.form_type === '휴가 신청서') {
      console.log('🏖️ 휴가 신청서 승인 - 휴가일수 차감 시작')
      
      const requestData = formRequest.request_data
      const leaveType = requestData['휴가형태']
      const startDate = requestData['시작일']
      const endDate = requestData['종료일']
      
      console.log('📊 휴가 정보:', { leaveType, startDate, endDate })
      
      // 휴가 일수 계산
      let daysToDeduct = 1 // 기본값
      if (startDate && endDate) {
        if (startDate === endDate) {
          daysToDeduct = leaveType?.includes('반차') ? 0.5 : 1
        } else {
          const start = new Date(startDate)
          const end = new Date(endDate)
          const timeDiff = end.getTime() - start.getTime()
          daysToDeduct = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
        }
      }
      
      console.log('📊 차감할 휴가일수:', daysToDeduct)
      
      // 사용자 휴가 데이터 조회
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', formRequest.user_id)
        .single()

      if (leaveError || !leaveData) {
        console.error('❌ 휴가 데이터 조회 실패:', leaveError)
        return NextResponse.json({ error: '휴가 데이터를 찾을 수 없습니다.' }, { status: 404 })
      }

      console.log('📊 현재 휴가 데이터:', leaveData.leave_types)
      
      // 휴가 유형별 처리
      let updatedLeaveTypes = { ...leaveData.leave_types }
      
      if (leaveType === '연차' || leaveType?.includes('반차')) {
        // 연차 차감
        const currentUsed = updatedLeaveTypes.used_annual_days || 0
        updatedLeaveTypes.used_annual_days = currentUsed + daysToDeduct
        console.log('📊 연차 사용일수 업데이트:', currentUsed, '→', currentUsed + daysToDeduct)
        
      } else if (leaveType === '병가') {
        // 병가 차감
        const currentUsed = updatedLeaveTypes.used_sick_days || 0
        updatedLeaveTypes.used_sick_days = currentUsed + daysToDeduct
        console.log('📊 병가 사용일수 업데이트:', currentUsed, '→', currentUsed + daysToDeduct)
        
      } else if (leaveType === '대체휴가' || leaveType === '대체휴가 오전 반차' || leaveType === '대체휴가 오후 반차' || leaveType?.includes('대체휴가')) {
        // 대체휴가 시간 차감 (종일/반차 모두 처리)
        const hoursToDeduct = daysToDeduct * 8
        // JSON 필드에서 가져오기 (별도 컬럼은 존재하지 않음)
        const currentHours = updatedLeaveTypes.substitute_leave_hours ?? 0
        const newHours = Math.max(0, currentHours - hoursToDeduct)
        
        // JSON 필드 업데이트
        updatedLeaveTypes.substitute_leave_hours = newHours
        
        console.log('📊 대체휴가 시간 업데이트:', {
          휴가유형: leaveType,
          차감일수: daysToDeduct,
          차감시간: hoursToDeduct,
          이전시간: currentHours,
          업데이트후: newHours,
          JSON필드값: leaveData.leave_types.substitute_leave_hours
        })
        
      } else if (leaveType === '보상휴가' || leaveType === '보상휴가 오전 반차' || leaveType === '보상휴가 오후 반차' || leaveType?.includes('보상휴가')) {
        // 보상휴가 시간 차감 (종일/반차 모두 처리)
        const hoursToDeduct = daysToDeduct * 8
        // JSON 필드에서 가져오기 (별도 컬럼은 존재하지 않음)
        const currentHours = updatedLeaveTypes.compensatory_leave_hours ?? 0
        const newHours = Math.max(0, currentHours - hoursToDeduct)
        
        // JSON 필드 업데이트
        updatedLeaveTypes.compensatory_leave_hours = newHours
        
        console.log('📊 보상휴가 시간 업데이트:', {
          휴가유형: leaveType,
          차감일수: daysToDeduct,
          차감시간: hoursToDeduct,
          이전시간: currentHours,
          업데이트후: newHours,
          JSON필드값: leaveData.leave_types.compensatory_leave_hours
        })
      }
      
      // 휴가 데이터 업데이트 (JSON 필드만 업데이트, 별도 컬럼은 존재하지 않음)
      const updateData = {
        leave_types: updatedLeaveTypes,
        updated_at: new Date().toISOString()
      }
      
      console.log('📊 데이터베이스 업데이트 데이터:', updateData)
      
      const { error: leaveUpdateError } = await supabase
        .from('leave_days')
        .update(updateData)
        .eq('user_id', formRequest.user_id)

      if (leaveUpdateError) {
        console.error('❌ 휴가 데이터 업데이트 실패:', leaveUpdateError)
        return NextResponse.json({ error: '휴가 데이터 업데이트에 실패했습니다.' }, { status: 500 })
      }
      
      console.log('✅ 휴가일수 차감 완료')
    }

    // 7. 상태 업데이트
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    
    const updateData: any = {
      status: newStatus,
      processed_at: new Date().toISOString(),
      processed_by: adminUserId
    }
    
    // 거절 시 사유 저장
    if (action === 'reject' && adminNote) {
      updateData.admin_note = adminNote
    }
    
    const { error: updateError } = await supabase
      .from('form_requests')
      .update(updateData)
      .eq('id', requestId)

    if (updateError) {
      console.error('❌ Update failed:', updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }

    console.log(`✅ Request ${action}d successfully`)

    return NextResponse.json({ 
      success: true,
      message: `Request ${action}d successfully`,
      requestId,
      newStatus
    })

  } catch (error) {
    console.error('❌ API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}
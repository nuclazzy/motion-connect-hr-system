import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { calculateHoursToDeduct } from '@/lib/hoursToLeaveDay'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper function to calculate leave days
function calculateWorkingDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5
  }
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  let workingDays = 0
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dayOfWeek = date.getDay()
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++
    }
  }
  
  return workingDays
}

export async function POST(request: NextRequest) {
  try {
    const { requestId, action, reason } = await request.json()

    console.log('🏛️ Supabase 승인 처리:', { requestId, action, reason })

    // 신청 데이터 조회
    const { data: formRequest, error: requestError } = await supabase
      .from('form_requests')
      .select(`
        *,
        users!inner(
          id,
          email,
          user_metadata
        )
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      console.error('신청 조회 오류:', requestError)
      return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (formRequest.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 신청입니다.' }, { status: 400 })
    }

    if (action === 'approve') {
      // 휴가 신청서인 경우 휴가 차감 처리
      if (formRequest.form_type === '휴가 신청서') {
        const requestData = formRequest.request_data
        const isHalfDay = requestData.휴가형태?.includes('반차')
        const daysToDeduct = calculateWorkingDays(requestData.시작일, requestData.종료일, isHalfDay)

        // 휴가 데이터 조회
        const { data: leaveData, error: leaveError } = await supabase
          .from('leave_days')
          .select('*')
          .eq('user_id', formRequest.user_id)
          .single()

        if (leaveError || !leaveData) {
          console.error('휴가 데이터 조회 오류:', leaveError)
          return NextResponse.json({ error: '사용자의 휴가 데이터를 찾을 수 없습니다.' }, { status: 404 })
        }

        const leaveTypes = leaveData.leave_types
        let updatedLeaveTypes = { ...leaveTypes }

        // 휴가 타입별 처리
        if (requestData.휴가형태 === '대체휴가' || requestData.휴가형태 === '보상휴가') {
          // 시간 단위 휴가 차감 - 단순 일수 계산 (평일/휴일 구분 없음)
          const simpleDays = isHalfDay ? 0.5 : 1.0 // 1일 또는 0.5일 (반차)만 지원
          const hoursToDeduct = calculateHoursToDeduct(simpleDays)
          const fieldName = requestData.휴가형태 === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
          const availableHours = leaveTypes[fieldName] || 0
          
          console.log(`🔍 ${requestData.휴가형태} 계산:`, {
            isHalfDay,
            simpleDays,
            hoursToDeduct,
            availableHours,
            startDate: requestData.시작일,
            endDate: requestData.종료일
          })
          
          if (availableHours < hoursToDeduct) {
            return NextResponse.json({ 
              error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${availableHours}시간, 필요: ${hoursToDeduct}시간)` 
            }, { status: 400 })
          }

          updatedLeaveTypes = {
            ...leaveTypes,
            [fieldName]: availableHours - hoursToDeduct
          }
          
          console.log(`⏰ ${requestData.휴가형태} ${hoursToDeduct}시간 차감: ${availableHours} → ${availableHours - hoursToDeduct}`)
        } else {
          // 기존 연차/병가 처리
          let leaveTypeKey = 'annual_days'
          let usedTypeKey = 'used_annual_days'
          if (requestData.휴가형태 === '병가') {
            leaveTypeKey = 'sick_days'
            usedTypeKey = 'used_sick_days'
          }

          const totalDays = leaveTypes[leaveTypeKey] || 0
          const usedDays = leaveTypes[usedTypeKey] || 0
          const remainingDays = totalDays - usedDays

          if (remainingDays < daysToDeduct) {
            return NextResponse.json({ 
              error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${remainingDays}일, 필요: ${daysToDeduct}일)` 
            }, { status: 400 })
          }

          updatedLeaveTypes = {
            ...leaveTypes,
            [usedTypeKey]: usedDays + daysToDeduct
          }

          console.log(`📅 ${requestData.휴가형태} ${daysToDeduct}일 차감: ${usedDays} → ${usedDays + daysToDeduct}`)
        }

        // 휴가 데이터 업데이트
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({
            leave_types: updatedLeaveTypes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', formRequest.user_id)

        if (updateError) {
          console.error('휴가 데이터 업데이트 오류:', updateError)
          return NextResponse.json({ error: '휴가 데이터 업데이트에 실패했습니다.' }, { status: 500 })
        }
      }

      // 승인 처리
      const { error: approveError } = await supabase
        .from('form_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: 'admin-test-id'
        })
        .eq('id', requestId)

      if (approveError) {
        console.error('승인 처리 오류:', approveError)
        return NextResponse.json({ error: '승인 처리에 실패했습니다.' }, { status: 500 })
      }

      console.log('✅ 승인 완료:', formRequest.form_type, formRequest.users?.user_metadata?.name)

      return NextResponse.json({
        success: true,
        message: '승인이 완료되었습니다.'
      })

    } else if (action === 'reject') {
      // 거절 처리
      const { error: rejectError } = await supabase
        .from('form_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: 'admin-test-id',
          reject_reason: reason
        })
        .eq('id', requestId)

      if (rejectError) {
        console.error('거절 처리 오류:', rejectError)
        return NextResponse.json({ error: '거절 처리에 실패했습니다.' }, { status: 500 })
      }

      console.log('❌ 거절 완료:', formRequest.form_type, formRequest.users?.user_metadata?.name, '사유:', reason)

      return NextResponse.json({
        success: true,
        message: '거절이 완료되었습니다.'
      })
    }

    return NextResponse.json({ error: '유효하지 않은 액션입니다.' }, { status: 400 })

  } catch (error) {
    console.error('Supabase 승인 처리 오류:', error)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
import { SupabaseClient } from '@supabase/supabase-js'

/**
 * 휴가 신청 시 트랜잭션으로 안전하게 처리하는 함수
 * 레이스 컨디션을 방지하기 위해 row-level locking 사용
 */
export async function submitLeaveRequestWithTransaction(
  supabase: SupabaseClient,
  userId: string,
  formType: string,
  requestData: any
) {
  // PostgreSQL 함수를 우선 시도, 실패하면 fallback 사용
  const { data, error } = await supabase.rpc('submit_leave_request_safe', {
    p_user_id: userId,
    p_form_type: formType,
    p_request_data: requestData
  })

  // 함수가 없으면 직접 처리
  if (error && error.message.includes('function') && error.message.includes('not found')) {
    console.log('⚠️ Supabase 함수를 찾을 수 없어 직접 처리합니다:', error.message)
    return await submitLeaveRequestFallback(supabase, userId, formType, requestData)
  }

  if (error) {
    if (error.message) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '휴가 신청 처리 중 오류가 발생했습니다.' }
  }

  return { success: true, data }
}

// Fallback function - 함수가 없을 때 직접 처리
async function submitLeaveRequestFallback(
  supabase: SupabaseClient,
  userId: string,
  formType: string,
  requestData: any
) {
  try {
    // 휴가 신청서가 아닌 경우 바로 저장
    if (formType !== '휴가 신청서') {
      const { data: newRequest, error: saveError } = await supabase
        .from('form_requests')
        .insert({
          user_id: userId,
          form_type: formType,
          status: 'pending',
          request_data: requestData,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single()

      if (saveError) {
        return { success: false, error: '신청서 저장에 실패했습니다.' }
      }

      return { success: true, data: newRequest }
    }

    // 휴가 신청서 처리
    const leaveType = requestData['휴가형태']
    const isHalfDay = leaveType?.includes('반차')
    
    // 휴가 일수 계산
    let daysToDeduct: number
    if (isHalfDay) {
      daysToDeduct = 0.5
    } else if (requestData['시작일'] === requestData['종료일']) {
      daysToDeduct = 1
    } else {
      const startDate = new Date(requestData['시작일'])
      const endDate = new Date(requestData['종료일'])
      const timeDiff = endDate.getTime() - startDate.getTime()
      daysToDeduct = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
    }

    // 사용자의 휴가 데이터 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (leaveError || !leaveData) {
      return { success: false, error: '휴가 정보를 조회할 수 없습니다.' }
    }

    const leaveTypes = leaveData.leave_types || {}

    // 시간 단위 휴가 처리 (대체휴가, 보상휴가)
    if (leaveType === '대체휴가' || leaveType === '보상휴가') {
      const hoursToDeduct = daysToDeduct * 8
      const fieldName = leaveType === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
      const availableHours = leaveTypes[fieldName] || 0

      if (availableHours < hoursToDeduct) {
        return {
          success: false,
          error: `잔여 ${leaveType}가 부족합니다. (잔여: ${availableHours}시간, 필요: ${hoursToDeduct}시간)`
        }
      }
    } else {
      // 일반 휴가 처리 (연차, 병가)
      let leaveTypeKey = 'annual_days'
      let usedTypeKey = 'used_annual_days'
      
      if (leaveType === '병가') {
        leaveTypeKey = 'sick_days'
        usedTypeKey = 'used_sick_days'
      }

      const totalDays = leaveTypes[leaveTypeKey] || 0
      const usedDays = leaveTypes[usedTypeKey] || 0
      const remainingDays = totalDays - usedDays

      if (remainingDays < daysToDeduct) {
        return {
          success: false,
          error: `잔여 ${leaveType}가 부족합니다. (잔여: ${remainingDays}일, 신청: ${daysToDeduct}일)`
        }
      }
    }

    // 검증 통과 시 휴가 신청 저장
    const { data: newRequest, error: saveError } = await supabase
      .from('form_requests')
      .insert({
        user_id: userId,
        form_type: formType,
        status: 'pending',
        request_data: requestData,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
      return { success: false, error: '신청서 저장에 실패했습니다.' }
    }

    return { success: true, data: newRequest }

  } catch (error) {
    console.error('Fallback 휴가 신청 처리 오류:', error)
    return { success: false, error: '휴가 신청 처리 중 오류가 발생했습니다.' }
  }
}

/**
 * 휴가 승인 시 트랜잭션으로 안전하게 처리하는 함수
 */
export async function approveLeaveRequestWithTransaction(
  supabase: SupabaseClient,
  requestId: string,
  adminUserId: string,
  adminNote?: string
) {
  const { data, error } = await supabase.rpc('approve_leave_request_safe', {
    p_request_id: requestId,
    p_admin_user_id: adminUserId,
    p_admin_note: adminNote
  })

  // 함수가 없으면 직접 처리
  if (error && error.message.includes('function') && error.message.includes('not found')) {
    console.log('⚠️ Supabase 승인 함수를 찾을 수 없어 직접 처리합니다:', error.message)
    return await approveLeaveRequestFallback(supabase, requestId, adminUserId, adminNote)
  }

  if (error) {
    if (error.message) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '휴가 승인 처리 중 오류가 발생했습니다.' }
  }

  return { success: true, data }
}

// Fallback function for approval
async function approveLeaveRequestFallback(
  supabase: SupabaseClient,
  requestId: string,
  adminUserId: string,
  adminNote?: string
) {
  try {
    // 요청 정보 조회
    const { data: request, error: requestError } = await supabase
      .from('form_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (requestError || !request) {
      return { success: false, error: '서식 요청을 찾을 수 없습니다.' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: '이미 처리된 요청입니다.' }
    }

    // 휴가 신청서인 경우만 휴가 차감 처리
    if (request.form_type === '휴가 신청서') {
      const requestData = request.request_data
      const leaveType = requestData['휴가형태']
      const isHalfDay = leaveType?.includes('반차')
      
      // 휴가 일수 계산
      let daysToDeduct: number
      if (isHalfDay) {
        daysToDeduct = 0.5
      } else if (requestData['시작일'] === requestData['종료일']) {
        daysToDeduct = 1
      } else {
        const startDate = new Date(requestData['시작일'])
        const endDate = new Date(requestData['종료일'])
        const timeDiff = endDate.getTime() - startDate.getTime()
        daysToDeduct = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
      }

      // 휴가 데이터 조회
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', request.user_id)
        .single()

      if (leaveError || !leaveData) {
        return { success: false, error: '휴가 정보를 조회할 수 없습니다.' }
      }

      let updatedLeaveTypes = { ...leaveData.leave_types }

      // 시간 단위 휴가 차감 (대체휴가, 보상휴가)
      if (leaveType === '대체휴가' || leaveType === '보상휴가') {
        const hoursToDeduct = daysToDeduct * 8
        const fieldName = leaveType === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
        const currentHours = updatedLeaveTypes[fieldName] || 0
        updatedLeaveTypes[fieldName] = Math.max(0, currentHours - hoursToDeduct)
      } else {
        // 일반 휴가 차감 (연차, 병가)
        if (leaveType === '병가') {
          const currentUsed = updatedLeaveTypes['used_sick_days'] || 0
          updatedLeaveTypes['used_sick_days'] = currentUsed + daysToDeduct
        } else if (leaveType === '연차' || leaveType.includes('반차')) {
          const currentUsed = updatedLeaveTypes['used_annual_days'] || 0
          updatedLeaveTypes['used_annual_days'] = currentUsed + daysToDeduct
        }
      }

      // 휴가 데이터 업데이트
      const { error: updateError } = await supabase
        .from('leave_days')
        .update({
          leave_types: updatedLeaveTypes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', request.user_id)

      if (updateError) {
        return { success: false, error: '휴가 데이터 업데이트에 실패했습니다.' }
      }
    }

    // 요청 승인 처리
    const { error: approveError } = await supabase
      .from('form_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: adminUserId,
        admin_notes: adminNote
      })
      .eq('id', requestId)

    if (approveError) {
      return { success: false, error: '승인 처리에 실패했습니다.' }
    }

    // 알림 생성 (선택적)
    try {
      await supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          message: `${request.form_type} 신청이 승인되었습니다.`,
          link: '/user',
          is_read: false
        })
    } catch (notificationError) {
      console.log('알림 생성 실패:', notificationError)
      // 알림 실패는 전체 프로세스를 중단하지 않음
    }

    return { success: true, message: '승인 완료' }

  } catch (error) {
    console.error('Fallback 승인 처리 오류:', error)
    return { success: false, error: '승인 처리 중 오류가 발생했습니다.' }
  }
}
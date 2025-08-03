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
  // PostgreSQL 함수를 사용하여 원자적으로 처리
  const { data, error } = await supabase.rpc('submit_leave_request_safe', {
    p_user_id: userId,
    p_form_type: formType,
    p_request_data: requestData
  })

  if (error) {
    // 에러 메시지가 있으면 그대로 반환
    if (error.message) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '휴가 신청 처리 중 오류가 발생했습니다.' }
  }

  return { success: true, data }
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

  if (error) {
    if (error.message) {
      return { success: false, error: error.message }
    }
    return { success: false, error: '휴가 승인 처리 중 오류가 발생했습니다.' }
  }

  return { success: true, data }
}
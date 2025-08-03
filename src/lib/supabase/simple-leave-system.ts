import { SupabaseClient } from '@supabase/supabase-js'

// 단순하고 신뢰할 수 있는 휴가 시스템
export class SimpleLeaveSystem {
  constructor(private supabase: SupabaseClient) {}

  // 휴가 잔량 조회 (단일 소스)
  async getAvailableHours(userId: string, leaveType: 'substitute' | 'compensatory'): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('leave_days')
        .select('substitute_leave_hours, compensatory_leave_hours')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        console.error('휴가 데이터 조회 실패:', error)
        return 0
      }

      const hours = leaveType === 'substitute' 
        ? data.substitute_leave_hours 
        : data.compensatory_leave_hours

      return Number(hours) || 0
    } catch (error) {
      console.error('휴가 잔량 조회 오류:', error)
      return 0
    }
  }

  // 휴가 신청 가능 여부 검증
  async canApplyForLeave(
    userId: string, 
    leaveType: 'substitute' | 'compensatory', 
    requestedHours: number
  ): Promise<{
    canApply: boolean
    availableHours: number
    message: string
  }> {
    try {
      const availableHours = await this.getAvailableHours(userId, leaveType)
      
      if (availableHours >= requestedHours) {
        return {
          canApply: true,
          availableHours,
          message: `신청 가능 (잔여: ${availableHours}시간, 신청: ${requestedHours}시간)`
        }
      } else {
        return {
          canApply: false,
          availableHours,
          message: `잔여량 부족 (잔여: ${availableHours}시간, 신청: ${requestedHours}시간)`
        }
      }
    } catch (error) {
      return {
        canApply: false,
        availableHours: 0,
        message: `검증 중 오류 발생: ${(error as Error).message}`
      }
    }
  }

  // 휴가 신청서 생성
  async createLeaveRequest(
    userId: string,
    formData: {
      leaveType: 'substitute' | 'compensatory'
      requestedHours: number
      startDate: string
      endDate: string
      reason: string
    }
  ): Promise<{
    success: boolean
    requestId?: string
    message: string
  }> {
    try {
      // 1. 신청 가능 여부 확인
      const validation = await this.canApplyForLeave(
        userId, 
        formData.leaveType, 
        formData.requestedHours
      )

      if (!validation.canApply) {
        return {
          success: false,
          message: validation.message
        }
      }

      // 2. 신청서 생성
      const requestData = {
        user_id: userId,
        form_type: '휴가 신청서',
        request_data: {
          '휴가형태': formData.leaveType === 'substitute' ? '대체휴가' : '보상휴가',
          '시작일': formData.startDate,
          '종료일': formData.endDate,
          '사유': formData.reason,
          '신청시간': formData.requestedHours
        },
        status: 'pending',
        submitted_at: new Date().toISOString()
      }

      const { data, error } = await this.supabase
        .from('form_requests')
        .insert(requestData)
        .select()
        .single()

      if (error || !data) {
        return {
          success: false,
          message: `신청서 생성 실패: ${error?.message || '알 수 없는 오류'}`
        }
      }

      return {
        success: true,
        requestId: data.id,
        message: '휴가 신청이 완료되었습니다.'
      }

    } catch (error) {
      return {
        success: false,
        message: `신청 중 오류 발생: ${(error as Error).message}`
      }
    }
  }

  // 휴가 승인 처리
  async approveLeaveRequest(
    requestId: string,
    adminUserId: string,
    adminNote?: string
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      // 1. 신청서 조회
      const { data: request, error: requestError } = await this.supabase
        .from('form_requests')
        .select(`
          *,
          users!inner(id, name)
        `)
        .eq('id', requestId)
        .single()

      if (requestError || !request) {
        return {
          success: false,
          message: `신청서를 찾을 수 없습니다: ${requestError?.message || ''}`
        }
      }

      if (request.status !== 'pending') {
        return {
          success: false,
          message: '이미 처리된 신청서입니다.'
        }
      }

      // 2. 휴가 정보 추출
      const requestData = request.request_data as any
      const leaveType = requestData['휴가형태'] === '대체휴가' ? 'substitute' : 'compensatory'
      const requestedHours = Number(requestData['신청시간']) || 0

      // 3. 잔량 재확인
      const validation = await this.canApplyForLeave(
        request.user_id,
        leaveType,
        requestedHours
      )

      if (!validation.canApply) {
        return {
          success: false,
          message: `승인 불가: ${validation.message}`
        }
      }

      // 4. 트랜잭션으로 승인 처리
      const { error: transactionError } = await this.supabase.rpc('approve_leave_transaction', {
        p_request_id: requestId,
        p_admin_user_id: adminUserId,
        p_admin_note: adminNote || '',
        p_leave_type: leaveType,
        p_requested_hours: requestedHours
      })

      if (transactionError) {
        // 트랜잭션 함수가 없으면 직접 처리
        return await this.fallbackApprovalProcess(
          request,
          adminUserId,
          adminNote,
          leaveType,
          requestedHours
        )
      }

      return {
        success: true,
        message: '휴가 승인이 완료되었습니다.'
      }

    } catch (error) {
      return {
        success: false,
        message: `승인 중 오류 발생: ${(error as Error).message}`
      }
    }
  }

  // 폴백 승인 처리 (트랜잭션 함수가 없을 때)
  private async fallbackApprovalProcess(
    request: any,
    adminUserId: string,
    adminNote: string | undefined,
    leaveType: 'substitute' | 'compensatory',
    requestedHours: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. 휴가 잔량 차감
      const { data: leaveData, error: leaveError } = await this.supabase
        .from('leave_days')
        .select('substitute_leave_hours, compensatory_leave_hours, leave_types')
        .eq('user_id', request.user_id)
        .single()

      if (leaveError || !leaveData) {
        return {
          success: false,
          message: '휴가 데이터 조회 실패'
        }
      }

      // 2. 차감 계산
      const currentHours = leaveType === 'substitute' 
        ? leaveData.substitute_leave_hours 
        : leaveData.compensatory_leave_hours

      const newHours = Number(currentHours) - requestedHours

      if (newHours < 0) {
        return {
          success: false,
          message: '잔여량이 부족합니다.'
        }
      }

      // 3. 데이터 업데이트
      const updateData: any = {
        updated_at: new Date().toISOString()
      }

      const updatedLeaveTypes = {
        ...leaveData.leave_types,
        [`${leaveType}_leave_hours`]: newHours
      }

      if (leaveType === 'substitute') {
        updateData.substitute_leave_hours = newHours
      } else {
        updateData.compensatory_leave_hours = newHours
      }

      updateData.leave_types = updatedLeaveTypes

      const { error: updateError } = await this.supabase
        .from('leave_days')
        .update(updateData)
        .eq('user_id', request.user_id)

      if (updateError) {
        return {
          success: false,
          message: '휴가 잔량 업데이트 실패'
        }
      }

      // 4. 신청서 상태 업데이트
      const { error: statusError } = await this.supabase
        .from('form_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: adminUserId,
          admin_note: adminNote
        })
        .eq('id', request.id)

      if (statusError) {
        return {
          success: false,
          message: '신청서 상태 업데이트 실패'
        }
      }

      // 5. 알림 전송
      await this.supabase
        .from('notifications')
        .insert({
          user_id: request.user_id,
          message: `${request.form_type} 신청이 승인되었습니다.`,
          link: '/user',
          is_read: false
        })

      return {
        success: true,
        message: '휴가 승인이 완료되었습니다.'
      }

    } catch (error) {
      return {
        success: false,
        message: `폴백 승인 중 오류: ${(error as Error).message}`
      }
    }
  }

  // 사용자 휴가 현황 조회
  async getUserLeaveStatus(userId: string): Promise<{
    success: boolean
    data?: {
      substituteHours: number
      compensatoryHours: number
      totalAvailable: number
      lastUpdated: string
    }
    message: string
  }> {
    try {
      const { data, error } = await this.supabase
        .from('leave_days')
        .select('substitute_leave_hours, compensatory_leave_hours, updated_at')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return {
          success: false,
          message: '휴가 데이터를 찾을 수 없습니다.'
        }
      }

      const substituteHours = Number(data.substitute_leave_hours) || 0
      const compensatoryHours = Number(data.compensatory_leave_hours) || 0

      return {
        success: true,
        data: {
          substituteHours,
          compensatoryHours,
          totalAvailable: substituteHours + compensatoryHours,
          lastUpdated: data.updated_at
        },
        message: '휴가 현황 조회 완료'
      }

    } catch (error) {
      return {
        success: false,
        message: `현황 조회 중 오류: ${(error as Error).message}`
      }
    }
  }
}
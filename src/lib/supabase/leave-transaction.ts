import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceRoleGoogleCalendarService } from '@/services/googleCalendarServiceAccount'

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
  // 개발환경에서는 강제로 fallback 사용 (함수가 없는 경우가 많음)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 개발환경에서 fallback 직접 사용')
    return await submitLeaveRequestFallback(supabase, userId, formType, requestData)
  }

  // PostgreSQL 함수를 우선 시도, 실패하면 fallback 사용
  const { data, error } = await supabase.rpc('submit_leave_request_safe', {
    p_user_id: userId,
    p_form_type: formType,
    p_request_data: requestData
  })

  // 함수가 없으면 직접 처리 (여러 에러 패턴 감지)
  if (error && (
    error.message.includes('function') ||
    error.message.includes('not found') ||
    error.message.includes('schema cache') ||
    error.code === 'PGRST202'
  )) {
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

    console.log('🔍 전체 휴가 데이터 확인:', {
      userId,
      leaveData,
      leaveTypes,
      formType,
      leaveType
    })

    // 시간 단위 휴가 처리 (대체휴가, 보상휴가)
    if (leaveType === '대체휴가' || leaveType === '보상휴가') {
      const hoursToDeduct = daysToDeduct * 8
      const fieldName = leaveType === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
      
      // Gemini 권장: 표준화된 조회 로직 (별도 컬럼 우선)
      const availableHours = leaveData[fieldName] ?? leaveTypes[fieldName] ?? 0
      const rawValue = leaveData[fieldName] ?? leaveTypes[fieldName]
      
      console.log(`🔍 ${leaveType} 상세 검증 (표준화된 로직):`, {
        fieldName,
        // 별도 컬럼에서 조회
        separateColumnValue: leaveData[fieldName],
        separateColumnType: typeof leaveData[fieldName],
        // JSON 필드에서 조회
        jsonFieldValue: leaveTypes[fieldName],
        jsonFieldType: typeof leaveTypes[fieldName],
        // 최종 값
        rawValue,
        availableHours,
        hoursToDeduct,
        daysToDeduct,
        // 전체 데이터 구조
        fullLeaveData: {
          substitute_leave_hours: leaveData.substitute_leave_hours,
          compensatory_leave_hours: leaveData.compensatory_leave_hours
        },
        fullLeaveTypes: leaveTypes
      })

      // 필드가 존재하지 않는 경우 (별도 컬럼과 JSON 필드 모두 확인)
      if (rawValue === undefined && !leaveTypes.hasOwnProperty(fieldName)) {
        console.error(`❌ ${leaveType} 필드 누락:`, { 
          fieldName,
          separateColumn: leaveData[fieldName],
          jsonField: leaveTypes[fieldName]
        })
        return {
          success: false,
          error: `${leaveType} 데이터가 초기화되지 않았습니다. 관리자가 [시간 단위 휴가 지급] 기능으로 먼저 시간을 지급해주세요.`
        }
      }

      // null, undefined, NaN 체크
      if (rawValue === null || rawValue === undefined || isNaN(Number(rawValue))) {
        console.error(`❌ ${leaveType} 값이 유효하지 않음:`, rawValue)
        return {
          success: false,
          error: `${leaveType} 값이 올바르지 않습니다. 관리자에게 문의해주세요. (현재값: ${rawValue})`
        }
      }

      const numericHours = Number(availableHours)
      if (numericHours < hoursToDeduct) {
        console.error(`❌ ${leaveType} 부족:`, { 
          available: numericHours, 
          required: hoursToDeduct 
        })
        return {
          success: false,
          error: `잔여 ${leaveType}가 부족합니다. (잔여: ${numericHours}시간, 필요: ${hoursToDeduct}시간)`
        }
      }

      console.log(`✅ ${leaveType} 검증 통과:`, {
        available: numericHours,
        required: hoursToDeduct,
        remaining: numericHours - hoursToDeduct
      })
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

  // 함수가 없으면 직접 처리 (여러 에러 패턴 감지)
  if (error && (
    error.message.includes('function') ||
    error.message.includes('not found') ||
    error.message.includes('schema cache') ||
    error.code === 'PGRST202'
  )) {
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
    // 요청 정보와 사용자 정보 조회
    const { data: request, error: requestError } = await supabase
      .from('form_requests')
      .select(`
        *,
        users!form_requests_user_id_fkey(name, email)
      `)
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

      // 휴가 데이터 업데이트 (JSON 필드와 별도 컬럼 모두 업데이트)
      const updateData: any = {
        leave_types: updatedLeaveTypes,
        updated_at: new Date().toISOString()
      }
      
      // 시간 단위 휴가인 경우 별도 컬럼도 업데이트
      if (leaveType === '대체휴가') {
        updateData.substitute_leave_hours = updatedLeaveTypes.substitute_leave_hours
      } else if (leaveType === '보상휴가') {
        updateData.compensatory_leave_hours = updatedLeaveTypes.compensatory_leave_hours
      }
      
      const { error: updateError } = await supabase
        .from('leave_days')
        .update(updateData)
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

    // Google Calendar 연동 (휴가 신청서인 경우)
    if (request.form_type === '휴가 신청서') {
      try {
        await createCalendarEventForLeave(request, request.users)
      } catch (calendarError) {
        console.log('캘린더 이벤트 생성 실패:', calendarError)
        // 캘린더 실패는 전체 프로세스를 중단하지 않음
      }
    }

    // 알림 생성
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
    }

    return { success: true, message: '승인 완료' }

  } catch (error) {
    console.error('Fallback 승인 처리 오류:', error)
    return { success: false, error: '승인 처리 중 오류가 발생했습니다.' }
  }
}

/**
 * 휴가 승인 시 Google Calendar 이벤트 생성
 */
async function createCalendarEventForLeave(request: any, user: any) {
  try {
    const requestData = request.request_data
    const leaveType = requestData['휴가형태']
    const startDate = requestData['시작일']
    const endDate = requestData['종료일']
    const reason = requestData['사유'] || ''

    // Google Calendar 서비스 생성
    const calendarService = await createServiceRoleGoogleCalendarService()
    
    // 이벤트 제목 생성
    const eventTitle = `🏖️ ${user.name} - ${leaveType}`
    
    // 이벤트 설명 생성
    let description = `직원: ${user.name}\n휴가 종류: ${leaveType}\n`
    if (reason) {
      description += `사유: ${reason}\n`
    }
    description += `\n승인 시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`

    // 반차인 경우 시간 설정
    const isHalfDay = leaveType?.includes('반차')
    let eventData: any

    if (isHalfDay) {
      // 반차는 시간 단위로 설정
      const isAfternoon = leaveType.includes('오후')
      const startTime = isAfternoon ? '13:00:00' : '09:00:00'
      const endTime = isAfternoon ? '18:00:00' : '12:00:00'
      
      eventData = {
        summary: eventTitle,
        description: description,
        start: {
          dateTime: `${startDate}T${startTime}+09:00`,
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: `${startDate}T${endTime}+09:00`,
          timeZone: 'Asia/Seoul'
        },
        extendedProperties: {
          shared: {
            'hr_leave_request_id': request.id,
            'employee_email': user.email,
            'leave_type': leaveType
          }
        }
      }
    } else {
      // 종일 휴가는 날짜 단위로 설정
      const nextDay = new Date(endDate)
      nextDay.setDate(nextDay.getDate() + 1)
      
      eventData = {
        summary: eventTitle,
        description: description,
        start: {
          date: startDate,
          timeZone: 'Asia/Seoul'
        },
        end: {
          date: nextDay.toISOString().split('T')[0],
          timeZone: 'Asia/Seoul'
        },
        extendedProperties: {
          shared: {
            'hr_leave_request_id': request.id,
            'employee_email': user.email,
            'leave_type': leaveType
          }
        }
      }
    }

    // 회사 HR 캘린더에 이벤트 생성 (환경 변수에서 캘린더 ID 가져오기)
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
    const event = await calendarService.createEvent(calendarId, eventData)
    
    console.log('✅ Google Calendar 이벤트 생성 완료:', {
      eventId: event.id,
      title: eventTitle,
      startDate: startDate,
      endDate: endDate,
      leaveType: leaveType
    })

    return event

  } catch (error) {
    console.error('❌ Google Calendar 이벤트 생성 실패:', error)
    
    // 개발 환경에서는 에러를 상세히 로깅
    if (process.env.NODE_ENV === 'development') {
      console.error('Calendar service error details:', {
        message: (error as Error).message,
        stack: (error as Error).stack
      })
    }
    
    throw error
  }
}
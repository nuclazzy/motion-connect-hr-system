import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { calculateOvertimeLeave, getLeaveTypeName } from '@/lib/calculateOvertimeLeave'
import { calculateHoursToDeduct } from '@/lib/hoursToLeaveDay'
import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { createServiceRoleGoogleCalendarService } from '@/services/googleCalendarServiceAccount'

// Helper function to calculate leave days (excluding weekends and holidays)
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

// Helper function to create Google Calendar event with enhanced metadata
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createCalendarEvent(requestData: Record<string, any>, requestId: string, userId: string, userName: string) {
  try {
    const isHalfDay = requestData.휴가형태?.includes('반차')
    const startDate = requestData.시작일
    const endDate = requestData.종료일 || startDate
    
    let eventData
    
    if (isHalfDay) {
      // 반차의 경우 시간 지정 이벤트
      let timeStart = ''
      let timeEnd = ''
      
      if (requestData.휴가형태 === '오전 반차') {
        timeStart = 'T09:00:00'
        timeEnd = 'T13:00:00'
      } else if (requestData.휴가형태 === '오후 반차') {
        timeStart = 'T13:00:00'
        timeEnd = 'T18:00:00'
      } else {
        // 기본 반차 처리
        timeStart = 'T09:00:00'
        timeEnd = 'T13:00:00'
      }
      
      eventData = {
        summary: `[휴가] ${userName} - ${requestData.휴가형태}`,
        description: `휴가 유형: ${requestData.휴가형태}\n사유: ${requestData.사유 || ''}\n신청자: ${userName}`,
        start: {
          dateTime: `${startDate}${timeStart}`,
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: `${endDate}${timeEnd}`,
          timeZone: 'Asia/Seoul'
        },
        extendedProperties: {
          shared: {
            userId: userId,
            requestId: requestId,
            leaveType: requestData.휴가형태,
            isHalfDay: 'true',
            approvedAt: new Date().toISOString(),
            source: 'motion-connect'
          }
        }
      }
    } else {
      // 종일 휴가의 경우 종일 이벤트로 생성
      // 종료일은 다음 날로 설정 (Google Calendar 종일 이벤트 규칙)
      const actualEndDate = new Date(endDate)
      actualEndDate.setDate(actualEndDate.getDate() + 1)
      const formattedEndDate = actualEndDate.toISOString().split('T')[0]
      
      eventData = {
        summary: `[휴가] ${userName} - ${requestData.휴가형태}`,
        description: `휴가 유형: ${requestData.휴가형태}\n사유: ${requestData.사유 || ''}\n신청자: ${userName}`,
        start: {
          date: startDate
        },
        end: {
          date: formattedEndDate
        },
        extendedProperties: {
          shared: {
            userId: userId,
            requestId: requestId,
            leaveType: requestData.휴가형태,
            isHalfDay: 'false',
            approvedAt: new Date().toISOString(),
            source: 'motion-connect'
          }
        }
      }
    }

    // Google Calendar Service 직접 사용
    const googleCalendarService = await createServiceRoleGoogleCalendarService()
    
    // 휴가 전용 캘린더에 이벤트 생성
    const event = await googleCalendarService.createEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, eventData)
    
    console.log('✅ 휴가 캘린더 이벤트 생성 완료:', {
      eventId: event.id,
      calendar: '연차 및 경조사 현황',
      user: userName,
      leaveType: requestData.휴가형태,
      period: `${startDate} ~ ${endDate}`
    })
    
    return event.id
  } catch (error) {
    console.error('❌ 휴가 캘린더 이벤트 생성 오류:', error)
    throw error
  }
}

// Helper function to send notification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendNotification(supabase: any, userId: string, message: string, link?: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      message,
      link,
      is_read: false
    })
  } catch (error) {
    console.error('알림 전송 실패:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { requestId, action, adminNote } = await request.json()
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
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 서식 요청 조회
    const { data: formRequest, error: requestError } = await serviceRoleSupabase
      .from('form_requests')
      .select(`
        *,
        users!inner(id, name, department, position)
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !formRequest) {
      return NextResponse.json({ error: '서식 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (formRequest.status !== 'pending') {
      return NextResponse.json({ error: '이미 처리된 요청입니다.' }, { status: 400 })
    }

    let eventId = null
    let leaveBalanceUpdated = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalLeaveData: any = null

    try {
      if (action === 'approve') {
        // 휴가 신청서인 경우 특별 처리
        if (formRequest.form_type === '휴가 신청서') {
          const requestData = formRequest.request_data
          const isHalfDay = requestData.휴가형태?.includes('반차')
          const daysToDeduct = calculateWorkingDays(requestData.시작일, requestData.종료일, isHalfDay)

          // 휴가 잔여일수 확인 및 차감
          const { data: leaveDaysData, error: leaveDaysError } = await serviceRoleSupabase
            .from('leave_days')
            .select('leave_types')
            .eq('user_id', formRequest.user_id)
            .single()

          if (leaveDaysError || !leaveDaysData) {
            return NextResponse.json({ error: '휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
          }

          // 원본 데이터 저장 (롤백용)
          originalLeaveData = leaveDaysData.leave_types

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const leaveTypes = leaveDaysData.leave_types as Record<string, any>
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let updatedLeaveTypes: any
          
          // 휴가 타입별 처리
          if (requestData.휴가형태 === '대체휴가' || requestData.휴가형태 === '보상휴가') {
            // 시간 단위 휴가 차감 - 시간 단위 휴가는 주말 관계없이 단순 계산
            const simpleDays = requestData.시작일 === requestData.종료일 ? 1 : 
              Math.ceil((new Date(requestData.종료일).getTime() - new Date(requestData.시작일).getTime()) / (1000 * 3600 * 24)) + 1
            const hoursToDeduct = calculateHoursToDeduct(simpleDays)
            const fieldName = requestData.휴가형태 === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
            const availableHours = leaveTypes[fieldName] || 0
            
            if (availableHours < hoursToDeduct) {
              return NextResponse.json({ 
                error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${availableHours}시간, 필요: ${hoursToDeduct}시간)` 
              }, { status: 400 })
            }

            updatedLeaveTypes = {
              ...leaveTypes,
              [fieldName]: availableHours - hoursToDeduct
            }
          } else {
            // 기존 연차/병가 처리
            let leaveTypeKey = 'annual'
            if (requestData.휴가형태 === '병가') {
              leaveTypeKey = 'sick'
            }

            const totalDays = leaveTypes[leaveTypeKey]?.total || 0
            const usedDays = leaveTypes[leaveTypeKey]?.used || 0
            const remainingDays = totalDays - usedDays

            if (remainingDays < daysToDeduct) {
              return NextResponse.json({ 
                error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${remainingDays}일, 필요: ${daysToDeduct}일)` 
              }, { status: 400 })
            }

            updatedLeaveTypes = {
              ...leaveTypes,
              [leaveTypeKey]: {
                ...leaveTypes[leaveTypeKey],
                used: (leaveTypes[leaveTypeKey]?.used || 0) + daysToDeduct
              }
            }
          }

          const { error: updateError } = await serviceRoleSupabase
            .from('leave_days')
            .update({ leave_types: updatedLeaveTypes })
            .eq('user_id', formRequest.user_id)

          if (updateError) {
            console.error('휴가 일수 차감 실패:', updateError)
            return NextResponse.json({ error: '휴가 일수 차감에 실패했습니다.' }, { status: 500 })
          }

          leaveBalanceUpdated = true

          // Google Calendar 이벤트 생성
          try {
            eventId = await createCalendarEvent(
              requestData,
              requestId,
              formRequest.user_id,
              formRequest.users.name
            )
          } catch (calendarError) {
            // 캘린더 생성 실패 시 휴가 일수 롤백
            if (leaveBalanceUpdated && originalLeaveData) {
              await serviceRoleSupabase
                .from('leave_days')
                .update({ leave_types: originalLeaveData })
                .eq('user_id', formRequest.user_id)
            }
            
            console.error('캘린더 이벤트 생성 실패:', calendarError)
            return NextResponse.json({ error: '캘린더 이벤트 생성에 실패했습니다.' }, { status: 500 })
          }
        }

        // 초과근무 신청서인 경우 보상휴가 자동 지급
        if (formRequest.form_type === '초과근무 신청서') {
          const requestData = formRequest.request_data
          
          try {
            // 보상휴가 계산
            const overtimeResult = calculateOvertimeLeave(
              requestData.근무일,
              requestData.시작시간,
              requestData.종료시간,
              requestData['저녁식사 여부'] === '예'
            )

            // 현재 직원의 휴가 데이터 조회
            const { data: leaveDaysData, error: leaveDaysError } = await serviceRoleSupabase
              .from('leave_days')
              .select('leave_types')
              .eq('user_id', formRequest.user_id)
              .single()

            if (leaveDaysError || !leaveDaysData) {
              console.error('직원 휴가 데이터 조회 실패:', leaveDaysError)
              return NextResponse.json({ error: '직원의 휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const leaveTypes = leaveDaysData.leave_types as Record<string, any>
            
            // 보상휴가 필드 이름 결정
            const fieldName = overtimeResult.leaveType === 'substitute' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
            
            // 기존 보상휴가 시간에 추가
            const currentHours = leaveTypes[fieldName] || 0
            const updatedHours = currentHours + overtimeResult.compensationHours

            // 휴가 데이터 업데이트
            const updatedLeaveTypes = {
              ...leaveTypes,
              [fieldName]: updatedHours
            }

            const { error: updateError } = await serviceRoleSupabase
              .from('leave_days')
              .update({ leave_types: updatedLeaveTypes })
              .eq('user_id', formRequest.user_id)

            if (updateError) {
              console.error('보상휴가 지급 실패:', updateError)
              return NextResponse.json({ error: '보상휴가 지급에 실패했습니다.' }, { status: 500 })
            }

            const leaveTypeName = getLeaveTypeName(overtimeResult.leaveType)
            
            // 직원에게 보상휴가 지급 알림
            await sendNotification(
              serviceRoleSupabase,
              formRequest.user_id,
              `초과근무 승인으로 ${leaveTypeName} ${overtimeResult.compensationHours}시간이 지급되었습니다.`,
              '/user'
            )

            // 대체휴가인 경우 즉시 사용 권고 알림
            if (overtimeResult.leaveType === 'substitute') {
              await sendNotification(
                serviceRoleSupabase,
                formRequest.user_id,
                `대체휴가 ${overtimeResult.compensationHours}시간이 지급되었습니다. 지급된 휴가는 가급적 해당 주에 사용하는 것을 권고드립니다.`,
                '/user'
              )
            }

            console.log(`⏰ [초과근무승인] ${formRequest.users.name}님에게 ${leaveTypeName} ${overtimeResult.compensationHours}시간 지급`)

          } catch (overtimeError) {
            console.error('초과근무 보상휴가 지급 실패:', overtimeError)
            return NextResponse.json({ error: '초과근무 보상휴가 지급에 실패했습니다.' }, { status: 500 })
          }
        }

        // 서식 요청 승인 처리
        const { error: approveError } = await serviceRoleSupabase
          .from('form_requests')
          .update({
            status: 'approved',
            processed_at: new Date().toISOString(),
            processed_by: adminUserId,
            admin_note: adminNote
          })
          .eq('id', requestId)

        if (approveError) {
          // 승인 실패 시 생성된 캘린더 이벤트 삭제
          if (eventId) {
            try {
              const googleCalendarService = await createServiceRoleGoogleCalendarService()
              await googleCalendarService.deleteEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, eventId)
              console.log('✅ 롤백: 캘린더 이벤트 삭제 완료')
            } catch (deleteError) {
              console.error('캘린더 이벤트 삭제 실패:', deleteError)
            }
          }

          // 휴가 일수 롤백
          if (leaveBalanceUpdated && originalLeaveData) {
            await serviceRoleSupabase
              .from('leave_days')
              .update({ leave_types: originalLeaveData })
              .eq('user_id', formRequest.user_id)
          }

          console.error('서식 요청 승인 실패:', approveError)
          return NextResponse.json({ error: '승인 처리에 실패했습니다.' }, { status: 500 })
        }

        // 직원에게 승인 알림 전송
        await sendNotification(
          serviceRoleSupabase,
          formRequest.user_id,
          `${formRequest.form_type} 신청이 승인되었습니다.`,
          '/user'
        )

      } else if (action === 'reject') {
        // 서식 요청 거절 처리
        const { error: rejectError } = await serviceRoleSupabase
          .from('form_requests')
          .update({
            status: 'rejected',
            processed_at: new Date().toISOString(),
            processed_by: adminUserId,
            admin_note: adminNote
          })
          .eq('id', requestId)

        if (rejectError) {
          console.error('서식 요청 거절 실패:', rejectError)
          return NextResponse.json({ error: '거절 처리에 실패했습니다.' }, { status: 500 })
        }

        // 직원에게 거절 알림 전송
        await sendNotification(
          serviceRoleSupabase,
          formRequest.user_id,
          `${formRequest.form_type} 신청이 거절되었습니다. 사유: ${adminNote || '사유 없음'}`,
          '/user'
        )
      }

      return NextResponse.json({ 
        success: true, 
        message: `${formRequest.form_type} ${action === 'approve' ? '승인' : '거절'} 완료`,
        eventId 
      })

    } catch (error) {
      console.error('서식 요청 처리 오류:', error)
      return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

  } catch (error) {
    console.error('API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
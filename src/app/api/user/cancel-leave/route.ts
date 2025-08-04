import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

// Helper function to send notification to admin
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendAdminNotification(supabase: any, message: string, link?: string) {
  try {
    // 모든 관리자에게 알림 전송
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notifications = admins.map((admin: any) => ({
        user_id: admin.id,
        message,
        link,
        is_read: false
      }))

      await supabase.from('notifications').insert(notifications)
    }
  } catch (error) {
    console.error('관리자 알림 전송 실패:', error)
  }
}

// Helper function to find and delete calendar event using extendedProperties
async function deleteCalendarEventByMetadata(requestId: string, userId: string) {
  try {
    // 휴가 전용 캘린더에서 이벤트 조회
    const response = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
        timeMin: new Date(new Date().getFullYear(), 0, 1).toISOString(), // 올해 1월 1일부터
        timeMax: new Date(new Date().getFullYear(), 11, 31).toISOString(), // 올해 12월 31일까지
        maxResults: 500
      })
    })

    if (!response.ok) {
      throw new Error('휴가 캘린더 이벤트 조회 실패')
    }

    const { events } = await response.json()
    
    // extendedProperties를 통해 해당 요청의 이벤트 찾기
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetEvent = events.find((event: any) => 
      event.extendedProperties?.shared?.requestId === requestId &&
      event.extendedProperties?.shared?.userId === userId &&
      event.extendedProperties?.shared?.source === 'motion-connect'
    )

    if (targetEvent) {
      const deleteResponse = await fetch('/api/calendar/delete-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          eventId: targetEvent.id,
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT
        })
      })

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text()
        throw new Error(`휴가 캘린더 이벤트 삭제 실패: ${errorText}`)
      }

      console.log('✅ 휴가 캘린더 이벤트 삭제 완료:', {
        eventId: targetEvent.id,
        calendar: '연차 및 경조사 현황',
        requestId
      })

      return targetEvent.id
    } else {
      console.warn('❌ 해당 요청의 캘린더 이벤트를 찾을 수 없습니다:', {
        requestId,
        userId,
        searchedCalendar: '연차 및 경조사 현황',
        totalEvents: events.length
      })
      return null
    }
  } catch (error) {
    console.error('❌ 휴가 캘린더 이벤트 삭제 오류:', error)
    throw error
  }
}

// Helper function to calculate leave days for restoration
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
    const { requestId } = await request.json()
    const supabase = await createClient()
    const serviceRoleSupabase = await createServiceRoleClient()

    // 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // 서식 요청 조회 (본인의 요청인지 확인)
    const { data: formRequest, error: requestError } = await serviceRoleSupabase
      .from('form_requests')
      .select(`
        *,
        users!inner(id, name, department, position)
      `)
      .eq('id', requestId)
      .eq('user_id', userId) // 본인의 요청만 취소 가능
      .single()

    if (requestError || !formRequest) {
      return NextResponse.json({ error: '서식 요청을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (formRequest.status !== 'approved') {
      return NextResponse.json({ error: '승인된 요청만 취소할 수 있습니다.' }, { status: 400 })
    }

    // 휴가 신청서인 경우에만 휴가 일수 복원 처리
    if (formRequest.form_type === '휴가 신청서') {
      const requestData = formRequest.request_data
      const leaveType = requestData?.['휴가형태'] || '';
      const leaveDays = parseFloat(requestData?.['휴가일수'] || requestData?.['신청일수'] || '0');

      if (leaveDays > 0) {
        let updateField = '';
        let isHourlyLeave = false;
        
        // 휴가 타입별 필드 매핑 (AdminFormManagement와 동일한 로직)
        if (leaveType === '연차') {
          updateField = 'used_annual_days';
        } else if (leaveType === '병가') {
          updateField = 'used_sick_days';
        } else if (leaveType === '대체휴가' || requestData?.['_leaveCategory'] === 'substitute') {
          updateField = 'substitute_leave_hours';
          isHourlyLeave = true;
        } else if (leaveType === '보상휴가' || requestData?.['_leaveCategory'] === 'compensatory') {
          updateField = 'compensatory_leave_hours';
          isHourlyLeave = true;
        }

        if (updateField) {
          console.log('🔍 휴가 복원 처리:', {
            leaveType,
            leaveDays,
            updateField,
            isHourlyLeave,
            userId
          });

          const { data: userData, error: userDataError } = await serviceRoleSupabase
            .from('users')
            .select(updateField)
            .eq('id', userId)
            .single();

          if (userDataError) {
            return NextResponse.json({ error: '사용자 휴가 정보 조회 실패' }, { status: 500 })
          }

          let newValue;
          const currentValue = (userData as any)?.[updateField] || 0;
          
          if (isHourlyLeave) {
            // 시간 단위 휴가는 시간으로 복원 (1일 = 8시간)
            const hoursToRestore = leaveDays * 8;
            newValue = currentValue + hoursToRestore;
          } else {
            // 일 단위 휴가는 사용 일수에서 차감
            newValue = Math.max(0, currentValue - leaveDays);
          }
          
          console.log('🔍 휴가 복원 계산:', {
            currentValue,
            leaveDays,
            newValue,
            operation: isHourlyLeave ? 'add_hours' : 'subtract_used_days'
          });

          const { error: updateError } = await serviceRoleSupabase
            .from('users')
            .update({ [updateField]: newValue })
            .eq('id', userId);

          if (updateError) {
            console.error('휴가 일수 복원 실패:', updateError)
            return NextResponse.json({ error: '휴가 일수 복원에 실패했습니다.' }, { status: 500 })
          }
          
          console.log('✅ 휴가 복원 완료:', { updateField, newValue });
        }
      }
    }

    // 서식 요청 상태를 'cancelled'로 업데이트
    const { error: cancelError } = await serviceRoleSupabase
      .from('form_requests')
      .update({
        status: 'cancelled',
        processed_at: new Date().toISOString(),
        admin_note: '직원이 직접 취소'
      })
      .eq('id', requestId)

    if (cancelError) {
      console.error('서식 요청 취소 실패:', cancelError)
      return NextResponse.json({ error: '취소 처리에 실패했습니다.' }, { status: 500 })
    }

    // 캘린더 이벤트 삭제 (휴가 신청서인 경우)
    let deletedEventId = null
    if (formRequest.form_type === '휴가 신청서') {
      try {
        deletedEventId = await deleteCalendarEventByMetadata(requestId, userId)
        if (deletedEventId) {
          console.log(`📅 캘린더 이벤트 삭제 완료: ${deletedEventId}`)
        }
      } catch (calendarError) {
        console.error('캘린더 이벤트 삭제 실패:', calendarError)
        // 캘린더 삭제 실패는 치명적이지 않으므로 계속 진행
      }
    }

    // 관리자에게 취소 알림 전송
    await sendAdminNotification(
      serviceRoleSupabase,
      `${formRequest.users.name}님이 ${formRequest.form_type} 신청을 취소했습니다.`,
      '/admin'
    )

    return NextResponse.json({ 
      success: true, 
      message: `${formRequest.form_type} 취소가 완료되었습니다.`,
      deletedEventId
    })

  } catch (error) {
    console.error('휴가 취소 API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
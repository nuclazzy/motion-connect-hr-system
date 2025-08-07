/**
 * Google Calendar Server-side 연동 (Service Account 방식)
 * 브라우저 OAuth 대신 서버 사이드에서 처리
 */

interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  attendees?: { email: string }[]
}

/**
 * 휴가 이벤트 생성 (Server Action)
 */
export const createLeaveEventServerSide = async (
  leaveData: {
    leaveType: string
    leaveDays: number
    startDate: string
    endDate: string
    reason: string
    formRequestId: string
  },
  user: {
    id: string
    name: string
    department: string
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> => {
  try {
    // 서버 사이드에서 Google Calendar API 호출
    const response = await fetch('/api/calendar/create-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `[${leaveData.leaveType}] ${user.name} (${user.department})`,
        description: `휴가 사유: ${leaveData.reason}\\n신청 ID: ${leaveData.formRequestId}\\n일수: ${leaveData.leaveDays}일`,
        startDate: leaveData.startDate,
        endDate: leaveData.endDate,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    
    return {
      success: true,
      eventId: result.eventId
    }
  } catch (error) {
    console.error('휴가 이벤트 생성 오류 (서버사이드):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 클라이언트에서 사용할 래퍼 함수들
 */
export const createLeaveEvent = createLeaveEventServerSide

export const fetchCalendarEvents = async (
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<CalendarEvent[]> => {
  try {
    const response = await fetch(`/api/calendar/events?calendarId=${calendarId}&timeMin=${timeMin}&timeMax=${timeMax}`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('캘린더 이벤트 조회 오류:', error)
    return []
  }
}
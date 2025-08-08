/**
 * Google Calendar 클라이언트 - Service Account API 호출
 * 서버의 Service Account를 통해 캘린더 데이터 가져오기
 */

/**
 * 서버에서 캘린더 이벤트 가져오기
 */
export const fetchCalendarEventsFromServer = async (
  calendarId: string,
  timeMin?: string,
  timeMax?: string
): Promise<any[]> => {
  try {
    const params = new URLSearchParams();
    params.append('calendarId', calendarId);
    if (timeMin) params.append('timeMin', timeMin);
    if (timeMax) params.append('timeMax', timeMax);

    const response = await fetch(`/api/calendar/server-events?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }

    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Error fetching calendar events from server:', error);
    return [];
  }
};

/**
 * 서버에서 여러 캘린더의 이벤트 가져오기
 */
export const fetchMultipleCalendarEventsFromServer = async (
  calendarIds: string[],
  timeMin?: string,
  timeMax?: string
): Promise<{ [calendarId: string]: any[] }> => {
  try {
    const response = await fetch('/api/calendar/server-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'fetch-multiple',  // action 파라미터 추가
        calendarIds,
        timeMin,
        timeMax,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar events: ${response.statusText}`);
    }

    const data = await response.json();
    return data.events || {};
  } catch (error) {
    console.error('Error fetching multiple calendar events from server:', error);
    return {};
  }
};

/**
 * 이벤트 날짜 파싱
 */
export const parseEventDate = (event: any) => {
  const isAllDay = !event.start?.dateTime;
  const start = isAllDay ? event.start?.date : event.start?.dateTime;
  const end = isAllDay ? event.end?.date : event.end?.dateTime;
  
  return { start, end, isAllDay };
};

/**
 * 서버를 통해 캘린더 이벤트 생성
 */
export const createCalendarEventFromServer = async (
  calendarId: string,
  eventData: any
): Promise<any> => {
  try {
    const response = await fetch('/api/calendar/server-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create',
        calendarId,
        eventData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create calendar event: ${response.statusText}`);
    }

    const data = await response.json();
    return data.event;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

/**
 * 서버를 통해 캘린더 이벤트 수정
 */
export const updateCalendarEventFromServer = async (
  calendarId: string,
  eventId: string,
  eventData: any
): Promise<any> => {
  try {
    const response = await fetch('/api/calendar/server-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'update',
        calendarId,
        eventId,
        eventData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update calendar event: ${response.statusText}`);
    }

    const data = await response.json();
    return data.event;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
};

/**
 * 서버를 통해 캘린더 이벤트 삭제
 */
export const deleteCalendarEventFromServer = async (
  calendarId: string,
  eventId: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/calendar/server-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'delete',
        calendarId,
        eventId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete calendar event: ${response.statusText}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
};
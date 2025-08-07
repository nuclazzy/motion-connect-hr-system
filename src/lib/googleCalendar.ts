/**
 * Google Calendar 직접 연동 라이브러리
 * OAuth2 인증 및 캘린더 API 직접 호출
 */

import { CALENDAR_IDS } from './calendarMapping'

// Google Calendar API 설정
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events'

// Google API 클라이언트 상태
let gapiInited = false
let gisInited = false
let tokenClient: google.accounts.oauth2.TokenClient | null = null

/**
 * Google API 초기화
 */
export const initializeGoogleAPI = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // gapi 로드
    const script1 = document.createElement('script')
    script1.src = 'https://apis.google.com/js/api.js'
    script1.async = true
    script1.defer = true
    script1.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
          })
          gapiInited = true
          checkInitComplete()
        } catch (error) {
          console.error('Error initializing gapi:', error)
          reject(error)
        }
      })
    }
    document.body.appendChild(script1)

    // gis 로드
    const script2 = document.createElement('script')
    script2.src = 'https://accounts.google.com/gsi/client'
    script2.async = true
    script2.defer = true
    script2.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: '', // 나중에 설정
      })
      gisInited = true
      checkInitComplete()
    }
    document.body.appendChild(script2)

    function checkInitComplete() {
      if (gapiInited && gisInited) {
        resolve()
      }
    }
  })
}

/**
 * 토큰 가져오기
 */
const getAccessToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized'))
      return
    }

    // 토큰 콜백 설정
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(resp)
        return
      }
      resolve(resp.access_token)
    }

    // 기존 토큰 체크
    if (gapi.client.getToken() === null) {
      // 프롬프트 없이 토큰 요청
      tokenClient.requestAccessToken({ prompt: '' })
    } else {
      resolve(gapi.client.getToken().access_token)
    }
  })
}

/**
 * 캘린더 이벤트 목록 가져오기
 */
export const fetchCalendarEvents = async (
  calendarId: string,
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 2500
): Promise<gapi.client.calendar.Event[]> => {
  try {
    // API 초기화 확인
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPI()
    }

    // 토큰 가져오기
    await getAccessToken()

    // 이벤트 목록 요청
    const response = await gapi.client.calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date(new Date().getFullYear(), 0, 1).toISOString(),
      timeMax: timeMax || new Date(new Date().getFullYear(), 11, 31).toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults,
      orderBy: 'startTime',
    })

    return response.result.items || []
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    throw error
  }
}

/**
 * 여러 캘린더의 이벤트 가져오기
 */
export const fetchMultipleCalendarEvents = async (
  calendarIds: string[],
  timeMin?: string,
  timeMax?: string
): Promise<{ [calendarId: string]: gapi.client.calendar.Event[] }> => {
  const results: { [calendarId: string]: gapi.client.calendar.Event[] } = {}

  // 병렬로 모든 캘린더 이벤트 가져오기
  const promises = calendarIds.map(async (calendarId) => {
    try {
      const events = await fetchCalendarEvents(calendarId, timeMin, timeMax)
      results[calendarId] = events
    } catch (error) {
      console.error(`Error fetching events for calendar ${calendarId}:`, error)
      results[calendarId] = []
    }
  })

  await Promise.all(promises)
  return results
}

/**
 * 캘린더에 이벤트 생성
 */
export const createCalendarEvent = async (
  calendarId: string,
  event: {
    summary: string
    description?: string
    location?: string
    start: { date?: string; dateTime?: string; timeZone?: string }
    end: { date?: string; dateTime?: string; timeZone?: string }
    attendees?: { email: string }[]
    reminders?: {
      useDefault?: boolean
      overrides?: { method: string; minutes: number }[]
    }
  }
): Promise<gapi.client.calendar.Event> => {
  try {
    // API 초기화 확인
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPI()
    }

    // 토큰 가져오기
    await getAccessToken()

    // 이벤트 생성
    const response = await gapi.client.calendar.events.insert({
      calendarId,
      resource: event,
    })

    return response.result
  } catch (error) {
    console.error('Error creating calendar event:', error)
    throw error
  }
}

/**
 * 캘린더 이벤트 업데이트
 */
export const updateCalendarEvent = async (
  calendarId: string,
  eventId: string,
  event: Partial<gapi.client.calendar.Event>
): Promise<gapi.client.calendar.Event> => {
  try {
    // API 초기화 확인
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPI()
    }

    // 토큰 가져오기
    await getAccessToken()

    // 이벤트 업데이트
    const response = await gapi.client.calendar.events.patch({
      calendarId,
      eventId,
      resource: event,
    })

    return response.result
  } catch (error) {
    console.error('Error updating calendar event:', error)
    throw error
  }
}

/**
 * 캘린더 이벤트 삭제
 */
export const deleteCalendarEvent = async (
  calendarId: string,
  eventId: string
): Promise<void> => {
  try {
    // API 초기화 확인
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPI()
    }

    // 토큰 가져오기
    await getAccessToken()

    // 이벤트 삭제
    await gapi.client.calendar.events.delete({
      calendarId,
      eventId,
    })
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    throw error
  }
}

/**
 * 휴가 이벤트 생성 (LEAVE_MANAGEMENT 캘린더용)
 */
export const createLeaveEvent = async (
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
    const event = {
      summary: `[${leaveData.leaveType}] ${user.name} (${user.department})`,
      description: `휴가 사유: ${leaveData.reason}\n신청 ID: ${leaveData.formRequestId}\n일수: ${leaveData.leaveDays}일`,
      start: {
        date: leaveData.startDate,
        timeZone: 'Asia/Seoul',
      },
      end: {
        date: leaveData.endDate,
        timeZone: 'Asia/Seoul',
      },
    }

    const result = await createCalendarEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, event)
    
    return {
      success: true,
      eventId: result.id
    }
  } catch (error) {
    console.error('휴가 이벤트 생성 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

/**
 * 팀 일정 생성
 */
export const createTeamEvent = async (
  calendarId: string,
  eventData: {
    title: string
    description?: string
    startDateTime: string
    endDateTime: string
    attendees?: string[]
  }
): Promise<gapi.client.calendar.Event> => {
  const event = {
    summary: eventData.title,
    description: eventData.description,
    start: {
      dateTime: eventData.startDateTime,
      timeZone: 'Asia/Seoul',
    },
    end: {
      dateTime: eventData.endDateTime,
      timeZone: 'Asia/Seoul',
    },
    attendees: eventData.attendees?.map(email => ({ email })),
  }

  return createCalendarEvent(calendarId, event)
}

/**
 * 캘린더 이벤트 색상별 필터링
 */
export const filterEventsByColor = (
  events: gapi.client.calendar.Event[],
  colorId?: string
): gapi.client.calendar.Event[] => {
  if (!colorId) return events
  return events.filter(event => event.colorId === colorId)
}

/**
 * 이벤트 날짜 파싱 유틸리티
 */
export const parseEventDate = (event: gapi.client.calendar.Event): {
  start: Date
  end: Date
  isAllDay: boolean
} => {
  const isAllDay = !!event.start?.date
  
  const start = isAllDay
    ? new Date(event.start!.date!)
    : new Date(event.start!.dateTime!)
  
  const end = isAllDay
    ? new Date(event.end!.date!)
    : new Date(event.end!.dateTime!)
  
  return { start, end, isAllDay }
}

/**
 * 월별 이벤트 그룹화
 */
export const groupEventsByMonth = (
  events: gapi.client.calendar.Event[]
): { [monthKey: string]: gapi.client.calendar.Event[] } => {
  const grouped: { [monthKey: string]: gapi.client.calendar.Event[] } = {}
  
  events.forEach(event => {
    const { start } = parseEventDate(event)
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
    
    if (!grouped[monthKey]) {
      grouped[monthKey] = []
    }
    grouped[monthKey].push(event)
  })
  
  return grouped
}

/**
 * 오늘의 이벤트 필터링
 */
export const getTodayEvents = (
  events: gapi.client.calendar.Event[]
): gapi.client.calendar.Event[] => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  return events.filter(event => {
    const { start, end } = parseEventDate(event)
    return start < tomorrow && end > today
  })
}

/**
 * 이번 주 이벤트 필터링
 */
export const getThisWeekEvents = (
  events: gapi.client.calendar.Event[]
): gapi.client.calendar.Event[] => {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)
  
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  
  return events.filter(event => {
    const { start, end } = parseEventDate(event)
    return start < weekEnd && end > weekStart
  })
}

/**
 * 캘린더 권한 확인
 */
export const checkCalendarPermission = async (): Promise<boolean> => {
  try {
    // API 초기화 확인
    if (!gapiInited || !gisInited) {
      await initializeGoogleAPI()
    }

    // 토큰 가져오기
    await getAccessToken()
    
    return true
  } catch (error) {
    console.error('Calendar permission check failed:', error)
    return false
  }
}

/**
 * 로그아웃 (토큰 제거)
 */
export const revokeCalendarAccess = () => {
  const token = gapi.client.getToken()
  if (token) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      console.log('Calendar access revoked')
    })
    gapi.client.setToken(null)
  }
}
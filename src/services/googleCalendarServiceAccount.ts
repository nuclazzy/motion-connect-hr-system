/**
 * Google Calendar Service Account Integration
 * Supabase와 Google Calendar 연동을 위한 서비스
 */

import { google } from 'googleapis'

interface CalendarEvent {
  summary: string
  description?: string
  start: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone?: string
  }
  extendedProperties?: {
    shared?: Record<string, string>
  }
}

interface CalendarEventResponse {
  id: string
  summary?: string
  start?: {
    date?: string
    dateTime?: string
  }
  end?: {
    date?: string
    dateTime?: string
  }
}

class GoogleCalendarService {
  private calendar

  constructor(auth: any) {
    this.calendar = google.calendar({ version: 'v3', auth })
  }

  async createEvent(calendarId: string, eventData: CalendarEvent): Promise<CalendarEventResponse> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData,
      })

      return {
        id: response.data.id!,
        summary: response.data.summary || undefined,
        start: response.data.start ? {
          date: response.data.start.date || undefined,
          dateTime: response.data.start.dateTime || undefined
        } : undefined,
        end: response.data.end ? {
          date: response.data.end.date || undefined,
          dateTime: response.data.end.dateTime || undefined
        } : undefined,
      }
    } catch (error) {
      console.error('Google Calendar 이벤트 생성 실패:', error)
      throw error
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      })
    } catch (error) {
      console.error('Google Calendar 이벤트 삭제 실패:', error)
      throw error
    }
  }

  async updateEvent(calendarId: string, eventId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEventResponse> {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData,
      })

      return {
        id: response.data.id!,
        summary: response.data.summary || undefined,
        start: response.data.start ? {
          date: response.data.start.date || undefined,
          dateTime: response.data.start.dateTime || undefined
        } : undefined,
        end: response.data.end ? {
          date: response.data.end.date || undefined,
          dateTime: response.data.end.dateTime || undefined
        } : undefined,
      }
    } catch (error) {
      console.error('Google Calendar 이벤트 업데이트 실패:', error)
      throw error
    }
  }

  async getEvents(calendarId: string, timeMin?: string, timeMax?: string): Promise<CalendarEventResponse[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      })

      return response.data.items?.map(event => ({
        id: event.id!,
        summary: event.summary || undefined,
        start: event.start ? {
          date: event.start.date || undefined,
          dateTime: event.start.dateTime || undefined
        } : undefined,
        end: event.end ? {
          date: event.end.date || undefined,
          dateTime: event.end.dateTime || undefined
        } : undefined,
      })) || []
    } catch (error) {
      console.error('Google Calendar 이벤트 조회 실패:', error)
      throw error
    }
  }
}

export async function createServiceRoleGoogleCalendarService(): Promise<GoogleCalendarService> {
  try {
    // 환경 변수에서 서비스 계정 정보 로드
    const credentials = {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`,
    }

    // JWT 인증 설정
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'], // Calendar 스코프
    })

    // 인증 수행
    await auth.authorize()

    return new GoogleCalendarService(auth)
  } catch (error) {
    console.error('Google Calendar 서비스 초기화 실패:', error)
    
    // 개발 환경에서는 목업 서비스 반환
    if (process.env.NODE_ENV === 'development') {
      return createMockGoogleCalendarService()
    }
    
    throw error
  }
}

// 개발용 목업 서비스
function createMockGoogleCalendarService(): GoogleCalendarService {
  console.warn('⚠️ 개발 모드: Google Calendar 목업 서비스 사용')
  
  return {
    async createEvent(calendarId: string, eventData: CalendarEvent): Promise<CalendarEventResponse> {
      const mockId = `mock_event_${Date.now()}`
      console.log('📅 [MOCK] Calendar Event Created:', {
        id: mockId,
        calendarId,
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end,
      })
      
      return {
        id: mockId,
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end,
      }
    },

    async deleteEvent(calendarId: string, eventId: string): Promise<void> {
      console.log('🗑️ [MOCK] Calendar Event Deleted:', {
        calendarId,
        eventId,
      })
    },

    async updateEvent(calendarId: string, eventId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEventResponse> {
      console.log('✏️ [MOCK] Calendar Event Updated:', {
        calendarId,
        eventId,
        eventData,
      })
      
      return {
        id: eventId,
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end,
      }
    },

    async getEvents(calendarId: string, timeMin?: string, timeMax?: string): Promise<CalendarEventResponse[]> {
      console.log('📅 [MOCK] Calendar Events Retrieved:', {
        calendarId,
        timeMin,
        timeMax,
      })
      
      return []
    },
  } as GoogleCalendarService
}

export default GoogleCalendarService
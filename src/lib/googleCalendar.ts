import { google } from 'googleapis'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  attendees?: string[]
  calendarId: string
  calendarName: string
  color?: string
}

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  description: string | null
  color: string | null
  is_active: boolean
}

class GoogleCalendarService {
  private calendar: ReturnType<typeof google.calendar>
  private auth: InstanceType<typeof google.auth.GoogleAuth>

  constructor() {
    // Service Account 방식으로 인증 (서버사이드)
    this.auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    })

    this.calendar = google.calendar({ version: 'v3', auth: this.auth })
  }

  // 특정 캘린더에서 이벤트 가져오기
  async getEventsFromCalendar(calendarId: string, maxResults: number = 10): Promise<CalendarEvent[]> {
    try {
      const now = new Date()
      const endTime = new Date()
      endTime.setDate(now.getDate() + 30) // 앞으로 30일간의 이벤트

      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      })

      const events = response.data.items || []
      
      return events.map((event) => {
        const startObj = event.start
        const endObj = event.end
        const attendees = event.attendees
        
        return {
          id: event.id || '',
          title: event.summary || '제목 없음',
          start: startObj?.dateTime || startObj?.date || '',
          end: endObj?.dateTime || endObj?.date || '',
          description: event.description || '',
          location: event.location || '',
          attendees: attendees?.map((attendee) => attendee.email).filter((email): email is string => Boolean(email)) || [],
          calendarId: calendarId,
          calendarName: '', // 나중에 설정
          color: ''
        }
      })
    } catch (error) {
      console.error(`캘린더 ${calendarId}에서 이벤트 가져오기 실패:`, error)
      return []
    }
  }

  // 여러 캘린더에서 이벤트 가져오기
  async getEventsFromMultipleCalendars(configs: CalendarConfig[]): Promise<CalendarEvent[]> {
    const activeConfigs = configs.filter(config => config.is_active)
    
    const eventPromises = activeConfigs.map(async (config) => {
      const events = await this.getEventsFromCalendar(config.calendar_id, 5)
      return events.map(event => ({
        ...event,
        calendarName: config.calendar_alias || config.target_name,
        color: config.color || '#3B82F6'
      }))
    })

    try {
      const eventArrays = await Promise.all(eventPromises)
      const allEvents = eventArrays.flat()
      
      // 시작 시간으로 정렬
      return allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    } catch (error) {
      console.error('여러 캘린더에서 이벤트 가져오기 실패:', error)
      return []
    }
  }

  // 금주의 이벤트만 가져오기
  async getThisWeekEvents(configs: CalendarConfig[]): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsFromMultipleCalendars(configs)
    
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())) // 일요일
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6)) // 토요일
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate >= startOfWeek && eventDate <= endOfWeek
    })
  }

  // 오늘의 이벤트만 가져오기
  async getTodayEvents(configs: CalendarConfig[]): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsFromMultipleCalendars(configs)
    
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate >= startOfDay && eventDate <= endOfDay
    })
  }

  // 캘린더 접근 권한 테스트
  async testCalendarAccess(calendarId: string): Promise<boolean> {
    try {
      await this.calendar.calendars.get({
        calendarId: calendarId
      })
      return true
    } catch (error) {
      console.error(`캘린더 ${calendarId} 접근 테스트 실패:`, error)
      return false
    }
  }
}

// 서버사이드에서만 사용 (클라이언트에서는 API 라우트를 통해 접근)
export const googleCalendarService = new GoogleCalendarService()

// 클라이언트에서 사용할 타입들
export type { CalendarEvent, CalendarConfig }
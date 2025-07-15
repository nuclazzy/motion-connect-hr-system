// OAuth 2.0 방식 Google Calendar 연동

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  calendarId: string
  calendarName: string
  color?: string
}

interface GoogleCalendarConfig {
  clientId: string
  apiKey?: string
  scope: string
  discoveryDocs: string[]
}

class GoogleCalendarOAuth {
  private gapi: Record<string, unknown> | null = null
  private isSignedIn: boolean = false
  private config: GoogleCalendarConfig

  constructor() {
    this.config = {
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
    }
  }

  // Google API 스크립트 로드
  async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('브라우저 환경에서만 사용 가능합니다.'))
        return
      }

      if (window.gapi) {
        this.gapi = window.gapi
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = () => {
        this.gapi = window.gapi as Record<string, unknown>
        resolve()
      }
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  // Google API 초기화
  async initializeGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Google API 초기화 시작...')
      console.log('Client ID:', this.config.clientId)
      if (typeof window !== 'undefined') {
        console.log('현재 도메인:', window.location.origin)
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.gapi as any)?.load('client:auth2', async () => {
        try {
          console.log('Google client:auth2 로드 완료')
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.gapi as any)?.client?.init({
            clientId: this.config.clientId,
            scope: this.config.scope,
            discoveryDocs: this.config.discoveryDocs
          })

          console.log('Google client 초기화 완료')

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const authInstance = (this.gapi as any)?.auth2?.getAuthInstance()
          this.isSignedIn = authInstance?.isSignedIn?.get() || false
          
          console.log('현재 로그인 상태:', this.isSignedIn)
          
          // 로그인 상태 변경 리스너
          authInstance?.isSignedIn?.listen((isSignedIn: boolean) => {
            this.isSignedIn = isSignedIn
            console.log('로그인 상태 변경:', isSignedIn)
          })

          resolve()
        } catch (error) {
          console.error('Google API 초기화 실패:', error)
          console.error('에러 상세:', {
            name: (error as Error)?.name,
            message: (error as Error)?.message,
            stack: (error as Error)?.stack
          })
          reject(error)
        }
      })
    })
  }

  // 사용자 로그인
  async signIn(): Promise<boolean> {
    try {
      if (!this.config.clientId) {
        console.error('Google Client ID가 설정되지 않았습니다.')
        throw new Error('Google Client ID가 설정되지 않았습니다.')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authInstance = (this.gapi as any)?.auth2?.getAuthInstance()
      
      if (!authInstance) {
        console.error('Google Auth instance가 초기화되지 않았습니다.')
        throw new Error('Google Auth instance가 초기화되지 않았습니다.')
      }

      console.log('Google signIn 호출 중...')
      await authInstance?.signIn()
      this.isSignedIn = true
      return true
    } catch (error) {
      console.error('Google 로그인 실패:', error)
      return false
    }
  }

  // 사용자 로그아웃
  async signOut(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authInstance = (this.gapi as any)?.auth2?.getAuthInstance()
    await authInstance?.signOut()
    this.isSignedIn = false
  }

  // 로그인 상태 확인
  isAuthenticated(): boolean {
    return this.isSignedIn
  }

  // 현재 사용자 정보 가져오기
  getCurrentUser(): Record<string, unknown> | null {
    // if (!this.isSignedIn || !this.gapi) return null
    // 
    // const authInstance = (this.gapi as {auth2?: {getAuthInstance?: () => unknown}}).auth2?.getAuthInstance?.()
    // const user = authInstance?.currentUser?.get?.()
    // const profile = user?.getBasicProfile?.()
    // 
    // return {
    //   id: profile?.getId?.(),
    //   name: profile?.getName?.(),
    //   email: profile?.getEmail?.(),
    //   imageUrl: profile?.getImageUrl?.()
    // }
    return null
  }

  // 캘린더 목록 가져오기
  async getCalendarList(): Promise<Record<string, unknown>[]> {
    if (!this.isSignedIn) {
      throw new Error('Google 계정에 로그인이 필요합니다.')
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.gapi as any)?.client?.calendar?.calendarList?.list()
      return response.result.items || []
    } catch (error) {
      console.error('캘린더 목록 조회 실패:', error)
      throw error
    }
  }

  // 특정 캘린더의 이벤트 가져오기
  async getEventsFromCalendar(calendarId: string, maxResults: number = 10): Promise<CalendarEvent[]> {
    if (!this.isSignedIn) {
      throw new Error('Google 계정에 로그인이 필요합니다.')
    }

    try {
      const now = new Date()
      const endTime = new Date()
      endTime.setDate(now.getDate() + 30) // 앞으로 30일간의 이벤트

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await (this.gapi as any)?.client?.calendar?.events?.list({
        calendarId: calendarId,
        timeMin: now.toISOString(),
        timeMax: endTime.toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      })

      const events = response.result.items || []
      
      return events.map((event: Record<string, unknown>) => {
        const start = event.start as Record<string, unknown> | undefined
        const end = event.end as Record<string, unknown> | undefined
        
        return {
          id: (event.id as string) || '',
          title: (event.summary as string) || '제목 없음',
          start: (start?.dateTime as string) || (start?.date as string) || '',
          end: (end?.dateTime as string) || (end?.date as string) || '',
          description: (event.description as string) || '',
          location: (event.location as string) || '',
          calendarId: calendarId,
          calendarName: '', // 별도로 설정
          color: ''
        }
      })
    } catch (error) {
      console.error(`캘린더 ${calendarId}에서 이벤트 가져오기 실패:`, error)
      throw error
    }
  }

  // 여러 캘린더에서 이벤트 가져오기
  async getEventsFromMultipleCalendars(calendarIds: string[]): Promise<CalendarEvent[]> {
    const eventPromises = calendarIds.map(async (calendarId) => {
      try {
        const events = await this.getEventsFromCalendar(calendarId, 5)
        return events
      } catch (error) {
        console.error(`캘린더 ${calendarId} 조회 실패:`, error)
        return []
      }
    })

    const eventArrays = await Promise.all(eventPromises)
    const allEvents = eventArrays.flat()
    
    // 시작 시간으로 정렬
    return allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }

  // 금주의 이벤트만 가져오기
  async getThisWeekEvents(calendarIds: string[]): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsFromMultipleCalendars(calendarIds)
    
    const now = new Date()
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())) // 일요일
    const endOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 6)) // 토요일
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate >= startOfWeek && eventDate <= endOfWeek
    })
  }

  // 오늘의 이벤트만 가져오기
  async getTodayEvents(calendarIds: string[]): Promise<CalendarEvent[]> {
    const allEvents = await this.getEventsFromMultipleCalendars(calendarIds)
    
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))
    
    return allEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate >= startOfDay && eventDate <= endOfDay
    })
  }
}

// 전역 인스턴스
let googleCalendarOAuth: GoogleCalendarOAuth | null = null

export const getGoogleCalendarOAuth = (): GoogleCalendarOAuth => {
  if (!googleCalendarOAuth) {
    googleCalendarOAuth = new GoogleCalendarOAuth()
  }
  return googleCalendarOAuth
}

export type { CalendarEvent }

// Window 타입 확장
declare global {
  interface Window {
    gapi: Record<string, unknown>
  }
}
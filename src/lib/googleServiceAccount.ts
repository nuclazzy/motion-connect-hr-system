import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

class GoogleServiceAccountClient {
  private calendar: ReturnType<typeof google.calendar>;
  private auth: JWT;

  constructor() {
    // Service Account 인증 설정
    this.auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ]
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  // 캘린더 목록 조회
  async getCalendars() {
    try {
      const response = await this.calendar.calendarList.list();
      return {
        success: true,
        calendars: response.data.items || []
      };
    } catch (error) {
      console.error('캘린더 목록 조회 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 특정 캘린더의 이벤트 조회
  async getEvents(calendarId: string, timeMin?: string, timeMax?: string) {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return {
        success: true,
        events: response.data.items || []
      };
    } catch (error) {
      console.error('이벤트 조회 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 새 이벤트 생성
  async createEvent(calendarId: string, eventData: object) {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData,
      });

      return {
        success: true,
        event: response.data
      };
    } catch (error) {
      console.error('이벤트 생성 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 이벤트 업데이트
  async updateEvent(calendarId: string, eventId: string, eventData: object) {
    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData,
      });

      return {
        success: true,
        event: response.data
      };
    } catch (error) {
      console.error('이벤트 업데이트 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 이벤트 삭제
  async deleteEvent(calendarId: string, eventId: string) {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });

      return {
        success: true,
        message: '이벤트가 삭제되었습니다.'
      };
    } catch (error) {
      console.error('이벤트 삭제 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 새 캘린더 생성
  async createCalendar(calendarData: { summary: string; description?: string; timeZone?: string }) {
    try {
      const response = await this.calendar.calendars.insert({
        requestBody: {
          summary: calendarData.summary,
          description: calendarData.description || '',
          timeZone: calendarData.timeZone || 'Asia/Seoul'
        }
      });

      return {
        success: true,
        calendar: response.data
      };
    } catch (error) {
      console.error('캘린더 생성 실패:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  // 환경변수 체크
  checkConfiguration() {
    const requiredVars = {
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    };

    const missing = Object.entries(requiredVars)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    return {
      isConfigured: missing.length === 0,
      missing,
      hasEmail: !!requiredVars.email,
      hasPrivateKey: !!requiredVars.privateKey
    };
  }
}

export default GoogleServiceAccountClient;
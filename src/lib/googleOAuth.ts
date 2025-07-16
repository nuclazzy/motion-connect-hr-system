import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

export class GoogleOAuthService {
  private oauth2Client: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'
    );
  }

  // Google OAuth 인증 URL 생성
  getAuthUrl(): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });
    return authUrl;
  }

  // 인증 코드로 토큰 획득
  async getAccessToken(code: string) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      return tokens;
    } catch (error) {
      console.error('토큰 획득 실패:', error);
      throw error;
    }
  }

  // 토큰을 사용하여 클라이언트 설정
  setCredentials(tokens: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    this.oauth2Client.setCredentials(tokens);
  }

  // 캘린더 API 클라이언트 반환
  getCalendarClient() {
    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // 캘린더 목록 조회
  async getCalendarList() {
    try {
      const calendar = this.getCalendarClient();
      const response = await calendar.calendarList.list();
      return response.data.items || [];
    } catch (error) {
      console.error('캘린더 목록 조회 실패:', error);
      throw error;
    }
  }

  // 캘린더 이벤트 조회
  async getCalendarEvents(calendarId: string, timeMin?: string, timeMax?: string) {
    try {
      const calendar = this.getCalendarClient();
      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin || new Date().toISOString(),
        timeMax,
        singleEvents: true,
        orderBy: 'startTime'
      });
      return response.data.items || [];
    } catch (error) {
      console.error('캘린더 이벤트 조회 실패:', error);
      throw error;
    }
  }

  // 캘린더 이벤트 생성
  async createCalendarEvent(calendarId: string, eventData: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const calendar = this.getCalendarClient();
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventData
      });
      return response.data;
    } catch (error) {
      console.error('캘린더 이벤트 생성 실패:', error);
      throw error;
    }
  }

  // 토큰 새로고침
  async refreshToken() {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      return credentials;
    } catch (error) {
      console.error('토큰 새로고침 실패:', error);
      throw error;
    }
  }
}

export const googleOAuthService = new GoogleOAuthService();
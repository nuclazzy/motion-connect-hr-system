import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  attendees?: { email: string }[];
  creator?: { email: string };
  organizer?: { email: string };
}

interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

class GoogleCalendarV2Service {
  private auth: JWT;
  private calendar: ReturnType<typeof google.calendar>;

  constructor() {
    this.auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.readonly'
      ]
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  async getCalendarList(): Promise<CalendarInfo[]> {
    try {
      const response = await this.calendar.calendarList.list({
        showHidden: false,
        showDeleted: false
      });

      return response.data.items?.map((cal) => ({
        id: cal.id || '',
        summary: cal.summary || '',
        description: cal.description || undefined,
        primary: cal.primary || undefined,
        accessRole: cal.accessRole || '',
        backgroundColor: cal.backgroundColor || undefined,
        foregroundColor: cal.foregroundColor || undefined
      })) || [];
    } catch (error) {
      console.error('Error fetching calendar list:', error);
      return [];
    }
  }

  async searchCalendars(query: string): Promise<CalendarInfo[]> {
    try {
      const allCalendars = await this.getCalendarList();
      
      if (!query) return allCalendars;

      return allCalendars.filter(calendar => 
        calendar.summary?.toLowerCase().includes(query.toLowerCase()) ||
        calendar.description?.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Error searching calendars:', error);
      return [];
    }
  }

  async getEventsFromCalendar(
    calendarId: string,
    maxResults: number = 10,
    timeMin?: string,
    timeMax?: string,
    q?: string
  ): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
        q
      });

      return response.data.items?.map((event) => ({
        id: event.id || '',
        title: event.summary || 'No Title',
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        description: event.description || undefined,
        location: event.location || undefined,
        attendees: event.attendees as { email: string }[] | undefined,
        creator: event.creator as { email: string } | undefined,
        organizer: event.organizer as { email: string } | undefined
      })) || [];
    } catch (error) {
      console.error(`Error fetching events from calendar ${calendarId}:`, error);
      return [];
    }
  }

  async createEvent(
    calendarId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { date?: string; dateTime?: string; timeZone?: string };
      end: { date?: string; dateTime?: string; timeZone?: string };
      location?: string;
      attendees?: { email: string }[];
    }
  ): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: eventData
      });

      return {
        id: response.data.id || '',
        title: response.data.summary || 'No Title',
        start: response.data.start?.dateTime || response.data.start?.date || '',
        end: response.data.end?.dateTime || response.data.end?.date || '',
        description: response.data.description || undefined,
        location: response.data.location || undefined,
        attendees: response.data.attendees as { email: string }[] | undefined,
        creator: response.data.creator as { email: string } | undefined,
        organizer: response.data.organizer as { email: string } | undefined
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.calendar.calendars.get({
        calendarId: 'primary'
      });

      return {
        success: true,
        message: `연결 성공! 기본 캘린더: ${response.data.summary}`
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: `연결 실패: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export const googleCalendarV2Service = new GoogleCalendarV2Service();
export type { CalendarEvent, CalendarInfo };
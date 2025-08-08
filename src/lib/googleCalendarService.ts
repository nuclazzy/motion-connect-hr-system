/**
 * Google Calendar Service Account 연동
 * 서버 측에서 인증하여 팝업 없이 캘린더 접근
 */

import { google } from 'googleapis';

// Service Account 설정
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');

// Google Calendar API 클라이언트 생성
let calendarClient: any = null;

/**
 * Service Account 인증 초기화
 */
export const initializeServiceAccount = async () => {
  try {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      console.warn('⚠️ Service Account 정보가 설정되지 않음');
      return false;
    }

    const auth = new google.auth.JWT({
      email: SERVICE_ACCOUNT_EMAIL,
      key: SERVICE_ACCOUNT_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar'] // 전체 권한으로 변경 (읽기/쓰기)
    });

    await auth.authorize();
    
    calendarClient = google.calendar({ version: 'v3', auth });
    console.log('✅ Google Calendar Service Account 인증 성공');
    return true;
  } catch (error) {
    console.error('❌ Service Account 인증 실패:', error);
    return false;
  }
};

/**
 * 캘린더 이벤트 가져오기
 */
export const fetchCalendarEventsServer = async (
  calendarId: string,
  timeMin?: string,
  timeMax?: string
) => {
  try {
    if (!calendarClient) {
      const initialized = await initializeServiceAccount();
      if (!initialized) {
        return [];
      }
    }

    const response = await calendarClient.events.list({
      calendarId,
      timeMin: timeMin || new Date(new Date().getFullYear(), 0, 1).toISOString(),
      timeMax: timeMax || new Date(new Date().getFullYear(), 11, 31).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 2500,
    });

    return response.data.items || [];
  } catch (error: any) {
    console.error(`캘린더 이벤트 조회 오류 (${calendarId}):`, error.message);
    return [];
  }
};

/**
 * 여러 캘린더의 이벤트 가져오기
 */
export const fetchMultipleCalendarEventsServer = async (
  calendarIds: string[],
  timeMin?: string,
  timeMax?: string
) => {
  const results: { [calendarId: string]: any[] } = {};

  // 병렬로 모든 캘린더 이벤트 가져오기
  const promises = calendarIds.map(async (calendarId) => {
    try {
      const events = await fetchCalendarEventsServer(calendarId, timeMin, timeMax);
      results[calendarId] = events;
    } catch (error) {
      console.error(`캘린더 ${calendarId} 조회 실패:`, error);
      results[calendarId] = [];
    }
  });

  await Promise.all(promises);
  return results;
};

/**
 * 캘린더 이벤트 생성
 */
export const createCalendarEventServer = async (
  calendarId: string,
  eventData: any
) => {
  try {
    if (!calendarClient) {
      const initialized = await initializeServiceAccount();
      if (!initialized) {
        throw new Error('Service Account 인증 실패');
      }
    }

    const response = await calendarClient.events.insert({
      calendarId,
      resource: eventData,
    });

    console.log('✅ 캘린더 이벤트 생성 성공:', response.data.id);
    return response.data;
  } catch (error: any) {
    console.error(`캘린더 이벤트 생성 오류 (${calendarId}):`, error.message);
    throw error;
  }
};

/**
 * 캘린더 이벤트 수정
 */
export const updateCalendarEventServer = async (
  calendarId: string,
  eventId: string,
  eventData: any
) => {
  try {
    if (!calendarClient) {
      const initialized = await initializeServiceAccount();
      if (!initialized) {
        throw new Error('Service Account 인증 실패');
      }
    }

    const response = await calendarClient.events.update({
      calendarId,
      eventId,
      resource: eventData,
    });

    console.log('✅ 캘린더 이벤트 수정 성공:', eventId);
    return response.data;
  } catch (error: any) {
    console.error(`캘린더 이벤트 수정 오류 (${calendarId}/${eventId}):`, error.message);
    throw error;
  }
};

/**
 * 캘린더 이벤트 삭제
 */
export const deleteCalendarEventServer = async (
  calendarId: string,
  eventId: string
) => {
  try {
    if (!calendarClient) {
      const initialized = await initializeServiceAccount();
      if (!initialized) {
        throw new Error('Service Account 인증 실패');
      }
    }

    await calendarClient.events.delete({
      calendarId,
      eventId,
    });

    console.log('✅ 캘린더 이벤트 삭제 성공:', eventId);
    return true;
  } catch (error: any) {
    console.error(`캘린더 이벤트 삭제 오류 (${calendarId}/${eventId}):`, error.message);
    throw error;
  }
};
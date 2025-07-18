import { NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';
import { ADMIN_WEEKLY_CALENDARS, ADMIN_TEAM_CALENDARS } from '@/lib/calendarMapping';

export async function GET() {
  try {
    const client = new GoogleServiceAccountClient();
    
    // 1. 환경변수 확인
    const config = client.checkConfiguration();
    console.log('Configuration check:', config);
    
    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Service Account 환경변수가 누락되었습니다.',
        missing: config.missing,
        diagnosis: 'MISSING_ENV_VARS'
      }, { status: 500 });
    }

    // 2. 캘린더 목록 조회 시도
    const calendarsResult = await client.getCalendars();
    console.log('Calendars list result:', calendarsResult);
    
    if (!calendarsResult.success) {
      return NextResponse.json({
        success: false,
        error: '캘린더 목록 조회 실패',
        details: calendarsResult.error,
        diagnosis: 'CALENDAR_LIST_ACCESS_FAILED'
      }, { status: 403 });
    }

    // 3. 설정된 캘린더들에 대한 접근 테스트
    const calendarTests = [];
    const allCalendars = [
      ...ADMIN_WEEKLY_CALENDARS.map(cal => ({ id: cal.id, name: cal.name, type: 'weekly' })),
      ...ADMIN_TEAM_CALENDARS.map(cal => ({ id: cal.id, name: cal.name, type: 'team' }))
    ];

    for (const calendar of allCalendars) {
      try {
        const calendarInfo = await client.getCalendarInfo(calendar.id);
        const eventsResult = await client.getEvents(calendar.id);
        
        calendarTests.push({
          id: calendar.id,
          name: calendar.name,
          type: calendar.type,
          accessible: calendarInfo.success,
          canReadEvents: eventsResult.success,
          eventCount: eventsResult.success ? eventsResult.events?.length || 0 : 0,
          error: calendarInfo.success ? null : calendarInfo.error
        });
      } catch (error) {
        calendarTests.push({
          id: calendar.id,
          name: calendar.name,
          type: calendar.type,
          accessible: false,
          canReadEvents: false,
          eventCount: 0,
          error: (error as Error).message
        });
      }
    }

    // 4. 테스트 이벤트 생성 시도 (첫 번째 접근 가능한 캘린더에서)
    const accessibleCalendar = calendarTests.find(cal => cal.accessible);
    let eventCreationTest = null;
    
    if (accessibleCalendar) {
      try {
        const testEvent = {
          summary: 'Google Calendar 연동 테스트',
          description: '이 이벤트는 자동으로 생성된 테스트 이벤트입니다.',
          start: {
            dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1시간 후
            timeZone: 'Asia/Seoul'
          },
          end: {
            dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2시간 후
            timeZone: 'Asia/Seoul'
          }
        };
        
        const createResult = await client.createEvent(accessibleCalendar.id, testEvent);
        eventCreationTest = {
          attempted: true,
          success: createResult.success,
          error: createResult.success ? null : createResult.error,
          eventId: createResult.success ? createResult.event?.id : null
        };
        
        // 테스트 이벤트가 성공적으로 생성되었다면 삭제
        if (createResult.success && createResult.event?.id) {
          await client.deleteEvent(accessibleCalendar.id, createResult.event.id);
        }
      } catch (error) {
        eventCreationTest = {
          attempted: true,
          success: false,
          error: (error as Error).message,
          eventId: null
        };
      }
    }

    // 5. 진단 결과 분석
    const accessibleCalendarsCount = calendarTests.filter(cal => cal.accessible).length;
    const canCreateEventsCount = calendarTests.filter(cal => cal.canReadEvents).length;
    
    let diagnosis = 'HEALTHY';
    const recommendations = [];

    if (accessibleCalendarsCount === 0) {
      diagnosis = 'NO_CALENDAR_ACCESS';
      recommendations.push('Service Account에 캘린더 접근 권한을 부여하세요.');
    } else if (canCreateEventsCount === 0) {
      diagnosis = 'NO_EVENT_ACCESS';
      recommendations.push('Service Account에 이벤트 읽기/쓰기 권한을 부여하세요.');
    } else if (eventCreationTest && !eventCreationTest.success) {
      diagnosis = 'EVENT_CREATION_FAILED';
      recommendations.push('이벤트 생성 권한을 확인하세요.');
    }

    return NextResponse.json({
      success: true,
      diagnosis,
      recommendations,
      configuration: config,
      totalCalendars: calendarsResult.calendars?.length || 0,
      configuredCalendars: allCalendars.length,
      accessibleCalendars: accessibleCalendarsCount,
      calendarTests,
      eventCreationTest,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Google Calendar 진단 오류:', error);
    return NextResponse.json({
      success: false,
      error: 'Google Calendar 진단 중 오류가 발생했습니다.',
      details: (error as Error).message,
      diagnosis: 'DIAGNOSTIC_ERROR'
    }, { status: 500 });
  }
}
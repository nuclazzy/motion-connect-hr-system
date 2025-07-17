import { NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export async function GET() {
  const CALENDAR_ID = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com';
  
  try {
    const client = new GoogleServiceAccountClient();
    
    // 환경변수 확인
    const config = client.checkConfiguration();
    console.log('Service Account 설정 상태:', config);
    
    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Service Account 설정이 완료되지 않았습니다.',
        config
      }, { status: 500 });
    }

    console.log(`테스트 중인 캘린더 ID: ${CALENDAR_ID}`);
    
    // 1. 캘린더 정보 조회
    const calendarInfo = await client.getCalendarInfo(CALENDAR_ID);
    console.log('캘린더 정보 조회 결과:', calendarInfo);
    
    if (!calendarInfo.success) {
      return NextResponse.json({
        success: false,
        error: '캘린더 정보 조회 실패',
        details: calendarInfo.error,
        step: 'calendar_info'
      }, { status: 403 });
    }

    // 2. 최근 이벤트 조회
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = await client.getEvents(
      CALENDAR_ID,
      oneMonthAgo.toISOString(),
      oneMonthLater.toISOString()
    );
    
    console.log('이벤트 조회 결과:', events);

    return NextResponse.json({
      success: true,
      message: '캘린더 접근 성공',
      calendarId: CALENDAR_ID,
      calendar: calendarInfo.calendar,
      events: {
        success: events.success,
        count: events.success ? events.events?.length || 0 : 0,
        data: events.success ? events.events?.slice(0, 3) : [], // 최대 3개만 반환
        error: events.success ? null : events.error
      }
    });

  } catch (error) {
    console.error('직접 캘린더 테스트 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캘린더 테스트 중 오류 발생',
      details: (error as Error).message
    }, { status: 500 });
  }
}
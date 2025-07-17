import { NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export async function POST(request: Request) {
  try {
    const { calendarId } = await request.json();
    
    if (!calendarId) {
      return NextResponse.json({
        success: false,
        error: '캘린더 ID가 필요합니다.'
      }, { status: 400 });
    }

    const client = new GoogleServiceAccountClient();
    
    // 환경변수 확인
    const config = client.checkConfiguration();
    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        error: 'Service Account가 올바르게 설정되지 않았습니다.',
        missing: config.missing
      }, { status: 500 });
    }

    // 특정 캘린더 접근 테스트
    console.log(`Testing access to calendar: ${calendarId}`);
    
    // 1. 캘린더 정보 조회 시도
    const calendarInfo = await client.getCalendarInfo(calendarId);
    if (!calendarInfo.success) {
      return NextResponse.json({
        success: false,
        error: '캘린더 접근 실패',
        details: calendarInfo.error,
        accessTest: 'failed'
      }, { status: 403 });
    }

    // 2. 이벤트 목록 조회 시도 (최근 30일)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const events = await client.getEvents(
      calendarId,
      thirtyDaysAgo.toISOString(),
      thirtyDaysLater.toISOString()
    );

    return NextResponse.json({
      success: true,
      message: '캘린더 접근 성공',
      calendarId,
      calendarInfo: calendarInfo.calendar,
      eventsAccess: events.success,
      eventCount: events.success ? events.events?.length || 0 : 0,
      events: events.success ? events.events?.slice(0, 5) : [], // 최대 5개 이벤트만 반환
      accessTest: 'success'
    });

  } catch (error) {
    console.error('캘린더 접근 테스트 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캘린더 접근 테스트 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 });
  }
}
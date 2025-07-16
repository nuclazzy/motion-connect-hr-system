import { NextRequest, NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export async function POST(request: NextRequest) {
  try {
    const client = new GoogleServiceAccountClient();
    const body = await request.json();
    
    const { calendarId = 'primary', title = '테스트 이벤트' } = body;

    // 테스트 이벤트 데이터
    const now = new Date();
    const eventStart = new Date(now.getTime() + 60 * 60 * 1000); // 1시간 후
    const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // 2시간 후

    const eventData = {
      summary: title,
      description: 'Service Account로 생성된 테스트 이벤트',
      start: {
        dateTime: eventStart.toISOString(),
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: eventEnd.toISOString(),
        timeZone: 'Asia/Seoul',
      },
      location: '서울, 대한민국'
    };

    const result = await client.createEvent(calendarId, eventData);
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        hint: calendarId === 'primary' 
          ? 'primary 캘린더에 접근할 수 없습니다. Service Account에 캘린더를 공유하거나 새 캘린더를 생성하세요.'
          : `캘린더 ${calendarId}에 접근할 수 없습니다. Service Account에 이 캘린더를 공유했는지 확인하세요.`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: result.event,
      message: 'Service Account로 테스트 이벤트 생성 성공'
    });

  } catch (error) {
    console.error('테스트 이벤트 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: '테스트 이벤트 생성 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 });
  }
}
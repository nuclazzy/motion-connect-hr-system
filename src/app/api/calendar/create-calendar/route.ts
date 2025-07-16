import { NextRequest, NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export async function POST(request: NextRequest) {
  try {
    const client = new GoogleServiceAccountClient();
    const body = await request.json();
    
    const { summary, description, timeZone = 'Asia/Seoul' } = body;

    if (!summary) {
      return NextResponse.json({
        success: false,
        error: '캘린더 이름(summary)이 필요합니다.'
      }, { status: 400 });
    }

    // 새 캘린더 생성
    const result = await client.createCalendar({
      summary,
      description,
      timeZone
    });
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      calendar: result.calendar,
      message: 'Service Account로 캘린더 생성 성공',
      instructions: {
        step1: '생성된 캘린더에 이벤트를 추가하려면 캘린더 ID를 사용하세요',
        step2: '다른 사용자와 공유하려면 Google Calendar 웹에서 설정하세요',
        calendarId: result.calendar?.id
      }
    });

  } catch (error) {
    console.error('캘린더 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캘린더 생성 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 });
  }
}
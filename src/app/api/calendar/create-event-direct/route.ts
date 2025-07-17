import { NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export async function POST(request: Request) {
  try {
    const { calendarId, eventData } = await request.json();
    
    if (!calendarId || !eventData) {
      return NextResponse.json({
        success: false,
        error: '캘린더 ID와 이벤트 데이터가 필요합니다.'
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

    // 이벤트 생성
    const result = await client.createEvent(calendarId, eventData);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        event: result.event,
        message: '이벤트가 성공적으로 생성되었습니다.'
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '이벤트 생성에 실패했습니다.',
        details: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error('이벤트 생성 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '이벤트 생성 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 });
  }
}
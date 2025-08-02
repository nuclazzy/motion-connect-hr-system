import { NextResponse } from 'next/server';
import GoogleServiceAccountClient from '@/lib/googleServiceAccount';

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    // 캘린더 목록 조회
    const result = await client.getCalendars();
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      calendars: result.calendars,
      message: 'Service Account로 캘린더 목록 조회 성공',
      config: {
        hasEmail: config.hasEmail,
        hasPrivateKey: config.hasPrivateKey
      }
    });

  } catch (error) {
    console.error('Service Account 캘린더 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: 'Service Account 캘린더 API 오류',
      details: (error as Error).message
    }, { status: 500 });
  }
}
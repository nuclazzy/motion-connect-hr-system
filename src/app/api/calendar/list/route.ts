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
      message: 'Service Account로 캘린더 목록 조회 성공'
    });

  } catch (error) {
    console.error('캘린더 목록 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '캘린더 목록 조회 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 });
  }
}
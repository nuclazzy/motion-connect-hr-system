import { NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 사용자의 Google 토큰 확인
    const tokens = user.user_metadata?.google_tokens;
    if (!tokens) {
      return NextResponse.json(
        { success: false, error: 'Google authentication required', needsAuth: true },
        { status: 401 }
      );
    }

    // Google OAuth 클라이언트에 토큰 설정
    googleOAuthService.setCredentials(tokens);

    // 캘린더 목록 조회
    const calendars = await googleOAuthService.getCalendarList();
    
    return NextResponse.json({
      success: true,
      calendars: calendars.map(calendar => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description,
        primary: calendar.primary,
        accessRole: calendar.accessRole,
        backgroundColor: calendar.backgroundColor
      }))
    });
  } catch (error) {
    console.error('OAuth 캘린더 목록 조회 실패:', error);
    
    // 토큰 만료 등의 경우 재인증 필요
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.message?.includes('invalid_grant') || (error as any)?.message?.includes('Token has been expired')) {
      return NextResponse.json(
        { success: false, error: 'Token expired, re-authentication required', needsAuth: true },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar list' },
      { status: 500 }
    );
  }
}
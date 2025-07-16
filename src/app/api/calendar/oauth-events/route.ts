import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const calendarId = searchParams.get('calendarId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (!calendarId) {
      return NextResponse.json(
        { success: false, error: 'Calendar ID is required' },
        { status: 400 }
      );
    }

    // Google OAuth 클라이언트에 토큰 설정
    googleOAuthService.setCredentials(tokens);

    // 캘린더 이벤트 조회
    const events = await googleOAuthService.getCalendarEvents(calendarId, timeMin || undefined, timeMax || undefined);
    
    return NextResponse.json({
      success: true,
      events: events.map(event => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        location: event.location,
        attendees: event.attendees,
        creator: event.creator,
        organizer: event.organizer,
        status: event.status
      }))
    });
  } catch (error) {
    console.error('OAuth 캘린더 이벤트 조회 실패:', error);
    
    // 토큰 만료 등의 경우 재인증 필요
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.message?.includes('invalid_grant') || (error as any)?.message?.includes('Token has been expired')) {
      return NextResponse.json(
        { success: false, error: 'Token expired, re-authentication required', needsAuth: true },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
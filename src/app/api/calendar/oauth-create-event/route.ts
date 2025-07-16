import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { calendarId, eventData } = body;

    if (!calendarId || !eventData) {
      return NextResponse.json(
        { success: false, error: 'Calendar ID and event data are required' },
        { status: 400 }
      );
    }

    // Google OAuth 클라이언트에 토큰 설정
    googleOAuthService.setCredentials(tokens);

    // 캘린더 이벤트 생성
    const createdEvent = await googleOAuthService.createCalendarEvent(calendarId, {
      summary: eventData.title,
      description: eventData.description,
      start: eventData.start,
      end: eventData.end,
      location: eventData.location,
      attendees: eventData.attendees
    });
    
    return NextResponse.json({
      success: true,
      event: createdEvent
    });
  } catch (error) {
    console.error('OAuth 캘린더 이벤트 생성 실패:', error);
    
    // 토큰 만료 등의 경우 재인증 필요
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.message?.includes('invalid_grant') || (error as any)?.message?.includes('Token has been expired')) {
      return NextResponse.json(
        { success: false, error: 'Token expired, re-authentication required', needsAuth: true },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
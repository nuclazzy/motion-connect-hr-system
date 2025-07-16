import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarV2Service } from '@/lib/googleCalendarV2';
import { teamCalendarPermissionService } from '@/lib/teamCalendarPermissions';
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

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
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

    // 캘린더 설정 조회
    const { data: calendarConfig } = await supabase
      .from('calendar_configs')
      .select('*')
      .eq('calendar_id', calendarId)
      .single();

    if (calendarConfig) {
      // 권한 확인
      const hasAccess = await teamCalendarPermissionService.checkTeamCalendarAccess(
        userData,
        calendarConfig.id
      );

      if (!hasAccess) {
        // 쓰기 권한 확인
        const permissions = await teamCalendarPermissionService.getUserCalendarPermissions(
          userData.id,
          calendarConfig.id
        );

        if (!permissions.canWrite && userData.role !== 'admin') {
          return NextResponse.json(
            { success: false, error: 'Write permission required' },
            { status: 403 }
          );
        }
      }
    }

    // 이벤트 생성
    const createdEvent = await googleCalendarV2Service.createEvent(calendarId, {
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
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
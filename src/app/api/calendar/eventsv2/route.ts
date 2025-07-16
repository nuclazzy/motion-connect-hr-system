import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarV2Service } from '@/lib/googleCalendarV2';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { calendarId, timeMin, timeMax, q, maxResults } = body;

    if (!calendarId) {
      return NextResponse.json(
        { success: false, error: 'Calendar ID is required' },
        { status: 400 }
      );
    }

    const events = await googleCalendarV2Service.getEventsFromCalendar(
      calendarId,
      maxResults || 250,
      timeMin,
      timeMax,
      q
    );

    return NextResponse.json({
      success: true,
      events
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}
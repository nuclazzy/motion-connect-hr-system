import { NextRequest, NextResponse } from 'next/server';
import { googleCalendarV2Service } from '@/lib/googleCalendarV2';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const calendars = await googleCalendarV2Service.searchCalendars(query);

    return NextResponse.json({
      success: true,
      calendars
    });
  } catch (error) {
    console.error('Error searching calendars:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search calendars' },
      { status: 500 }
    );
  }
}
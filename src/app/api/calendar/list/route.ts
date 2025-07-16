import { NextResponse } from 'next/server';
import { googleCalendarV2Service } from '@/lib/googleCalendarV2';

export async function GET() {
  try {
    const calendars = await googleCalendarV2Service.getCalendarList();

    return NextResponse.json({
      success: true,
      calendars
    });
  } catch (error) {
    console.error('Error fetching calendar list:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar list' },
      { status: 500 }
    );
  }
}
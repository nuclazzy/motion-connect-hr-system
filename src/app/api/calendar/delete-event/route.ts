import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

async function deleteEventHandler(request: NextRequest) {
  try {
    const { calendarId, eventId } = await request.json()

    if (!calendarId || !eventId) {
      return NextResponse.json(
        { success: false, error: 'calendarId and eventId are required' },
        { status: 400 }
      )
    }

    // Google Calendar API 인증
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/calendar']
    })

    const calendar = google.calendar({ version: 'v3', auth })

    // 이벤트 삭제
    await calendar.events.delete({
      calendarId: calendarId,
      eventId: eventId
    })

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully'
    })

  } catch (error) {
    console.error('Google Calendar 이벤트 삭제 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}

// DELETE와 POST 둘 다 지원
export async function DELETE(request: NextRequest) {
  return deleteEventHandler(request)
}

export async function POST(request: NextRequest) {
  return deleteEventHandler(request)
}
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

export async function PUT(request: NextRequest) {
  try {
    const { calendarId, eventId, eventData } = await request.json()

    if (!calendarId || !eventId || !eventData) {
      return NextResponse.json(
        { success: false, error: 'calendarId, eventId, and eventData are required' },
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

    // 이벤트 업데이트
    const response = await calendar.events.update({
      calendarId: calendarId,
      eventId: eventId,
      requestBody: eventData
    })

    return NextResponse.json({
      success: true,
      event: response.data
    })

  } catch (error) {
    console.error('Google Calendar 이벤트 업데이트 오류:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    )
  }
}
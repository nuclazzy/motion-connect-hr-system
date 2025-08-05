import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { googleCalendarService } from '@/lib/googleCalendar'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { meeting, calendarId } = await request.json()
    
    if (!meeting || !calendarId) {
      return NextResponse.json({ 
        error: '미팅 정보와 캘린더 ID가 필요합니다.' 
      }, { status: 400 })
    }

    // Google Calendar에 이벤트 생성
    const eventData = {
      summary: meeting.title,
      description: meeting.description || '',
      location: meeting.location || '',
      start: {
        dateTime: `${meeting.date}T${meeting.time}:00`,
        timeZone: 'Asia/Seoul',
      },
      end: {
        dateTime: `${meeting.date}T${meeting.time}:00`,
        timeZone: 'Asia/Seoul',
      },
    }

    const googleEvent = await googleCalendarService.createEvent(calendarId, eventData)
    
    if (googleEvent && typeof googleEvent === 'object' && 'id' in googleEvent) {
      // Supabase 미팅 테이블에 Google Event ID 업데이트
      const { error } = await supabase
        .from('meetings')
        .update({ 
          calendar_id: calendarId,
          google_event_id: (googleEvent as { id: string }).id 
        })
        .eq('id', meeting.id)

      if (error) {
        console.error('미팅 테이블 업데이트 실패:', error)
      }

      return NextResponse.json({ 
        success: true,
        googleEventId: (googleEvent as { id: string }).id,
        message: 'Google Calendar에 이벤트가 생성되었습니다.'
      })
    } else {
      return NextResponse.json({ 
        success: false,
        message: 'Google Calendar 이벤트 생성에 실패했습니다.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Calendar event creation error:', error)
    return NextResponse.json({ 
      success: false,
      error: '이벤트 생성 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
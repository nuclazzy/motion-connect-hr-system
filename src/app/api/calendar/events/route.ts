import { NextRequest, NextResponse } from 'next/server'
import { googleCalendarService } from '@/lib/googleCalendar'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = searchParams.get('timeframe') || 'week' // 'today', 'week', 'month'

    // Supabase에서 활성화된 캘린더 설정 가져오기
    const { data: configs, error } = await supabase
      .from('calendar_configs')
      .select('*')
      .eq('is_active', true)

    if (error) {
      console.error('캘린더 설정 조회 실패:', error)
      return NextResponse.json({ error: '캘린더 설정을 가져올 수 없습니다.' }, { status: 500 })
    }

    if (!configs || configs.length === 0) {
      return NextResponse.json({ events: [], message: '활성화된 캘린더가 없습니다.' })
    }

    let events = []
    
    switch (timeframe) {
      case 'today':
        events = await googleCalendarService.getTodayEvents(configs)
        break
      case 'week':
        events = await googleCalendarService.getThisWeekEvents(configs)
        break
      case 'month':
      default:
        events = await googleCalendarService.getEventsFromMultipleCalendars(configs)
        break
    }

    return NextResponse.json({ 
      events,
      calendarsCount: configs.length,
      timeframe 
    })

  } catch (error) {
    console.error('캘린더 이벤트 조회 오류:', error)
    return NextResponse.json({ 
      error: '캘린더 이벤트를 가져오는 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // 단일 캘린더에서 이벤트 조회 (새로운 컴포넌트들 용)
    if (body.calendarId && body.timeMin && body.timeMax) {
      const { calendarId, timeMin, timeMax, q, maxResults = 50 } = body
      
      try {
        const events = await googleCalendarService.getEventsFromCalendar(
          calendarId, 
          maxResults,
          timeMin,
          timeMax,
          q // 검색 쿼리 (사용자 이름 등)
        )
        
        return NextResponse.json({ 
          events,
          calendarId,
          query: q || null
        })
      } catch (error) {
        console.error(`캘린더 ${calendarId} 접근 오류:`, error)
        return NextResponse.json({ 
          events: [],
          error: '캘린더에 접근할 수 없습니다.',
          calendarId 
        }, { status: 403 })
      }
    }
    
    // 다중 캘린더에서 이벤트 조회 (기존 방식)
    if (body.calendarIds && body.timeMin && body.timeMax) {
      const { calendarIds, timeMin, timeMax } = body
      
      // Supabase에서 활성화된 캘린더 설정 가져오기
      const { data: configs, error } = await supabase
        .from('calendar_configs')
        .select('*')
        .eq('is_active', true)
        .in('calendar_id', calendarIds)

      if (error) {
        console.error('캘린더 설정 조회 실패:', error)
        return NextResponse.json({ error: '캘린더 설정을 가져올 수 없습니다.' }, { status: 500 })
      }

      if (!configs || configs.length === 0) {
        return NextResponse.json({ events: [], message: '활성화된 캘린더가 없습니다.' })
      }
      
      const events = await googleCalendarService.getEventsFromMultipleCalendars(configs, timeMin, timeMax)
      
      return NextResponse.json({ 
        events,
        calendarsCount: configs.length 
      })
    }
    
    // 캘린더 접근 테스트 (기존 방식)
    const { calendarId } = body
    
    if (!calendarId) {
      return NextResponse.json({ error: '캘린더 ID가 필요합니다.' }, { status: 400 })
    }

    const isAccessible = await googleCalendarService.testCalendarAccess(calendarId)
    
    if (isAccessible) {
      const events = await googleCalendarService.getEventsFromCalendar(calendarId, 5)
      return NextResponse.json({ 
        success: true, 
        message: '캘린더 접근 성공',
        eventsCount: events.length,
        sampleEvents: events.slice(0, 3)
      })
    } else {
      return NextResponse.json({ 
        success: false, 
        message: '캘린더에 접근할 수 없습니다. 권한을 확인해주세요.'
      }, { status: 403 })
    }

  } catch (error) {
    console.error('캘린더 API 오류:', error)
    return NextResponse.json({ 
      success: false,
      error: '캘린더 API 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
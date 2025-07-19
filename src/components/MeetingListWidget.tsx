'use client'

import { useState, useEffect, useCallback } from 'react'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

interface MeetingListWidgetProps {
  title: string
  calendarType: 'internal' | 'external' // 직접 캘린더 타입 지정
  noEventsMessage: string
}

export default function MeetingListWidget({ 
  title, 
  calendarType, 
  noEventsMessage
}: MeetingListWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  // 캘린더 타입에 따라 직접 캘린더 ID 선택
  const getCalendarId = useCallback(() => {
    if (calendarType === 'internal') {
      return CALENDAR_IDS.INTERNAL_MEETING
    } else {
      return CALENDAR_IDS.EXTERNAL_MEETING
    }
  }, [calendarType])

  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    try {
      const calendarId = getCalendarId()
      
      // 이번주 데이터만 가져오기 (일요일 시작 기준)
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay()) // 이번주 일요일
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // 이번주 토요일
      endOfWeek.setHours(23, 59, 59, 999)
      
      const timeMin = startOfWeek.toISOString()
      const timeMax = endOfWeek.toISOString()

      console.log(`📅 [DEBUG] ${title} 이벤트 조회 시작:`, { calendarId, timeMin, timeMax })

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          timeMin,
          timeMax,
          maxResults: 100, // 이번주 전체 일정 가져오기
        }),
      })

      console.log(`📅 [DEBUG] ${title} API 응답 상태:`, response.status)

      let fetchedEvents: CalendarEvent[] = []
      if (response.ok) {
        const data = await response.json()
        console.log(`📅 [DEBUG] ${title} 가져온 이벤트 수:`, data.events?.length || 0)
        if (data.events) {
          // API 응답을 우리 인터페이스에 맞게 변환
          fetchedEvents = data.events.map((event: unknown) => {
            const googleEvent = event as { id: string; summary?: string; title?: string; start?: { date?: string; dateTime?: string } | string; end?: { date?: string; dateTime?: string } | string; description?: string; location?: string }
            const getEventTime = (timeObj: { date?: string; dateTime?: string } | string | undefined) => {
              if (typeof timeObj === 'string') return timeObj
              if (timeObj && typeof timeObj === 'object') {
                return timeObj.dateTime || timeObj.date || ''
              }
              return ''
            }
            
            return {
              id: googleEvent.id,
              title: googleEvent.summary || googleEvent.title || '',
              start: getEventTime(googleEvent.start),
              end: getEventTime(googleEvent.end),
              description: googleEvent.description,
              location: googleEvent.location
            }
          })
        }
      } else {
        const errorText = await response.text()
        console.error(`${title} 이벤트 조회 실패:`, response.status, errorText)
      }

      // 이번주 일정 중 과거 → 현재/미래 순으로 정렬
      const sortedEvents = fetchedEvents
        .sort((a, b) => {
          const dateA = new Date(a.start)
          const dateB = new Date(b.start)
          return dateA.getTime() - dateB.getTime() // 과거순 정렬
        })

      console.log(`📅 [DEBUG] ${title} 최종 이벤트 수:`, sortedEvents.length)
      setEvents(sortedEvents)
    } catch (error) {
      console.error(`${title} 이벤트 조회 오류:`, error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [title, getCalendarId])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  const formatEventDate = (event: CalendarEvent) => {
    const start = event.start
    if (!start) return ''
    
    const date = new Date(start)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (start.includes('T')) {
      // 시간이 있는 이벤트
      if (isToday) {
        return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
      }
      return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      // 종일 이벤트
      if (isToday) return '오늘'
      return date.toLocaleDateString('ko-KR')
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        <p className="font-medium">{title}</p>
        <div className="animate-pulse mt-2">
          <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-600">
      <p className="font-medium">{title}</p>
      {events.length === 0 ? (
        <p className="text-xs text-gray-500 mt-1">{noEventsMessage}</p>
      ) : (
        <div className="space-y-2 mt-2 max-h-64 overflow-y-auto pr-1 hover:pr-0" style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E1 #F1F5F9'
        }}>
          {events.map((event, index) => (
            <div key={event.id || index} className="text-xs border-l-2 border-gray-200 pl-2">
              <p className="font-medium text-gray-700 line-clamp-1">{event.title}</p>
              <p className="text-gray-500 flex items-center mt-1">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatEventDate(event)}
              </p>
              {event.location && (
                <p className="text-gray-400 flex items-center mt-1">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {event.location}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
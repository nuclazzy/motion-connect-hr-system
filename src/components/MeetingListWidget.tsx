'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface CalendarEvent {
  id: string
  summary: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  description?: string
  location?: string
}

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

interface MeetingListWidgetProps {
  title: string
  targetName: string // DB에서 조회할 target_name
  noEventsMessage: string
  maxResults?: number
}

export default function MeetingListWidget({ 
  title, 
  targetName, 
  noEventsMessage, 
  maxResults = 5 
}: MeetingListWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarConfig, setCalendarConfig] = useState<CalendarConfig | null>(null)

  // DB에서 캘린더 설정 조회
  const fetchCalendarConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_configs')
        .select('*')
        .eq('target_name', targetName)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error(`${title} 캘린더 설정 조회 실패:`, error)
        return
      }

      setCalendarConfig(data)
    } catch (error) {
      console.error(`${title} 캘린더 설정 조회 오류:`, error)
    }
  }, [targetName, title])

  const fetchCalendarEvents = useCallback(async () => {
    if (!calendarConfig) {
      setEvents([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // 현재 월의 데이터만 가져오기 (성능 최적화)
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth()
      const timeMin = new Date(year, month, 1).toISOString()
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendarConfig.calendar_id,
          timeMin,
          timeMax,
          maxResults: maxResults * 2, // 여유분을 두고 가져와서 정렬 후 제한
        }),
      })

      let fetchedEvents: CalendarEvent[] = []
      if (response.ok) {
        const data = await response.json()
        if (data.events) {
          fetchedEvents = data.events
        }
      } else {
        console.error(`캘린더 ${title} 이벤트 조회 실패`)
      }

      // 최근 이벤트 순으로 정렬 및 제한
      const sortedEvents = fetchedEvents
        .sort((a, b) => {
          const dateA = new Date(a.start.dateTime || a.start.date || '')
          const dateB = new Date(b.start.dateTime || b.start.date || '')
          return dateB.getTime() - dateA.getTime()
        })
        .slice(0, maxResults)

      setEvents(sortedEvents)
    } catch (error) {
      console.error(`${title} 이벤트 조회 오류:`, error)
    } finally {
      setLoading(false)
    }
  }, [calendarConfig, title, maxResults])

  useEffect(() => {
    fetchCalendarConfig()
  }, [fetchCalendarConfig])

  useEffect(() => {
    if (calendarConfig) {
      fetchCalendarEvents()
    }
  }, [calendarConfig, fetchCalendarEvents])

  const formatEventDate = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return ''
    
    const date = new Date(start)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (event.start.dateTime) {
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
        <div className="space-y-2 mt-2">
          {events.map((event, index) => (
            <div key={event.id || index} className="text-xs border-l-2 border-gray-200 pl-2">
              <p className="font-medium text-gray-700 line-clamp-1">{event.summary}</p>
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
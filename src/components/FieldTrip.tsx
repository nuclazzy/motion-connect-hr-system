'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  description: string | null
  color: string | null
  is_active: boolean
}

interface CalendarEvent {
  id: string
  summary: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  description?: string
  location?: string
}

interface FieldTripProps {
  user: User
}

export default function FieldTrip({ }: FieldTripProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([])

  const fetchCalendarConfigs = async () => {
    try {
      // Service Account 기반 캘린더 설정 조회
      const { data, error } = await supabase
        .from('calendar_configs')
        .select('*')
        .eq('config_type', 'function')
        .eq('target_name', 'field-trip')
        .eq('is_active', true)
      
      if (error) throw error
      console.log('외부 답사 연결된 캘린더 수:', data?.length || 0)
      if ((data?.length || 0) === 0) {
        console.log('외부 답사에 연결된 캘린더가 없습니다. 관리자가 캘린더를 연결해주세요.')
      }
      setCalendarConfigs(data || [])
    } catch (error) {
      console.error('외부 답사 캘린더 설정 조회 오류:', error)
    }
  }

  const fetchCalendarEvents = useCallback(async () => {
    if (calendarConfigs.length === 0) {
      setLoading(false)
      return
    }

    try {
      const currentYear = new Date().getFullYear()
      const startDate = `${currentYear}-01-01T00:00:00Z`
      const endDate = `${currentYear}-12-31T23:59:59Z`

      const allEvents: CalendarEvent[] = []

      for (const config of calendarConfigs) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarId: config.calendar_id,
              timeMin: startDate,
              timeMax: endDate,
              maxResults: 250
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.events) {
              allEvents.push(...data.events)
            }
          }
        } catch (error) {
          console.error(`캘린더 ${config.calendar_alias} 이벤트 조회 오류:`, error)
        }
      }

      // 최근 이벤트 순으로 정렬 및 최대 5개로 제한
      const sortedEvents = allEvents
        .sort((a, b) => {
          const dateA = new Date(a.start.dateTime || a.start.date || '')
          const dateB = new Date(b.start.dateTime || b.start.date || '')
          return dateB.getTime() - dateA.getTime()
        })
        .slice(0, 5)

      setEvents(sortedEvents)
    } catch (error) {
      console.error('외부 답사 이벤트 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [calendarConfigs])

  useEffect(() => {
    fetchCalendarConfigs()
  }, [])

  useEffect(() => {
    if (calendarConfigs.length > 0) {
      fetchCalendarEvents()
    }
  }, [calendarConfigs, fetchCalendarEvents])

  const formatEventDate = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return ''
    
    const date = new Date(start)
    const now = new Date()
    
    // 오늘 날짜인지 확인
    const isToday = date.toDateString() === now.toDateString()
    
    if (event.start.dateTime) {
      // 시간이 있는 이벤트
      if (isToday) {
        return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
      }
      return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      // 종일 이벤트
      if (isToday) {
        return '오늘'
      }
      return date.toLocaleDateString('ko-KR')
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-gray-600">
        <p className="font-medium">외부 미팅/답사</p>
        <p className="text-xs text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="text-sm text-gray-600">
      <p className="font-medium">외부 미팅/답사</p>
      {events.length === 0 ? (
        <p className="text-xs text-gray-500">이번 주에는 예정된 외부 미팅/답사 일정이 없습니다.</p>
      ) : (
        <div className="space-y-1 mt-1">
          {events.map((event, index) => (
            <div key={event.id || index} className="text-xs">
              <p className="font-medium text-gray-700">{event.summary}</p>
              <p className="text-gray-500">{formatEventDate(event)}</p>
              {event.location && (
                <p className="text-gray-400">{event.location}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
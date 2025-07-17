'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { ADMIN_WEEKLY_CALENDARS, getCurrentYearRange } from '@/lib/calendarMapping'

interface Meeting {
  id: string
  created_by: string
  title: string
  meeting_type: 'external' | 'internal'
  date: string
  location?: string
  description?: string
  user?: {
    name: string
    department: string
  }
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  calendarId?: string
  calendarName: string
  color?: string
}

interface UserWeeklyScheduleProps {
  user: User
}

export default function UserWeeklySchedule({ }: UserWeeklyScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [showCalendarEvents, setShowCalendarEvents] = useState(true)

  const fetchCalendarEvents = useCallback(async () => {
    if (!showCalendarEvents) {
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      
      // 외부 및 내부 미팅 캘린더에서 이벤트 가져오기
      for (const calendarConfig of ADMIN_WEEKLY_CALENDARS) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarId: calendarConfig.id,
              timeMin,
              timeMax,
              maxResults: 250
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.events) {
              const eventsWithCalendarInfo = data.events.map((event: CalendarEvent) => ({
                ...event,
                calendarName: calendarConfig.name,
                calendarId: calendarConfig.id
              }))
              allEvents.push(...eventsWithCalendarInfo)
            }
          }
        } catch (error) {
          console.error(`캘린더 ${calendarConfig.name} 이벤트 조회 오류:`, error)
        }
      }

      // 현재 주의 이벤트만 필터링
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const weeklyEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start || '')
        return eventDate >= startOfWeek && eventDate <= endOfWeek
      })
      
      setCalendarEvents(weeklyEvents)
    } catch (error) {
      console.error('캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [currentDate, showCalendarEvents])

  const fetchMeetings = useCallback(async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          user:users(name, department)
        `)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error) {
        console.error('Error fetching meetings:', error)
      } else {
        setMeetings(data || [])
      }
    } catch (error) {
      console.error('Error in fetchMeetings:', error)
    }
  }, [currentDate])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()) // 일요일부터 시작

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getMeetingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return meetings.filter(meeting => meeting.date === dateStr)
  }

  const getCalendarEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getAllEventsForDate = (date: Date) => {
    const meetingsForDate = getMeetingsForDate(date)
    const events = getCalendarEventsForDate(date)
    
    return {
      meetings: meetingsForDate,
      calendarEvents: events,
      totalCount: meetingsForDate.length + events.length
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const goToThisWeek = () => {
    setCurrentDate(new Date())
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const formatWeekRange = () => {
    const weekDays = getWeekDays()
    const startDate = weekDays[0]
    const endDate = weekDays[6]
    
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getDate()}일`
    } else {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`
    }
  }

  const weekDays = getWeekDays()

  return (
    <div className="mt-6 space-y-6 p-4">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-900">이번 주 일정 - {formatWeekRange()}</h4>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCalendarEvents(!showCalendarEvents)}
              className={`px-2 py-1 text-xs rounded-md flex items-center space-x-1 ${
                showCalendarEvents 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}
              disabled={calendarLoading}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Google</span>
              {calendarLoading && (
                <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>
            <button 
              onClick={() => navigateWeek('prev')}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button 
              onClick={goToThisWeek}
              className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
            >
              이번 주
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* 데스크탑 그리드뷰 */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
              const day = weekDays[index]
              const dayMeetings = getMeetingsForDate(day)
              const dayEvents = getAllEventsForDate(day)
              const isTodayDay = isToday(day)
              const isWeekend = index === 0 || index === 6
              
              return (
                <div key={index} className="flex flex-col">
                  <div className={`text-center py-2 text-sm font-medium ${
                    isTodayDay ? 'text-indigo-600' : isWeekend ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    <div>{dayName}</div>
                    <div className="h-8 flex items-center justify-center">
                      <div className={`text-lg ${isTodayDay ? 'bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                    {/* 미팅 표시 */}
                    {dayMeetings.map((meeting, idx) => (
                      <div 
                        key={`meeting-${idx}`}
                        className={`text-xs p-1 rounded break-words ${
                          meeting.meeting_type === 'external' 
                            ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                            : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                        }`}
                        title={`${meeting.title} (${meeting.user?.department})`}
                      >
                        <div className="font-medium">[{meeting.user?.department}]</div>
                        <div>{meeting.title}</div>
                      </div>
                    ))}
                    
                    {/* Google Calendar 이벤트 표시 */}
                    {showCalendarEvents && dayEvents.calendarEvents.map((event, idx) => (
                      <div 
                        key={`cal-${event.id}-${idx}`}
                        className={`text-xs p-1 rounded break-words ${
                          event.calendarName.includes('외부') 
                            ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500'
                            : 'bg-purple-100 text-purple-800 border-l-2 border-purple-500'
                        }`}
                        title={`${event.title} (${event.calendarName})`}
                      >
                        <div className="font-medium">[{event.calendarName}]</div>
                        <div>{event.title}</div>
                      </div>
                    ))}
                    
                    {dayMeetings.length === 0 && (!showCalendarEvents || dayEvents.calendarEvents.length === 0) && (
                      <div className="text-xs text-gray-400 text-center pt-8">
                        일정 없음
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 모바일 리스트뷰 */}
        <div className="md:hidden space-y-2">
          {weekDays.map((day, index) => {
            const dayMeetings = getMeetingsForDate(day)
            const dayEvents = getAllEventsForDate(day)
            const isTodayDay = isToday(day)
            const isWeekend = index === 0 || index === 6
            const dayName = ['일', '월', '화', '수', '목', '금', '토'][index]
            const totalEvents = dayMeetings.length + (showCalendarEvents ? dayEvents.calendarEvents.length : 0)
            
            if (totalEvents === 0) return null
            
            return (
              <div key={index} className="bg-white rounded-lg border p-3">
                <div className={`flex items-center justify-between mb-2 ${
                  isTodayDay ? 'text-indigo-600' : isWeekend ? 'text-red-600' : 'text-gray-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`text-sm font-medium ${isTodayDay ? 'bg-indigo-600 text-white px-2 py-1 rounded-full' : ''}`}>
                      {dayName}
                    </div>
                    <div className="text-lg font-medium">
                      {day.getDate()}일
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {totalEvents}개 일정
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* 미팅 표시 */}
                  {dayMeetings.map((meeting, idx) => (
                    <div 
                      key={`meeting-${idx}`}
                      className={`text-sm p-2 rounded break-words ${
                        meeting.meeting_type === 'external' 
                          ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                          : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                      }`}
                    >
                      <div className="font-medium text-xs text-gray-600 mb-1">[{meeting.user?.department}]</div>
                      <div className="font-medium">{meeting.title}</div>
                      {meeting.location && (
                        <div className="text-xs text-gray-600 mt-1">📍 {meeting.location}</div>
                      )}
                    </div>
                  ))}
                  
                  {/* Google Calendar 이벤트 표시 */}
                  {showCalendarEvents && dayEvents.calendarEvents.map((event, idx) => (
                    <div 
                      key={`cal-${event.id}-${idx}`}
                      className={`text-sm p-2 rounded break-words ${
                        event.calendarName.includes('외부') 
                          ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500'
                          : 'bg-purple-100 text-purple-800 border-l-2 border-purple-500'
                      }`}
                    >
                      <div className="font-medium text-xs text-gray-600 mb-1">[{event.calendarName}]</div>
                      <div className="font-medium">{event.title}</div>
                      {event.location && (
                        <div className="text-xs text-gray-600 mt-1">📍 {event.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          
          {weekDays.every(day => {
            const dayMeetings = getMeetingsForDate(day)
            const dayEvents = getAllEventsForDate(day)
            return dayMeetings.length === 0 && (!showCalendarEvents || dayEvents.calendarEvents.length === 0)
          }) && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <div>이번 주에 등록된 일정이 없습니다</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
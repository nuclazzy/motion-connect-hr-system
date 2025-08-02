'use client'

import { useState, useEffect, useCallback } from 'react'
import { CALENDAR_IDS, CALENDAR_NAMES } from '@/lib/calendarMapping'
import { getHolidayInfoSync, initializeHolidayCache } from '@/lib/holidays'

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
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('list')
  const [isManualView, setIsManualView] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    is_all_day: false,
    location: '',
    description: '',
    targetCalendar: ''
  })

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
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()) // 이번주 일요일
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
              location: googleEvent.location,
              calendarId: calendarId,
              calendarName: (CALENDAR_NAMES as Record<string, string>)[calendarId] || title,
              color: calendarType === 'internal' ? 'bg-blue-100 text-blue-800 border-blue-500' : 'bg-green-100 text-green-800 border-green-500'
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
  }, [title, getCalendarId, currentDate, calendarType])

  // 화면 크기에 따른 자동 뷰 변경
  useEffect(() => {
    const handleResize = () => {
      if (!isManualView) {
        // 768px (md breakpoint) 미만이면 리스트 뷰, 이상이면 캘린더 뷰
        const isMobile = window.innerWidth < 768
        setViewType(isMobile ? 'list' : 'calendar')
      }
    }

    // 초기 설정
    handleResize()

    // 리사이즈 이벤트 리스너 추가
    window.addEventListener('resize', handleResize)
    
    // 클린업
    return () => window.removeEventListener('resize', handleResize)
  }, [isManualView])

  useEffect(() => {
    fetchCalendarEvents()
    initializeHolidayCache()
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

  const getEventsForDate = (date: Date) => {
    // 로컬 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 해결)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const localDateStr = `${year}-${month}-${day}`
    
    return events.filter(event => {
      if (!event.start || !event.end) return false
      
      // 이벤트 시작일과 종료일 추출
      const eventStartDate = event.start.split('T')[0]
      const eventEndDate = event.end.split('T')[0]
      
      // 종일 이벤트의 경우 Google Calendar는 종료일을 하루 뒤로 설정하므로 하루 빼기
      let actualEndDate = eventEndDate
      if (!event.start.includes('T') && !event.end.includes('T')) {
        // 종일 이벤트인 경우
        const endDateObj = new Date(eventEndDate)
        endDateObj.setDate(endDateObj.getDate() - 1)
        const endYear = endDateObj.getFullYear()
        const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0')
        const endDay = String(endDateObj.getDate()).padStart(2, '0')
        actualEndDate = `${endYear}-${endMonth}-${endDay}`
      }
      
      // 현재 날짜가 이벤트 기간 내에 있는지 확인
      return localDateStr >= eventStartDate && localDateStr <= actualEndDate
    })
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

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.targetCalendar) {
      alert('등록할 캘린더를 선택해주세요.')
      return
    }

    const apiRoute = editingEvent ? '/api/calendar/update-event' : '/api/calendar/create-event-direct'
    
    let eventData
    if (formData.is_all_day) {
      // 종일 이벤트
      const endDate = new Date(formData.date)
      endDate.setDate(endDate.getDate() + 1) // Google Calendar 규칙: 종료일은 다음 날
      
      eventData = {
        summary: formData.title,
        description: formData.description,
        location: formData.location,
        start: { date: formData.date },
        end: { date: endDate.toISOString().split('T')[0] }
      }
    } else {
      // 시간 지정 이벤트
      const startDateTime = new Date(`${formData.date}T${formData.time || '09:00'}:00`)
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000) // 1시간 지속

      eventData = {
        summary: formData.title,
        description: formData.description,
        location: formData.location,
        start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' }
      }
    }

    const body = editingEvent 
      ? { eventId: editingEvent.id, calendarId: editingEvent.calendarId, eventData }
      : { calendarId: formData.targetCalendar, eventData }

    try {
      const response = await fetch(apiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || 'API 요청 실패')
      }

      alert(editingEvent ? '일정이 성공적으로 수정되었습니다!' : '일정이 성공적으로 등록되었습니다!')

      setShowAddForm(false)
      setShowEditForm(false)
      setEditingEvent(null)
      setFormData({
        title: '',
        date: '',
        time: '',
        is_all_day: false,
        location: '',
        description: '',
        targetCalendar: getCalendarId()
      })
      fetchCalendarEvents() // 목록 새로고침
    } catch (error) {
      console.error(editingEvent ? '일정 수정 오류:' : '일정 등록 오류:', error)
      alert(editingEvent ? '일정 수정 중 오류가 발생했습니다.' : '일정 등록 중 오류가 발생했습니다.')
    }
  }

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event)
    const isAllDayEvent = !event.start.includes('T')
    const eventDate = new Date(event.start)
    setFormData({
      title: event.title,
      date: eventDate.toISOString().split('T')[0],
      time: isAllDayEvent ? '' : eventDate.toTimeString().slice(0, 5),
      is_all_day: isAllDayEvent,
      location: event.location || '',
      description: event.description || '',
      targetCalendar: event.calendarId || getCalendarId()
    })
    setShowEditForm(true)
  }

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!confirm(`"${event.title}" 일정을 삭제하시겠습니까?`)) {
      return
    }

    try {
      await fetch('/api/calendar/delete-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, calendarId: event.calendarId })
      })

      alert('일정이 성공적으로 삭제되었습니다!')
      fetchCalendarEvents() // 목록 새로고침
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
    }
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

  const formatEventDate = (event: CalendarEvent) => {
    const start = event.start
    if (!start) return ''
    
    const date = new Date(start)
    const now = new Date()
    const isTodayEvent = date.toDateString() === now.toDateString()
    
    if (start.includes('T')) {
      // 시간이 있는 이벤트
      if (isTodayEvent) {
        return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
      }
      return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    } else {
      // 종일 이벤트
      if (isTodayEvent) return '오늘'
      return date.toLocaleDateString('ko-KR')
    }
  }

  const renderListView = () => {
    return (
      <div className="space-y-6">
        <div className={`rounded-lg p-4 border ${
          calendarType === 'internal' 
            ? 'bg-blue-50 border-blue-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <h4 className={`text-sm font-medium mb-4 ${
            calendarType === 'internal' ? 'text-blue-900' : 'text-green-900'
          }`}>
            {title} - {formatWeekRange()}
          </h4>
          <div className="space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-8">
                <svg className={`mx-auto h-12 w-12 ${
                  calendarType === 'internal' ? 'text-blue-400' : 'text-green-400'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className={`mt-2 ${
                  calendarType === 'internal' ? 'text-blue-600' : 'text-green-600'
                }`}>{noEventsMessage}</p>
              </div>
            ) : (
              events.map((event, index) => {
                const startDate = new Date(event.start)
                const isTodayEvent = new Date().toDateString() === startDate.toDateString()
                
                return (
                  <div key={index} className={`bg-white border rounded-lg p-3 shadow-sm ${
                    calendarType === 'internal' ? 'border-blue-200' : 'border-green-200'
                  }`}>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-2 md:space-y-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className={`inline-block w-3 h-3 rounded-full ${
                            calendarType === 'internal' ? 'bg-blue-500' : 'bg-green-500'
                          }`}></span>
                          <h4 className={`font-semibold text-sm md:text-base ${
                            calendarType === 'internal' ? 'text-blue-900' : 'text-green-900'
                          }`}>{event.title}</h4>
                          {isTodayEvent && (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              calendarType === 'internal' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>오늘</span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className={`text-sm flex items-center ${
                            calendarType === 'internal' ? 'text-blue-700' : 'text-green-700'
                          }`}>
                            <svg className={`w-4 h-4 mr-2 ${
                              calendarType === 'internal' ? 'text-blue-400' : 'text-green-400'
                            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatEventDate(event)}
                          </p>
                          {event.location && (
                            <p className={`text-sm flex items-center ${
                              calendarType === 'internal' ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              <svg className={`w-4 h-4 mr-2 ${
                                calendarType === 'internal' ? 'text-blue-400' : 'text-green-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className={`text-sm mt-2 ${
                              calendarType === 'internal' ? 'text-blue-600' : 'text-green-600'
                            }`}>{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 md:ml-4 mt-2 md:mt-0">
                        <button
                          onClick={() => handleEditEvent(event)}
                          className={`p-2 md:p-1 hover:text-opacity-70 md:bg-transparent rounded ${
                            calendarType === 'internal' 
                              ? 'text-blue-500 bg-blue-50' 
                              : 'text-green-500 bg-green-50'
                          }`}
                          title="수정"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(event)}
                          className="p-2 md:p-1 text-red-500 hover:text-red-700 md:bg-transparent bg-red-50 rounded"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    )
  }

  // 초기 설정
  useEffect(() => {
    setFormData(prev => ({ ...prev, targetCalendar: getCalendarId() }))
  }, [getCalendarId])

  const weekDays = getWeekDays()

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg col-span-full">
      <div className="p-3 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500">{calendarType === 'internal' ? '내부 미팅 및 면담' : '외부 답사 및 미팅'} 일정을 확인합니다.</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* 반응형 상태 표시 */}
            <div className="hidden md:flex items-center text-xs text-gray-500">
              {!isManualView && (
                <span className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  자동 전환
                </span>
              )}
            </div>
            
            {/* 뷰 토글 */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => {
                  setViewType('calendar')
                  setIsManualView(true)
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center ${
                  viewType === 'calendar' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="hidden md:inline">캘린더</span>
              </button>
              <button
                onClick={() => {
                  setViewType('list')
                  setIsManualView(true)
                }}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors flex items-center ${
                  viewType === 'list' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="hidden md:inline">목록</span>
              </button>
            </div>
            
            {/* 자동 전환 재활성화 버튼 */}
            {isManualView && (
              <button
                onClick={() => setIsManualView(false)}
                className="hidden md:flex items-center px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
                title="자동 반응형 전환 재활성화"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                자동
              </button>
            )}

            <div className="flex space-x-2">
              <button
                onClick={fetchCalendarEvents}
                className="px-3 py-1 text-sm rounded-md flex items-center space-x-1 bg-blue-100 text-blue-800"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden md:inline">새로고침</span>
                {loading && (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden md:inline">일정 등록</span>
                <span className="md:hidden">등록</span>
              </button>
            </div>
          </div>
        </div>

        {/* 주간 네비게이션 */}
        <div className="mt-4 md:mt-6 flex items-center justify-between border-b border-gray-200 pb-4">
          <button 
            onClick={() => navigateWeek('prev')}
            className="text-gray-400 hover:text-gray-600 p-2 md:p-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h4 className="text-sm md:text-base font-medium text-gray-900">{formatWeekRange()}</h4>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={goToThisWeek}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
            >
              이번 주
            </button>
            <button 
              onClick={() => navigateWeek('next')}
              className="text-gray-400 hover:text-gray-600 p-2 md:p-1"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 md:mt-6">
          {viewType === 'calendar' ? (
            <div className="hidden md:block space-y-6">
              <div className={`rounded-lg p-4 border ${
                calendarType === 'internal' 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-green-50 border-green-200'
              }`}>
                <h4 className={`text-sm font-medium mb-4 ${
                  calendarType === 'internal' ? 'text-blue-900' : 'text-green-900'
                }`}>{title}</h4>
                
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                    const day = weekDays[index]
                    const dayEvents = getEventsForDate(day)
                    const isTodayDay = isToday(day)
                    const isWeekendDay = index === 0 || index === 6
                    const holidayInfo = getHolidayInfoSync(day)
                    
                    return (
                      <div key={index} className="flex flex-col">
                        <div className={`text-center py-2 text-xs md:text-sm font-medium ${
                          isTodayDay 
                            ? (calendarType === 'internal' ? 'text-blue-600' : 'text-green-600') 
                            : (holidayInfo.isHoliday || isWeekendDay) ? 'text-red-600' : 'text-gray-700'
                        }`}>
                          <div>{dayName}</div>
                          <div className="h-6 md:h-8 flex items-center justify-center">
                            <div className={`text-sm md:text-lg ${
                              isTodayDay 
                                ? `text-white rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center ${
                                    calendarType === 'internal' ? 'bg-blue-600' : 'bg-green-600'
                                  }` 
                                : ''
                            }`}>
                              {day.getDate()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="min-h-[100px] md:min-h-[140px] bg-white rounded border p-1 md:p-2 space-y-1">
                          {/* 공휴일 표시 */}
                          {holidayInfo.isHoliday && (
                            <div className="text-xs text-red-600 mb-1 p-1 bg-red-50 rounded truncate text-center" title={holidayInfo.name}>
                              🎌 {holidayInfo.name}
                            </div>
                          )}
                          {dayEvents.slice(0, 2).map((event, idx) => (
                            <div 
                              key={`event-${idx}`}
                              className={`text-xs p-1 rounded break-words cursor-pointer hover:opacity-80 border-l-2 group relative ${
                                event.color || (calendarType === 'internal' 
                                  ? 'bg-blue-100 text-blue-800 border-blue-500' 
                                  : 'bg-green-100 text-green-800 border-green-500')
                              }`}
                              onClick={() => handleEditEvent(event)}
                              title={`${event.title} - 클릭하여 수정/삭제`}
                            >
                              <div className="font-medium leading-tight">
                                {event.title.length > 12 ? event.title.substring(0, 12) + '...' : event.title}
                              </div>
                              {event.start.includes('T') && (
                                <div className="text-xs">
                                  {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                              <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteEvent(event)
                                  }}
                                  className="text-red-500 hover:text-red-700 p-0.5"
                                  title="삭제"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className={`text-xs text-center font-medium ${
                              calendarType === 'internal' ? 'text-blue-600' : 'text-green-600'
                            }`}>
                              +{dayEvents.length - 2}개 더
                            </div>
                          )}
                          
                          {dayEvents.length === 0 && (
                            <div className="text-xs text-gray-400 text-center pt-6 md:pt-8">
                              일정 없음
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            renderListView()
          )}
        </div>
      </div>

      {/* 일정 추가/수정 모달 */}
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEvent ? '일정 수정' : '새 일정 등록'}
              </h3>
              
              <form onSubmit={handleSubmitMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">등록할 캘린더</label>
                  <select
                    value={formData.targetCalendar}
                    onChange={(e) => setFormData({...formData, targetCalendar: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    disabled={!!editingEvent}
                    required
                  >
                    <option value={getCalendarId()}>
                      {(CALENDAR_NAMES as Record<string, string>)[getCalendarId()] || title}
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="일정 제목을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">날짜</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_all_day}
                      onChange={(e) => setFormData({...formData, is_all_day: e.target.checked, time: e.target.checked ? '' : formData.time})}
                      className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-700">종일</span>
                  </label>
                </div>

                {!formData.is_all_day && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">시간</label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({...formData, time: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅 장소를 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅 내용을 입력하세요"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setShowEditForm(false)
                      setEditingEvent(null)
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {editingEvent ? '수정' : '등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
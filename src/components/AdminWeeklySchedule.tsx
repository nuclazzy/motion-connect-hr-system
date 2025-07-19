'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'

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

interface AdminWeeklyScheduleProps {
  user: User
}

interface FormData {
  title: string
  date: string
  time: string
  is_all_day: boolean
  location: string
  description: string
  calendarType: 'internal' | 'external'
}

const WEEKLY_CALENDARS = [
  { id: CALENDAR_IDS.INTERNAL_MEETING, name: '내부 회의 및 면담', type: 'internal' as const, color: 'bg-blue-500' },
  { id: CALENDAR_IDS.EXTERNAL_MEETING, name: '외부 미팅 및 답사', type: 'external' as const, color: 'bg-green-500' }
]

export default function AdminWeeklySchedule({}: AdminWeeklyScheduleProps) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [isManualView, setIsManualView] = useState(false) // 사용자가 수동으로 뷰를 변경했는지 추적
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    date: '',
    time: '',
    is_all_day: false,
    location: '',
    description: '',
    calendarType: 'internal'
  })

  // 이번주 시작일과 종료일 계산
  const getWeekRange = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay()) // 이번주 일요일
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(start)
    end.setDate(start.getDate() + 6) // 이번주 토요일
    end.setHours(23, 59, 59, 999)
    
    return { start, end }
  }

  // 모든 미팅 캘린더에서 직접 이벤트 조회
  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    try {
      const { start: timeMin, end: timeMax } = getWeekRange(currentDate)
      
      
      const allEvents: CalendarEvent[] = []
      
      // 각 캘린더에서 이벤트 가져오기
      for (const calendar of WEEKLY_CALENDARS) {
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: calendar.id,
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: 250
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.events) {
            const events = data.events.map((event: { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; description?: string; location?: string }) => ({
              id: event.id,
              title: event.summary || '',
              start: event.start?.dateTime || event.start?.date || '',
              end: event.end?.dateTime || event.end?.date || '',
              description: event.description,
              location: event.location,
              calendarId: calendar.id,
              calendarName: calendar.name,
              color: calendar.color
            }))
            allEvents.push(...events)
          }
        } else {
          const errorText = await response.text()
          console.error(`캘린더 ${calendar.name} 조회 실패:`, response.status, errorText)
        }
      }

      setCalendarEvents(allEvents)
    } catch (error) {
      console.error('주간 일정 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentDate])

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
    initializeHolidayCache()
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  // 주간 네비게이션
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction === 'prev' ? -7 : 7))
      return newDate
    })
  }

  // 이벤트 제출 핸들러
  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const targetCalendar = WEEKLY_CALENDARS.find(cal => cal.type === formData.calendarType)
    if (!targetCalendar) {
      alert('캘린더 타입을 선택해주세요.')
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
      : { calendarId: targetCalendar.id, eventData }

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
        calendarType: 'internal'
      })
      fetchCalendarEvents() // 목록 새로고침
    } catch (error) {
      console.error(editingEvent ? '일정 수정 오류:' : '일정 등록 오류:', error)
      alert(editingEvent ? '일정 수정 중 오류가 발생했습니다.' : '일정 등록 중 오류가 발생했습니다.')
    }
  }

  // 이벤트 편집 핸들러
  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event)
    const isAllDayEvent = !event.start.includes('T')
    const eventDate = new Date(event.start)
    const calendarType = event.calendarId === CALENDAR_IDS.INTERNAL_MEETING ? 'internal' : 'external'
    
    setFormData({
      title: event.title,
      date: eventDate.toISOString().split('T')[0],
      time: isAllDayEvent ? '' : eventDate.toTimeString().slice(0, 5),
      is_all_day: isAllDayEvent,
      location: event.location || '',
      description: event.description || '',
      calendarType
    })
    setShowEditForm(true)
  }

  // 이벤트 삭제 핸들러
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

  // 주간 캘린더 렌더링
  const renderWeeklyCalendar = () => {
    const { start } = getWeekRange(currentDate)
    const days = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateString = date.toISOString().split('T')[0]
      const dayEvents = calendarEvents.filter(event => {
        const eventStartDate = event.start.includes('T') ? event.start.split('T')[0] : event.start
        const eventEndDate = event.end.includes('T') ? event.end.split('T')[0] : event.end
        return dateString >= eventStartDate && dateString < eventEndDate
      })
      
      const isToday = new Date().toDateString() === date.toDateString()
      const isWeekendDay = isWeekend(date)
      const holidayInfo = getHolidayInfoSync(date)
      const holiday = holidayInfo.isHoliday ? holidayInfo.name : null
      
      days.push(
        <div
          key={i}
          className={`p-2 md:p-3 min-h-[100px] md:min-h-[120px] border border-gray-200 ${
            isToday ? 'bg-blue-50 border-blue-300' : ''
          } ${isWeekendDay || holiday ? 'bg-red-50' : ''}`}
        >
          <div className={`text-xs md:text-sm font-medium ${
            isToday ? 'text-blue-600' : 
            isWeekendDay || holiday ? 'text-red-600' : 'text-gray-900'
          }`}>
            <span className="md:hidden">{['일', '월', '화', '수', '목', '금', '토'][i]}</span>
            <span className="hidden md:inline">{['일', '월', '화', '수', '목', '금', '토'][i]} {date.getDate()}일</span>
            <span className="md:hidden ml-1">{date.getDate()}</span>
          </div>
          {holiday && (
            <div className="text-xs text-red-600 mt-1 truncate" title={holiday}>
              <span className="md:hidden">{holiday.substring(0, 4)}...</span>
              <span className="hidden md:inline">{holiday}</span>
            </div>
          )}
          <div className="mt-1 md:mt-2 space-y-1">
            {dayEvents.slice(0, 3).map((event, index) => (
              <div
                key={index}
                className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${
                  event.calendarId === CALENDAR_IDS.INTERNAL_MEETING 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}
                onClick={() => handleEditEvent(event)}
                title={event.title}
              >
                <div className="font-medium truncate">{event.title}</div>
                {event.start.includes('T') && (
                  <div className="text-gray-600 hidden md:block">
                    {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{dayEvents.length - 3}개 더
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {/* 요일 헤더 */}
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-2 md:p-3 bg-gray-50 text-center text-xs md:text-sm font-medium text-gray-700 border-b border-gray-200">
            {day}
          </div>
        ))}
        {days}
      </div>
    )
  }

  // 리스트 뷰 렌더링
  const renderListView = () => {
    const sortedEvents = calendarEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return (
      <div className="space-y-3">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 mt-2">이번주 일정이 없습니다.</p>
          </div>
        ) : (
          sortedEvents.map((event, index) => {
            const startDate = new Date(event.start)
            const isToday = new Date().toDateString() === startDate.toDateString()
            
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-2 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className={`inline-block w-3 h-3 rounded-full ${
                        event.calendarId === CALENDAR_IDS.INTERNAL_MEETING ? 'bg-blue-500' : 'bg-green-500'
                      }`}></span>
                      <h4 className="font-semibold text-gray-900 text-sm md:text-base">{event.title}</h4>
                      {isToday && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">오늘</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{event.calendarName}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {event.start.includes('T') 
                          ? `${startDate.toLocaleDateString('ko-KR')} ${startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                          : `${startDate.toLocaleDateString('ko-KR')} (종일)`
                        }
                      </p>
                      {event.location && (
                        <p className="text-sm text-gray-500 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {event.location}
                        </p>
                      )}
                      {event.description && (
                        <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2 md:ml-4 mt-2 md:mt-0">
                    <button
                      onClick={() => handleEditEvent(event)}
                      className="p-2 md:p-1 text-gray-400 hover:text-blue-600 md:bg-transparent bg-gray-50 rounded"
                      title="수정"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(event)}
                      className="p-2 md:p-1 text-gray-400 hover:text-red-600 md:bg-transparent bg-gray-50 rounded"
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
    )
  }

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">이번주 미팅 및 답사일정</h3>
                <p className="text-sm text-gray-500">관리자 일정 관리</p>
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
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-indigo-600 text-white px-3 md:px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
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
        <div className="p-3 md:p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <button onClick={() => navigateWeek('prev')} className="p-2 md:p-1 hover:bg-gray-200 rounded-full">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm md:text-lg font-semibold text-gray-900 text-center">
              <span className="hidden md:inline">
                {getWeekRange(currentDate).start.toLocaleDateString('ko-KR')} - {getWeekRange(currentDate).end.toLocaleDateString('ko-KR')}
              </span>
              <span className="md:hidden">
                {getWeekRange(currentDate).start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - {getWeekRange(currentDate).end.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </span>
            </h3>
            <button onClick={() => navigateWeek('next')} className="p-2 md:p-1 hover:bg-gray-200 rounded-full">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 캘린더/목록 뷰 */}
        <div className="p-3 md:p-5">
          {viewType === 'calendar' ? renderWeeklyCalendar() : renderListView()}
        </div>
      </div>

      {/* 일정 등록/수정 모달 */}
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEvent ? '일정 수정' : '새 일정 등록'}
              </h3>
              
              <form onSubmit={handleSubmitEvent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">캘린더 유형</label>
                  <select
                    value={formData.calendarType}
                    onChange={(e) => setFormData({...formData, calendarType: e.target.value as 'internal' | 'external'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="internal">내부 회의 및 면담</option>
                    <option value="external">외부 미팅 및 답사</option>
                  </select>
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
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
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
                        calendarType: 'internal'
                      })
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
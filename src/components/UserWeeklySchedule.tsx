'use client'

import { useState, useEffect, useCallback } from 'react'
import { getMeetingCalendars, CALENDAR_NAMES } from '@/lib/calendarMapping'
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

interface CalendarConfig {
  id: string
  config_type: 'meeting'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

export default function UserWeeklySchedule() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  // 반응형 뷰는 CSS로 자동 처리 (모바일: list, 데스크톱: calendar)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    is_all_day: false,
    location: '',
    description: '',
    targetCalendar: ''
  })

  const fetchCalendarConfigs = useCallback(async () => {
    try {
      console.log('📅 [DEBUG] 미팅 캘린더 설정 시작')
      
      // 미팅 캘린더 매핑 사용
      const meetingCalendars = getMeetingCalendars()
      console.log('📅 [DEBUG] 미팅 캘린더:', meetingCalendars)
      
      const allCalendars = [...meetingCalendars.own, ...meetingCalendars.others]
      console.log('📅 [DEBUG] 전체 미팅 캘린더 목록:', allCalendars)
      
      const configs = allCalendars.map(calendarId => ({
        id: calendarId,
        config_type: 'meeting' as const,
        target_name: 'meetings',
        calendar_id: calendarId,
        calendar_alias: (CALENDAR_NAMES as Record<string, string>)[calendarId] || calendarId,
        is_active: true
      }))
      
      console.log('📅 [DEBUG] 생성된 미팅 캘린더 설정:', configs)
      setCalendarConfigs(configs)
    } catch (error) {
      console.error('미팅 캘린더 설정 조회 오류:', error)
    }
  }, [])

  const fetchCalendarEvents = useCallback(async () => {
    if (calendarConfigs.length === 0) {
      console.log('🔄 [DEBUG] 미팅 캘린더 설정이 비어있음 - 이벤트 조회 생략')
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      // 성능 최적화: 연간 데이터 대신 현재 주간의 데이터만 가져오도록 수정
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      const timeMin = startOfWeek.toISOString()
      const timeMax = endOfWeek.toISOString()
      console.log('🔄 [DEBUG] 시간 범위:', { timeMin, timeMax })

      // Google Calendar에서 이벤트 가져오기
      for (const config of calendarConfigs) {
        console.log(`🔄 [DEBUG] 미팅 캘린더 이벤트 조회 시도: ${config.calendar_alias} (${config.calendar_id})`)
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarId: config.calendar_id,
              timeMin,
              timeMax,
              maxResults: 250
            }),
          })

          console.log(`🔄 [DEBUG] 미팅 캘린더 API 응답 상태: ${response.status}`)
          
          if (response.ok) {
            const data = await response.json()
            console.log(`🔄 [DEBUG] 가져온 미팅 이벤트 수: ${data.events?.length || 0}`)
            if (data.events) {
              const eventsWithCalendarInfo = data.events.map((event: CalendarEvent) => ({
                ...event,
                calendarName: config.calendar_alias,
                calendarId: config.calendar_id
              }))
              allEvents.push(...eventsWithCalendarInfo)
            }
          } else {
            const errorText = await response.text()
            console.error(`🔄 [ERROR] 미팅 캘린더 API 오류: ${response.status} - ${errorText}`)
          }
        } catch (error) {
          console.error(`미팅 캘린더 ${config.calendar_alias} 이벤트 조회 오류:`, error)
        }
      }

      console.log(`🔄 [DEBUG] 이번 주 미팅 이벤트 수: ${allEvents.length}`)
      setCalendarEvents(allEvents)
    } catch (error) {
      console.error('미팅 캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [currentDate, calendarConfigs])

  // 반응형 뷰는 CSS로 자동 처리되므로 별도 로직 불필요

  useEffect(() => {
    fetchCalendarConfigs()
  }, [fetchCalendarConfigs])

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
    const dateStr = date.toISOString().split('T')[0]
    return calendarEvents.filter(event => (event.start || '').startsWith(dateStr))
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
        targetCalendar: ''
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
      targetCalendar: event.calendarId || ''
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

  const renderListView = () => {
    // 모든 이벤트를 시간순으로 정렬
    const allEvents = [...calendarEvents].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return (
      <div className="space-y-6">
        {/* 통합된 미팅 및 답사 일정 */}
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-4">미팅 및 답사 일정 - {formatWeekRange()}</h4>
          <div className="space-y-3">
            {allEvents.length === 0 ? (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-600 mt-2">이번 주에는 예정된 일정이 없습니다.</p>
              </div>
            ) : (
              allEvents.map((event, index) => {
                const startDate = new Date(event.start)
                const isTodayEvent = new Date().toDateString() === startDate.toDateString()
                const isExternal = event.calendarId?.includes('motionsense')
                
                // 색상 설정
                const colorClasses = isExternal 
                  ? {
                      dot: 'bg-blue-500',
                      title: 'text-blue-900',
                      border: 'border-blue-200',
                      text: 'text-blue-700',
                      icon: 'text-blue-400',
                      description: 'text-blue-600',
                      badge: 'bg-blue-100 text-blue-800',
                      editBtn: 'text-blue-500 hover:text-blue-700 bg-blue-50',
                      type: '외부'
                    }
                  : {
                      dot: 'bg-green-500',
                      title: 'text-green-900',
                      border: 'border-green-200',
                      text: 'text-green-700',
                      icon: 'text-green-400',
                      description: 'text-green-600',
                      badge: 'bg-green-100 text-green-800',
                      editBtn: 'text-green-500 hover:text-green-700 bg-green-50',
                      type: '내부'
                    }
                
                return (
                  <div key={index} className={`bg-white border ${colorClasses.border} rounded-lg p-3 shadow-sm`}>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-2 md:space-y-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className={`inline-block w-3 h-3 rounded-full ${colorClasses.dot}`}></span>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{colorClasses.type}</span>
                          <h4 className={`font-semibold ${colorClasses.title} text-sm md:text-base`}>{event.title}</h4>
                          {isTodayEvent && (
                            <span className={`px-2 py-1 ${colorClasses.badge} text-xs rounded-full`}>오늘</span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1">
                          <p className={`text-sm ${colorClasses.text} flex items-center`}>
                            <svg className={`w-4 h-4 mr-2 ${colorClasses.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {event.start.includes('T') 
                              ? `${startDate.toLocaleDateString('ko-KR')} ${startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                              : `${startDate.toLocaleDateString('ko-KR')} (종일)`
                            }
                          </p>
                          {event.location && (
                            <p className={`text-sm ${colorClasses.description} flex items-center`}>
                              <svg className={`w-4 h-4 mr-2 ${colorClasses.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className={`text-sm ${colorClasses.description} mt-2`}>{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2 md:ml-4 mt-2 md:mt-0">
                        <button
                          onClick={() => handleEditEvent(event)}
                          className={`p-2 md:p-1 ${colorClasses.editBtn} md:bg-transparent rounded`}
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
              <h3 className="text-lg font-medium text-gray-900">주간 미팅/답사 일정</h3>
              <p className="text-sm text-gray-500">외부/내부 일정을 확인하고 관리합니다.</p>
              {/* 캘린더 범례 */}
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
                  <span className="text-gray-600">외부 미팅 및 답사</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                  <span className="text-gray-600">내부 회의 및 면담</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <button
                onClick={fetchCalendarEvents}
                className="px-3 py-1 text-sm rounded-md flex items-center space-x-1 bg-blue-100 text-blue-800"
                disabled={calendarLoading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="hidden md:inline">새로고침</span>
                {calendarLoading && (
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
          {/* 캘린더 뷰 - 데스크톱에서만 표시 */}
          <div className="hidden md:block space-y-6">
              {/* 통합된 미팅 및 답사 캘린더 */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-900 mb-4">미팅 및 답사 캘린더</h4>
                
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                    const day = getWeekDays()[index]
                    const allDayEvents = getEventsForDate(day)
                    const isTodayDay = isToday(day)
                    const isWeekend = index === 0 || index === 6
                    const holidayInfo = getHolidayInfoSync(day)
                    
                    return (
                      <div key={index} className="flex flex-col">
                        <div className={`text-center py-2 text-xs md:text-sm font-medium ${
                          isTodayDay ? 'text-indigo-600' : (holidayInfo.isHoliday || isWeekend) ? 'text-red-600' : 'text-gray-700'
                        }`}>
                          <div>{dayName}</div>
                          <div className="h-6 md:h-8 flex items-center justify-center">
                            <div className={`text-sm md:text-lg ${isTodayDay ? 'bg-indigo-600 text-white rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center' : ''}`}>
                              {day.getDate()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="min-h-[120px] md:min-h-[160px] bg-white rounded border p-1 md:p-2 space-y-1 overflow-hidden">
                          {/* 공휴일 표시 */}
                          {holidayInfo.isHoliday && (
                            <div className="text-xs text-red-600 mb-1 p-1 bg-red-50 rounded text-center" title={holidayInfo.name}>
                              🎌 <span className="truncate inline-block max-w-full">{holidayInfo.name}</span>
                            </div>
                          )}
                          {allDayEvents.slice(0, 2).map((event, idx) => {
                            const isExternal = event.calendarId?.includes('motionsense')
                            const colorClasses = isExternal 
                              ? 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                              : 'bg-green-100 text-green-800 border-l-2 border-green-500'
                              
                            return (
                              <div 
                                key={`event-${idx}`}
                                className={`text-xs p-1.5 md:p-2 rounded cursor-pointer hover:opacity-80 ${colorClasses} group relative overflow-hidden`}
                                onClick={() => handleEditEvent(event)}
                                title={`${event.title} - 클릭하여 수정/삭제`}
                              >
                                <div className="font-medium leading-tight mb-1">
                                  <div className="break-words overflow-hidden" style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                  }}>{event.title}</div>
                                </div>
                                {event.start.includes('T') && (
                                  <div className="text-xs opacity-75">
                                    {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteEvent(event)
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5 bg-white rounded-full shadow-sm"
                                    title="삭제"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                          {allDayEvents.length > 2 && (
                            <div className="text-xs text-gray-600 text-center font-medium py-1">
                              +{allDayEvents.length - 2}개 더
                            </div>
                          )}
                          
                          {allDayEvents.length === 0 && (
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
          
          {/* 리스트 뷰 - 모바일에서 표시 */}
          <div className="md:hidden">
            {renderListView()}
          </div>
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
                    <option value="">캘린더를 선택하세요</option>
                    {calendarConfigs.map(config => (
                      <option key={config.calendar_id} value={config.calendar_id}>
                        {config.calendar_alias}
                      </option>
                    ))}
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
'use client'

import { useState, useEffect, useCallback } from 'react'
import { getMeetingCalendars, CALENDAR_NAMES } from '@/lib/calendarMapping'

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
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [isManualView] = useState(false)
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

  // TeamSchedule과 동일한 캘린더 설정 조회 로직
  const fetchCalendarConfigs = useCallback(async () => {
    try {
      console.log('📅 [DEBUG] 미팅 캘린더 설정 시작')
      
      // 미팅 캘린더 매핑 사용 - TeamSchedule과 동일한 패턴
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

  // TeamSchedule과 완전히 동일한 이벤트 조회 로직
  const fetchCalendarEvents = useCallback(async () => {
    if (calendarConfigs.length === 0) {
      console.log('🔄 [DEBUG] 미팅 캘린더 설정이 비어있음 - 이벤트 조회 생략')
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      // 현재 주간의 시간 범위 계산
      const startOfWeek = new Date(currentDate)
      const day = startOfWeek.getDay()
      const diff = startOfWeek.getDate() - day
      startOfWeek.setDate(diff)
      startOfWeek.setHours(0, 0, 0, 0)
      
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)
      
      const timeMin = startOfWeek.toISOString()
      const timeMax = endOfWeek.toISOString()
      console.log('🔄 [DEBUG] 현재 주간 시간 범위:', { timeMin, timeMax })

      // Google Calendar에서 이벤트 가져오기 - TeamSchedule과 동일한 방식
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
                calendarId: config.calendar_id,
                color: config.calendar_id.includes('motionsense') ? '#3B82F6' : '#10B981' // blue for external, green for internal
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

  useEffect(() => {
    fetchCalendarConfigs()
  }, [fetchCalendarConfigs])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents, currentDate])

  // 화면 크기에 따른 자동 뷰 변경 - TeamSchedule과 동일
  useEffect(() => {
    const handleResize = () => {
      if (!isManualView) {
        const isMobile = window.innerWidth < 768
        setViewType(isMobile ? 'list' : 'calendar')
      }
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isManualView])

  // 주간 네비게이션 함수들
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const goToCurrentWeek = () => {
    setCurrentDate(new Date())
  }

  const formatWeekRange = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day
    startOfWeek.setDate(diff)
    
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    
    const formatDate = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`
    return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`
  }

  const resetFormData = () => {
    setFormData({
      title: '',
      date: '',
      time: '',
      is_all_day: false,
      location: '',
      description: '',
      targetCalendar: calendarConfigs[0]?.calendar_id || ''
    })
  }

  const handleAddEvent = () => {
    resetFormData()
    setFormData(prev => ({ ...prev, targetCalendar: calendarConfigs[0]?.calendar_id || '' }))
    setShowAddForm(true)
  }

  const handleEditEvent = (event: CalendarEvent) => {
    const eventDate = new Date(event.start)
    const isAllDay = event.start.includes('T00:00:00') && event.end.includes('T00:00:00')
    
    setFormData({
      title: event.title,
      date: eventDate.toISOString().split('T')[0],
      time: isAllDay ? '' : eventDate.toTimeString().slice(0, 5),
      is_all_day: isAllDay,
      location: event.location || '',
      description: event.description || '',
      targetCalendar: event.calendarId || calendarConfigs[0]?.calendar_id || ''
    })
    setEditingEvent(event)
    setShowEditForm(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.date) {
      alert('제목과 날짜는 필수 입력사항입니다.')
      return
    }

    try {
      let startDateTime: string
      let endDateTime: string

      if (formData.is_all_day) {
        startDateTime = `${formData.date}T00:00:00`
        endDateTime = `${formData.date}T23:59:59`
      } else {
        if (!formData.time) {
          alert('종일이 아닌 경우 시간을 입력해주세요.')
          return
        }
        startDateTime = `${formData.date}T${formData.time}:00`
        const startDate = new Date(startDateTime)
        startDate.setHours(startDate.getHours() + 1)
        endDateTime = startDate.toISOString().slice(0, 19)
      }

      const eventData = {
        calendarId: formData.targetCalendar,
        summary: formData.title,
        description: formData.description,
        location: formData.location,
        start: formData.is_all_day ? 
          { date: formData.date } : 
          { dateTime: startDateTime },
        end: formData.is_all_day ? 
          { date: formData.date } : 
          { dateTime: endDateTime }
      }

      let response
      if (showEditForm && editingEvent) {
        response = await fetch('/api/calendar/update-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventData,
            eventId: editingEvent.id
          })
        })
      } else {
        response = await fetch('/api/calendar/create-event-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData)
        })
      }

      if (response.ok) {
        alert(showEditForm ? '일정이 수정되었습니다.' : '일정이 등록되었습니다.')
        setShowAddForm(false)
        setShowEditForm(false)
        setEditingEvent(null)
        resetFormData()
        await fetchCalendarEvents()
      } else {
        const errorData = await response.json()
        console.error('이벤트 처리 실패:', errorData)
        alert(`일정 ${showEditForm ? '수정' : '등록'}에 실패했습니다: ${errorData.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      console.error('이벤트 처리 오류:', error)
      alert('일정 처리 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteEvent = async (eventId: string, calendarId: string) => {
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) {
      return
    }

    try {
      const response = await fetch('/api/calendar/delete-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          eventId
        })
      })

      if (response.ok) {
        alert('일정이 삭제되었습니다.')
        await fetchCalendarEvents()
      } else {
        const errorData = await response.json()
        console.error('이벤트 삭제 실패:', errorData)
        alert('일정 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('이벤트 삭제 오류:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
    }
  }

  const getWeekDays = () => {
    const today = new Date(currentDate)
    const currentDay = today.getDay()
    const sundayDate = new Date(today)
    sundayDate.setDate(today.getDate() - currentDay)
    
    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(sundayDate)
      day.setDate(sundayDate.getDate() + i)
      weekDays.push(day)
    }
    return weekDays
  }

  const formatDateRange = (startDate: Date, endDate: Date) => {
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getDate()}일`
    } else {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`
    }
  }

  // TeamSchedule과 동일한 리스트 뷰 구조
  const renderListView = () => {
    const externalEvents = calendarEvents.filter(event => 
      event.calendarId?.includes('motionsense')
    )
    const internalEvents = calendarEvents.filter(event => 
      event.calendarId?.includes('dingastory')
    )

    const sortedExternalEvents = externalEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    const sortedInternalEvents = internalEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return (
      <div className="space-y-6">
        {/* 외부 미팅 및 답사 일정 */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              외부 미팅 및 답사 일정
            </h3>
          </div>
          <div className="p-4">
            {sortedExternalEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">외부 미팅 및 답사 일정이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {sortedExternalEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(event.start).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          hour: event.start.includes('T00:00:00') ? undefined : 'numeric',
                          minute: event.start.includes('T00:00:00') ? undefined : '2-digit'
                        })}
                        {event.start.includes('T00:00:00') && ' (종일)'}
                      </p>
                      {event.location && <p className="text-sm text-gray-500">📍 {event.location}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.calendarId!)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 내부 회의 및 면담 일정 */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              내부 회의 및 면담 일정
            </h3>
          </div>
          <div className="p-4">
            {sortedInternalEvents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">내부 회의 및 면담 일정이 없습니다</p>
            ) : (
              <div className="space-y-3">
                {sortedInternalEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-600">
                        {new Date(event.start).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          hour: event.start.includes('T00:00:00') ? undefined : 'numeric',
                          minute: event.start.includes('T00:00:00') ? undefined : '2-digit'
                        })}
                        {event.start.includes('T00:00:00') && ' (종일)'}
                      </p>
                      {event.location && <p className="text-sm text-gray-500">📍 {event.location}</p>}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditEvent(event)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id, event.calendarId!)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // TeamSchedule과 동일한 캘린더 뷰 구조
  const renderCalendarView = () => {
    const weekDays = getWeekDays()
    const startDate = weekDays[0]
    const endDate = weekDays[6]

    return (
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            이번 주 미팅 및 답사 일정 ({formatDateRange(startDate, endDate)})
          </h3>
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* 요일 헤더 */}
          {['월', '화', '수', '목', '금', '토', '일'].map((day) => (
            <div key={day} className="bg-gray-50 p-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {/* 날짜 칸들 */}
          {weekDays.map((day, index) => {
            const dayEvents = calendarEvents.filter(event => {
              const eventDate = new Date(event.start)
              return eventDate.toDateString() === day.toDateString()
            })

            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <div key={index} className={`bg-white p-2 min-h-[120px] ${isToday ? 'bg-blue-50' : ''}`}>
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="text-xs p-1 rounded cursor-pointer hover:opacity-80"
                      style={{ backgroundColor: event.color + '20', borderLeft: `3px solid ${event.color}` }}
                      onClick={() => handleEditEvent(event)}
                      title={`${event.title}${event.location ? ` (${event.location})` : ''}`}
                    >
                      <div className="font-medium leading-tight break-words overflow-wrap-anywhere">
                        {event.title}
                      </div>
                      {event.start.includes('T00:00:00') && (
                        <div className="text-xs text-gray-500">종일</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">주간 미팅/답사 일정</h3>
              <p className="text-sm text-gray-500">외부/내부 일정을 확인하고 관리합니다.</p>
            </div>
          </div>
          <button
            onClick={handleAddEvent}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            일정 추가
          </button>
        </div>
      </div>

      {/* 캘린더 로딩 상태 */}
      {calendarLoading && (
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">일정을 불러오는 중...</p>
        </div>
      )}

      {/* 메인 컨텐츠 */}
      {!calendarLoading && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">{formatWeekRange()}</h4>
            <div className="flex items-center space-x-2">
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button onClick={() => setViewType('calendar')} className={`px-3 py-1 text-sm rounded-md ${viewType === 'calendar' ? 'bg-white shadow' : ''}`}>캘린더</button>
                <button onClick={() => setViewType('list')} className={`px-3 py-1 text-sm rounded-md ${viewType === 'list' ? 'bg-white shadow' : ''}`}>목록</button>
              </div>
              <button onClick={goToPreviousWeek} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={goToCurrentWeek} className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs">이번 주</button>
              <button onClick={goToNextWeek} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>

          {calendarLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-600">일정을 불러오는 중...</p>
            </div>
          ) : (
            viewType === 'calendar' ? renderCalendarView() : renderListView()
          )}
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {showEditForm ? '일정 수정' : '일정 추가'}
              </h3>
              
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">캘린더 선택</label>
                  <select
                    value={formData.targetCalendar}
                    onChange={(e) => setFormData({...formData, targetCalendar: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    {calendarConfigs.map((config) => (
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

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_all_day"
                    checked={formData.is_all_day}
                    onChange={(e) => setFormData({...formData, is_all_day: e.target.checked})}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_all_day" className="ml-2 block text-sm text-gray-900">
                    종일
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
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={3}
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
                      resetFormData()
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {showEditForm ? '수정' : '추가'}
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
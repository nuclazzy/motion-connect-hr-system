'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { ADMIN_TEAM_CALENDARS } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'
import { 
  fetchCalendarEvents as fetchGoogleCalendarEvents,
  deleteCalendarEvent,
  initializeGoogleAPI,
  parseEventDate 
} from '@/lib/googleCalendar'

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

interface AdminTeamScheduleProps {
  user?: User
}

interface FormData {
  title: string
  date: string
  time: string
  is_all_day: boolean
  location: string
  description: string
  targetCalendar: string
}

export default function AdminTeamSchedule({}: AdminTeamScheduleProps) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
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
    targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || ''
  })

  // 모든 팀 캘린더에서 직접 이벤트 조회
  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    try {
      // Google API 초기화
      await initializeGoogleAPI()
      
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
      
      console.log('📅 [DEBUG] 전체 팀 캘린더 이벤트 조회 시작:', { timeMin, timeMax })

      // 각 팀 캘린더에서 이벤트 가져오기
      for (const calendarConfig of ADMIN_TEAM_CALENDARS) {
        console.log(`📅 [DEBUG] 캘린더 이벤트 조회: ${calendarConfig.name} (${calendarConfig.id})`)
        try {
          // Google Calendar 직접 연동으로 이벤트 가져오기
          const googleEvents = await fetchGoogleCalendarEvents(calendarConfig.id, timeMin, timeMax, 250)
          
          console.log(`📅 [DEBUG] ${calendarConfig.name} 가져온 이벤트 수:`, googleEvents.length)
          
          if (googleEvents && googleEvents.length > 0) {
            const eventsWithCalendarInfo = googleEvents.map((event: any) => {
              const { start, end, isAllDay } = parseEventDate(event)
              
              return {
                id: event.id || '',
                title: event.summary || '',
                start: isAllDay ? event.start?.date || '' : event.start?.dateTime || '',
                end: isAllDay ? event.end?.date || '' : event.end?.dateTime || '',
                description: event.description,
                location: event.location,
                calendarName: calendarConfig.name,
                calendarId: calendarConfig.id,
                color: getCalendarColor(calendarConfig.id)
              }
            })
            allEvents.push(...eventsWithCalendarInfo)
          }
        } catch (error) {
          console.error(`캘린더 ${calendarConfig.name} 이벤트 조회 오류:`, error)
        }
      }

      console.log(`📅 [DEBUG] 이번 주 전체 팀 이벤트 수:`, allEvents.length)
      setCalendarEvents(allEvents)
    } catch (error) {
      console.error('전체 팀 캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchCalendarEvents()
    initializeHolidayCache()
  }, [fetchCalendarEvents])

  // 캘린더별 색상 지정
  const getCalendarColor = (calendarId: string) => {
    const colors = {
      [ADMIN_TEAM_CALENDARS[0]?.id]: 'bg-blue-100 text-blue-800 border-blue-500',
      [ADMIN_TEAM_CALENDARS[1]?.id]: 'bg-green-100 text-green-800 border-green-500',
      [ADMIN_TEAM_CALENDARS[2]?.id]: 'bg-purple-100 text-purple-800 border-purple-500',
      [ADMIN_TEAM_CALENDARS[3]?.id]: 'bg-orange-100 text-orange-800 border-orange-500',
    }
    return colors[calendarId] || 'bg-gray-100 text-gray-800 border-gray-500'
  }

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
    
    return calendarEvents.filter(event => {
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

  const handleSubmitEvent = async (e: React.FormEvent) => {
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
        targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || ''
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
      // Google Calendar 직접 연동으로 이벤트 삭제
      await deleteCalendarEvent(event.calendarId || '', event.id)

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

  const weekDays = getWeekDays()

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.196-2.121L16.5 14l-2.5-4.5L12 14l-2-4.5L8.5 14l-.304 1.879A3 3 0 003 18v2h5M9 10a3 3 0 11-6 0 3 3 0 016 0zm11 0a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">전체 팀 일정 관리</h3>
              <p className="text-sm text-gray-500">모든 팀의 일정을 확인하고 수정/삭제합니다.</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={fetchCalendarEvents}
              className="px-3 py-1 text-sm rounded-md flex items-center space-x-1 bg-blue-100 text-blue-800"
              disabled={loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>새로고침</span>
              {loading && (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
            >
              일정 등록
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6 p-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">전체 팀 일정 - {formatWeekRange()}</h4>
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigateWeek('prev')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 캘린더 범례 */}
            <div className="mb-4 flex flex-wrap gap-2">
              {ADMIN_TEAM_CALENDARS.map((calendar) => (
                <div key={calendar.id} className="flex items-center space-x-1">
                  <div className={`w-3 h-3 rounded border-l-2 ${getCalendarColor(calendar.id)}`}></div>
                  <span className="text-xs text-gray-600">{calendar.name}</span>
                </div>
              ))}
            </div>

            {/* 데스크톱 그리드뷰 */}
            <div className="hidden md:grid grid-cols-7 gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                const day = weekDays[index]
                const dayEvents = getEventsForDate(day)
                const isTodayDay = isToday(day)
                const isWeekendDay = isWeekend(day)
                const holidayInfo = getHolidayInfoSync(day)
                
                return (
                  <div key={index} className="flex flex-col">
                    <div className={`text-center py-2 text-sm font-medium ${
                      isTodayDay ? 'text-indigo-600' : (holidayInfo.isHoliday || isWeekendDay) ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      <div>{dayName}</div>
                      <div className="h-8 flex items-center justify-center">
                        <div className={`text-lg ${isTodayDay ? 'bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                          {day.getDate()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                      {/* 공휴일 표시 */}
                      {holidayInfo.isHoliday && (
                        <div className="text-xs text-red-600 mb-1 p-1 bg-red-50 rounded truncate text-center" title={holidayInfo.name}>
                          🎌 {holidayInfo.name}
                        </div>
                      )}
                      {/* 팀 이벤트 표시 */}
                      {dayEvents.map((event, idx) => (
                        <div 
                          key={`event-${idx}`}
                          className={`text-xs p-1 rounded break-words cursor-pointer hover:opacity-80 relative group border-l-2 ${event.color || 'bg-gray-100 text-gray-800 border-gray-500'}`}
                          title={`${event.title} (${event.calendarName}) - 클릭하여 수정/삭제`}
                          onClick={() => handleEditEvent(event)}
                        >
                          <div className="font-medium">[{event.calendarName}]</div>
                          <div>{event.title}</div>
                          {event.start.includes('T') && (
                            <div className="text-xs">
                              {new Date(event.start).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteEvent(event)
                            }}
                            className="absolute top-0 right-0 text-red-600 hover:text-red-800 text-xs opacity-0 group-hover:opacity-100 bg-white rounded-full w-4 h-4 flex items-center justify-center"
                            title="삭제"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      
                      {dayEvents.length === 0 && (
                        <div className="text-xs text-gray-400 text-center pt-8">
                          일정 없음
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 모바일 리스트뷰 */}
            <div className="md:hidden space-y-2 mt-4">
              {weekDays.map((day, index) => {
                const dayEvents = getEventsForDate(day)
                const isTodayDay = isToday(day)
                const isWeekendDay = isWeekend(day)
                const holidayInfo = getHolidayInfoSync(day)
                const dayName = ['일', '월', '화', '수', '목', '금', '토'][index]
                const totalEvents = dayEvents.length
                
                if (totalEvents === 0 && !holidayInfo.isHoliday) return null
                
                return (
                  <div key={index} className="bg-white rounded-lg border p-3">
                    <div className={`flex items-center justify-between mb-2 ${
                      isTodayDay ? 'text-indigo-600' : (holidayInfo.isHoliday || isWeekendDay) ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className={`text-sm font-medium ${isTodayDay ? 'bg-indigo-600 text-white px-2 py-1 rounded-full' : ''}`}>
                          {dayName}
                        </div>
                        <div className="text-lg font-medium">
                          {day.getDate()}일
                        </div>
                        {holidayInfo.isHoliday && (
                          <div className="text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded" title={holidayInfo.name}>
                            🎌 {holidayInfo.name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {totalEvents}개 일정
                      </div>
                    </div>
                    
                    {totalEvents > 0 && (
                      <div className="space-y-2">
                        {dayEvents.map((event, idx) => (
                          <div 
                            key={`event-${idx}`}
                            className={`text-sm p-2 rounded break-words cursor-pointer hover:opacity-80 border-l-2 ${event.color || 'bg-gray-100 text-gray-800 border-gray-500'}`}
                            title={`${event.title} (${event.calendarName}) - 클릭하여 수정/삭제`}
                            onClick={() => handleEditEvent(event)}
                          >
                            <div className="font-medium text-xs text-gray-600 mb-1">[{event.calendarName}]</div>
                            <div className="font-medium">{event.title}</div>
                            {event.location && (
                              <div className="text-xs text-gray-600 mt-1">📍 {event.location}</div>
                            )}
                            <div className="flex justify-end mt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteEvent(event)
                                }}
                                className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-white rounded"
                                title="삭제"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              
              {weekDays.every(day => {
                const dayEvents = getEventsForDate(day)
                const holidayInfo = getHolidayInfoSync(day)
                return dayEvents.length === 0 && !holidayInfo.isHoliday
              }) && (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📅</div>
                  <div>이번 주에 등록된 팀 일정이 없습니다</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 일정 추가/수정 모달 */}
      {(showAddForm || showEditForm) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEvent ? '일정 수정' : '새 일정 등록'}
              </h3>
              
              <form onSubmit={handleSubmitEvent} className="space-y-4">
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
                    {ADMIN_TEAM_CALENDARS.map(cal => (
                      <option key={cal.id} value={cal.id}>{cal.name}</option>
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
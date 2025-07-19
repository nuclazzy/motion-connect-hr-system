'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { getCurrentYearRange } from '@/lib/calendarMapping'

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

export default function UserWeeklySchedule({}: UserWeeklyScheduleProps) {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [isManualView, setIsManualView] = useState(false)
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

  // 미팅 캘린더 ID 정의
  const MEETING_CALENDARS = {
    external: 'motionsense.co.kr_vdbr1eu5ectsbsnod67gdohj00@group.calendar.google.com', // 외부 미팅 및 답사
    internal: 'dingastory.com_aatf30n7ad8e3mq7kfilhvu6rk@group.calendar.google.com'  // 내부 회의 및 면담
  }

  // 화면 크기에 따른 자동 뷰 변경
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

  const fetchCalendarEvents = useCallback(async () => {
    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      console.log('🔄 [DEBUG] 미팅 캘린더 이벤트 조회 시작')

      // 외부 미팅 및 답사 일정
      try {
        console.log(`🔄 [DEBUG] 외부 미팅 및 답사 캘린더 조회: ${MEETING_CALENDARS.external}`)
        const externalResponse = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: MEETING_CALENDARS.external,
            timeMin,
            timeMax,
            maxResults: 250
          })
        })

        if (externalResponse.ok) {
          const externalData = await externalResponse.json()
          console.log(`✅ [DEBUG] 외부 미팅 이벤트 조회 성공:`, externalData.events?.length || 0)
          
          if (externalData.events) {
            const externalEvents = externalData.events.map((event: unknown) => ({
              ...event as CalendarEvent,
              calendarName: '외부 미팅 및 답사',
              calendarId: MEETING_CALENDARS.external,
              color: '#3B82F6' // blue
            }))
            allEvents.push(...externalEvents)
          }
        } else {
          console.error('❌ [DEBUG] 외부 미팅 캘린더 조회 실패:', externalResponse.status)
        }
      } catch (error) {
        console.error('❌ [DEBUG] 외부 미팅 캘린더 조회 오류:', error)
      }

      // 내부 회의 및 면담 일정
      try {
        console.log(`🔄 [DEBUG] 내부 회의 및 면담 캘린더 조회: ${MEETING_CALENDARS.internal}`)
        const internalResponse = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: MEETING_CALENDARS.internal,
            timeMin,
            timeMax,
            maxResults: 250
          })
        })

        if (internalResponse.ok) {
          const internalData = await internalResponse.json()
          console.log(`✅ [DEBUG] 내부 회의 이벤트 조회 성공:`, internalData.events?.length || 0)
          
          if (internalData.events) {
            const internalEvents = internalData.events.map((event: unknown) => ({
              ...event as CalendarEvent,
              calendarName: '내부 회의 및 면담',
              calendarId: MEETING_CALENDARS.internal,
              color: '#10B981' // green
            }))
            allEvents.push(...internalEvents)
          }
        } else {
          console.error('❌ [DEBUG] 내부 회의 캘린더 조회 실패:', internalResponse.status)
        }
      } catch (error) {
        console.error('❌ [DEBUG] 내부 회의 캘린더 조회 오류:', error)
      }

      console.log(`✅ [DEBUG] 전체 미팅 이벤트 조회 완료: ${allEvents.length}개`)
      setCalendarEvents(allEvents)
    } catch (error) {
      console.error('❌ [DEBUG] 미팅 캘린더 이벤트 조회 총 오류:', error)
    } finally {
      setCalendarLoading(false)
    }
  }, [MEETING_CALENDARS.external, MEETING_CALENDARS.internal])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])


  const resetFormData = () => {
    setFormData({
      title: '',
      date: '',
      time: '',
      is_all_day: false,
      location: '',
      description: '',
      targetCalendar: MEETING_CALENDARS.external
    })
  }

  const handleAddEvent = () => {
    resetFormData()
    setFormData(prev => ({ ...prev, targetCalendar: MEETING_CALENDARS.external }))
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
      targetCalendar: event.calendarId || MEETING_CALENDARS.external
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
    const today = new Date()
    const currentDay = today.getDay()
    const mondayDate = new Date(today)
    mondayDate.setDate(today.getDate() - currentDay + 1)
    
    const weekDays = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(mondayDate)
      day.setDate(mondayDate.getDate() + i)
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

  const renderListView = () => {
    const externalEvents = calendarEvents.filter(event => event.calendarId === MEETING_CALENDARS.external)
    const internalEvents = calendarEvents.filter(event => event.calendarId === MEETING_CALENDARS.internal)

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
                      <div className="font-medium leading-tight break-words overflow-hidden">
                        <span className="md:hidden">{event.title.length > 8 ? event.title.substring(0, 8) + '...' : event.title}</span>
                        <span className="hidden md:block">{event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}</span>
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
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">이번주 미팅 및 답사 일정</h2>
          <p className="text-sm text-gray-600">외부 미팅 및 답사, 내부 회의 및 면담 일정을 확인하고 관리할 수 있습니다</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 뷰 전환 버튼 */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setViewType('calendar')
                setIsManualView(true)
                setTimeout(() => setIsManualView(false), 5000)
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewType === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              캘린더
            </button>
            <button
              onClick={() => {
                setViewType('list')
                setIsManualView(true)
                setTimeout(() => setIsManualView(false), 5000)
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewType === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              목록
            </button>
          </div>

          {/* 일정 추가 버튼 */}
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

      {/* 뷰 렌더링 */}
      {!calendarLoading && (
        viewType === 'calendar' ? renderCalendarView() : renderListView()
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
                    <option value={MEETING_CALENDARS.external}>외부 미팅 및 답사</option>
                    <option value={MEETING_CALENDARS.internal}>내부 회의 및 면담</option>
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
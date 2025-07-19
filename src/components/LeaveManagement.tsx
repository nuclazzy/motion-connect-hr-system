'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

// 한국 공휴일 데이터 (2024-2025년)
const koreanHolidays = {
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체휴일',
  '2024-03-01': '삼일절',
  '2024-04-10': '국회의원선거',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체휴일',
  '2024-05-15': '부처님 오신 날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체휴일',
  '2025-05-05': '어린이날',
  '2025-05-13': '부처님 오신 날',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-06': '추석 연휴',
  '2025-10-07': '추석',
  '2025-10-08': '추석 연휴',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절'
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

interface LeaveManagementProps {
  user?: User
}

export default function LeaveManagement({}: LeaveManagementProps) {
  const [leaveEvents, setLeaveEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<'calendar' | 'list'>('calendar')

  // Google Calendar에서 직접 휴가 이벤트 조회 (보기 전용)
  const fetchLeaveEvents = useCallback(async () => {
    setLoading(true)
    try {
      // 현재 월의 데이터만 가져오기
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const timeMin = new Date(year, month, 1).toISOString()
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      console.log('📅 [DEBUG] 휴가 캘린더 이벤트 조회 시작:', { 
        calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT, 
        timeMin, 
        timeMax 
      })

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
          timeMin,
          timeMax,
          maxResults: 250
        }),
      })

      console.log('📅 [DEBUG] 휴가 캘린더 API 응답 상태:', response.status)

      let fetchedEvents: CalendarEvent[] = []
      if (response.ok) {
        const data = await response.json()
        console.log('📅 [DEBUG] 가져온 휴가 이벤트 수:', data.events?.length || 0)
        if (data.events) {
          // API 응답을 우리 인터페이스에 맞게 변환
          fetchedEvents = data.events.map((event: unknown) => {
            const googleEvent = event as { id: string; summary?: string; title?: string; start?: { date?: string; dateTime?: string } | string; end?: { date?: string; dateTime?: string } | string; description?: string; location?: string }
            const getEventTime = (timeObj: { date?: string; dateTime?: string } | string | undefined) => {
              if (typeof timeObj === 'string') return timeObj
              if (timeObj && typeof timeObj === 'object') {
                return timeObj.date || timeObj.dateTime || ''
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
        console.error('휴가 캘린더 이벤트 조회 실패:', response.status, errorText)
      }

      setLeaveEvents(fetchedEvents)
    } catch (error) {
      console.error('휴가 캘린더 이벤트 조회 오류:', error)
      setLeaveEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchLeaveEvents()
  }, [fetchLeaveEvents])

  // 캘린더 헬퍼 함수들
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const isToday = (date: Date, day: number) => {
    const today = new Date()
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           day === today.getDate()
  }

  const getDateString = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getEventsForDate = (dateString: string) => {
    return leaveEvents.filter(event => {
      const eventStartDate = event.start.split('T')[0]
      const eventEndDate = event.end.split('T')[0]
      // Google Calendar의 종일 이벤트는 종료일을 포함하지 않으므로 (exclusive)
      // 현재 날짜가 시작일(포함) 이상이고 종료일(미포함) 미만인지 확인
      return dateString >= eventStartDate && dateString < eventEndDate
    })
  }

  const isHoliday = (dateString: string) => {
    return koreanHolidays[dateString as keyof typeof koreanHolidays]
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // 빈 셀들 (이전 달의 마지막 날들)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>)
    }

    // 현재 달의 날들
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = getDateString(year, month, day)
      const isCurrentDay = isToday(currentDate, day)
      const dayEvents = getEventsForDate(dateString)
      const holiday = isHoliday(dateString)
      const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6

      days.push(
        <div
          key={day}
          className={`p-2 min-h-[80px] border border-gray-200 ${
            isCurrentDay ? 'bg-blue-100 border-blue-300' : ''
          } ${isWeekend || holiday ? 'bg-red-50' : ''}`}
        >
          <div className={`text-sm ${
            isCurrentDay ? 'text-blue-600 font-bold' : 
            isWeekend || holiday ? 'text-red-600' : 'text-gray-900'
          }`}>
            {day}
          </div>
          {holiday && (
            <div className="text-xs text-red-600 mt-1">{holiday}</div>
          )}
          {dayEvents.map((event, index) => (
            <div key={index} className="text-xs bg-green-100 text-green-800 rounded px-1 mt-1 truncate">
              {event.title}
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-2 bg-gray-50 text-center text-sm font-medium text-gray-700 border-b border-gray-200">
            {day}
          </div>
        ))}
        {days}
      </div>
    )
  }

  const renderLeaveList = () => {
    const currentMonth = currentDate.getMonth()
    const currentYear = currentDate.getFullYear()
    
    const filteredEvents = leaveEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
    })

    // 날짜순으로 정렬
    const sortedEvents = filteredEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    return (
      <div className="space-y-3">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 mt-2">이번 달 휴가 일정이 없습니다.</p>
          </div>
        ) : (
          sortedEvents.map((event, index) => {
            const startDate = new Date(event.start)
            const endDate = new Date(event.end)
            const isSameDay = startDate.toDateString() === endDate.toDateString()
            
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-lg">{event.title}</h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {isSameDay 
                          ? startDate.toLocaleDateString('ko-KR')
                          : `${startDate.toLocaleDateString('ko-KR')} - ${endDate.toLocaleDateString('ko-KR')}`
                        }
                      </p>
                      {event.description && (
                        <p className="text-sm text-gray-500 flex items-start">
                          <svg className="w-4 h-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    휴가
                  </span>
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
    <div className="bg-white overflow-hidden shadow rounded-lg">
      {/* 헤더 */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">휴가 현황</h3>
              <p className="text-sm text-gray-500">전체 직원 휴가 현황 조회 (보기 전용)</p>
            </div>
          </div>
          
          {/* 새로고침 및 뷰 토글 버튼 */}
          <div className="flex space-x-2">
            <button
              onClick={fetchLeaveEvents}
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
              onClick={() => setCalendarView('calendar')}
              className={`px-3 py-1 text-sm rounded-md ${
                calendarView === 'calendar' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              캘린더
            </button>
            <button
              onClick={() => setCalendarView('list')}
              className={`px-3 py-1 text-sm rounded-md ${
                calendarView === 'list' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              목록
            </button>
          </div>
        </div>
      </div>

      {/* 캘린더 네비게이션 */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h4 className="text-lg font-semibold text-gray-900">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </h4>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="p-5">
        {calendarView === 'calendar' ? renderCalendar() : renderLeaveList()}
      </div>
    </div>
  )
}
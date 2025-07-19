'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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
}

interface AdminLeaveManagementProps {
  user?: User
}

interface AddLeaveForm {
  employee_id: string
  leave_type: 'annual' | 'special' | 'maternity' | 'paternity' | 'family_care' | 'sick'
  start_date: string
  end_date: string
  is_half_day: boolean
  half_day_type: 'morning' | 'afternoon'
  reason: string
}

export default function AdminLeaveManagement({}: AdminLeaveManagementProps) {
  const [leaveEvents, setLeaveEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<'calendar' | 'list'>('calendar')
  const [showAddLeave, setShowAddLeave] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; department: string; position: string }>>([])
  const [addLeaveForm, setAddLeaveForm] = useState<AddLeaveForm>({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'morning',
    reason: ''
  })

  // 직원 목록 조회
  const fetchAllUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('role', 'user')
        .order('name')

      if (error) {
        console.error('직원 목록 조회 오류:', error)
      } else {
        setUsers(data || [])
      }
    } catch (error) {
      console.error('직원 목록 조회 오류:', error)
    }
  }, [])

  // Google Calendar에서 직접 휴가 이벤트 조회
  const fetchLeaveEvents = useCallback(async () => {
    setLoading(true)
    try {
      // 현재 월의 데이터만 가져오기 (직원용과 동일)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const timeMin = new Date(year, month, 1).toISOString()
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      console.log('📅 [ADMIN DEBUG] 휴가 캘린더 이벤트 조회 시작:', { 
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

      console.log('📅 [ADMIN DEBUG] 휴가 캘린더 API 응답 상태:', response.status)

      let fetchedEvents: CalendarEvent[] = []
      if (response.ok) {
        const data = await response.json()
        console.log('📅 [ADMIN DEBUG] 가져온 휴가 이벤트 수:', data.events?.length || 0)
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
    fetchAllUsers()
    initializeHolidayCache()
  }, [fetchAllUsers])

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

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1))
      return newDate
    })
  }

  // 휴가 신청 처리
  const handleSubmitAddLeave = async () => {
    if (!addLeaveForm.employee_id || !addLeaveForm.start_date) {
      alert('직원과 시작일을 입력해주세요.')
      return
    }
    
    if (!addLeaveForm.is_half_day && !addLeaveForm.end_date) {
      alert('종료일을 입력해주세요.')
      return
    }

    try {
      const selectedUser = users.find(user => user.id === addLeaveForm.employee_id)
      if (!selectedUser) {
        alert('선택된 직원을 찾을 수 없습니다.')
        return
      }

      // 휴가 유형별 텍스트
      const leaveTypeTexts = {
        annual: '연차',
        special: '특별휴가',
        maternity: '출산휴가',
        paternity: '육아휴직',
        family_care: '가족돌봄휴가',
        sick: '병가'
      }
      const leaveTypeText = leaveTypeTexts[addLeaveForm.leave_type]
      const halfDayText = addLeaveForm.is_half_day ? 
        ` (${addLeaveForm.half_day_type === 'morning' ? '오전' : '오후'} 반차)` : ''

      // Google Calendar에 이벤트 추가
      const startDate = new Date(addLeaveForm.start_date)
      const endDate = addLeaveForm.is_half_day ? startDate : new Date(addLeaveForm.end_date)

      let eventData
      if (addLeaveForm.is_half_day) {
        // 반차인 경우 시간 지정
        const timeStart = addLeaveForm.half_day_type === 'morning' ? '09:00:00' : '13:00:00'
        const timeEnd = addLeaveForm.half_day_type === 'morning' ? '13:00:00' : '18:00:00'
        eventData = {
          summary: `${selectedUser.name} ${leaveTypeText}${halfDayText}`,
          description: addLeaveForm.reason || `관리자에 의한 수동 ${leaveTypeText} 등록`,
          start: { 
            dateTime: `${addLeaveForm.start_date}T${timeStart}`, 
            timeZone: 'Asia/Seoul' 
          },
          end: { 
            dateTime: `${addLeaveForm.start_date}T${timeEnd}`, 
            timeZone: 'Asia/Seoul' 
          }
        }
      } else {
        // 종일 휴가인 경우
        const adjustedEndDate = new Date(endDate)
        adjustedEndDate.setDate(adjustedEndDate.getDate() + 1) // Google Calendar는 종료일 다음날까지 설정해야 함
        
        eventData = {
          summary: `${selectedUser.name} ${leaveTypeText}${halfDayText}`,
          description: addLeaveForm.reason || `관리자에 의한 수동 ${leaveTypeText} 등록`,
          start: { 
            date: addLeaveForm.start_date, 
            timeZone: 'Asia/Seoul' 
          },
          end: { 
            date: adjustedEndDate.toISOString().split('T')[0], 
            timeZone: 'Asia/Seoul' 
          }
        }
      }

      const response = await fetch('/api/calendar/create-event-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
          eventData
        })
      })

      const result = await response.json()
      if (result.success) {
        alert(`휴가가 성공적으로 등록되었습니다.`)
        setShowAddLeave(false)
        setAddLeaveForm({
          employee_id: '',
          leave_type: 'annual',
          start_date: '',
          end_date: '',
          is_half_day: false,
          half_day_type: 'morning',
          reason: ''
        })
        fetchLeaveEvents() // 캘린더 새로고침
      } else {
        console.error('캘린더 이벤트 생성 실패:', result.error)
        alert('휴가 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('수동 휴가 등록 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate)
    const firstDay = getFirstDayOfMonth(currentDate)
    const days = []

    // 빈 셀들 (이전 달의 마지막 날들)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200"></div>)
    }

    // 현재 달의 날들
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      // 시간대 문제를 피하고 정확한 날짜 비교를 위해 YYYY-MM-DD 형식으로 직접 생성
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      
      const dayEvents = leaveEvents.filter(event => {
        const startDateStr = event.start.includes('T') ? event.start.split('T')[0] : event.start
        const endDateStr = event.end.includes('T') ? event.end.split('T')[0] : event.end
        
        // Google Calendar의 종일 이벤트는 종료일을 포함하지 않으므로 (exclusive)
        // 현재 날짜가 시작일(포함) 이상이고 종료일(미포함) 미만인지 확인
        return dateString >= startDateStr && dateString < endDateStr
      })
      const isCurrentDay = isToday(currentDate, day)
      const isWeekendDay = isWeekend(date)
      const holidayInfo = getHolidayInfoSync(date)
      const holiday = holidayInfo.isHoliday ? holidayInfo.name : null

      days.push(
        <div
          key={day}
          className={`p-2 min-h-[80px] border border-gray-200 ${
            isCurrentDay ? 'bg-blue-100 border-blue-300' : ''
          } ${isWeekendDay || holiday ? 'bg-red-50' : ''}`}
        >
          <div className={`text-sm ${
            isCurrentDay ? 'text-blue-600 font-bold' : 
            isWeekendDay || holiday ? 'text-red-600' : 'text-gray-900'
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
                <h3 className="text-lg font-medium text-gray-900">관리자 휴가 관리</h3>
                <p className="text-sm text-gray-500">전체 직원 휴가 현황 및 수동 등록</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setCalendarView('calendar')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    calendarView === 'calendar' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  캘린더
                </button>
                <button
                  onClick={() => setCalendarView('list')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    calendarView === 'list' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  목록
                </button>
              </div>
              <button
                onClick={() => setShowAddLeave(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
              >
                휴가 등록
              </button>
            </div>
          </div>
        </div>

        {/* 월 네비게이션 */}
        <div className="p-5 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <button onClick={() => navigateMonth('prev')} className="p-1 hover:bg-gray-200 rounded-full">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h3>
            <button onClick={() => navigateMonth('next')} className="p-1 hover:bg-gray-200 rounded-full">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 캘린더/목록 뷰 */}
        <div className="p-5">
          {calendarView === 'calendar' ? renderCalendar() : renderLeaveList()}
        </div>
      </div>

      {/* 수동 휴가 등록 모달 */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">직원 휴가 등록</h3>
              
              <div className="space-y-4">
                {/* 직원 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">직원 선택</label>
                  <select
                    value={addLeaveForm.employee_id}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, employee_id: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">직원을 선택하세요</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.department} {user.position})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 휴가 유형 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 유형</label>
                  <select
                    value={addLeaveForm.leave_type}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, leave_type: e.target.value as AddLeaveForm['leave_type']})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="annual">연차</option>
                    <option value="special">특별휴가</option>
                    <option value="maternity">출산휴가</option>
                    <option value="paternity">육아휴직</option>
                    <option value="family_care">가족돌봄휴가</option>
                    <option value="sick">병가</option>
                  </select>
                </div>

                {/* 반차 여부 */}
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={addLeaveForm.is_half_day}
                      onChange={(e) => setAddLeaveForm({...addLeaveForm, is_half_day: e.target.checked})}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">반차</span>
                  </label>
                  {addLeaveForm.is_half_day && (
                    <select
                      value={addLeaveForm.half_day_type}
                      onChange={(e) => setAddLeaveForm({...addLeaveForm, half_day_type: e.target.value as 'morning' | 'afternoon'})}
                      className="mt-2 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="morning">오전 반차</option>
                      <option value="afternoon">오후 반차</option>
                    </select>
                  )}
                </div>

                {/* 시작일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">시작일</label>
                  <input
                    type="date"
                    value={addLeaveForm.start_date}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, start_date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                {/* 종료일 (반차가 아닌 경우만) */}
                {!addLeaveForm.is_half_day && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">종료일</label>
                    <input
                      type="date"
                      value={addLeaveForm.end_date}
                      onChange={(e) => setAddLeaveForm({...addLeaveForm, end_date: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                )}

                {/* 사유 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">사유</label>
                  <textarea
                    rows={3}
                    value={addLeaveForm.reason}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, reason: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="휴가 사유를 입력하세요"
                  />
                </div>

                {/* 버튼들 */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddLeave(false)
                      setAddLeaveForm({
                        employee_id: '',
                        leave_type: 'annual',
                        start_date: '',
                        end_date: '',
                        is_half_day: false,
                        half_day_type: 'morning',
                        reason: ''
                      })
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitAddLeave}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
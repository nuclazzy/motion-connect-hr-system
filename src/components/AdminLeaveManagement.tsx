'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'

interface CalendarEvent {
  id: string
  summary: string
  start: { date?: string; dateTime?: string }
  end: { date?: string; dateTime?: string }
  description?: string
  location?: string
}

interface Employee {
  id: string
  name: string
  department: string
  position: string
}

export default function AdminLeaveManagement() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<Employee[]>([])
  const [showAddLeave, setShowAddLeave] = useState(false)
  const [addLeaveForm, setAddLeaveForm] = useState({
    employee_id: '',
    leave_type: 'annual' as 'annual' | 'sick',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'morning' as 'morning' | 'afternoon',
    reason: ''
  })

  const fetchAllUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('role', 'user')
        .order('name', { ascending: true })

      if (error) {
        console.error('직원 목록 조회 오류:', error)
      } else {
        setAllUsers(data || [])
      }
    } catch (error) {
      console.error('직원 목록 조회 오류:', error)
    }
  }

  const fetchCalendarEvents = useCallback(async () => {
    setLoading(true)
    try {
      const year = currentDate.getFullYear()
      const timeMin = new Date(year, 0, 1).toISOString()
      const timeMax = new Date(year, 11, 31, 23, 59, 59).toISOString()

      console.log('📅 [DEBUG] 휴가 캘린더 이벤트 조회:', { 
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
          maxResults: 250,
        }),
      })

      console.log('📅 [DEBUG] 휴가 캘린더 API 응답 상태:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('📅 [DEBUG] 가져온 휴가 이벤트 수:', data.events?.length || 0)
        setCalendarEvents(data.events || [])
      } else {
        const errorText = await response.text()
        console.error('휴가 캘린더 이벤트 조회 실패:', response.status, errorText)
        setCalendarEvents([])
      }
    } catch (error) {
      console.error('휴가 캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchAllUsers()
    initializeHolidayCache()
  }, [])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  const handleSubmitAddLeave = async () => {
    if (!addLeaveForm.employee_id || !addLeaveForm.start_date || !addLeaveForm.end_date) {
      alert('직원, 시작일, 종료일을 모두 입력해주세요.')
      return
    }

    try {
      // 1. DB에서 해당 직원의 휴가 데이터 조회 및 사용일수 업데이트
      const { data: userLeave, error: fetchError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', addLeaveForm.employee_id)
        .single()

      if (fetchError || !userLeave) {
        alert('해당 직원의 휴가 데이터를 찾을 수 없습니다.')
        console.error('휴가 데이터 조회 실패:', fetchError)
        return
      }

      // 실제 휴가일수 계산 (주말, 공휴일 제외)
      const startDate = new Date(addLeaveForm.start_date)
      const endDate = new Date(addLeaveForm.end_date)
      let daysToUse = 0

      if (addLeaveForm.is_half_day) {
        daysToUse = 0.5
      } else {
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dayOfWeek = d.getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6 && !getHolidayInfoSync(d).isHoliday) {
            daysToUse++
          }
        }
      }

      const updatedLeaveTypes = { ...userLeave.leave_types }

      if (addLeaveForm.leave_type === 'annual') {
        if ((updatedLeaveTypes.used_annual_days || 0) + daysToUse > updatedLeaveTypes.annual_days) {
          alert(`연차 부족: 현재 ${updatedLeaveTypes.annual_days - (updatedLeaveTypes.used_annual_days || 0)}일 남음, 신청 ${daysToUse}일`)
          return
        }
        updatedLeaveTypes.used_annual_days = (updatedLeaveTypes.used_annual_days || 0) + daysToUse
      } else if (addLeaveForm.leave_type === 'sick') {
        if ((updatedLeaveTypes.used_sick_days || 0) + daysToUse > updatedLeaveTypes.sick_days) {
          alert(`병가 부족: 현재 ${updatedLeaveTypes.sick_days - (updatedLeaveTypes.used_sick_days || 0)}일 남음, 신청 ${daysToUse}일`)
          return
        }
        updatedLeaveTypes.used_sick_days = (updatedLeaveTypes.used_sick_days || 0) + daysToUse
      }

      const { error: leaveError } = await supabase
        .from('leave_days')
        .update({ leave_types: updatedLeaveTypes })
        .eq('user_id', addLeaveForm.employee_id)

      if (leaveError) {
        console.error('휴가 데이터 업데이트 실패:', leaveError)
        alert('휴가 데이터 업데이트에 실패했습니다.')
        return
      }

      // 2. 구글 캘린더에 이벤트 추가
      try {
        const selectedUser = allUsers.find(u => u.id === addLeaveForm.employee_id)
        const leaveTypeText = addLeaveForm.leave_type === 'annual' ? '연차' : '병가'
        const halfDayText = addLeaveForm.is_half_day 
          ? ` (${addLeaveForm.half_day_type === 'morning' ? '오전' : '오후'} 반차)` 
          : ''
        
        const eventData = {
          summary: `${selectedUser?.name || '직원'} ${leaveTypeText}${halfDayText}`,
          description: addLeaveForm.reason || `관리자에 의한 수동 ${leaveTypeText} 등록 (${daysToUse}일 차감)`,
          start: addLeaveForm.is_half_day 
            ? {
                dateTime: addLeaveForm.half_day_type === 'morning' 
                  ? `${addLeaveForm.start_date}T09:00:00`
                  : `${addLeaveForm.start_date}T13:00:00`,
                timeZone: 'Asia/Seoul'
              }
            : {
                date: addLeaveForm.start_date,
                timeZone: 'Asia/Seoul'
              },
          end: addLeaveForm.is_half_day
            ? {
                dateTime: addLeaveForm.half_day_type === 'morning'
                  ? `${addLeaveForm.start_date}T12:00:00`
                  : `${addLeaveForm.start_date}T18:00:00`,
                timeZone: 'Asia/Seoul'
              }
            : {
                date: new Date(new Date(addLeaveForm.end_date).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                timeZone: 'Asia/Seoul'
              }
        }
        
        const calendarResponse = await fetch('/api/calendar/create-event-direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
            eventData
          })
        })

        const calendarResult = await calendarResponse.json()
        if (calendarResult.success) {
          console.log('휴가 캘린더 이벤트 생성 성공:', calendarResult.event)
        } else {
          console.error('휴가 캘린더 이벤트 생성 실패:', calendarResult.error)
        }
      } catch (calendarError) {
        console.error('휴가 캘린더 연동 오류:', calendarError)
      }

      // 3. form_requests 테이블에 수동 입력 기록 추가 (선택사항)
      try {
        await supabase
          .from('form_requests')
          .insert([{
            user_id: addLeaveForm.employee_id,
            form_type: 'manual_leave_admin',
            status: 'approved',
            request_data: {
              leave_type: addLeaveForm.leave_type,
              start_date: addLeaveForm.start_date,
              end_date: addLeaveForm.end_date,
              days: daysToUse,
              is_half_day: addLeaveForm.is_half_day,
              half_day_type: addLeaveForm.half_day_type,
              reason: addLeaveForm.reason,
              manual_entry: true,
              actual_working_days: daysToUse
            },
            submitted_at: new Date().toISOString(),
            processed_at: new Date().toISOString(),
            processed_by: 'admin'
          }])
      } catch (requestError) {
        console.error('수동 입력 기록 추가 실패:', requestError)
      }
      
      alert(`휴가가 성공적으로 등록되었습니다.\n실제 차감일수: ${daysToUse}일`)
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
      fetchCalendarEvents() // 캘린더 새로고침
    } catch (error) {
      console.error('수동 휴가 등록 오류:', error)
      alert('오류가 발생했습니다.')
    }
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

  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    const days = []

    // 빈 셀들 (이전 달의 마지막 날들)
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="p-2 border border-gray-200"></div>)
    }

    // 현재 달의 날들
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateString = date.toISOString().split('T')[0]
      const dayEvents = calendarEvents.filter(event => 
        (event.start?.date || event.start?.dateTime?.split('T')[0]) === dateString
      )
      const holidayInfo = getHolidayInfoSync(date)
      const isToday = new Date().toDateString() === date.toDateString()

      days.push(
        <div 
          key={day} 
          className={`p-2 min-h-[120px] border border-gray-200 relative ${
            isWeekend(date) || holidayInfo.isHoliday ? 'bg-red-50' : 'bg-white'
          } ${isToday ? 'bg-blue-50 border-blue-300' : ''}`}
        >
          <div className={`text-sm ${
            isToday ? 'font-bold text-blue-600' : 
            isWeekend(date) || holidayInfo.isHoliday ? 'text-red-500' : 'text-gray-900'
          }`}>
            {day}
          </div>
          {holidayInfo.isHoliday && (
            <div className="text-xs text-red-600 mt-1 truncate" title={holidayInfo.name}>
              🎌 {holidayInfo.name}
            </div>
          )}
          <div className="mt-1 space-y-1">
            {dayEvents.map((event, index) => (
              <div 
                key={event.id || index} 
                className="text-xs bg-green-100 text-green-800 rounded px-1 py-0.5 truncate border-l-2 border-green-500" 
                title={event.summary}
              >
                {event.summary}
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 border-b border-gray-200">
            {day}
          </div>
        ))}
        {days}
      </div>
    )
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(prev.getMonth() + (direction === 'prev' ? -1 : 1))
      return newDate
    })
  }

  return (
    <div className="space-y-6">
      {/* 휴가 캘린더 현황 */}
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
            <button
              onClick={() => setShowAddLeave(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              휴가 등록
            </button>
          </div>
        </div>
        <div className="p-5">
          {renderCalendar()}
        </div>
        <div className="bg-gray-50 px-5 py-3">
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-100 border-l-2 border-green-500 rounded"></div>
              <span>휴가 일정</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-50 rounded"></div>
              <span>주말/공휴일</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
              <span>오늘</span>
            </div>
          </div>
        </div>
      </div>

      {/* 수동 휴가 등록 모달 */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                수동 휴가 등록
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                📄 페이퍼 휴가 신청서를 보고 시스템에 입력하세요
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">직원 선택</label>
                  <select
                    value={addLeaveForm.employee_id}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, employee_id: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">직원을 선택하세요</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.department} {user.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 종류</label>
                  <select
                    value={addLeaveForm.leave_type}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, leave_type: e.target.value as 'annual' | 'sick'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="annual">연차</option>
                    <option value="sick">병가</option>
                  </select>
                </div>
                
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
                
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_half_day"
                      checked={addLeaveForm.is_half_day}
                      onChange={(e) => setAddLeaveForm({
                        ...addLeaveForm, 
                        is_half_day: e.target.checked,
                        end_date: e.target.checked ? addLeaveForm.start_date : addLeaveForm.end_date
                      })}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_half_day" className="ml-2 block text-sm text-gray-900">
                      반차
                    </label>
                  </div>
                  
                  {addLeaveForm.is_half_day && (
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700">반차 종류</label>
                      <select
                        value={addLeaveForm.half_day_type}
                        onChange={(e) => setAddLeaveForm({...addLeaveForm, half_day_type: e.target.value as 'morning' | 'afternoon'})}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="morning">오전 반차 (09:00-12:00)</option>
                        <option value="afternoon">오후 반차 (13:00-18:00)</option>
                      </select>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">사유 (선택)</label>
                  <textarea
                    value={addLeaveForm.reason}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, reason: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="휴가 사유를 입력하세요 (선택사항)"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddLeave(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmitAddLeave}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
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
  special_leave_detail: string
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
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [isManualView] = useState(false) // 사용자가 수동으로 뷰를 변경했는지 추적
  const [showAddLeave, setShowAddLeave] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; name: string; department: string; position: string }>>([])
  const [addLeaveForm, setAddLeaveForm] = useState<AddLeaveForm>({
    employee_id: '',
    leave_type: 'annual',
    special_leave_detail: '',
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

  // 휴가 일수 자동 차감 함수
  const updateLeaveBalance = async (leaveForm: AddLeaveForm) => {
    try {
      // 휴가 일수 계산 (반차는 0.5일, 종일휴가는 1일 단위로 계산)
      let leaveDays: number
      
      if (leaveForm.is_half_day) {
        // 반차는 0.5일
        leaveDays = 0.5
      } else {
        // 종일 휴가는 시작일부터 종료일까지의 일수 계산
        const startDate = new Date(leaveForm.start_date)
        const endDate = new Date(leaveForm.end_date)
        const timeDiff = endDate.getTime() - startDate.getTime()
        leaveDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // 당일 포함
      }

      console.log(`💰 [휴가차감] ${leaveForm.leave_type} ${leaveDays}일 차감 시작`)

      // 현재 직원의 휴가 데이터 조회
      const { data: currentLeaveData, error: fetchError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', leaveForm.employee_id)
        .single()

      if (fetchError) {
        console.error('직원 휴가 데이터 조회 실패:', fetchError)
        return
      }

      if (!currentLeaveData) {
        console.error('직원 휴가 데이터를 찾을 수 없습니다.')
        return
      }

      // 현재 휴가 타입에 따른 사용 일수 업데이트
      const updatedLeaveTypes = { ...currentLeaveData.leave_types }
      
      switch (leaveForm.leave_type) {
        case 'annual':
          updatedLeaveTypes.used_annual_days = (updatedLeaveTypes.used_annual_days || 0) + leaveDays
          break
        case 'sick':
          updatedLeaveTypes.used_sick_days = (updatedLeaveTypes.used_sick_days || 0) + leaveDays
          break
        case 'special':
          updatedLeaveTypes.used_special_days = (updatedLeaveTypes.used_special_days || 0) + leaveDays
          break
        case 'maternity':
          updatedLeaveTypes.used_maternity_days = (updatedLeaveTypes.used_maternity_days || 0) + leaveDays
          break
        case 'paternity':
          updatedLeaveTypes.used_paternity_days = (updatedLeaveTypes.used_paternity_days || 0) + leaveDays
          break
        case 'family_care':
          updatedLeaveTypes.used_family_care_days = (updatedLeaveTypes.used_family_care_days || 0) + leaveDays
          break
        default:
          console.warn('알 수 없는 휴가 타입:', leaveForm.leave_type)
          return
      }

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('leave_days')
        .update({
          leave_types: updatedLeaveTypes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', leaveForm.employee_id)

      if (updateError) {
        console.error('휴가 일수 차감 실패:', updateError)
        alert('휴가는 등록되었지만 일수 차감에 실패했습니다. 관리자에게 문의하세요.')
      } else {
        console.log(`✅ [휴가차감] ${leaveForm.leave_type} ${leaveDays}일 차감 완료`)
      }
    } catch (error) {
      console.error('휴가 일수 업데이트 오류:', error)
      alert('휴가는 등록되었지만 일수 차감에 실패했습니다. 관리자에게 문의하세요.')
    }
  }

  // 휴가 삭제 및 일수 복원 함수
  const deleteLeaveAndRestoreBalance = async (event: CalendarEvent) => {
    if (!confirm(`'${event.title}' 휴가를 삭제하시겠습니까?\n삭제 시 해당 휴가 일수가 복원됩니다.`)) {
      return
    }

    try {
      // 1. Google Calendar에서 이벤트 삭제
      const response = await fetch('/api/calendar/delete-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
          eventId: event.id
        })
      })

      if (!response.ok) {
        throw new Error('캘린더 이벤트 삭제 실패')
      }

      // 2. 휴가 일수 복원 로직
      await restoreLeaveBalance(event)
      
      alert('휴가가 삭제되고 일수가 복원되었습니다.')
      fetchLeaveEvents() // 캘린더 새로고침
    } catch (error) {
      console.error('휴가 삭제 오류:', error)
      alert('휴가 삭제 중 오류가 발생했습니다.')
    }
  }

  // 휴가 일수 복원 함수
  const restoreLeaveBalance = async (event: CalendarEvent) => {
    try {
      // 이벤트 제목에서 직원 이름과 휴가 타입 파싱
      const titleParts = event.title.split(' ')
      if (titleParts.length < 2) {
        console.warn('이벤트 제목 형식을 파싱할 수 없습니다:', event.title)
        return
      }

      const employeeName = titleParts[0]
      const leaveTypeText = titleParts[1]
      const isHalfDay = event.title.includes('반차')
      
      // 휴가 타입 매핑
      let leaveType: string
      if (leaveTypeText.includes('연차')) leaveType = 'annual'
      else if (leaveTypeText.includes('병가')) leaveType = 'sick' 
      else if (leaveTypeText.includes('특별휴가')) leaveType = 'special'
      else if (leaveTypeText.includes('출산휴가')) leaveType = 'maternity'
      else if (leaveTypeText.includes('배우자출산휴가')) leaveType = 'paternity'
      else if (leaveTypeText.includes('가족돌봄휴가')) leaveType = 'family_care'
      else {
        console.warn('알 수 없는 휴가 타입:', leaveTypeText)
        return
      }

      // 휴가 일수 계산
      let leaveDays: number
      if (isHalfDay) {
        leaveDays = 0.5
      } else {
        // 종일 휴가는 시작일~종료일 계산 (Google Calendar 이벤트 기준)
        const startDate = new Date(event.start)
        const endDate = new Date(event.end)
        
        // 시간이 포함된 경우 (반차)와 날짜만 있는 경우 (종일) 구분
        if (event.start.includes('T') && event.end.includes('T')) {
          // 시간 기반 이벤트 (반차) - 이미 위에서 처리됨
          leaveDays = 0.5
        } else {
          // 날짜 기반 이벤트 (종일)
          const timeDiff = endDate.getTime() - startDate.getTime()
          leaveDays = Math.ceil(timeDiff / (1000 * 3600 * 24))
        }
      }

      console.log(`🔄 [휴가복원] ${employeeName} ${leaveType} ${leaveDays}일 복원 시작`)

      // 직원 ID 찾기
      const matchingUser = users.find(user => user.name === employeeName)
      if (!matchingUser) {
        console.error('해당 직원을 찾을 수 없습니다:', employeeName)
        return
      }

      // 현재 직원의 휴가 데이터 조회
      const { data: currentLeaveData, error: fetchError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', matchingUser.id)
        .single()

      if (fetchError || !currentLeaveData) {
        console.error('직원 휴가 데이터 조회 실패:', fetchError)
        return
      }

      // 휴가 타입에 따른 사용 일수 복원 (차감된 만큼 빼기)
      const updatedLeaveTypes = { ...currentLeaveData.leave_types }
      
      switch (leaveType) {
        case 'annual':
          updatedLeaveTypes.used_annual_days = Math.max(0, (updatedLeaveTypes.used_annual_days || 0) - leaveDays)
          break
        case 'sick':
          updatedLeaveTypes.used_sick_days = Math.max(0, (updatedLeaveTypes.used_sick_days || 0) - leaveDays)
          break
        case 'special':
          updatedLeaveTypes.used_special_days = Math.max(0, (updatedLeaveTypes.used_special_days || 0) - leaveDays)
          break
        case 'maternity':
          updatedLeaveTypes.used_maternity_days = Math.max(0, (updatedLeaveTypes.used_maternity_days || 0) - leaveDays)
          break
        case 'paternity':
          updatedLeaveTypes.used_paternity_days = Math.max(0, (updatedLeaveTypes.used_paternity_days || 0) - leaveDays)
          break
        case 'family_care':
          updatedLeaveTypes.used_family_care_days = Math.max(0, (updatedLeaveTypes.used_family_care_days || 0) - leaveDays)
          break
      }

      // 데이터베이스 업데이트
      const { error: updateError } = await supabase
        .from('leave_days')
        .update({
          leave_types: updatedLeaveTypes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', matchingUser.id)

      if (updateError) {
        console.error('휴가 일수 복원 실패:', updateError)
        alert('캘린더에서는 삭제되었지만 일수 복원에 실패했습니다.')
      } else {
        console.log(`✅ [휴가복원] ${employeeName} ${leaveType} ${leaveDays}일 복원 완료`)
      }
    } catch (error) {
      console.error('휴가 일수 복원 오류:', error)
      alert('캘린더에서는 삭제되었지만 일수 복원에 실패했습니다.')
    }
  }

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
      let leaveTypeText = leaveTypeTexts[addLeaveForm.leave_type]
      if (addLeaveForm.leave_type === 'special' && addLeaveForm.special_leave_detail) {
        leaveTypeText = `특별휴가(${addLeaveForm.special_leave_detail})`
      }
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
        // 휴가 일수 자동 차감 로직
        await updateLeaveBalance(addLeaveForm)
        
        alert(`휴가가 성공적으로 등록되었습니다.`)
        setShowAddLeave(false)
        setAddLeaveForm({
          employee_id: '',
          leave_type: 'annual',
          special_leave_detail: '',
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
      days.push(<div key={`empty-${i}`} className="p-2 md:p-3 border border-gray-200"></div>)
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
          className={`p-2 md:p-3 min-h-[80px] md:min-h-[100px] border border-gray-200 ${
            isCurrentDay ? 'bg-blue-100 border-blue-300' : ''
          } ${isWeekendDay || holiday ? 'bg-red-50' : ''}`}
        >
          <div className={`text-xs md:text-sm ${
            isCurrentDay ? 'text-blue-600 font-bold' : 
            isWeekendDay || holiday ? 'text-red-600' : 'text-gray-900'
          }`}>
            {day}
          </div>
          {holiday && (
            <div className="text-xs text-red-600 mt-1 truncate" title={holiday}>
              <span className="md:hidden">{holiday.substring(0, 4)}...</span>
              <span className="hidden md:inline">{holiday}</span>
            </div>
          )}
          <div className="mt-1 md:mt-2 space-y-1">
            {dayEvents.slice(0, 2).map((event, index) => (
              <div key={index} className="text-xs p-1 rounded bg-green-100 text-green-800 cursor-pointer hover:opacity-80 relative group" title={event.title}>
                <div className="font-medium leading-tight break-words overflow-hidden pr-4">
                  <span className="md:hidden">{event.title.length > 8 ? event.title.substring(0, 8) + '...' : event.title}</span>
                  <span className="hidden md:block">{event.title.length > 15 ? event.title.substring(0, 15) + '...' : event.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLeaveAndRestoreBalance(event);
                  }}
                  className="absolute top-0 right-0 text-red-600 hover:text-red-800 text-xs opacity-0 group-hover:opacity-100 bg-white rounded-full w-4 h-4 flex items-center justify-center shadow-sm"
                  title="휴가 삭제"
                >
                  ×
                </button>
              </div>
            ))}
            {dayEvents.length > 2 && (
              <div className="text-xs text-gray-500 text-center font-medium">
                +{dayEvents.length - 2}개 더
              </div>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-0 border border-gray-200">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="p-2 md:p-3 bg-gray-50 text-center text-xs md:text-sm font-medium text-gray-700 border-b border-gray-200">
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
            const isToday = new Date().toDateString() === startDate.toDateString()
            
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-2 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                      <h4 className="font-semibold text-gray-900 text-sm md:text-base">{event.title}</h4>
                      {isToday && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">오늘</span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {event.start.includes('T') 
                          ? `${startDate.toLocaleDateString('ko-KR')} ${startDate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                          : isSameDay 
                            ? `${startDate.toLocaleDateString('ko-KR')} (종일)`
                            : `${startDate.toLocaleDateString('ko-KR')} - ${endDate.toLocaleDateString('ko-KR')} (종일)`
                        }
                      </p>
                      {event.description && (
                        <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 md:ml-4 mt-2 md:mt-0">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      휴가
                    </span>
                    <button
                      onClick={() => deleteLeaveAndRestoreBalance(event)}
                      className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50"
                      title="휴가 삭제"
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
    <div className="bg-white overflow-hidden shadow rounded-lg col-span-full">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">관리자 휴가 관리</h3>
              <p className="text-sm text-gray-500">전체 직원 휴가 현황 및 수동 등록</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddLeave(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            휴가 추가
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-900">{currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월</h4>
          <div className="flex space-x-2">
            <div className="flex bg-gray-200 p-1 rounded-lg">
              <button onClick={() => setViewType('calendar')} className={`px-3 py-1 text-sm rounded-md ${viewType === 'calendar' ? 'bg-white shadow' : ''}`}>캘린더</button>
              <button onClick={() => setViewType('list')} className={`px-3 py-1 text-sm rounded-md ${viewType === 'list' ? 'bg-white shadow' : ''}`}>목록</button>
            </div>
            <button onClick={() => navigateMonth('prev')} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs">오늘</button>
            <button onClick={() => navigateMonth('next')} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
        {viewType === 'calendar' ? renderCalendar() : renderLeaveList()}
      </div>

      {/* 수동 휴가 등록 모달 */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
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
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, leave_type: e.target.value as AddLeaveForm['leave_type'], special_leave_detail: ''})}
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

                {/* 특별휴가 세부 사항 */}
                {addLeaveForm.leave_type === 'special' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">특별휴가 세부 사항</label>
                    <input
                      type="text"
                      value={addLeaveForm.special_leave_detail}
                      onChange={(e) => setAddLeaveForm({...addLeaveForm, special_leave_detail: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="예: 결혼, 장례, 이사 등"
                      required
                    />
                  </div>
                )}

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
                        special_leave_detail: '',
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
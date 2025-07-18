'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import LeaveStatusModal from './LeaveStatusModal'
import { CALENDAR_IDS, CALENDAR_NAMES, getCurrentYearRange } from '@/lib/calendarMapping'

// 한국 공휴일 데이터 (2024년)
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

interface LeaveData {
  id: string
  user_id: string
  leave_types: {
    annual_days: number
    used_annual_days: number
    sick_days: number
    used_sick_days: number
  }
  user?: {
    name: string
    department: string
    position: string
  }
}

interface LeaveEvent {
  id: string
  user_id: string
  leave_type: string
  start_date: string
  end_date: string
  status: 'approved' | 'pending' | 'rejected'
  reason?: string
}

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  calendarId?: string
  calendarName: string
}

interface LeaveManagementProps {
  user: User
}

export default function LeaveManagement({ user }: LeaveManagementProps) {
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([])
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [showCalendarEvents, setShowCalendarEvents] = useState(true)
  const [loading, setLoading] = useState(true)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarView, setCalendarView] = useState<'calendar' | 'list'>('calendar')

  const fetchLeaveData = async () => {
    try {
      const { data, error } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching leave data:', error)
      } else if (data) {
        setLeaveData(data)
      } else {
        // 데이터가 없으면 기본값 생성
        const { data: newLeaveData, error: insertError } = await supabase
          .from('leave_days')
          .insert([{
            user_id: user.id,
            leave_types: {
              annual_days: 15, // 기본 연차일수
              used_annual_days: 0,
              sick_days: 3, // 기본 병가일수
              used_sick_days: 0
            }
          }])
          .select()
          .single()

        if (!insertError && newLeaveData) {
          setLeaveData(newLeaveData)
        }
      }
    } catch (error) {
      console.error('Error in fetchLeaveData:', error)
    } finally {
      setLoading(false)
    }
  }


  const fetchCalendarConfigs = async () => {
    try {
      // Service Account 기반 캘린더 설정 조회
      const { data, error } = await supabase
        .from('calendar_configs')
        .select('*')
        .eq('config_type', 'function')
        .eq('target_name', 'leave-management')
        .eq('is_active', true)
      
      if (error) throw error
      console.log('휴가 관리 연결된 캘린더 수:', data?.length || 0)
      if ((data?.length || 0) === 0) {
        console.log('휴가 관리에 연결된 캘린더가 없습니다. 관리자가 캘린더를 연결해주세요.')
      }
      setCalendarConfigs(data || [])
    } catch (error) {
      console.error('휴가 관리 캘린더 설정 조회 오류:', error)
    }
  }

  // 휴가 캘린더에 이벤트 생성하는 함수
  const createLeaveCalendarEvent = async (leaveType: string, startDate: string, endDate: string, reason?: string) => {
    try {
      const eventData = {
        summary: `${user.name} - ${leaveType}`,
        description: reason ? `사유: ${reason}` : `${user.name}님의 ${leaveType}`,
        start: {
          date: startDate, // 종일 이벤트로 설정
          timeZone: 'Asia/Seoul'
        },
        end: {
          date: endDate === startDate ? 
            new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : // 하루 더 추가
            new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          timeZone: 'Asia/Seoul'
        },
        attendees: [
          {
            email: user.email,
            displayName: user.name
          }
        ]
      }

      const response = await fetch('/api/calendar/create-event-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
          eventData
        })
      })

      const result = await response.json()
      if (result.success) {
        console.log('휴가 캘린더 이벤트 생성 성공:', result.event)
        // 캘린더 이벤트 새로고침
        fetchCalendarEvents()
        return result.event
      } else {
        console.error('휴가 캘린더 이벤트 생성 실패:', result.error)
      }
    } catch (error) {
      console.error('휴가 캘린더 이벤트 생성 오류:', error)
    }
  }

  const fetchCalendarEvents = async () => {
    if (!showCalendarEvents) {
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      
      // 휴가 캘린더에서 이벤트 가져오기
      try {
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
            timeMin,
            timeMax,
            // q: user.name, // 모든 직원의 휴가 정보를 보기 위해 검색 필터 제거
            maxResults: 250
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.events) {
            const eventsWithCalendarInfo = data.events.map((event: CalendarEvent) => ({
              ...event,
              calendarName: CALENDAR_NAMES[CALENDAR_IDS.LEAVE_MANAGEMENT],
              calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT
            }))
            allEvents.push(...eventsWithCalendarInfo)
          }
        }
      } catch (error) {
        console.error('휴가 캘린더 이벤트 조회 오류:', error)
      }

      // 현재 월의 이벤트만 필터링
      const currentMonth = currentDate.getMonth()
      const currentYear = currentDate.getFullYear()
      const currentMonthEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start || '')
        return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
      })

      setCalendarEvents(currentMonthEvents)
    } catch (error) {
      console.error('캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }

  const fetchLeaveEvents = async () => {
    try {
      // 실제로는 form_requests 테이블에서 승인된 휴가 신청을 가져와야 하지만,
      // 현재는 샘플 데이터로 대체
      const sampleEvents: LeaveEvent[] = [
        {
          id: '1',
          user_id: user.id,
          leave_type: '연차',
          start_date: '2024-12-25',
          end_date: '2024-12-25',
          status: 'approved',
          reason: '개인사유'
        },
        {
          id: '2',
          user_id: user.id,
          leave_type: '연차',
          start_date: '2024-12-31',
          end_date: '2025-01-02',
          status: 'approved',
          reason: '연말연시 휴가'
        }
      ]
      setLeaveEvents(sampleEvents)
    } catch (error) {
      console.error('Error fetching leave events:', error)
    }
  }

  useEffect(() => {
    fetchLeaveData()
    fetchLeaveEvents()
    fetchCalendarConfigs()
  }, [user.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchCalendarEvents()
  }, [currentDate, showCalendarEvents, calendarConfigs]) // eslint-disable-line react-hooks/exhaustive-deps

  const openFormModal = (formType: string, formUrl: string) => {
    // Google Apps Script 웹앱은 iframe 제한이 있을 수 있으므로 새 창에서 열기
    const popup = window.open(formUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (!popup) {
      alert('팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제해주세요.')
    }
  }

  const handleFormComplete = async (formType: string) => {
    if (confirm(`${formType} 서식을 작성하고 제출하셨나요?\n\n작성 완료 후 서식을 인쇄하여 대표에게 제출해주세요.`)) {
      try {
        const { error } = await supabase
          .from('form_requests')
          .insert([{
            user_id: user.id,
            form_type: formType,
            status: 'pending',
            submitted_at: new Date().toISOString(),
            request_data: {
              form_name: formType,
              submitted_via: 'web_form'
            }
          }])

        if (error) {
          console.error('서식 신청 저장 실패:', error)
          alert('❌ 신청 저장에 실패했습니다. 다시 시도해주세요.')
        } else {
          // 휴가 관련 서식인 경우 캘린더에 임시 이벤트 생성
          if (formType.includes('휴가') || formType.includes('연차')) {
            const today = new Date()
            const dateString = today.toISOString().split('T')[0]
            
            try {
              await createLeaveCalendarEvent(
                `${formType} 신청`, 
                dateString, 
                dateString, 
                `${user.name}님이 ${formType}를 신청했습니다. 승인 대기 중입니다.`
              )
              console.log('휴가 캘린더에 임시 이벤트 생성 완료')
            } catch (calendarError) {
              console.error('캘린더 이벤트 생성 실패:', calendarError)
              // 캘린더 이벤트 생성 실패는 전체 프로세스를 중단하지 않음
            }
          }
          
          alert('✅ 신청이 완료되었습니다!\n\n📄 작성한 서식을 인쇄하여 대표에게 제출해주세요.\n관리자가 확인 후 최종 승인 처리됩니다.')
        }
      } catch (error) {
        console.error('서식 신청 오류:', error)
        alert('❌ 신청 처리 중 오류가 발생했습니다.')
      }
    }
  }


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

  const hasLeaveEvent = (dateString: string) => {
    return leaveEvents.some(event => {
      const startDate = new Date(event.start_date)
      const endDate = new Date(event.end_date)
      const checkDate = new Date(dateString)
      return checkDate >= startDate && checkDate <= endDate
    })
  }

  const getCalendarEventsForDate = (dateString: string) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateString
    })
  }

  const getAllEventsForDate = (dateString: string) => {
    const leaveEventsForDate = leaveEvents.filter(event => {
      const startDate = new Date(event.start_date)
      const endDate = new Date(event.end_date)
      const checkDate = new Date(dateString)
      return checkDate >= startDate && checkDate <= endDate
    })

    const calendarEventsForDate = getCalendarEventsForDate(dateString)
    
    return {
      leaveEvents: leaveEventsForDate,
      calendarEvents: calendarEventsForDate,
      totalCount: leaveEventsForDate.length + calendarEventsForDate.length
    }
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
      const hasLeave = hasLeaveEvent(dateString)
      const holiday = isHoliday(dateString)
      const isWeekend = (firstDay + day - 1) % 7 === 0 || (firstDay + day - 1) % 7 === 6
      const dayEvents = getAllEventsForDate(dateString)

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
          {hasLeave && (
            <div className="text-xs bg-green-100 text-green-800 rounded px-1 mt-1">
              휴가
            </div>
          )}
          {showCalendarEvents && dayEvents.calendarEvents.map((event, index) => {
            // 이벤트 제목에서 직원 이름 추출 (예: "홍길동 - 연차")
            const titleParts = event.title.split(' - ')
            const employeeName = titleParts[0]
            const leaveType = titleParts[1] || event.title
            
            return (
              <div 
                key={`cal-${event.id}-${index}`}
                className="text-xs bg-green-100 text-green-800 rounded px-1 mt-1 truncate border-l-2 border-green-500"
                title={`${event.title} (${event.calendarName})`}
              >
                <div className="font-medium">{employeeName}</div>
                <div className="text-xs opacity-75">{leaveType}</div>
              </div>
            )
          })}
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
    
    // 개인 휴가 이벤트
    const filteredEvents = leaveEvents.filter(event => {
      const eventDate = new Date(event.start_date)
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
    })

    // 구글 캘린더에서 가져온 모든 직원 휴가 이벤트
    const filteredCalendarEvents = calendarEvents.filter(event => {
      const eventDate = new Date(event.start)
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear
    })

    const allEvents = [
      ...filteredEvents.map(event => ({
        type: 'personal',
        title: event.leave_type,
        employee: user.name,
        date: event.start_date === event.end_date ? event.start_date : `${event.start_date} ~ ${event.end_date}`,
        reason: event.reason,
        status: event.status
      })),
      ...filteredCalendarEvents.map(event => {
        const titleParts = event.title.split(' - ')
        const employeeName = titleParts[0]
        const leaveType = titleParts[1] || event.title
        
        return {
          type: 'calendar',
          title: leaveType,
          employee: employeeName,
          date: new Date(event.start).toLocaleDateString('ko-KR'),
          reason: event.description || '',
          status: 'approved'
        }
      })
    ]

    // 날짜순으로 정렬
    allEvents.sort((a, b) => new Date(a.date.split(' ~ ')[0]).getTime() - new Date(b.date.split(' ~ ')[0]).getTime())

    return (
      <div className="space-y-2">
        {allEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-4">이번 달 휴가 일정이 없습니다.</p>
        ) : (
          allEvents.map((event, index) => (
            <div key={`event-${index}`} className="bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{event.employee}</h4>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {event.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {event.date}
                  </p>
                  {event.reason && (
                    <p className="text-xs text-gray-500 mt-1">{event.reason}</p>
                  )}
                </div>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  event.status === 'approved' ? 'bg-green-100 text-green-800' :
                  event.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {event.status === 'approved' ? '승인' : 
                   event.status === 'pending' ? '대기' : '거절'}
                </span>
              </div>
            </div>
          ))
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
              <h3 className="text-lg font-medium text-gray-900">휴가 관리</h3>
              <p className="text-sm text-gray-500">휴가 현황 및 신청</p>
            </div>
          </div>
          <div className="flex space-x-2">
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
            {calendarConfigs.length > 0 && (
              <button
                onClick={() => setShowCalendarEvents(!showCalendarEvents)}
                className={`px-3 py-1 text-sm rounded-md flex items-center space-x-1 ${
                  showCalendarEvents 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}
                disabled={calendarLoading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Google 캘린더</span>
                {calendarLoading && (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 휴가 현황 요약 */}
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">연차: {leaveData?.leave_types.used_annual_days || 0}일 / {leaveData?.leave_types.annual_days || 0}일</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{
                    width: `${leaveData ? Math.min((leaveData.leave_types.used_annual_days / leaveData.leave_types.annual_days) * 100, 100) : 0}%`
                  }}
                ></div>
              </div>
            </div>
            <div>
              <p className="text-gray-600">병가: {leaveData?.leave_types.used_sick_days || 0}일 / {leaveData?.leave_types.sick_days || 0}일</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-red-600 h-2 rounded-full" 
                  style={{
                    width: `${leaveData ? Math.min((leaveData.leave_types.used_sick_days / leaveData.leave_types.sick_days) * 100, 100) : 0}%`
                  }}
                ></div>
              </div>
            </div>
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

      {/* 액션 버튼들 */}
      <div className="bg-gray-50 px-5 py-3">
        <div className="text-sm">
          <div className="flex justify-between items-center">
            <button 
              onClick={() => openFormModal('휴가 신청', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=vacation')}
              className="font-medium text-indigo-600 hover:text-indigo-500 text-left flex-1"
            >
              📝 휴가 신청하기
            </button>
            <button 
              onClick={() => handleFormComplete('휴가 신청')}
              className="ml-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2 py-1 rounded text-xs font-medium"
            >
              신청 완료
            </button>
          </div>
        </div>
      </div>

      {/* 휴가 신청 모달 */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">휴가 신청</h3>
              
              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 종류</label>
                  <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="annual">연차</option>
                    <option value="sick">병가</option>
                    <option value="personal">개인사유</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">시작일</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">종료일</label>
                  <input
                    type="date"
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">사유</label>
                  <textarea
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="휴가 사유를 입력해주세요"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(false)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    신청
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 휴가 현황 모달 */}
      <LeaveStatusModal 
        user={user}
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
      />

    </div>
  )
}
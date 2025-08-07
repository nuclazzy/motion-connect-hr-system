'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/auth'
import { createLeaveEvent } from '@/lib/googleCalendar'
import { Calendar, Users, AlertCircle, Clock, TrendingUp, FileText, Edit2, Check, X, Plus, History } from 'lucide-react'
import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'
import { 
  fetchCalendarEvents, 
  deleteCalendarEvent,
  initializeGoogleAPI,
  parseEventDate 
} from '@/lib/googleCalendar'
import SpecialLeaveGrantModal from './SpecialLeaveGrantModal'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
}

interface LeaveOverviewData {
  totalEmployees: number
  totalAnnualUsageRate: number
  pendingRequests: number
  upcomingLeaves: number
  substituteWarnings: number
  expiringAnnualLeaves: LeaveExpiryInfo[]
  expiringSubstituteLeaves: LeaveExpiryInfo[]
}

interface LeaveExpiryInfo {
  userId: string
  name: string
  department: string
  remainingDays?: number
  remainingHours?: number
  leaveType?: 'substitute' | 'compensatory'
}

interface EmployeeLeaveBalance {
  id: string
  name: string
  department: string
  position: string
  annual_days: number
  used_annual_days: number
  sick_days: number
  used_sick_days: number
  substitute_leave_hours: number
  compensatory_leave_hours: number
}

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  request_data: any
  processed_at?: string
  user: {
    name: string
    department: string
  }
}

export default function AdminLeaveOverview() {
  const [overviewData, setOverviewData] = useState<LeaveOverviewData | null>(null)
  const [employeeBalances, setEmployeeBalances] = useState<EmployeeLeaveBalance[]>([])
  const [formRequests, setFormRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'balances' | 'requests' | 'calendar' | 'alerts' | 'history'>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [requestFilter, setRequestFilter] = useState<'pending' | 'all'>('pending')
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<EmployeeLeaveBalance>>({})
  const [showSpecialLeaveModal, setShowSpecialLeaveModal] = useState(false)
  const [selectedEmployeeForSpecialLeave, setSelectedEmployeeForSpecialLeave] = useState<any>(null)
  const [leaveHistory, setLeaveHistory] = useState<any[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'annual' | 'sick' | 'special'>('all')
  
  // 캘린더 관련 상태
  const [leaveEvents, setLeaveEvents] = useState<CalendarEvent[]>([])
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar')
  const [isManualView] = useState(false)

  // 전체 휴가 현황 데이터 조회
  const fetchOverviewData = useCallback(async () => {
    try {
      // 1. 전체 직원 수 및 연차 사용률
      const { data: employees } = await supabase
        .from('users')
        .select('annual_days, used_annual_days, substitute_leave_hours, department')
        .eq('is_active', true)

      if (!employees) return

      const totalEmployees = employees.length
      const totalAnnualUsageRate = employees.reduce((acc, emp) => {
        const rate = emp.annual_days > 0 ? (emp.used_annual_days / emp.annual_days) * 100 : 0
        return acc + rate
      }, 0) / totalEmployees

      // 2. 승인 대기 중인 휴가 신청
      const { count: pendingCount } = await supabase
        .from('form_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('form_type', '휴가 신청서')

      // 3. 이번 달 휴가 예정자
      const currentMonth = new Date()
      const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)

      const { count: upcomingCount } = await supabase
        .from('form_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('form_type', '휴가 신청서')
        .gte('request_data->시작일', monthStart.toISOString().split('T')[0])
        .lte('request_data->시작일', monthEnd.toISOString().split('T')[0])

      // 4. 대체휴가 경고 대상자 (16시간 이상)
      const substituteWarnings = employees.filter(emp => emp.substitute_leave_hours >= 16).length

      // 5. 연말 소멸 예정 휴가 (12월 기준)
      const currentYear = new Date().getFullYear()
      const isNearYearEnd = new Date().getMonth() >= 9 // 10월부터 경고

      let expiringAnnualLeaves: LeaveExpiryInfo[] = []
      let expiringSubstituteLeaves: LeaveExpiryInfo[] = []

      if (isNearYearEnd) {
        // 미사용 연차 보유자
        const { data: annualExpiry } = await supabase
          .from('users')
          .select('id, name, department, annual_days, used_annual_days')
          .eq('is_active', true)
          .gt('annual_days', 0)

        if (annualExpiry) {
          expiringAnnualLeaves = annualExpiry
            .filter(emp => emp.annual_days - emp.used_annual_days > 0)
            .map(emp => ({
              userId: emp.id,
              name: emp.name,
              department: emp.department,
              remainingDays: emp.annual_days - emp.used_annual_days
            }))
        }

        // 대체휴가 및 보상휴가 보유자
        const { data: substituteExpiry } = await supabase
          .from('users')
          .select('id, name, department, substitute_leave_hours, compensatory_leave_hours')
          .eq('is_active', true)
          .or('substitute_leave_hours.gt.0,compensatory_leave_hours.gt.0')

        if (substituteExpiry) {
          expiringSubstituteLeaves = substituteExpiry.flatMap(emp => {
            const leaves = []
            if (emp.substitute_leave_hours > 0) {
              leaves.push({
                userId: emp.id,
                name: emp.name,
                department: emp.department,
                remainingHours: emp.substitute_leave_hours,
                leaveType: 'substitute' as const
              })
            }
            if (emp.compensatory_leave_hours > 0) {
              leaves.push({
                userId: emp.id,
                name: emp.name,
                department: emp.department,
                remainingHours: emp.compensatory_leave_hours,
                leaveType: 'compensatory' as const
              })
            }
            return leaves
          })
        }
      }

      setOverviewData({
        totalEmployees,
        totalAnnualUsageRate,
        pendingRequests: pendingCount || 0,
        upcomingLeaves: upcomingCount || 0,
        substituteWarnings,
        expiringAnnualLeaves,
        expiringSubstituteLeaves
      })
    } catch (error) {
      console.error('휴가 현황 데이터 조회 오류:', error)
    }
  }, [])

  // 직원별 휴가 잔액 조회
  const fetchEmployeeBalances = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select(`
          id, name, department, position,
          annual_days, used_annual_days,
          sick_days, used_sick_days,
          substitute_leave_hours, compensatory_leave_hours
        `)
        .eq('is_active', true)
        .order('department', { ascending: true })
        .order('name', { ascending: true })

      if (data) {
        setEmployeeBalances(data)
      }
    } catch (error) {
      console.error('직원 휴가 잔액 조회 오류:', error)
    }
  }, [])

  // 휴가 신청 목록 조회
  const fetchFormRequests = useCallback(async () => {
    try {
      let query = supabase
        .from('form_requests')
        .select('*')
        .eq('form_type', '휴가 신청서')
        .order('submitted_at', { ascending: false })

      if (requestFilter === 'pending') {
        query = query.eq('status', 'pending')
      }

      const { data: requests } = await query

      if (requests) {
        // 사용자 정보 조회
        const mappedRequests = []
        for (const req of requests) {
          const { data: userData } = await supabase
            .from('users')
            .select('name, department')
            .eq('id', req.user_id)
            .single()
          
          mappedRequests.push({
            ...req,
            user: userData || { name: '알 수 없음', department: '알 수 없음' }
          })
        }
        setFormRequests(mappedRequests)
      }
    } catch (error) {
      console.error('휴가 신청 조회 오류:', error)
    }
  }, [requestFilter])

  // 휴가 사용 이력 조회
  const fetchLeaveHistory = useCallback(async () => {
    try {
      // 1. 승인된 휴가 신청 이력
      const { data: approvedLeaves } = await supabase
        .from('form_requests')
        .select('*, users(name, department)')
        .eq('form_type', '휴가 신청서')
        .eq('status', 'approved')
        .order('processed_at', { ascending: false })
        .limit(100)

      // 2. 특별휴가 이력 (테이블이 있는 경우)
      const { data: specialLeaves } = await supabase
        .from('special_leave_records')
        .select('*, users(name, department)')
        .order('created_at', { ascending: false })
        .limit(50)

      const combinedHistory: any[] = []
      
      // 승인된 휴가 추가
      if (approvedLeaves) {
        approvedLeaves.forEach(leave => {
          const requestData = leave.request_data
          combinedHistory.push({
            id: leave.id,
            type: requestData?.leaveType || 'annual',
            employeeName: leave.users?.name || '알 수 없음',
            department: leave.users?.department || '알 수 없음',
            startDate: requestData?.startDate,
            endDate: requestData?.endDate,
            days: requestData?.leaveDays || 1,
            reason: requestData?.reason || '',
            status: 'approved',
            processedAt: leave.processed_at,
            isSpecial: false
          })
        })
      }

      // 특별휴가 추가
      if (specialLeaves) {
        specialLeaves.forEach(leave => {
          combinedHistory.push({
            id: leave.id,
            type: 'special',
            employeeName: leave.users?.name || '알 수 없음',
            department: leave.users?.department || '알 수 없음',
            startDate: leave.start_date,
            endDate: leave.end_date,
            days: leave.leave_days,
            reason: leave.leave_title,
            status: 'granted',
            processedAt: leave.created_at,
            isSpecial: true
          })
        })
      }

      // 날짜순 정렬
      combinedHistory.sort((a, b) => 
        new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
      )

      setLeaveHistory(combinedHistory)
    } catch (error) {
      console.error('휴가 이력 조회 오류:', error)
    }
  }, [])

  // 휴가 취소 (승인된 휴가를 취소하고 잔액 복구)
  const handleCancelLeave = async (leaveRequest: any) => {
    if (!confirm('정말 이 휴가를 취소하시겠습니까? 휴가 잔액이 복구됩니다.')) {
      return
    }

    try {
      const requestData = leaveRequest.request_data

      // 1. 사용자 현재 휴가 잔액 조회
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('id', leaveRequest.user_id)
        .single()

      if (!user) throw new Error('사용자 정보를 찾을 수 없습니다')

      // 2. 휴가 유형에 따라 잔액 복구
      let updateData: any = {}
      
      if (requestData.leaveType === '연차' || requestData.leaveType === '반차') {
        const daysToRestore = requestData.leaveType === '반차' ? 0.5 : requestData.leaveDays
        updateData.used_annual_days = Math.max(0, user.used_annual_days - daysToRestore)
      } else if (requestData.leaveType === '병가') {
        updateData.used_sick_days = Math.max(0, user.used_sick_days - requestData.leaveDays)
      } else if (requestData.leaveType === '대체휴가') {
        const hoursToRestore = requestData.leaveDays * 8
        updateData.substitute_leave_hours = user.substitute_leave_hours + hoursToRestore
      } else if (requestData.leaveType === '보상휴가') {
        const hoursToRestore = requestData.leaveDays * 8
        updateData.compensatory_leave_hours = user.compensatory_leave_hours + hoursToRestore
      }

      // 3. 잔액 복구
      await supabase
        .from('users')
        .update(updateData)
        .eq('id', leaveRequest.user_id)

      // 4. 휴가 신청 상태를 'cancelled'로 변경
      await supabase
        .from('form_requests')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'admin'
        })
        .eq('id', leaveRequest.id)

      alert('휴가가 취소되고 잔액이 복구되었습니다.')
      
      // 데이터 새로고침
      fetchFormRequests()
      fetchEmployeeBalances()
      fetchLeaveHistory()
    } catch (error) {
      console.error('휴가 취소 오류:', error)
      alert('휴가 취소 중 오류가 발생했습니다.')
    }
  }

  // 휴가 잔액 수정
  const handleUpdateLeaveBalance = async (employeeId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          annual_days: editForm.annual_days,
          used_annual_days: editForm.used_annual_days,
          sick_days: editForm.sick_days,
          used_sick_days: editForm.used_sick_days,
          substitute_leave_hours: editForm.substitute_leave_hours,
          compensatory_leave_hours: editForm.compensatory_leave_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)

      if (error) throw error

      alert('휴가 잔액이 수정되었습니다.')
      setEditingEmployee(null)
      setEditForm({})
      fetchEmployeeBalances()
    } catch (error) {
      console.error('휴가 잔액 수정 오류:', error)
      alert('휴가 잔액 수정 중 오류가 발생했습니다.')
    }
  }

  // 휴가 신청 승인/거부
  const handleUpdateRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    const adminNote = newStatus === 'rejected' ? prompt('거절 사유를 입력하세요:') : undefined
    if (newStatus === 'rejected' && !adminNote) return

    const userStr = localStorage.getItem('motion-connect-user')
    const user = userStr ? JSON.parse(userStr) : null
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    const request = formRequests.find(r => r.id === requestId)
    if (!request) return

    try {
      // 승인 상태 업데이트
      const { error: updateError } = await supabase
        .from('form_requests')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          processed_by: user.id,
          admin_notes: adminNote || null
        })
        .eq('id', request.id)

      if (updateError) throw updateError

      // 승인된 경우 휴가 차감 및 캘린더 등록
      if (newStatus === 'approved' && request.form_type.includes('휴가')) {
        const leaveType = request.request_data?.['휴가형태'] || ''
        const leaveDays = parseFloat(request.request_data?.['휴가일수'] || request.request_data?.['신청일수'] || '0')

        if (leaveDays > 0) {
          let updateField = ''
          let isHourlyLeave = false
          
          if (leaveType === '연차') {
            updateField = 'used_annual_days'
          } else if (leaveType === '병가') {
            updateField = 'used_sick_days'
          } else if (leaveType === '대체휴가' || request.request_data?.['_leaveCategory'] === 'substitute') {
            updateField = 'substitute_leave_hours'
            isHourlyLeave = true
          } else if (leaveType === '보상휴가' || request.request_data?.['_leaveCategory'] === 'compensatory') {
            updateField = 'compensatory_leave_hours'
            isHourlyLeave = true
          }

          if (updateField) {
            const { data: userData } = await supabase
              .from('users')
              .select(updateField)
              .eq('id', request.user_id)
              .single()

            let newValue
            const currentValue = (userData as any)?.[updateField] || 0
            
            if (isHourlyLeave) {
              const hoursToDeduct = leaveDays * 8
              newValue = Math.max(0, currentValue - hoursToDeduct)
            } else {
              newValue = currentValue + leaveDays
            }

            await supabase
              .from('users')
              .update({ [updateField]: newValue })
              .eq('id', request.user_id)
          }
        }

        // Google Calendar 이벤트 생성
        try {
          const startDate = request.request_data?.['시작일'] || ''
          const endDate = request.request_data?.['종료일'] || startDate
          
          if (startDate) {
            const endDateObj = new Date(endDate)
            endDateObj.setDate(endDateObj.getDate() + 1)
            const adjustedEndDate = endDateObj.toISOString().split('T')[0]

            await createLeaveEvent(
              {
                leaveType: leaveType,
                leaveDays: leaveDays,
                startDate: startDate,
                endDate: adjustedEndDate,
                reason: request.request_data?.['사유'] || request.request_data?.['휴가사유'] || '',
                formRequestId: request.id
              },
              {
                id: request.user_id,
                name: request.user.name,
                department: request.user.department
              }
            )
          }
        } catch (calendarError) {
          console.error('캘린더 이벤트 생성 오류:', calendarError)
        }
      }

      alert(newStatus === 'approved' ? '승인되었습니다.' : '반려되었습니다.')
      fetchFormRequests()
      fetchOverviewData()
    } catch (error) {
      console.error('휴가 처리 오류:', error)
      alert('처리 중 오류가 발생했습니다.')
    }
  }

  // 캘린더 관련 함수들
  // 휴가 삭제 함수 (캘린더에서만 삭제)
  const deleteLeaveFromCalendar = async (event: CalendarEvent) => {
    if (!confirm(`'${event.title}' 휴가를 캘린더에서 삭제하시겠습니까?`)) {
      return
    }

    try {
      // Google Calendar에서 이벤트 삭제 (직접 연동)
      await deleteCalendarEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, event.id)
      
      alert('캘린더에서 휴가가 삭제되었습니다.')
      fetchLeaveEvents() // 캘린더 새로고침
    } catch (error) {
      console.error('휴가 삭제 오류:', error)
      alert('휴가 삭제 중 오류가 발생했습니다.')
    }
  }

  // Google Calendar에서 직접 휴가 이벤트 조회
  const fetchLeaveEvents = useCallback(async () => {
    setCalendarLoading(true)
    try {
      // Google API 초기화
      await initializeGoogleAPI()
      
      // 현재 월의 데이터만 가져오기
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const timeMin = new Date(year, month, 1).toISOString()
      const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

      // Google Calendar 직접 연동으로 이벤트 가져오기
      const googleEvents = await fetchCalendarEvents(CALENDAR_IDS.LEAVE_MANAGEMENT, timeMin, timeMax, 250)
      
      let fetchedEvents: CalendarEvent[] = []
      if (googleEvents && googleEvents.length > 0) {
        // API 응답을 우리 인터페이스에 맞게 변환
        fetchedEvents = googleEvents.map((event: any) => {
          const { start, end, isAllDay } = parseEventDate(event)
          return {
            id: event.id || '',
            title: event.summary || '',
            start: isAllDay ? event.start?.date || '' : event.start?.dateTime || '',
            end: isAllDay ? event.end?.date || '' : event.end?.dateTime || '',
            description: event.description,
            location: event.location
          }
        })
      }

      setLeaveEvents(fetchedEvents)
    } catch (error) {
      console.error('휴가 캘린더 이벤트 조회 오류:', error)
      setLeaveEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [currentDate])

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

  // 캘린더 렌더링 함수
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
                    deleteLeaveFromCalendar(event);
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
            const isTodayEvent = new Date().toDateString() === startDate.toDateString()
            
            return (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 md:p-4 shadow-sm">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start space-y-2 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
                      <h4 className="font-semibold text-gray-900 text-sm md:text-base">{event.title}</h4>
                      {isTodayEvent && (
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
                      onClick={() => deleteLeaveFromCalendar(event)}
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
  }, [])

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchLeaveEvents()
    }
  }, [activeTab, fetchLeaveEvents])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchOverviewData(), 
        fetchEmployeeBalances(), 
        fetchFormRequests(),
        fetchLeaveHistory()
      ])
      setLoading(false)
    }
    loadData()
  }, [fetchOverviewData, fetchEmployeeBalances, fetchFormRequests, fetchLeaveHistory])

  // 필터링된 직원 목록
  const filteredEmployees = employeeBalances.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment = departmentFilter === 'all' || emp.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  // 부서 목록 추출
  const departments = [...new Set(employeeBalances.map(emp => emp.department))].filter(Boolean)

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">휴가 통합 관리</h2>
        <p className="text-gray-600 mt-1">전체 직원의 휴가를 한 곳에서 관리합니다</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '현황 요약', icon: TrendingUp },
            { id: 'balances', label: '휴가 잔액 관리', icon: Users },
            { id: 'requests', label: '휴가 신청 관리', icon: FileText },
            { id: 'calendar', label: '휴가 캘린더', icon: Calendar },
            { id: 'alerts', label: '알림', icon: AlertCircle },
            { id: 'history', label: '휴가 이력', icon: History }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="mr-2 h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 현황 요약 탭 */}
      {activeTab === 'overview' && overviewData && (
        <div className="space-y-6">
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-md p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">전체 직원</p>
                  <p className="text-2xl font-bold text-gray-900">{overviewData.totalEmployees}명</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">평균 연차 사용률</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {overviewData.totalAnnualUsageRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">승인 대기</p>
                  <p className="text-2xl font-bold text-gray-900">{overviewData.pendingRequests}건</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">이번 달 휴가</p>
                  <p className="text-2xl font-bold text-gray-900">{overviewData.upcomingLeaves}명</p>
                </div>
              </div>
            </div>
          </div>

          {/* 경고 섹션 */}
          {overviewData.substituteWarnings > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    대체휴가 사용 권고 대상
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    {overviewData.substituteWarnings}명의 직원이 16시간 이상의 대체휴가를 보유하고 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 휴가 잔액 관리 탭 */}
      {activeTab === 'balances' && (
        <div className="bg-white rounded-lg shadow">
          {/* 필터 및 액션 버튼 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="직원명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">전체 부서</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <button
                onClick={() => setShowSpecialLeaveModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                특별휴가 부여
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연차
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    병가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    대체휴가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    보상휴가
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map(emp => {
                  const isEditing = editingEmployee === emp.id
                  const annualRemaining = emp.annual_days - emp.used_annual_days
                  const sickRemaining = emp.sick_days - emp.used_sick_days
                  const substituteDays = Math.floor(emp.substitute_leave_hours / 8)
                  const compensatoryDays = Math.floor(emp.compensatory_leave_hours / 8)

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                          <div className="text-sm text-gray-500">
                            {emp.department} · {emp.position}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <input
                              type="number"
                              value={editForm.used_annual_days || 0}
                              onChange={(e) => setEditForm({...editForm, used_annual_days: Number(e.target.value)})}
                              className="w-12 px-1 py-1 border rounded text-sm"
                              min="0"
                            />
                            <span>/</span>
                            <input
                              type="number"
                              value={editForm.annual_days || 0}
                              onChange={(e) => setEditForm({...editForm, annual_days: Number(e.target.value)})}
                              className="w-12 px-1 py-1 border rounded text-sm"
                              min="0"
                            />
                          </div>
                        ) : (
                          <div className="text-sm">
                            <span className="font-medium">{annualRemaining}</span>
                            <span className="text-gray-500"> / {emp.annual_days}</span>
                            <div className="text-xs text-gray-500">
                              사용: {emp.used_annual_days}일
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <input
                              type="number"
                              value={editForm.used_sick_days || 0}
                              onChange={(e) => setEditForm({...editForm, used_sick_days: Number(e.target.value)})}
                              className="w-12 px-1 py-1 border rounded text-sm"
                              min="0"
                            />
                            <span>/</span>
                            <input
                              type="number"
                              value={editForm.sick_days || 0}
                              onChange={(e) => setEditForm({...editForm, sick_days: Number(e.target.value)})}
                              className="w-12 px-1 py-1 border rounded text-sm"
                              min="0"
                            />
                          </div>
                        ) : (
                          <div className="text-sm">
                            <span className="font-medium">{sickRemaining}</span>
                            <span className="text-gray-500"> / {emp.sick_days}</span>
                            <div className="text-xs text-gray-500">
                              사용: {emp.used_sick_days}일
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.substitute_leave_hours || 0}
                            onChange={(e) => setEditForm({...editForm, substitute_leave_hours: Number(e.target.value)})}
                            className="w-20 px-1 py-1 border rounded text-sm"
                            min="0"
                          />
                        ) : (
                          <div className={`text-sm ${emp.substitute_leave_hours >= 16 ? 'text-red-600 font-semibold' : ''}`}>
                            {emp.substitute_leave_hours}시간
                            <div className="text-xs text-gray-500">
                              ({substituteDays}일)
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.compensatory_leave_hours || 0}
                            onChange={(e) => setEditForm({...editForm, compensatory_leave_hours: Number(e.target.value)})}
                            className="w-20 px-1 py-1 border rounded text-sm"
                            min="0"
                          />
                        ) : (
                          <div className="text-sm">
                            {emp.compensatory_leave_hours}시간
                            <div className="text-xs text-gray-500">
                              ({compensatoryDays}일)
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {isEditing ? (
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleUpdateLeaveBalance(emp.id)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingEmployee(null)
                                setEditForm({})
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingEmployee(emp.id)
                              setEditForm(emp)
                            }}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 휴가 신청 관리 탭 */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-lg shadow">
          {/* 필터 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={() => setRequestFilter('pending')}
                className={`px-3 py-1 text-sm rounded-md ${
                  requestFilter === 'pending' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                승인 대기
              </button>
              <button
                onClick={() => setRequestFilter('all')}
                className={`px-3 py-1 text-sm rounded-md ${
                  requestFilter === 'all' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                전체 보기
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">휴가 정보</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일시</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태 / 처리</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formRequests.length > 0 ? (
                  formRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="font-medium text-gray-900">{request.user.name}</div>
                        <div className="text-gray-500">{request.user.department}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        <div className="font-medium">{request.request_data['휴가형태']}</div>
                        {request.request_data['시작일'] && request.request_data['종료일'] && (
                          <div className="text-xs text-gray-500 mt-1">
                            {request.request_data['시작일']} ~ {request.request_data['종료일']}
                            <span className="ml-1">
                              ({request.request_data['휴가일수'] || request.request_data['신청일수']}일)
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(request.submitted_at)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {request.status === 'pending' ? (
                          <div className="flex items-center space-x-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              대기중
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleUpdateRequest(request.id, 'approved')}
                                className="bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 rounded-md text-xs font-medium"
                              >
                                승인
                              </button>
                              <button
                                onClick={() => handleUpdateRequest(request.id, 'rejected')}
                                className="bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded-md text-xs font-medium"
                              >
                                거절
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              request.status === 'approved' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {request.status === 'approved' ? '승인됨' : '거절됨'}
                            </span>
                            {request.processed_at && (
                              <span className="text-xs text-gray-500 ml-2">
                                {formatDate(request.processed_at)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      {requestFilter === 'pending' ? '승인 대기 중인 신청이 없습니다.' : '표시할 신청 내역이 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 휴가 캘린더 탭 */}
      {activeTab === 'calendar' && (
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-6 w-6 text-gray-400" />
                </div>
                <div className="ml-5">
                  <h3 className="text-lg font-medium text-gray-900">휴가 캘린더</h3>
                  <p className="text-sm text-gray-500">전체 직원 휴가 현황</p>
                </div>
              </div>
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
            
            {calendarLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                <span className="ml-2 text-gray-500">캘린더 로딩 중...</span>
              </div>
            ) : (
              viewType === 'calendar' ? renderCalendar() : renderLeaveList()
            )}
          </div>
        </div>
      )}

      {/* 알림 탭 */}
      {activeTab === 'alerts' && overviewData && (
        <div className="space-y-4">
          {/* 연말 소멸 예정 연차 */}
          {overviewData.expiringAnnualLeaves.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-red-900 mb-3">
                연말 소멸 예정 연차 ({new Date().getFullYear()}년 12월 31일)
              </h3>
              <div className="space-y-2">
                {overviewData.expiringAnnualLeaves.map(emp => (
                  <div key={emp.userId} className="flex justify-between items-center py-2 border-b border-red-100 last:border-0">
                    <div>
                      <span className="font-medium text-gray-900">{emp.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({emp.department})</span>
                    </div>
                    <div className="text-red-600 font-semibold">
                      {emp.remainingDays}일 소멸 예정
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 연말 소멸 예정 대체/보상휴가 */}
          {overviewData.expiringSubstituteLeaves.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-orange-900 mb-3">
                연말 소멸 예정 대체/보상휴가 ({new Date().getFullYear()}년 12월 31일)
              </h3>
              <div className="space-y-2">
                {overviewData.expiringSubstituteLeaves.map((emp, idx) => (
                  <div key={`${emp.userId}-${emp.leaveType}-${idx}`} className="flex justify-between items-center py-2 border-b border-orange-100 last:border-0">
                    <div>
                      <span className="font-medium text-gray-900">{emp.name}</span>
                      <span className="text-sm text-gray-500 ml-2">({emp.department})</span>
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-orange-200 text-orange-800">
                        {emp.leaveType === 'substitute' ? '대체휴가' : '보상휴가'}
                      </span>
                    </div>
                    <div className="text-orange-600 font-semibold">
                      {emp.remainingHours}시간 ({Math.floor(emp.remainingHours! / 8)}일) 소멸 예정
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 알림이 없는 경우 */}
          {overviewData.expiringAnnualLeaves.length === 0 && 
           overviewData.expiringSubstituteLeaves.length === 0 && (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">현재 표시할 알림이 없습니다</p>
              <p className="text-sm text-gray-400 mt-1">10월부터 연말 소멸 예정 휴가가 표시됩니다</p>
            </div>
          )}
        </div>
      )}

      {/* 휴가 이력 탭 */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow">
          {/* 필터 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-4">
              <select
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">전체 이력</option>
                <option value="annual">연차</option>
                <option value="sick">병가</option>
                <option value="special">특별휴가</option>
              </select>
              <div className="text-sm text-gray-500 flex items-center">
                총 {leaveHistory.length}건의 휴가 이력
              </div>
            </div>
          </div>

          {/* 이력 테이블 */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    휴가 종류
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기간
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    일수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사유
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    처리일
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leaveHistory
                  .filter(history => historyFilter === 'all' || 
                    (historyFilter === 'special' && history.isSpecial) ||
                    (historyFilter === 'annual' && history.type === 'annual') ||
                    (historyFilter === 'sick' && history.type === 'sick')
                  )
                  .map(history => (
                    <tr key={history.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{history.employeeName}</div>
                          <div className="text-xs text-gray-500">{history.department}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          history.isSpecial ? 'bg-purple-100 text-purple-800' :
                          history.type === 'annual' ? 'bg-blue-100 text-blue-800' :
                          history.type === 'sick' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {history.isSpecial ? '특별휴가' :
                           history.type === 'annual' ? '연차' :
                           history.type === 'sick' ? '병가' : history.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {history.startDate} ~ {history.endDate || history.startDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-medium">{history.days}일</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="max-w-xs truncate">
                          {history.reason || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          history.status === 'approved' ? 'bg-green-100 text-green-800' :
                          history.status === 'granted' ? 'bg-indigo-100 text-indigo-800' :
                          history.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {history.status === 'approved' ? '승인됨' :
                           history.status === 'granted' ? '부여됨' :
                           history.status === 'cancelled' ? '취소됨' : history.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {new Date(history.processedAt).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {history.status === 'approved' && !history.isSpecial && (
                          <button
                            onClick={() => handleCancelLeave(history)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* 이력이 없는 경우 */}
          {leaveHistory.length === 0 && (
            <div className="p-8 text-center">
              <History className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-500">휴가 이력이 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* 특별휴가 부여 모달 */}
      {showSpecialLeaveModal && (
        <SpecialLeaveGrantModal
          isOpen={showSpecialLeaveModal}
          onClose={() => {
            setShowSpecialLeaveModal(false)
            setSelectedEmployeeForSpecialLeave(null)
          }}
          employee={selectedEmployeeForSpecialLeave}
          onSuccess={() => {
            setShowSpecialLeaveModal(false)
            setSelectedEmployeeForSpecialLeave(null)
            fetchLeaveHistory()
            alert('특별휴가가 부여되었습니다.')
          }}
        />
      )}
    </div>
  )
}
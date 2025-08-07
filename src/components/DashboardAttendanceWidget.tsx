'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, Coffee, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Calendar, Edit, HelpCircle } from 'lucide-react'
import { getCurrentUser, type User as AuthUser } from '@/lib/auth'
import WorkPolicyExplanationModal from './WorkPolicyExplanationModal'
import { formatTimeWithNextDay, convertNextDayTimeFormat } from '@/lib/time-utils'
import { useSupabase } from '@/components/SupabaseProvider'
import { isWeekendOrHoliday, getHolidayInfo, formatDateForHoliday } from '@/lib/holidays'
import { detectDinnerEligibility, formatDinnerDetectionResult } from '@/lib/dinner-detection'

interface AttendanceStatus {
  user: {
    id: string
    name: string
    department: string
    position: string
  }
  date: string
  currentStatus: string
  statusMessage: string
  canCheckIn: boolean
  canCheckOut: boolean
  todayRecords: {
    checkIn: any[]
    checkOut: any[]
    total: number
  }
  workSummary: {
    basic_hours: number
    overtime_hours: number
    work_status: string
    check_in_time?: string
    check_out_time?: string
  }
}

interface MonthlyWorkSummary {
  user: {
    id: string
    name: string
    department: string
    position: string
  }
  period: {
    month: string
    startDate: string
    endDate: string
    totalDays: number
  }
  workStats: {
    totalWorkDays: number
    totalBasicHours: number
    totalOvertimeHours: number
    totalNightHours: number
    totalWorkHours: number
    averageDailyHours: number
    dinnerCount: number
  }
  attendanceStats: {
    onTimeCount: number
    lateCount: number
    earlyLeaveCount: number
    absentCount: number
    attendanceRate: number
  }
  dailyRecords?: Array<{
    work_date: string
    check_in_time?: string
    check_out_time?: string
    basic_hours: number
    overtime_hours: number
    work_status: string
    had_dinner: boolean
    missing_records?: string[]
    day_type?: string
    day_type_name?: string
    night_hours?: number
  }>
}

interface DashboardAttendanceWidgetProps {
  user: AuthUser
}

export default function DashboardAttendanceWidget({ user }: DashboardAttendanceWidgetProps) {
  const { supabase } = useSupabase()
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlyWorkSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'출근' | '퇴근' | null>(null)
  const [reason, setReason] = useState('')
  const [hadDinner, setHadDinner] = useState(false)
  const [selectedTime, setSelectedTime] = useState('')
  const [useCurrentTime, setUseCurrentTime] = useState(true)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7))
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [selectedPolicyType, setSelectedPolicyType] = useState<'flexible' | 'overtime' | 'leave' | null>(null)
  const [missingRecordForm, setMissingRecordForm] = useState({
    recordType: '출근' as '출근' | '퇴근',
    selectedDate: '',
    selectedTime: '',
    reason: ''
  })
  const [submittingMissingRecord, setSubmittingMissingRecord] = useState(false)

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 위치 정보 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          console.log('위치 정보를 가져올 수 없습니다:', error)
        }
      )
    }
  }, [])

  // 출퇴근 현황 조회
  const fetchAttendanceStatus = async () => {
    if (!user?.id || !supabase) return

    try {
      const date = new Date().toISOString().split('T')[0]
      
      // 사용자 정보 조회
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('사용자 조회 오류:', userError)
        return
      }

      // 해당 날짜의 출퇴근 기록 조회
      const { data: todayRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('record_date', date)
        .order('record_timestamp', { ascending: true })

      if (recordsError) {
        console.error('출퇴근 기록 조회 오류:', recordsError)
        return
      }

      // 출근/퇴근 기록 분리
      const checkInRecords = todayRecords?.filter(r => r.record_type === '출근') || []
      const checkOutRecords = todayRecords?.filter(r => r.record_type === '퇴근') || []

      const latestCheckIn = checkInRecords.length > 0 ? checkInRecords[checkInRecords.length - 1] : null
      const latestCheckOut = checkOutRecords.length > 0 ? checkOutRecords[checkOutRecords.length - 1] : null

      // 현재 상태 판단
      let currentStatus = '미출근'
      let statusMessage = '아직 출근하지 않았습니다.'
      let canCheckIn = true
      let canCheckOut = false

      if (latestCheckIn && !latestCheckOut) {
        currentStatus = '근무중'
        statusMessage = `${latestCheckIn.record_time}에 출근했습니다.`
        canCheckIn = false
        canCheckOut = true
      } else if (latestCheckIn && latestCheckOut) {
        if (new Date(latestCheckIn.record_timestamp) > new Date(latestCheckOut.record_timestamp)) {
          currentStatus = '근무중'
          statusMessage = `${latestCheckIn.record_time}에 재출근했습니다.`
          canCheckIn = false
          canCheckOut = true
        } else {
          currentStatus = '퇴근완료'
          statusMessage = `${latestCheckOut.record_time}에 퇴근했습니다.`
          canCheckIn = true
          canCheckOut = false
        }
      }

      // 일별 근무시간 요약 조회
      const { data: workSummary } = await supabase
        .from('daily_work_summary')
        .select('*')
        .eq('user_id', user.id)
        .eq('work_date', date)
        .single()

      setStatus({
        user: {
          id: userData.id,
          name: userData.name,
          department: userData.department,
          position: userData.position
        },
        date,
        currentStatus,
        statusMessage,
        canCheckIn,
        canCheckOut,
        todayRecords: {
          checkIn: checkInRecords,
          checkOut: checkOutRecords,
          total: todayRecords?.length || 0
        },
        workSummary: workSummary || {
          basic_hours: 0,
          overtime_hours: 0,
          work_status: currentStatus,
          check_in_time: latestCheckIn?.record_timestamp || null,
          check_out_time: latestCheckOut?.record_timestamp || null
        }
      })

    } catch (error) {
      console.error('출퇴근 현황 조회 오류:', error)
    }
  }

  // 월별 근무시간 요약 조회
  const fetchMonthlySummary = async () => {
    if (!user?.id || !supabase) return

    try {
      const targetMonth = currentMonth
      const monthStart = `${targetMonth}-01`
      const nextMonth = new Date(targetMonth + '-01')
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const monthEnd = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0]

      // 사용자 정보 조회
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('사용자 조회 오류:', userError)
        return
      }

      // 월별 통계 조회
      const { data: monthlyStatsArray, error: monthlyError } = await supabase
        .from('monthly_work_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('work_month', monthStart)
      
      const monthlyStats = monthlyStatsArray && monthlyStatsArray.length > 0 ? monthlyStatsArray[0] : null

      // 일별 근무 데이터 조회
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_work_summary')
        .select('*')
        .eq('user_id', user.id)
        .gte('work_date', monthStart)
        .lte('work_date', monthEnd)
        .order('work_date', { ascending: true })

      if (dailyError) {
        console.error('일별 데이터 조회 오류:', dailyError)
        return
      }

      // 데이터 집계 (월별 통계가 없는 경우 일별 데이터로 계산)
      const workDays = dailyData?.filter(d => d.check_in_time && d.check_out_time).length || 0
      const totalBasicHours = dailyData?.reduce((sum, d) => sum + (d.basic_hours || 0), 0) || 0
      const totalOvertimeHours = dailyData?.reduce((sum, d) => sum + (d.overtime_hours || 0), 0) || 0
      const totalNightHours = dailyData?.reduce((sum, d) => sum + (d.night_hours || 0), 0) || 0
      const totalWorkHours = totalBasicHours + totalOvertimeHours
      const averageDailyHours = workDays > 0 ? totalWorkHours / workDays : 0
      const dinnerCount = dailyData?.filter(d => d.had_dinner).length || 0

      // 연차 기록 조회
      const { data: leaveRecords, error: leaveError } = await supabase
        .from('form_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('form_type', '연차신청')
        .eq('status', '승인됨')
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd + 'T23:59:59')

      if (leaveError) {
        console.error('연차 기록 조회 오류:', leaveError)
      }

      // 출근/지각/조퇴/결근 통계 (공휴일 및 연차 고려)
      let onTimeCount = 0
      let lateCount = 0
      let earlyLeaveCount = 0
      let absentCount = 0
      let holidayCount = 0
      let leaveCount = 0

      const workingDays = new Date(nextMonth.getTime() - 1).getDate()
      
      for (let day = 1; day <= workingDays; day++) {
        const dateStr = `${targetMonth}-${day.toString().padStart(2, '0')}`
        const dayData = dailyData?.find(d => d.work_date === dateStr)
        
        try {
          // 공휴일 체크
          const holidayInfo = await getHolidayInfo(new Date(dateStr))
          
          // 연차 사용 체크 (해당 날짜의 연차 신청이 있는지)
          const hasLeaveRequest = leaveRecords?.some(leave => {
            try {
              const leaveData = typeof leave.form_data === 'string' 
                ? JSON.parse(leave.form_data) 
                : leave.form_data
              const startDate = leaveData.start_date
              const endDate = leaveData.end_date
              return dateStr >= startDate && dateStr <= endDate
            } catch (e) {
              return false
            }
          })
          
          if (holidayInfo.isHoliday) {
            holidayCount++
            // 공휴일은 통계에서 제외
            continue
          }
          
          if (hasLeaveRequest) {
            leaveCount++
            // 연차는 통계에서 제외
            continue
          }
          
          // 주말 체크
          const dayOfWeek = new Date(dateStr).getDay()
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            // 주말은 통계에서 제외
            continue
          }
          
          if (!dayData || (!dayData.check_in_time && !dayData.check_out_time)) {
            // 평일이면서 출퇴근 기록이 없으면 결근
            absentCount++
          } else {
            if (dayData.check_in_time) {
              const checkInHour = new Date(dayData.check_in_time).getHours()
              const checkInMinute = new Date(dayData.check_in_time).getMinutes()
              
              // 9시 정각까지는 정시출근, 이후는 지각
              if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0)) {
                lateCount++
              } else {
                onTimeCount++
              }
            }
            
            if (dayData.check_out_time) {
              const checkOutHour = new Date(dayData.check_out_time).getHours()
              // 17시 이전 퇴근을 조퇴로 간주 (단, 반차인 경우는 제외)
              if (checkOutHour < 17 && !hasLeaveRequest) {
                earlyLeaveCount++
              }
            }
          }
        } catch (error) {
          console.error(`날짜 ${dateStr} 처리 오류:`, error)
          // 오류 발생 시 기존 로직으로 처리
          const dayOfWeek = new Date(dateStr).getDay()
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            if (!dayData || (!dayData.check_in_time && !dayData.check_out_time)) {
              absentCount++
            }
          }
        }
      }

      // 각 일별 기록에 누락된 기록 정보와 공휴일/연차 정보 추가
      const enhancedDailyData = await Promise.all(
        (dailyData || []).map(async (day) => {
          const missing_records: string[] = []
          let dayType = 'workday' // workday, holiday, weekend, leave
          let dayTypeName = '근무일'
          
          try {
            // 공휴일 체크
            const holidayInfo = await getHolidayInfo(new Date(day.work_date))
            
            // 연차 사용 체크
            const hasLeaveRequest = leaveRecords?.some(leave => {
              try {
                const leaveData = typeof leave.form_data === 'string' 
                  ? JSON.parse(leave.form_data) 
                  : leave.form_data
                const startDate = leaveData.start_date
                const endDate = leaveData.end_date
                return day.work_date >= startDate && day.work_date <= endDate
              } catch (e) {
                return false
              }
            })
            
            // 주말 체크
            const dayOfWeek = new Date(day.work_date).getDay()
            
            if (holidayInfo.isHoliday) {
              dayType = 'holiday'
              dayTypeName = holidayInfo.name || '공휴일'
            } else if (hasLeaveRequest) {
              dayType = 'leave'
              dayTypeName = '연차'
            } else if (dayOfWeek === 0 || dayOfWeek === 6) {
              dayType = 'weekend'
              dayTypeName = dayOfWeek === 0 ? '일요일' : '토요일'
            }
            
            // 근무일인 경우에만 누락 기록 체크
            if (dayType === 'workday') {
              // 출근 기록이 없는 경우
              if (!day.check_in_time && day.work_status !== '휴가' && day.work_status !== '결근') {
                missing_records.push('출근기록누락')
              }
              
              // 퇴근 기록이 없는 경우 (출근은 했지만 퇴근이 없는 경우)
              if (day.check_in_time && !day.check_out_time) {
                missing_records.push('퇴근기록누락')
              }
            }
            
          } catch (error) {
            console.error(`날짜 ${day.work_date} 처리 오류:`, error)
            // 오류 발생 시 기본 누락 기록 체크만 수행
            if (!day.check_in_time && day.work_status !== '휴가' && day.work_status !== '결근') {
              missing_records.push('출근기록누락')
            }
            if (day.check_in_time && !day.check_out_time) {
              missing_records.push('퇴근기록누락')
            }
          }

          return {
            ...day,
            missing_records: missing_records.length > 0 ? missing_records : undefined,
            day_type: dayType,
            day_type_name: dayTypeName
          }
        })
      )

      const summaryData: MonthlyWorkSummary = {
        user: {
          id: userData.id,
          name: userData.name,
          department: userData.department,
          position: userData.position
        },
        period: {
          month: targetMonth,
          startDate: monthStart,
          endDate: monthEnd,
          totalDays: workingDays
        },
        workStats: {
          totalWorkDays: workDays,
          totalBasicHours: Math.round(totalBasicHours * 10) / 10,
          totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
          totalNightHours: Math.round(totalNightHours * 10) / 10,
          totalWorkHours: Math.round(totalWorkHours * 10) / 10,
          averageDailyHours: Math.round(averageDailyHours * 10) / 10,
          dinnerCount
        },
        attendanceStats: {
          onTimeCount,
          lateCount,
          earlyLeaveCount,
          absentCount,
          attendanceRate: workingDays > 0 ? Math.round((workDays / workingDays) * 100) : 0
        },
        dailyRecords: enhancedDailyData
      }

      setMonthlySummary(summaryData)

    } catch (error) {
      console.error('월별 요약 조회 오류:', error)
    }
  }

  // 컴포넌트 마운트 시 상태 조회
  useEffect(() => {
    if (user?.id) {
      fetchAttendanceStatus()
      fetchMonthlySummary()
      // 5분마다 상태 새로고침
      const interval = setInterval(() => {
        fetchAttendanceStatus()
        fetchMonthlySummary()
      }, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user, currentMonth])

  // 출퇴근 버튼 클릭
  const handleAttendanceClick = (action: '출근' | '퇴근') => {
    setSelectedAction(action)
    setReason('')
    setHadDinner(false)
    setUseCurrentTime(true)
    setSelectedTime(formatTime(currentTime).substring(0, 5)) // HH:MM 형식
    setShowReasonModal(true)
  }

  // 출퇴근 기록 실행
  const executeAttendance = async () => {
    if (!selectedAction || !user?.id || !supabase) return
    
    // 중복 클릭 방지
    if (loading) return

    // 입력값 검증
    if (selectedAction === '출근' && !reason.trim()) {
      alert('출근 시에는 업무 사유를 반드시 입력해주세요.')
      return
    }

    if (!useCurrentTime && !selectedTime) {
      alert('시간을 선택해주세요.')
      return
    }

    // 업무 사유 길이 제한 (500자)
    if (reason.length > 500) {
      alert('업무 사유는 500자 이내로 입력해주세요.')
      return
    }

    // 미래 시간 검증
    if (!useCurrentTime) {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const selectedDateTime = new Date()
      selectedDateTime.setHours(hours, minutes, 0, 0)
      
      if (selectedDateTime > new Date()) {
        alert('미래 시간으로는 기록할 수 없습니다.')
        return
      }
    }

    setLoading(true)

    try {
      // 사용자 존재 여부 확인
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, department')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        alert('등록되지 않은 사용자입니다.')
        setLoading(false)
        return
      }

      // 시간 설정 (수동 입력 또는 현재 시간)
      let record_timestamp: Date
      let record_date: string
      let record_time: string
      let is_manual = false

      if (!useCurrentTime && selectedTime) {
        // 수동 입력 시간 사용
        const today = new Date().toISOString().split('T')[0]
        const [year, month, day] = today.split('-').map(Number)
        const [hours, minutes] = selectedTime.split(':').map(Number)
        record_timestamp = new Date(year, month - 1, day, hours, minutes)
        is_manual = true
      } else {
        // 현재 시간 사용
        record_timestamp = new Date()
      }

      record_date = record_timestamp.toISOString().split('T')[0]
      record_time = record_timestamp.toTimeString().split(' ')[0].substring(0, 5)

      // 중복 기록 검사 (같은 날짜, 같은 유형, 5분 이내)
      const fiveMinutesAgo = new Date(record_timestamp.getTime() - 5 * 60 * 1000)
      const fiveMinutesLater = new Date(record_timestamp.getTime() + 5 * 60 * 1000)

      const { data: duplicateCheck } = await supabase
        .from('attendance_records')
        .select('id, record_timestamp')
        .eq('user_id', user.id)
        .eq('record_date', record_date)
        .eq('record_type', selectedAction)
        .gte('record_timestamp', fiveMinutesAgo.toISOString())
        .lte('record_timestamp', fiveMinutesLater.toISOString())
        .limit(1)

      if (duplicateCheck && duplicateCheck.length > 0) {
        alert(`${selectedAction} 기록이 이미 존재합니다. (${record_time})`)
        setLoading(false)
        return
      }

      // 출퇴근 기록 저장
      const { data: attendanceRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: user.id,
          record_date,
          record_time,
          record_timestamp: record_timestamp.toISOString(),
          record_type: selectedAction,
          reason: reason?.trim() || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null,
          location_accuracy: location?.accuracy || null,
          source: 'web',
          had_dinner: selectedAction === '퇴근' ? hadDinner : false,
          is_manual
        })
        .select()
        .single()

      if (insertError) {
        console.error('출퇴근 기록 저장 오류:', insertError)
        // 구체적인 에러 메시지 제공
        if (insertError.message?.includes('duplicate')) {
          alert('이미 해당 시간에 기록이 존재합니다.')
        } else if (insertError.message?.includes('network')) {
          alert('네트워크 연결을 확인해주세요.')
        } else {
          alert('출퇴근 기록 저장에 실패했습니다.')
        }
        setLoading(false)
        return
      }

      alert(`${selectedAction} 기록이 완료되었습니다!`)
      setShowReasonModal(false)
      setSelectedAction(null)
      setReason('')
      setHadDinner(false)
      setUseCurrentTime(true)
      setSelectedTime('')
      
      // 상태 새로고침
      await fetchAttendanceStatus()
      await fetchMonthlySummary()

    } catch (error: any) {
      console.error('출퇴근 기록 오류:', error)
      // 구체적인 에러 메시지 제공
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        alert('인터넷 연결을 확인해주세요.')
      } else if (error?.message?.includes('timeout')) {
        alert('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      } else {
        alert('출퇴근 기록 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01')
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long' 
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { 
      month: '2-digit', 
      day: '2-digit' 
    })
  }

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[date.getDay()]
  }

  const getStatusColor = (canCheckIn: boolean, canCheckOut: boolean) => {
    if (canCheckIn) return 'text-blue-600'
    if (canCheckOut) return 'text-green-600'
    return 'text-gray-600'
  }

  const getStatusIcon = (canCheckIn: boolean, canCheckOut: boolean) => {
    if (canCheckIn) return <Clock className="h-5 w-5 text-blue-500" />
    if (canCheckOut) return <CheckCircle className="h-5 w-5 text-green-500" />
    return <XCircle className="h-5 w-5 text-gray-500" />
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const date = new Date(currentMonth + '-01')
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    setCurrentMonth(date.toISOString().substring(0, 7))
  }

  const openPolicyModal = (policyType: 'flexible' | 'overtime' | 'leave') => {
    setSelectedPolicyType(policyType)
    setShowPolicyModal(true)
  }

  // 누락 기록 추가
  const submitMissingRecord = async () => {
    if (!user?.id || !editingRecord || !supabase) return
    
    // 중복 클릭 방지
    if (submittingMissingRecord) return

    // 입력값 검증
    if (!missingRecordForm.selectedDate || !missingRecordForm.selectedTime || !missingRecordForm.reason.trim()) {
      alert('모든 필드를 입력해주세요.')
      return
    }
    
    // 사유 길이 제한 (200자)
    if (missingRecordForm.reason.length > 200) {
      alert('사유는 200자 이내로 입력해주세요.')
      return
    }

    setSubmittingMissingRecord(true)

    try {
      // 대상 사용자 확인
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, department')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        alert('사용자를 찾을 수 없습니다.')
        setSubmittingMissingRecord(false)
        return
      }

      // 날짜와 시간 파싱
      const [year, month, day] = missingRecordForm.selectedDate.split('-').map(Number)
      const [hours, minutes] = missingRecordForm.selectedTime.split(':').map(Number)
      
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        alert('날짜 또는 시간 형식이 올바르지 않습니다.')
        setSubmittingMissingRecord(false)
        return
      }

      const timestamp = new Date(year, month - 1, day, hours, minutes)
      
      // 미래 시간 검증
      if (timestamp > new Date()) {
        alert('미래 시간으로는 기록할 수 없습니다.')
        setSubmittingMissingRecord(false)
        return
      }

      // 중복 기록 검사
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id, record_time')
        .eq('user_id', user.id)
        .eq('record_date', missingRecordForm.selectedDate)
        .eq('record_type', missingRecordForm.recordType)
        .single()

      if (existingRecord) {
        alert(`${missingRecordForm.recordType} 기록이 이미 존재합니다. (${existingRecord.record_time})`)
        setSubmittingMissingRecord(false)
        return
      }

      // 누락 기록 추가
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: user.id,
          record_date: missingRecordForm.selectedDate,
          record_time: missingRecordForm.selectedTime,
          record_timestamp: timestamp.toISOString(),
          record_type: missingRecordForm.recordType,
          reason: missingRecordForm.reason.trim() || '누락 기록 보충',
          source: 'manual',
          is_manual: true,
          approved_by: user.id,
          approved_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('누락 기록 추가 오류:', insertError)
        alert('누락 기록 추가에 실패했습니다.')
        setSubmittingMissingRecord(false)
        return
      }

      alert(`${userData.name}님의 ${missingRecordForm.recordType} 기록이 추가되었습니다. (${missingRecordForm.selectedDate} ${missingRecordForm.selectedTime})`)
      setEditingRecord(null)
      setMissingRecordForm({
        recordType: '출근',
        selectedDate: '',
        selectedTime: '',
        reason: ''
      })
      
      // 상태 새로고침
      await fetchAttendanceStatus()
      await fetchMonthlySummary()

    } catch (error) {
      console.error('누락 기록 추가 오류:', error)
      alert('누락 기록 추가 중 오류가 발생했습니다.')
    } finally {
      setSubmittingMissingRecord(false)
    }
  }

  // 저녁식사 기록 업데이트
  const updateDinnerRecord = async (workDate: string, hadDinner: boolean) => {
    if (!user?.id || !supabase) return

    try {
      // 해당 날짜의 퇴근 기록 찾기 (가장 최근 것)
      const { data: checkoutRecord, error: checkoutError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user.id)
        .eq('record_date', workDate)
        .eq('record_type', '퇴근')
        .order('record_timestamp', { ascending: false })
        .limit(1)
        .single()

      if (checkoutError || !checkoutRecord) {
        alert('해당 날짜의 퇴근 기록을 찾을 수 없습니다.')
        return
      }

      // 저녁식사 기록 업데이트
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance_records')
        .update({
          had_dinner: hadDinner,
          updated_at: new Date().toISOString()
        })
        .eq('id', checkoutRecord.id)
        .select()
        .single()

      if (updateError) {
        console.error('저녁식사 기록 업데이트 오류:', updateError)
        alert('저녁식사 기록 업데이트에 실패했습니다.')
        return
      }

      // daily_work_summary도 업데이트
      await supabase
        .from('daily_work_summary')
        .update({
          had_dinner: hadDinner,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('work_date', workDate)

      alert(`저녁식사 기록이 ${hadDinner ? '추가' : '제거'}되었습니다.`)
      
      // 상태 새로고침
      await fetchMonthlySummary()

    } catch (error) {
      console.error('저녁식사 기록 오류:', error)
      alert('저녁식사 기록 중 오류가 발생했습니다.')
    }
  }

  return (
    <>
      <div className="bg-white overflow-hidden shadow rounded-lg">
        {/* 헤더 - 출퇴근 버튼과 현재 시간 */}
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {status ? getStatusIcon(status.canCheckIn, status.canCheckOut) : <Clock className="h-5 w-5 text-gray-400" />}
              </div>
              <div className="ml-3">
                <dt className="text-sm font-medium text-gray-500">
                  근태 관리
                </dt>
                <dd className={`text-lg font-medium ${status ? getStatusColor(status.canCheckIn, status.canCheckOut) : 'text-gray-900'}`}>
                  {status ? status.statusMessage : '상태 확인 중...'}
                </dd>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-800">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs text-gray-500">
                {currentTime.toLocaleDateString('ko-KR')}
              </div>
            </div>
          </div>

          {/* 출퇴근 버튼 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              onClick={() => handleAttendanceClick('출근')}
              disabled={loading || !status?.canCheckIn}
              className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                loading || !status?.canCheckIn
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-md'
              }`}
            >
              {loading && selectedAction === '출근' ? '처리중...' : '출근'}
            </button>

            <button
              onClick={() => handleAttendanceClick('퇴근')}
              disabled={loading || !status?.canCheckOut}
              className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                loading || !status?.canCheckOut
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-md'
              }`}
            >
              {loading && selectedAction === '퇴근' ? '처리중...' : '퇴근'}
            </button>
          </div>
          
          {/* 출퇴근 관리 페이지로 이동 버튼 */}
          <div className="text-center">
            <a
              href="/attendance"
              className="inline-flex items-center px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Clock className="h-4 w-4 mr-2" />
              출퇴근 관리 페이지로 이동
            </a>
          </div>

          {/* CAPS 우선 사용 안내 */}
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <AlertCircle className="h-3 w-3 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="mb-1">• <strong>평소에는 CAPS(지문인식기)로 출퇴근 처리해주세요</strong></p>
                <p>• CAPS로 처리가 불가능한 경우에만 이 버튼을 사용해주세요</p>
              </div>
            </div>
          </div>
        </div>

        {/* 월별 근무시간 요약 */}
        <div className="p-5">
          {/* 월 선택 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {formatMonth(currentMonth)} 근무시간
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => openPolicyModal('overtime')}
                className="p-1 rounded-md hover:bg-blue-100 text-blue-600"
                title="근무정책 안내"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
              <button
                onClick={() => changeMonth('prev')}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronDown className="h-4 w-4 transform rotate-90" />
              </button>
              <button
                onClick={() => changeMonth('next')}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronDown className="h-4 w-4 transform -rotate-90" />
              </button>
            </div>
          </div>

          {monthlySummary ? (
            <div className="space-y-4">
              {/* 월별 기준 정보 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="text-sm font-medium text-gray-700">해당 월 기준 정보</span>
                  </div>
                  <button
                    onClick={() => openPolicyModal('flexible')}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    탄력근무제
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  {monthlySummary.period.month} 기준 근로시간: {monthlySummary.workStats.totalBasicHours}시간 
                  (실근무일 기준: {monthlySummary.workStats.totalWorkDays}시간) 
                  (단력근로제 적용: {monthlySummary.period.startDate}~{monthlySummary.period.endDate})
                </p>
              </div>

              {/* 근무시간 통계 */}
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">일평균 근무시간</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.averageDailyHours.toFixed(1)}시간
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">실근무시간 (출근일반)</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.totalBasicHours.toFixed(1)}시간
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">인정시간 (유급휴가 포함)</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.totalWorkHours.toFixed(1)}시간
                  </span>
                </div>
              </div>

              {/* 마지막 업데이트 시간 */}
              <div className="text-center text-xs text-gray-500 pt-2">
                최종 업데이트: {new Date().toLocaleString('ko-KR')}
              </div>

              {/* 자세히보기 버튼 */}
              <div className="pt-3">
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="w-full py-2 px-4 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  자세히보기
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>근무시간 데이터를 불러오는 중...</p>
            </div>
          )}
        </div>
      </div>

      {/* 사유 입력 모달 */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  {selectedAction === '출근' ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 mr-2 text-red-500" />
                  )}
                  {selectedAction} 기록
                </h3>
                <button
                  onClick={() => setShowReasonModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {/* 위치 정보 표시 */}
                {location && (
                  <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span>위치: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</span>
                  </div>
                )}

                {/* 시간 선택 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기록 시간
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={useCurrentTime}
                        onChange={(e) => setUseCurrentTime(e.target.checked)}
                        className="mr-2"
                        disabled={loading}
                      />
                      <Clock className="h-4 w-4 mr-1" />
                      <span className="text-sm">현재 시간 사용 ({formatTime(currentTime)})</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        checked={!useCurrentTime}
                        onChange={(e) => setUseCurrentTime(!e.target.checked)}
                        className="mr-2"
                        disabled={loading}
                      />
                      <span className="text-sm">직접 시간 선택</span>
                    </label>
                    {!useCurrentTime && (
                      <div className="ml-6">
                        <input
                          type="time"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                          max={formatTime(currentTime).substring(0, 5)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          disabled={loading}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          현재 시간 이전만 선택 가능합니다
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 업무 사유 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업무 사유 {selectedAction === '출근' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      selectedAction === '출근' 
                        ? "오늘 수행할 업무나 프로젝트를 간단히 입력해주세요..."
                        : "마무리한 업무나 특이사항을 입력해주세요 (선택사항)"
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                    disabled={loading}
                  />
                </div>

                {/* 저녁식사 여부 (퇴근 시) */}
                {selectedAction === '퇴근' && (
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={hadDinner}
                        onChange={(e) => setHadDinner(e.target.checked)}
                        className="mr-2"
                        disabled={loading}
                      />
                      <Coffee className="h-4 w-4 mr-1" />
                      <span className="text-sm">저녁식사를 했습니다</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      8시간 이상 근무 시 저녁식사 여부를 체크해주세요
                    </p>
                  </div>
                )}

                {/* 주의사항 */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="mb-1">• {selectedAction === '출근' ? '출근 시에는 반드시 업무 사유를 입력해주세요' : '퇴근 기록이 저장됩니다'}</p>
                      <p>• 기록은 실시간으로 저장되며 수정이 어려우니 신중히 입력해주세요</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(false)}
                  disabled={loading}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={executeAttendance}
                  disabled={loading || (selectedAction === '출근' && !reason.trim())}
                  className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    selectedAction === '출근'
                      ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400'
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
                  } disabled:opacity-50`}
                >
                  {loading ? '처리중...' : `${selectedAction} 기록`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 자세히보기 모달 */}
      {showDetailModal && monthlySummary && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {formatMonth(currentMonth)} 일별 근무현황
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 테이블 헤더 */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        날짜
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        요일
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무유형
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        출근
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        퇴근
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        비고
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlySummary.dailyRecords?.map((record, index) => (
                      <tr key={record.work_date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(record.work_date)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getDayOfWeek(record.work_date)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex flex-col space-y-1">
                            {/* 일별 유형 표시 (공휴일, 연차, 주말) */}
                            {record.day_type && record.day_type !== 'workday' && (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                record.day_type === 'holiday' 
                                  ? 'bg-blue-100 text-blue-800'
                                  : record.day_type === 'leave'
                                  ? 'bg-green-100 text-green-800'
                                  : record.day_type === 'weekend'
                                  ? 'bg-gray-100 text-gray-600'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {record.day_type === 'holiday' && '🏛️'} 
                                {record.day_type === 'leave' && '🌴'} 
                                {record.day_type === 'weekend' && '📅'} 
                                {record.day_type_name}
                              </span>
                            )}
                            
                            {/* 근무 상태 표시 */}
                            {record.work_status && record.day_type === 'workday' && (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                record.work_status === '정상근무' 
                                  ? 'bg-green-100 text-green-800'
                                  : record.work_status === '지각'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : record.work_status === '조퇴'
                                  ? 'bg-orange-100 text-orange-800'
                                  : record.work_status === '결근'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {record.work_status}
                              </span>
                            )}
                            
                            {/* 공휴일 또는 연차 근무 시 특별 표시 */}
                            {(record.day_type === 'holiday' || record.day_type === 'weekend') && 
                             (record.check_in_time || record.check_out_time) && (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                                💼 특근
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_in_time ? 
                            formatTimeWithNextDay(
                              new Date(record.check_in_time),
                              new Date(record.work_date)
                            )
                            : '--'
                          }
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_out_time ? 
                            formatTimeWithNextDay(
                              new Date(record.check_out_time),
                              new Date(record.work_date)
                            )
                            : '--'
                          }
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            {/* 저녁식사 기록 표시 */}
                            {record.had_dinner && (
                              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded flex items-center">
                                <Coffee className="h-3 w-3 mr-1" />
                                저녁식사
                              </span>
                            )}
                            
                            {/* 저녁식사 확인 요청 */}
                            {(() => {
                              // 저녁식사 감지 로직
                              if (!record.check_in_time || !record.check_out_time || record.had_dinner) {
                                return null
                              }
                              
                              const dinnerDetection = detectDinnerEligibility(
                                record.check_in_time.split('T')[1]?.substring(0, 8) || '',
                                record.check_out_time.split('T')[1]?.substring(0, 8) || '',
                                '',
                                false
                              )
                              
                              // 요건 충족 시 간단한 확인 메시지
                              if (dinnerDetection.isDinnerMissing) {
                                return (
                                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded flex items-center">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    저녁식사 여부 확인 필요
                                  </span>
                                )
                              }
                              
                              return null
                            })()}
                            
                            {/* 누락 기록 표시 */}
                            {record.missing_records && record.missing_records.length > 0 && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded flex items-center">
                                <XCircle className="h-3 w-3 mr-1" />
                                {record.missing_records.includes('출근기록누락') && record.missing_records.includes('퇴근기록누락') 
                                  ? '출퇴근 누락' 
                                  : record.missing_records.includes('출근기록누락') 
                                    ? '출근 누락'
                                    : '퇴근 누락'
                                }
                              </span>
                            )}
                            
                            {/* 기본 근무시간 표시 */}
                            {record.basic_hours > 0 && (
                              <span className="text-xs text-gray-600">
                                {record.basic_hours}h
                                {record.overtime_hours > 0 && ` +${record.overtime_hours}h`}
                                {(record.night_hours || 0) > 0 && ` (야간 ${record.night_hours}h)`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-1">
                            {record.missing_records && record.missing_records.length > 0 && (
                              <button
                                onClick={() => {
                                  setEditingRecord(record)
                                  const hasCheckInMissing = record.missing_records?.includes('출근기록누락') || false
                                  setMissingRecordForm({
                                    recordType: hasCheckInMissing ? '출근' : '퇴근',
                                    selectedDate: record.work_date,
                                    selectedTime: hasCheckInMissing ? '09:00' : '18:00',
                                    reason: '누락 기록 보충'
                                  })
                                }}
                                className="text-indigo-600 hover:text-indigo-900 text-xs bg-indigo-50 px-2 py-1 rounded"
                              >
                                <Edit className="h-3 w-3 inline mr-1" />
                                수정
                              </button>
                            )}
                            {/* 간단한 체크/취소 버튼 */}
                            {(() => {
                              if (!record.check_in_time || !record.check_out_time) {
                                return null
                              }
                              
                              const dinnerDetection = detectDinnerEligibility(
                                record.check_in_time.split('T')[1]?.substring(0, 8) || '',
                                record.check_out_time.split('T')[1]?.substring(0, 8) || '',
                                '',
                                record.had_dinner
                              )
                              
                              // 요건 충족 시 버튼 표시 (이미 체크된 경우도 취소 가능)
                              if (dinnerDetection.isDinnerMissing || record.had_dinner) {
                                return (
                                  <button
                                    onClick={() => updateDinnerRecord(record.work_date, !record.had_dinner)}
                                    className={`text-xs px-2 py-1 rounded transition-colors ${
                                      record.had_dinner 
                                        ? 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100' 
                                        : 'text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100'
                                    }`}
                                  >
                                    <Coffee className="h-3 w-3 inline mr-1" />
                                    {record.had_dinner ? '식사 취소' : '식사 체크'}
                                  </button>
                                )
                              }
                              
                              return null
                            })()}
                          </div>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                          해당 월의 근무 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 모달 하단 */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  총 {monthlySummary.dailyRecords?.length || 0}일의 기록
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기록 편집 모달 (누락 기록 처리) */}
      {editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {formatDate(editingRecord.work_date)} 기록 수정
                </h3>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="mb-1">누락된 기록:</p>
                      <ul className="list-disc list-inside">
                        {editingRecord.missing_records?.map((missing: string, index: number) => (
                          <li key={index}>{missing}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      기록 유형
                    </label>
                    <select
                      value={missingRecordForm.recordType}
                      onChange={(e) => setMissingRecordForm({...missingRecordForm, recordType: e.target.value as '출근' | '퇴근'})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {editingRecord?.missing_records?.includes('출근기록누락') && (
                        <option value="출근">출근</option>
                      )}
                      {editingRecord?.missing_records?.includes('퇴근기록누락') && (
                        <option value="퇴근">퇴근</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      날짜
                    </label>
                    <input
                      type="date"
                      value={missingRecordForm.selectedDate}
                      onChange={(e) => setMissingRecordForm({...missingRecordForm, selectedDate: e.target.value})}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      시간
                    </label>
                    <input
                      type="time"
                      value={missingRecordForm.selectedTime}
                      onChange={(e) => setMissingRecordForm({...missingRecordForm, selectedTime: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      사유
                    </label>
                    <textarea
                      value={missingRecordForm.reason}
                      onChange={(e) => setMissingRecordForm({...missingRecordForm, reason: e.target.value})}
                      placeholder="누락 기록 추가 사유를 입력해주세요..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={() => {
                    setEditingRecord(null)
                    setMissingRecordForm({
                      recordType: '출근',
                      selectedDate: '',
                      selectedTime: '',
                      reason: ''
                    })
                  }}
                  disabled={submittingMissingRecord}
                  className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={submitMissingRecord}
                  disabled={submittingMissingRecord || !missingRecordForm.selectedDate || !missingRecordForm.selectedTime || !missingRecordForm.reason.trim()}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submittingMissingRecord ? '처리중...' : '기록 추가'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 근무정책 설명 모달 */}
      <WorkPolicyExplanationModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false)
          setSelectedPolicyType(null)
        }}
        policyType={selectedPolicyType}
      />
    </>
  )
}
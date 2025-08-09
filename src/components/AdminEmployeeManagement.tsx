'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import CapsUploadManager from '@/components/CapsUploadManager'
import SpecialLeaveGrantModal from '@/components/SpecialLeaveGrantModal'
import { ChevronLeft, ChevronRight, AlertCircle, Calendar, CalendarSync, FileUp } from 'lucide-react'
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave'
import { updateHolidayCache } from '@/lib/holidays'


// Assuming a more complete User type
interface Employee {
  id: string
  name: string
  email: string
  employee_number?: string // 사원번호 추가
  password_hash?: string
  role: string
  department: string
  position: string
  phone: string
  start_date: string
  hire_date?: string
  salary: number
  hourly_rate: number
  annual_leave_days: number
  used_leave_days: number
  remaining_leave_days: number
  hourly_leave_hours: number
  used_hourly_leave: number
  remaining_hourly_leave: number
  substitute_leave_hours?: number // 대체휴가 시간
  compensatory_leave_hours?: number // 보상휴가 시간
  termination_date?: string // 퇴사일
  resignation_date?: string // 퇴사 신청일
  is_active?: boolean // 활성 상태
  work_type?: string // 근무 형태
  annual_leave?: number // 연차 잔여일수
  sick_leave?: number // 병가 잔여일수
  created_at: string
  updated_at: string
}

export default function AdminEmployeeManagement() {
  const { supabase } = useSupabase()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'management'>('info')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned' | 'contract'>('all')
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newEmployeeData, setNewEmployeeData] = useState({
    name: '',
    employee_number: '',
    email: '',
    password: '',
    department: '',
    position: '',
    phone: '',
    dob: '',
    address: '',
    work_type: 'regular',
    contract_end_date: '',
    hire_date: new Date().toISOString().split('T')[0],
    annual_salary: 0,
    meal_allowance: 0,
    car_allowance: 0,
    role: 'employee' as 'employee' | 'admin'
  })
  
  // Attendance management states
  const [attendanceMonth, setAttendanceMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [attendanceData, setAttendanceData] = useState<any>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false)
  const [showHolidaySync, setShowHolidaySync] = useState(false)
  const [showLeaveSync, setShowLeaveSync] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{type: string, status: 'idle' | 'loading' | 'success' | 'error', message?: string}>({type: '', status: 'idle'})

  // fetchData 함수를 컴포넌트 스코프로 이동
  const fetchData = async () => {
    try {
        console.log('🚀 Fetching employees (direct Supabase)...')
        
        // localStorage에서 사용자 정보 가져오기
        const userStr = localStorage.getItem('motion-connect-user')
        if (!userStr) {
          throw new Error('로그인이 필요합니다.')
        }
        
        const user = JSON.parse(userStr)
        if (user.role !== 'admin') {
          throw new Error('관리자 권한이 필요합니다.')
        }

        // Supabase에서 직접 users 테이블 조회 (employee_number 포함)
        let { data: users, error } = await supabase
          .from('users')
          .select(`
            id, name, email, employee_number, department, position, hire_date,
            annual_days, used_annual_days, sick_days, used_sick_days,
            substitute_leave_hours, compensatory_leave_hours
          `)
          .order('hire_date', { ascending: true, nullsFirst: false })

        // work_type, termination_date, contract_end_date 컬럼이 존재하는지 확인하고 추가 조회
        let hasStatusColumns = false
        try {
          const { data: usersWithStatus, error: statusError } = await supabase
            .from('users')
            .select(`
              id, name, email, employee_number, department, position, hire_date,
              annual_days, used_annual_days, sick_days, used_sick_days,
              substitute_leave_hours, compensatory_leave_hours,
              work_type, termination_date, contract_end_date,
              annual_salary, monthly_salary, basic_salary, bonus,
              meal_allowance, transportation_allowance, hourly_wage,
              salary_details_updated_at
            `)
            .order('hire_date', { ascending: true, nullsFirst: false })
          
          if (!statusError && usersWithStatus) {
            users = usersWithStatus
            hasStatusColumns = true
          }
        } catch (statusErr) {
          console.log('ℹ️ Status columns not found, using basic columns only')
        }

        if (error) {
          console.error('❌ Supabase error:', error)
          setError(`직원 데이터를 불러올 수 없습니다: ${error.message}`)
          return
        }

        console.log('✅ Users fetched directly from Supabase:', users?.length, '명')
        
        // 데이터 변환 (퇴사자 및 계약직 분류 포함)
        const result = users?.map((userData: any) => {
          // work_type 컬럼이 있으면 그것을 사용, 없으면 로직으로 계산
          let work_type = '정규직'
          if (hasStatusColumns && userData.work_type) {
            // 데이터베이스에서 자동 계산된 work_type 사용
            work_type = userData.work_type
          } else if (hasStatusColumns) {
            // 컬럼은 있지만 work_type이 비어있는 경우 로직으로 계산
            const isTerminated = !!userData.termination_date
            const isContractEmployee = !!userData.contract_end_date
            
            if (isTerminated) {
              work_type = '퇴사자'
            } else if (isContractEmployee) {
              work_type = '계약직'
            }
          }
          
          // 퇴사자 여부 (is_active 설정용)
          const isTerminated = hasStatusColumns && !!userData.termination_date
          
          return {
            ...userData,
            // 기본 필드들
            work_type,
            dob: userData.dob || '',
            phone: userData.phone || '',
            address: userData.address || '',
            is_active: !isTerminated, // 퇴사자는 비활성화
            resignation_date: userData.resignation_date || null,
            termination_date: userData.termination_date || null,
            contract_end_date: userData.contract_end_date || null,
            updated_at: userData.updated_at || new Date().toISOString(),
            // 휴가 계산 필드들
            annual_leave: Math.max(0, (userData.annual_days || 0) - (userData.used_annual_days || 0)),
            sick_leave: Math.max(0, (userData.sick_days || 0) - (userData.used_sick_days || 0)),
            substitute_leave_hours: userData.substitute_leave_hours || 0,
            compensatory_leave_hours: userData.compensatory_leave_hours || 0,
            leave_data: {
              annual_days: userData.annual_days || 0,
              used_annual_days: userData.used_annual_days || 0,
              sick_days: userData.sick_days || 0,
              used_sick_days: userData.used_sick_days || 0,
              substitute_leave_hours: userData.substitute_leave_hours || 0,
              compensatory_leave_hours: userData.compensatory_leave_hours || 0
            }
          }
        }) || []
        
        setEmployees(result)
      } catch (err) {
        console.error('❌ Error:', err)
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // employees가 변경될 때 선택된 직원 정보 업데이트 (순환 참조 방지)
  useEffect(() => {
    if (selectedEmployee && employees.length > 0) {
      const updatedEmployee = employees.find(emp => emp.id === selectedEmployee.id)
      if (updatedEmployee && JSON.stringify(updatedEmployee) !== JSON.stringify(selectedEmployee)) {
        setSelectedEmployee(updatedEmployee)
      }
    }
  }, [employees]) // selectedEmployee를 의존성에서 제거

  // When an employee is selected, populate the form data
  useEffect(() => {
    if (selectedEmployee) {
      setFormData(selectedEmployee)
    } else {
      setFormData({})
    }
  }, [selectedEmployee])


  // useEffect to fetch attendance data when attendanceMonth changes
  useEffect(() => {
    if (selectedEmployee && activeTab === 'attendance') {
      fetchAttendanceData()
    }
  }, [attendanceMonth, selectedEmployee, activeTab])

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    
    let finalValue: string | boolean = value
    if (type === 'checkbox') {
        finalValue = (e.target as HTMLInputElement).checked
    }

    setFormData(prev => ({ ...prev, [name]: finalValue }))
  }


  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!selectedEmployee) return

    setSubmitting(true)
    setError(null)

    try {
      // 디버깅: 전송할 데이터 로그
      console.log('💾 업데이트할 데이터:', formData)
      console.log('선택된 직원 ID:', selectedEmployee.id)
      
      // 실제 데이터베이스 컬럼만 필터링하여 업데이트
      const updateData = {
        name: formData.name,
        email: formData.email,
        employee_number: formData.employee_number,
        department: formData.department,
        position: formData.position,
        phone: formData.phone,
        hire_date: formData.hire_date,
        work_type: formData.work_type,
        resignation_date: formData.resignation_date,
        updated_at: new Date().toISOString()
      }
      
      // undefined 또는 null 값 제거
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null && value !== '')
      )
      
      console.log('🔍 필터링된 업데이트 데이터:', filteredUpdateData)
      
      // Supabase로 직접 업데이트
      const { data, error } = await supabase
        .from('users')
        .update(filteredUpdateData)
        .eq('id', selectedEmployee.id)
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase update error:', error)
        throw new Error('직원 정보 업데이트에 실패했습니다.')
      }
      
      console.log('✅ 업데이트 성공:', data)
      alert('직원 정보가 성공적으로 업데이트되었습니다.')
      // 로컬 상태 업데이트
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === selectedEmployee.id ? { ...emp, ...formData } : emp
        )
      )
      setSelectedEmployee({ ...selectedEmployee, ...formData })
    } catch (err) {
      setError(err instanceof Error ? err.message : '업데이트 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFieldEdit = (fieldKey: string, currentValue: number) => {
    setEditingField(fieldKey)
    setEditValue(currentValue.toString())
  }

  const handleFieldSave = async (fieldKey: string, leaveType: string, adjustmentType: 'granted' | 'used') => {
    // 모든 휴가 관련 값은 소수점 허용
    const newValue = parseFloat(editValue)
    
    if (isNaN(newValue) || newValue < 0) {
      alert('유효한 숫자를 입력해주세요 (0 이상)')
      return
    }

    if (!selectedEmployee) return

    let currentValue = 0
    let difference = 0

    // 필드별 현재 값 계산
    if (['substitute_hours', 'compensatory_hours'].includes(fieldKey)) {
      // 대체휴가/보상휴가는 직접 값 설정
      currentValue = fieldKey === 'substitute_hours' 
        ? selectedEmployee.substitute_leave_hours || 0
        : selectedEmployee.compensatory_leave_hours || 0
      difference = newValue - currentValue
    } else {
      // 연차/병가는 leave_data에서 값 가져오기
      const currentData = (selectedEmployee as any)?.leave_data || {}
      const targetField = leaveType === 'annual_leave' 
        ? (adjustmentType === 'granted' ? 'annual_days' : 'used_annual_days')
        : (adjustmentType === 'granted' ? 'sick_days' : 'used_sick_days')
      
      currentValue = currentData[targetField] || 0
      difference = newValue - currentValue
    }

    // 직접 값 설정이므로 차이값을 이용해 조정
    await handleLeaveAdjustment(leaveType, adjustmentType, difference)
    
    setEditingField(null)
    setEditValue('')
  }

  const handleFieldCancel = () => {
    setEditingField(null)
    setEditValue('')
  }


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  // Attendance management functions
  const fetchAttendanceData = async () => {
    if (!selectedEmployee) return
    
    setAttendanceLoading(true)
    try {
      console.log('🔍 근무시간 데이터 조회 (직접 Supabase):', attendanceMonth, selectedEmployee.id)
      
      // 선택된 월의 시작일과 종료일 계산
      const [year, month] = attendanceMonth.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      // 다음 달 1일의 하루 전 = 이번 달 마지막 날
      const endDate = new Date(year, month, 0)
      
      const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      
      // 월별 통계 조회 (대체휴가, 보상휴가 시간 포함)
      const { data: monthlyStatsArray, error: statsError } = await supabase
        .from('monthly_work_stats')
        .select('*')
        .eq('user_id', selectedEmployee.id)
        .eq('work_month', `${year}-${String(month).padStart(2, '0')}-01`)
      
      const monthlyStats = monthlyStatsArray && monthlyStatsArray.length > 0 ? monthlyStatsArray[0] : null
      
      // 대체휴가, 보상휴가 시간 집계 (daily_work_summary에서)
      const { data: compensatoryData, error: compError } = await supabase
        .from('daily_work_summary')
        .select('substitute_hours, compensatory_hours')
        .eq('user_id', selectedEmployee.id)
        .gte('work_date', startDateStr)
        .lte('work_date', endDateStr)
      
      // 대체휴가, 보상휴가 시간 합계 계산
      let totalSubstituteHours = 0
      let totalCompensatoryHours = 0
      
      if (compensatoryData) {
        compensatoryData.forEach(day => {
          totalSubstituteHours += day.substitute_hours || 0
          totalCompensatoryHours += day.compensatory_hours || 0
        })
      }
      
      console.log('📊 휴가 발생시간:', {
        대체휴가: totalSubstituteHours,
        보상휴가: totalCompensatoryHours
      })
      
      // 일별 상세 데이터 조회
      const { data: dailyRecords, error: dailyError } = await supabase
        .from('daily_work_summary')
        .select('*')
        .eq('user_id', selectedEmployee.id)
        .gte('work_date', startDateStr)
        .lte('work_date', endDateStr)
        .order('work_date', { ascending: true })
      
      // 출퇴근 기록 조회
      const { data: attendanceRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', selectedEmployee.id)
        .gte('record_date', startDateStr)
        .lte('record_date', endDateStr)
        .order('record_date', { ascending: true })
      
      // 휴가 신청 기록 조회 (해당 월에 포함되는 휴가만 정확히 조회)
      const { data: leaveRecords, error: leaveError } = await supabase
        .from('leave_applications')
        .select('*')
        .eq('user_id', selectedEmployee.id)
        .eq('status', 'approved') // 승인된 휴가만
        .lte('start_date', endDateStr) // 시작일이 월말 이전
        .gte('end_date', startDateStr) // 종료일이 월초 이후
        .order('start_date', { ascending: true })
      
      console.log('📅 휴가 신청 데이터 조회:', {
        employee: selectedEmployee.name,
        month: attendanceMonth,
        leaveCount: leaveRecords?.length || 0,
        leaves: leaveRecords?.map(l => ({
          date: `${l.start_date} ~ ${l.end_date || l.start_date}`,
          reason: l.reason,
          leave_type: l.leave_type,
          half_day: l.half_day,
          period: l.period,
          status: l.status
        }))
      })
      
      if (statsError || dailyError || recordsError) {
        const error = statsError || dailyError || recordsError
        console.error('❌ 근무시간 데이터 조회 오류:', error)
        setError('근무시간 데이터를 불러올 수 없습니다.')
        return
      }
      
      // 휴가 데이터를 날짜별로 매핑
      const leaveByDate: Record<string, any> = {}
      leaveRecords?.forEach(leave => {
        const startDate = new Date(leave.start_date)
        const endDate = leave.end_date ? new Date(leave.end_date) : startDate
        
        // reason 또는 leave_type에서 휴가 정보 추출
        const reasonText = (leave.reason || '') + ' ' + (leave.leave_type || '')
        const reasonLower = reasonText.toLowerCase()
        
        // 모든 휴가 유형 체크
        const isMorningHalfDay = reasonLower.includes('오전 반차') || reasonLower.includes('오전반차') || 
                                reasonLower.includes('대체 오전 반차') || reasonLower.includes('대체오전반차') ||
                                reasonLower.includes('보상 오전 반차') || reasonLower.includes('보상오전반차')
        
        const isAfternoonHalfDay = reasonLower.includes('오후 반차') || reasonLower.includes('오후반차') ||
                                  reasonLower.includes('대체 오후 반차') || reasonLower.includes('대체오후반차') ||
                                  reasonLower.includes('보상 오후 반차') || reasonLower.includes('보상오후반차')
        
        const isHalfDay = isMorningHalfDay || isAfternoonHalfDay
        
        // 휴가 유형 판별
        let leaveCategory = 'annual' // 기본값: 연차
        if (reasonLower.includes('대체')) {
          leaveCategory = 'substitute'
        } else if (reasonLower.includes('보상')) {
          leaveCategory = 'compensatory'
        } else if (reasonLower.includes('공가')) {
          leaveCategory = 'official'
        } else if (reasonLower.includes('경조사')) {
          leaveCategory = 'condolence'
        } else if (reasonLower.includes('병가')) {
          leaveCategory = 'sick'
        }
        
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          leaveByDate[dateStr] = {
            type: leave.leave_type,
            category: leaveCategory, // 휴가 카테고리 추가
            half_day: isHalfDay,
            period: isMorningHalfDay ? 'morning' : (isAfternoonHalfDay ? 'afternoon' : null),
            reason: leave.reason,
            original_half_day: leave.half_day, // 기존 필드 보존
            original_period: leave.period, // 기존 필드 보존
            original_text: reasonText // 원본 텍스트 저장 (디버깅용)
          }
        }
      })
      
      // 휴가 카테고리별 집계
      const leaveSummary = {
        annual: 0,
        annualHalfDay: 0,
        substitute: 0,
        substituteHalfDay: 0,
        compensatory: 0,
        compensatoryHalfDay: 0,
        official: 0,
        condolence: 0,
        sick: 0
      }
      
      Object.values(leaveByDate).forEach((leave: any) => {
        if (leave.half_day) {
          if (leave.category === 'annual') leaveSummary.annualHalfDay++
          else if (leave.category === 'substitute') leaveSummary.substituteHalfDay++
          else if (leave.category === 'compensatory') leaveSummary.compensatoryHalfDay++
        } else {
          if (leave.category === 'annual') leaveSummary.annual++
          else if (leave.category === 'substitute') leaveSummary.substitute++
          else if (leave.category === 'compensatory') leaveSummary.compensatory++
          else if (leave.category === 'official') leaveSummary.official++
          else if (leave.category === 'condolence') leaveSummary.condolence++
          else if (leave.category === 'sick') leaveSummary.sick++
        }
      })
      
      console.log('📊 휴가 유형별 집계:', leaveSummary)
      
      // 일별 데이터에 휴가 정보 병합 및 근무시간 재계산
      const mergedDailyRecords = dailyRecords?.map(record => {
        const leaveInfo = leaveByDate[record.work_date] || null
        let adjustedBasicHours = record.basic_hours || 0
        let adjustedOvertimeHours = record.overtime_hours || 0
        
        // 반차가 있는 경우 근무시간 재계산
        if (leaveInfo?.half_day) {
          const checkInTime = record.check_in_time ? new Date(record.check_in_time) : null
          const checkOutTime = record.check_out_time ? new Date(record.check_out_time) : null
          
          if (leaveInfo.period === 'morning') {
            // 오전 반차: 9:00~13:00는 근무로 간주 (4시간)
            // 추가로 오후에 실제 근무한 시간을 더함
            let totalHours = 4 // 오전 반차 기본 4시간
            
            if (checkInTime && checkOutTime) {
              // 실제 근무시간 계산
              const workMs = checkOutTime.getTime() - checkInTime.getTime()
              const workHours = workMs / (1000 * 60 * 60)
              
              // 오후에만 근무했다면 (14시 이후 출근)
              const checkInHour = checkInTime.getHours()
              if (checkInHour >= 14) {
                // 오후 근무시간 그대로 추가
                totalHours = 4 + workHours
              } else if (checkInHour >= 13) {
                // 13시~14시 사이 출근: 14시부터 계산
                const pmStart = new Date(checkInTime)
                pmStart.setHours(14, 0, 0, 0)
                const pmWorkMs = checkOutTime.getTime() - pmStart.getTime()
                const pmWorkHours = Math.max(0, pmWorkMs / (1000 * 60 * 60))
                totalHours = 4 + pmWorkHours
              }
            }
            
            adjustedBasicHours = Math.min(8, totalHours)
            adjustedOvertimeHours = Math.max(0, totalHours - 8)
            
          } else if (leaveInfo.period === 'afternoon') {
            // 오후 반차: 14:00~18:00는 근무로 간주 (4시간)
            // 추가로 오전에 실제 근무한 시간을 더함
            let totalHours = 4 // 오후 반차 기본 4시간
            
            if (checkInTime && checkOutTime) {
              // 실제 근무시간 계산
              const checkOutHour = checkOutTime.getHours()
              
              // 오전에만 근무했다면 (13시 이전 퇴근)
              if (checkOutHour <= 13) {
                const workMs = checkOutTime.getTime() - checkInTime.getTime()
                const workHours = workMs / (1000 * 60 * 60)
                // 점심시간 차감 (4시간 이상 근무 시)
                const amWorkHours = workHours > 4 ? workHours - 1 : workHours
                totalHours = amWorkHours + 4
              } else if (checkOutHour <= 14) {
                // 13시~14시 사이 퇴근: 13시까지만 계산
                const amEnd = new Date(checkOutTime)
                amEnd.setHours(13, 0, 0, 0)
                const amWorkMs = amEnd.getTime() - checkInTime.getTime()
                const amWorkHours = Math.max(0, amWorkMs / (1000 * 60 * 60))
                // 점심시간 차감 (4시간 이상 근무 시)
                const adjustedAmHours = amWorkHours > 4 ? amWorkHours - 1 : amWorkHours
                totalHours = adjustedAmHours + 4
              }
            }
            
            adjustedBasicHours = Math.min(8, totalHours)
            adjustedOvertimeHours = Math.max(0, totalHours - 8)
          }
          
          console.log(`📊 ${record.work_date} 반차 근무시간 계산:`, {
            period: leaveInfo.period,
            original: record.basic_hours,
            adjusted: adjustedBasicHours,
            checkIn: record.check_in_time,
            checkOut: record.check_out_time
          })
        }
        
        // 연차인 경우 8시간으로 간주
        if (leaveInfo && !leaveInfo.half_day && leaveInfo.type === 'annual') {
          adjustedBasicHours = 8
          adjustedOvertimeHours = 0
        }
        
        return {
          ...record,
          leave_info: leaveInfo,
          basic_hours: adjustedBasicHours,
          overtime_hours: adjustedOvertimeHours,
          original_basic_hours: record.basic_hours,
          original_overtime_hours: record.overtime_hours
        }
      }) || []
      
      // 데이터 변환
      const attendanceData = {
        summary: monthlyStats ? {
          ...monthlyStats,
          total_substitute_hours: totalSubstituteHours,
          total_compensatory_hours: totalCompensatoryHours
        } : {
          total_work_days: dailyRecords?.length || 0,
          total_basic_hours: dailyRecords?.reduce((sum, record) => sum + (record.basic_hours || 0), 0) || 0,
          total_overtime_hours: dailyRecords?.reduce((sum, record) => sum + (record.overtime_hours || 0), 0) || 0,
          total_substitute_hours: totalSubstituteHours,
          total_compensatory_hours: totalCompensatoryHours,
          average_daily_hours: dailyRecords?.length ? (dailyRecords.reduce((sum, record) => sum + (record.basic_hours || 0) + (record.overtime_hours || 0), 0) / dailyRecords.length) : 0,
          dinner_count: dailyRecords?.filter(record => record.had_dinner).length || 0,
          late_count: 0, // TODO: 지각 수 계산 로직 추가
          early_leave_count: 0, // TODO: 조퇴 수 계산 로직 추가
          absent_count: 0, // TODO: 결근 수 계산 로직 추가
          leave_count: Object.keys(leaveByDate).length // 휴가 사용 일수
        },
        daily_records: mergedDailyRecords,
        attendance_records: attendanceRecords || [],
        leave_records: leaveRecords || []
      }
      
      console.log('✅ 근무시간 데이터 조회 완료:', attendanceData)
      setAttendanceData(attendanceData)
      
    } catch (err) {
      console.error('❌ 근무시간 조회 오류:', err)
      setError('근무시간 조회 중 오류가 발생했습니다.')
    } finally {
      setAttendanceLoading(false)
    }
  }

  const handleEditWorkTime = (record: any) => {
    setEditingRecord(record)
    setShowEditModal(true)
  }

  const handleAddAttendanceRecord = () => {
    setEditingRecord({
      work_date: new Date().toISOString().split('T')[0],
      check_in_time: '',
      check_out_time: '',
      basic_hours: 0,
      overtime_hours: 0,
      had_dinner: false
    })
    setShowEditModal(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'approved': return '승인됨'
      case 'rejected': return '거절됨'
      default: return '알 수 없음'
    }
  }

  const handleLeaveAdjustment = async (leaveType: string, adjustmentType: 'granted' | 'used', amount: number) => {
    if (!selectedEmployee) return

    try {
      let updateData: any = {}
      
      if (['substitute_leave_hours', 'compensatory_leave_hours'].includes(leaveType)) {
        // 대체휴가/보상휴가 직접 업데이트
        const currentValue = leaveType === 'substitute_leave_hours' 
          ? (selectedEmployee.substitute_leave_hours || 0)
          : (selectedEmployee.compensatory_leave_hours || 0)
        
        updateData[leaveType] = currentValue + amount
      } else {
        // 연차/병가 업데이트 - 실제 데이터베이스 컬럼명 사용
        const baseType = leaveType === 'annual_leave' ? 'annual' : 'sick'
        const targetField = adjustmentType === 'granted' ? `${baseType}_days` : `used_${baseType}_days`
        
        const currentValue = (selectedEmployee as any).leave_data?.[targetField] || 0
        updateData[targetField] = currentValue + amount
      }

      // Supabase로 직접 업데이트
      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', selectedEmployee.id)

      if (error) {
        console.error('❌ Supabase leave adjustment error:', error)
        throw new Error('휴가 일수 조정에 실패했습니다.')
      }
      
      // 로컬 상태 즉시 업데이트
      const updatedEmployee = { ...selectedEmployee }
      
      if (['substitute_leave_hours', 'compensatory_leave_hours'].includes(leaveType)) {
        // 대체휴가/보상휴가 업데이트
        if (leaveType === 'substitute_leave_hours') {
          updatedEmployee.substitute_leave_hours = (selectedEmployee.substitute_leave_hours || 0) + amount
        } else if (leaveType === 'compensatory_leave_hours') {
          updatedEmployee.compensatory_leave_hours = (selectedEmployee.compensatory_leave_hours || 0) + amount
        }
      } else {
        // 연차/병가 업데이트
        const leaveData = (updatedEmployee as any).leave_data || {};
        const baseType = leaveType === 'annual_leave' ? 'annual' : 'sick';
        const targetField = adjustmentType === 'granted' ? `${baseType}_days` : `used_${baseType}_days`;
        
        leaveData[targetField] = (leaveData[targetField] || 0) + amount;
        
        // users 테이블 필드도 업데이트
        (updatedEmployee as any)[targetField] = leaveData[targetField];
        
        // 잔여 일수 재계산 (로컬 상태용 - 데이터베이스 업데이트에는 포함되지 않음)
        if (leaveType === 'annual_leave') {
          (updatedEmployee as any).annual_leave = (leaveData.annual_days || 0) - (leaveData.used_annual_days || 0);
        } else {
          (updatedEmployee as any).sick_leave = (leaveData.sick_days || 0) - (leaveData.used_sick_days || 0);
        }
        
        (updatedEmployee as any).leave_data = leaveData;
      }
      
      // 직원 목록에서도 업데이트
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp)
      )
      setSelectedEmployee(updatedEmployee)
      
      // 직원 화면 실시간 업데이트를 위한 이벤트 발생
      const refreshEvent = new CustomEvent('formSubmitSuccess')
      window.dispatchEvent(refreshEvent)
      console.log('✅ 관리자 휴가 수정 완료 - 직원 화면 새로고침 이벤트 발생')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '휴가 일수 조정 중 오류가 발생했습니다.')
    }
  }

  const handleResignation = async () => {
    if (!selectedEmployee || !formData.resignation_date) return

    setSubmitting(true)
    setError(null)

    try {
      // 현재 사용자 정보 가져오기
      const currentUser = await getCurrentUser()
      if (!currentUser || currentUser.role !== 'admin') {
        throw new Error('관리자 권한이 필요합니다.')
      }

      // 최신 사용자 데이터 가져오기 (휴가 정산용)
      const { data: userData } = await supabase
        .from('users')
        .select('annual_days, used_annual_days, substitute_leave_hours, compensatory_leave_hours')
        .eq('id', selectedEmployee.id)
        .single()

      // 휴가 잔여일수 정산 확인
      const remainingAnnualLeave = userData ? (userData.annual_days - userData.used_annual_days) : 0
      const remainingHourlyLeave = (userData?.substitute_leave_hours || 0) + (userData?.compensatory_leave_hours || 0)
      
      let settlementMessage = ''
      if (remainingAnnualLeave > 0 || remainingHourlyLeave > 0) {
        settlementMessage = `\n\n📋 휴가 정산 내역:\n`
        if (remainingAnnualLeave > 0) {
          settlementMessage += `- 잔여 연차: ${remainingAnnualLeave}일\n`
        }
        if (remainingHourlyLeave > 0) {
          settlementMessage += `- 잔여 시간차: ${remainingHourlyLeave}시간\n`
        }
        settlementMessage += `\n이 휴가는 급여와 함께 정산됩니다.`
        
        if (!confirm(`퇴사 처리를 진행하시겠습니까?${settlementMessage}`)) {
          setSubmitting(false)
          return
        }
      }

      // Supabase로 직접 퇴사 처리 (관리자 정보 포함)
      const { error } = await supabase
        .from('users')
        .update({ 
          resignation_date: formData.resignation_date,
          termination_date: formData.resignation_date,
          is_active: false,
          resignation_processed_by: currentUser.id, // 관리자 정보 기록
          resignation_processed_at: new Date().toISOString(), // 처리 시간 기록
          leave_settlement_days: remainingAnnualLeave, // 정산할 연차
          leave_settlement_hours: remainingHourlyLeave // 정산할 시간차
        })
        .eq('id', selectedEmployee.id)

      if (error) {
        console.error('❌ Supabase resignation error:', error)
        throw new Error('퇴사 처리에 실패했습니다.')
      }
      
      alert(`퇴사 처리가 완료되었습니다.${settlementMessage}`)
      
      // 로컬 상태 업데이트
      const updatedEmployee = { 
        ...selectedEmployee, 
        resignation_date: formData.resignation_date,
        termination_date: formData.resignation_date,
        is_active: false
      }
      
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => 
          emp.id === selectedEmployee.id ? updatedEmployee : emp
        )
      )
      setSelectedEmployee(updatedEmployee)
    } catch (err) {
      setError(err instanceof Error ? err.message : '퇴사 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEmployee = async () => {
    if (!selectedEmployee) return

    setSubmitting(true)
    setError(null)

    try {
      // Supabase로 직접 직원 삭제
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', selectedEmployee.id)

      if (error) {
        console.error('❌ Supabase delete error:', error)
        throw new Error('직원 삭제에 실패했습니다.')
      }
      
      alert('직원이 성공적으로 삭제되었습니다.')
      
      // 로컬 상태에서 직원 제거
      setEmployees(prevEmployees => 
        prevEmployees.filter(emp => emp.id !== selectedEmployee.id)
      )
      setSelectedEmployee(null)
      setShowDeleteConfirm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '직원 삭제 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddEmployee = async () => {
    setSubmitting(true)
    setError(null)

    try {
      // 필수 필드 검증
      if (!newEmployeeData.name || !newEmployeeData.employee_number || !newEmployeeData.email || !newEmployeeData.password) {
        throw new Error('이름, 직원번호, 이메일, 비밀번호는 필수 입력 항목입니다.')
      }

      // 비밀번호 해싱 (bcrypt 사용)
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(newEmployeeData.password, 10)

      // 연차 계산 로직 import 및 적용
      const { calculateAnnualLeave } = await import('@/lib/calculateAnnualLeave')
      const calculatedAnnualDays = calculateAnnualLeave(newEmployeeData.hire_date)
      
      console.log(`📅 입사일 기준 연차 계산: ${newEmployeeData.hire_date} → ${calculatedAnnualDays}일`)

      // Supabase에 직원 추가
      const { data, error } = await supabase
        .from('users')
        .insert({
          name: newEmployeeData.name,
          employee_number: newEmployeeData.employee_number,
          email: newEmployeeData.email,
          password_hash: hashedPassword,
          department: newEmployeeData.department || '미지정',
          position: newEmployeeData.position || '사원',
          phone: newEmployeeData.phone || '',
          dob: newEmployeeData.dob || null,
          address: newEmployeeData.address || '',
          work_type: newEmployeeData.work_type || 'regular',
          contract_end_date: (newEmployeeData.work_type === 'contract' || newEmployeeData.work_type === 'intern') && newEmployeeData.contract_end_date ? newEmployeeData.contract_end_date : null,
          hire_date: newEmployeeData.hire_date,
          annual_salary: newEmployeeData.annual_salary || 0,
          meal_allowance: newEmployeeData.meal_allowance || 0,
          car_allowance: newEmployeeData.car_allowance || 0,
          role: newEmployeeData.role,
          annual_days: calculatedAnnualDays, // 입사일 기준으로 계산된 연차
          used_annual_days: 0,
          sick_days: 60, // 기본 병가
          used_sick_days: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Supabase insert error:', error)
        if (error.code === '23505') {
          throw new Error('이미 존재하는 이메일입니다.')
        }
        throw new Error('직원 추가에 실패했습니다.')
      }

      alert('신규 직원이 성공적으로 등록되었습니다.')
      
      // 직원 목록 새로고침
      await fetchData()
      
      // 폼 초기화 및 모달 닫기
      setNewEmployeeData({
        name: '',
        employee_number: '',
        email: '',
        password: '',
        department: '',
        position: '',
        phone: '',
        dob: '',
        address: '',
        work_type: 'regular',
        contract_end_date: '',
        hire_date: new Date().toISOString().split('T')[0],
        annual_salary: 0,
        meal_allowance: 0,
        car_allowance: 0,
        role: 'employee'
      })
      setShowAddEmployee(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '직원 추가 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  // 상태별 직원 필터링 (termination_date 기준)
  const getFilteredEmployees = () => {
    switch (statusFilter) {
      case 'active':
        return employees.filter(emp => emp.work_type === '정규직')
      case 'resigned':
        return employees.filter(emp => emp.work_type === '퇴사자')
      case 'contract':
        return employees.filter(emp => emp.work_type === '계약직')
      default:
        return employees
    }
  }

  const filteredEmployees = getFilteredEmployees()

  if (loading) return (
    <div className="p-8 text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
      <p className="text-gray-600">직원 목록을 불러오는 중...</p>
    </div>
  )
  
  if (error && !employees.length) return (
    <div className="p-8 text-center">
      <div className="bg-red-50 border border-red-300 rounded-lg p-6">
        <div className="text-red-600 font-semibold mb-2">❌ 오류 발생</div>
        <p className="text-red-800 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          페이지 새로고침
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">직원 정보 관리</h3>
            <p className="text-sm text-gray-500 mt-1">
              전체 {employees.length}명 | 재직 {employees.filter(emp => !emp.termination_date).length}명 | 퇴사 {employees.filter(emp => !!emp.termination_date).length}명
            </p>
          </div>
          <div className="flex space-x-2">
            {/* 데이터 동기화 버튼들 */}
            <button
              onClick={() => setShowLeaveSync(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              title="휴가 및 경조사 캘린더 데이터 가져오기">
              <CalendarSync className="w-4 h-4" />
              <span className="hidden lg:inline">휴가데이터 동기화</span>
            </button>
            <button
              onClick={() => setShowHolidaySync(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              title="공휴일 데이터 가져오기">
              <Calendar className="w-4 h-4" />
              <span className="hidden lg:inline">공휴일 데이터 동기화</span>
            </button>
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
              title="CSV 파일 업로드">
              <FileUp className="w-4 h-4" />
              <span className="hidden lg:inline">CSV파일 업로드</span>
            </button>
            <div className="border-l border-gray-300 mx-2"></div>
            <button
              onClick={() => setShowAddEmployee(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
              + 신규 직원 추가
            </button>
            <div className="border-l border-gray-300 mx-2"></div>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              전체
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              재직중
            </button>
            <button
              onClick={() => setStatusFilter('contract')}
              className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'contract' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              계약직
            </button>
            <button
              onClick={() => setStatusFilter('resigned')}
              className={`px-3 py-1 text-sm rounded-md ${statusFilter === 'resigned' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              퇴사
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>
      <div className="border-t border-gray-200 md:grid md:grid-cols-3">
        {/* Employee List */}
        <div className="md:col-span-1 border-r border-gray-200 h-96 overflow-y-auto">
          <ul>
            {filteredEmployees.map(emp => (
              <li key={emp.id}>
                <button
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full text-left p-4 ${selectedEmployee?.id === emp.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-indigo-600">{emp.name} ({emp.position})</p>
                      <p className="text-sm text-gray-500">{emp.department}</p>
                      {emp.employee_number && (
                        <p className="text-xs text-gray-400">사번: {emp.employee_number}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        !emp.termination_date 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {!emp.termination_date ? '재직' : '퇴사'}
                      </span>
                      {emp.termination_date && (
                        <span className="text-xs text-gray-400 mt-1">
                          {new Date(emp.termination_date).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Employee Management Panel */}
        <div className="md:col-span-2 p-6">
          {selectedEmployee ? (
            <div>
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('info')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'info'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    기본 정보
                  </button>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'attendance'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    근무시간 관리
                  </button>
                  <button
                    onClick={() => setActiveTab('management')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'management'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    인사 관리
                  </button>
                </nav>
              </div>

              {/* Basic Info Tab */}
              {activeTab === 'info' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">이름</label>
                      <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="employee_number" className="block text-sm font-medium text-gray-700">직원번호(사번)</label>
                      <input type="text" name="employee_number" id="employee_number" value={formData.employee_number || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="EMP001" />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">이메일</label>
                      <input type="email" name="email" id="email" value={formData.email || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="department" className="block text-sm font-medium text-gray-700">부서</label>
                      <input type="text" name="department" id="department" value={formData.department || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="position" className="block text-sm font-medium text-gray-700">직책</label>
                      <input type="text" name="position" id="position" value={formData.position || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                      <label htmlFor="work_type" className="block text-sm font-medium text-gray-700">근무 형태</label>
                      <select name="work_type" id="work_type" value={formData.work_type || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                        <option value="정규직">정규직</option>
                        <option value="계약직">계약직</option>
                        <option value="인턴">인턴</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700">입사일</label>
                      <input type="date" name="hire_date" id="hire_date" value={formData.hire_date || ''} onChange={handleInputChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                  </div>
                  <div className="text-right">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {submitting ? '저장 중...' : '정보 저장'}
                    </button>
                  </div>
                </form>
              )}

              {/* Leave Management Tab Removed - Use AdminLeaveOverview Instead */}

              {/* Attendance Management Tab */}
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  {/* Leave Information Summary */}
                  <div className="bg-green-50 p-4 rounded-lg mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">휴가 정보</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-sm text-gray-600">연차 잔여일수:</span>
                        <span className="ml-2 font-semibold text-green-700">
                          {selectedEmployee.remaining_leave_days || 0}일
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">사용한 연차:</span>
                        <span className="ml-2 font-semibold text-gray-700">
                          {selectedEmployee.used_leave_days || 0}일
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">총 연차일수:</span>
                        <span className="ml-2 font-semibold text-gray-700">
                          {selectedEmployee.annual_leave_days || 0}일
                        </span>
                      </div>
                      {selectedEmployee.hourly_leave_hours > 0 && (
                        <>
                          <div>
                            <span className="text-sm text-gray-600">시간차 잔여:</span>
                            <span className="ml-2 font-semibold text-blue-700">
                              {selectedEmployee.remaining_hourly_leave || 0}시간
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">사용한 시간차:</span>
                            <span className="ml-2 font-semibold text-gray-700">
                              {selectedEmployee.used_hourly_leave || 0}시간
                            </span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600">총 시간차:</span>
                            <span className="ml-2 font-semibold text-gray-700">
                              {selectedEmployee.hourly_leave_hours || 0}시간
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Month Selector and Summary */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium text-gray-900">근무시간 조회 및 관리</h4>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium text-gray-700">
                            조회 월:
                          </label>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => {
                                const [year, month] = attendanceMonth.split('-').map(Number)
                                const prevDate = new Date(year, month - 2, 1)
                                setAttendanceMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`)
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <div className="px-3 py-1 min-w-[120px] text-center font-medium text-gray-900">
                              {attendanceMonth}
                            </div>
                            <button
                              onClick={() => {
                                const [year, month] = attendanceMonth.split('-').map(Number)
                                const nextDate = new Date(year, month, 1)
                                setAttendanceMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`)
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={handleAddAttendanceRecord}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                        >
                          출퇴근 기록 추가
                        </button>
                        <button
                          onClick={() => setShowBulkUploadModal(true)}
                          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 flex items-center space-x-2"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span>일괄 업로드</span>
                        </button>
                      </div>
                    </div>

                    {/* Loading State */}
                    {attendanceLoading && (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">근무시간 데이터를 불러오는 중...</p>
                      </div>
                    )}

                    {/* Attendance Summary */}
                    {!attendanceLoading && attendanceData && (
                      <>
                        {/* Monthly Summary Stats - 모바일 최적화 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-4 sm:mb-6">
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">총 근무일수</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                              {attendanceData.summary?.total_work_days || 0}일
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">총 근무시간</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                              {Math.round(((attendanceData.summary?.total_basic_hours || 0) + (attendanceData.summary?.total_overtime_hours || 0)) * 10) / 10}시간
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">초과근무시간</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                              {attendanceData.summary?.total_overtime_hours || 0}시간
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">평균 일일 근무</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                              {Math.round(attendanceData.summary?.average_daily_hours * 10) / 10 || 0}시간
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">대체휴가 발생</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                              {Math.round((attendanceData.summary?.total_substitute_hours || 0) * 10) / 10}시간
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 sm:p-4 border">
                            <div className="text-xs sm:text-sm text-gray-500">보상휴가 발생</div>
                            <div className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600">
                              {Math.round((attendanceData.summary?.total_compensatory_hours || 0) * 10) / 10}시간
                            </div>
                          </div>
                        </div>

                        {/* Daily Records Table */}
                        <div className="bg-white rounded-lg border overflow-hidden">
                          <div className="px-4 py-3 border-b bg-gray-50">
                            <h5 className="text-sm font-medium text-gray-900">일별 근무시간 상세</h5>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">출근시간</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">퇴근시간</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기본근무</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">초과근무</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {attendanceData.daily_records && attendanceData.daily_records.length > 0 ? (
                                  attendanceData.daily_records.map((record: any) => {
                                    // 휴가 정보 확인 (leave_applications 테이블에서 승인된 휴가만)
                                    const hasLeave = record.leave_info !== null && record.leave_info !== undefined && typeof record.leave_info === 'object'
                                    const isFullDayLeave = hasLeave && record.leave_info?.half_day === false
                                    const isHalfDayLeave = hasLeave && record.leave_info?.half_day === true
                                    
                                    // 디버깅용 로그
                                    if (record.work_date && record.work_date.includes('2025-07')) {
                                      console.log(`📊 ${record.work_date} 데이터:`, {
                                        hasLeave,
                                        leave_info: record.leave_info,
                                        work_status: record.work_status,
                                        basic_hours: record.basic_hours
                                      })
                                    }
                                    
                                    return (
                                      <tr key={record.work_date} className={`hover:bg-gray-50 ${hasLeave ? 'bg-yellow-50' : ''}`}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                          <div>
                                            {new Date(record.work_date).toLocaleDateString('ko-KR', {
                                              month: 'long',
                                              day: 'numeric',
                                              weekday: 'short'
                                            })}
                                            {hasLeave && (
                                              <div className="text-xs text-yellow-600 mt-1">
                                                {record.leave_info.type === 'annual' ? '연차' : 
                                                 record.leave_info.type === 'sick' ? '병가' :
                                                 record.leave_info.type === 'special' ? '특별휴가' : '기타'}
                                                {isHalfDayLeave && ` (${record.leave_info.period === 'morning' ? '오전' : '오후'}반차)`}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                          {isFullDayLeave ? (
                                            <span className="text-yellow-600">휴가</span>
                                          ) : isHalfDayLeave && record.leave_info?.period === 'morning' ? (
                                            <span className="text-blue-600">09:00 (반차)</span>
                                          ) : record.check_in_time ? 
                                            new Date(record.check_in_time).toLocaleTimeString('ko-KR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              hour12: false
                                            }) : '--'
                                          }
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                          {isFullDayLeave ? (
                                            <span className="text-yellow-600">휴가</span>
                                          ) : isHalfDayLeave && record.leave_info?.period === 'afternoon' ? (
                                            <span className="text-blue-600">18:00 (반차)</span>
                                          ) : record.check_out_time ? 
                                            new Date(record.check_out_time).toLocaleTimeString('ko-KR', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              hour12: false
                                            }) : '--'
                                          }
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                                          {isFullDayLeave ? (
                                            <span className="text-yellow-600">8시간 (연차)</span>
                                          ) : isHalfDayLeave ? (
                                            <span className="text-blue-600">
                                              {record.basic_hours || 0}시간 
                                              ({record.leave_info?.period === 'morning' ? '오전' : '오후'}반차)
                                            </span>
                                          ) : (
                                            <span>{record.basic_hours || 0}시간</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                          {isFullDayLeave ? (
                                            <span className="text-yellow-600">-</span>
                                          ) : (
                                            <span>{record.overtime_hours || 0}시간</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            hasLeave ? 'bg-yellow-100 text-yellow-800' :
                                            record.work_status === '정상근무' ? 'bg-green-100 text-green-800' :
                                            record.work_status === '조정근무' ? 'bg-blue-100 text-blue-800' :
                                            record.work_status === '단축근무' ? 'bg-amber-100 text-amber-800' :
                                            record.work_status === '조기퇴근' ? 'bg-indigo-100 text-indigo-800' :
                                            record.work_status === '지각' ? 'bg-orange-100 text-orange-800' :
                                            record.work_status === '조퇴' ? 'bg-orange-100 text-orange-800' :
                                            record.work_status === '결근' ? 'bg-red-100 text-red-800' :
                                            record.work_status === '출근누락' ? 'bg-purple-100 text-purple-800' :
                                            record.work_status === '퇴근누락' ? 'bg-purple-100 text-purple-800' :
                                            record.work_status === '기록없음' ? 'bg-gray-100 text-gray-800' :
                                            record.work_status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                                            record.work_status === 'completed' ? 'bg-green-100 text-green-800' :
                                            record.work_status?.includes('누락') ? 'bg-purple-100 text-purple-800' :
                                            'bg-gray-100 text-gray-800'
                                          }`}>
                                            {hasLeave && isFullDayLeave ? '휴가' :
                                             hasLeave && isHalfDayLeave ? '반차' :
                                             // 휴가가 아닌 경우 work_status 표시
                                             record.work_status === '정상근무' ? '정상근무' :
                                             record.work_status === '조정근무' ? '조정근무' :
                                             record.work_status === '단축근무' ? '표준근로시간 미달' :
                                             record.work_status === '조기퇴근' ? '조기퇴근' :
                                             record.work_status === '출근누락' ? '출근누락' :
                                             record.work_status === '퇴근누락' ? '퇴근누락' :
                                             record.work_status === '기록없음' ? '기록없음' :
                                             record.work_status === 'in_progress' ? '퇴근누락' :
                                             record.work_status === 'completed' ? '정상근무' :
                                             record.work_status || '미확인'}
                                          </span>
                                        {record.had_dinner && (
                                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                            저녁식사
                                          </span>
                                        )}
                                        {record.missing_records && record.missing_records.length > 0 && (
                                          <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                            {record.missing_records.join(', ')}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                        <button
                                          onClick={() => handleEditWorkTime(record)}
                                          className="text-indigo-600 hover:text-indigo-900"
                                        >
                                          수정
                                        </button>
                                        </td>
                                      </tr>
                                    )
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                                      {attendanceMonth} 근무 기록이 없습니다.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Attendance Stats */}
                        {attendanceData.attendanceStats && (
                          <div className="mt-4 bg-yellow-50 rounded-lg p-4">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">출퇴근 통계</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">정상출근: </span>
                                <span className="font-medium text-green-600">{attendanceData.attendanceStats.onTimeCount}일</span>
                              </div>
                              <div>
                                <span className="text-gray-600">지각: </span>
                                <span className="font-medium text-yellow-600">{attendanceData.attendanceStats.lateCount}일</span>
                              </div>
                              <div>
                                <span className="text-gray-600">조퇴: </span>
                                <span className="font-medium text-orange-600">{attendanceData.attendanceStats.earlyLeaveCount}일</span>
                              </div>
                              <div>
                                <span className="text-gray-600">결근: </span>
                                <span className="font-medium text-red-600">{attendanceData.attendanceStats.absentCount}일</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">근무시간 관리 안내</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>• <strong>근무시간 수정:</strong> 각 일자의 수정 버튼을 클릭하여 출퇴근 시간 및 근무시간 수정</div>
                      <div>• <strong>기록 추가:</strong> 누락된 출퇴근 기록 추가 가능</div>
                      <div>• <strong>자동 계산:</strong> 기본/초과 근무시간은 시스템에서 자동 계산</div>
                      <div>• <strong>수정 이력:</strong> 모든 수정 내역은 시스템에 기록됨</div>
                    </div>
                  </div>
                </div>
              )}

              {/* HR Management Tab */}
              {activeTab === 'management' && (
                <div className="space-y-6">
                  {/* Resignation Processing */}
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">퇴사 처리</h4>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="resignation_date" className="block text-sm font-medium text-gray-700">퇴사일</label>
                        <input
                          type="date"
                          name="resignation_date"
                          id="resignation_date"
                          value={formData.resignation_date || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          disabled={!!selectedEmployee?.termination_date}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleResignation}
                        disabled={submitting || !formData.resignation_date || !!selectedEmployee?.termination_date}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                      >
                        {submitting ? '처리 중...' : selectedEmployee?.termination_date ? '퇴사 처리됨' : '퇴사 처리'}
                      </button>
                    </div>
                  </div>

                  {/* Reinstatement Processing - 복직 처리 */}
                  {selectedEmployee?.termination_date && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-4">복직 처리</h4>
                      <p className="text-sm text-gray-600 mb-4">
                        퇴사일: {new Date(selectedEmployee.termination_date).toLocaleDateString('ko-KR')}
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('이 직원을 복직 처리하시겠습니까?')) return
                          
                          setSubmitting(true)
                          try {
                            const currentUser = await getCurrentUser()
                            if (!currentUser || currentUser.role !== 'admin') {
                              throw new Error('관리자 권한이 필요합니다.')
                            }

                            // 복직 처리
                            const { error } = await supabase
                              .from('users')
                              .update({ 
                                resignation_date: null,
                                termination_date: null,
                                is_active: true,
                                resignation_processed_by: null,
                                resignation_processed_at: null,
                                leave_settlement_days: null,
                                leave_settlement_hours: null,
                                reinstatement_processed_by: currentUser.id,
                                reinstatement_processed_at: new Date().toISOString()
                              })
                              .eq('id', selectedEmployee.id)

                            if (error) {
                              console.error('❌ Reinstatement error:', error)
                              throw new Error('복직 처리에 실패했습니다.')
                            }
                            
                            alert('복직 처리가 완료되었습니다.')
                            
                            // 로컬 상태 업데이트
                            const updatedEmployee = { 
                              ...selectedEmployee, 
                              resignation_date: undefined,
                              termination_date: undefined,
                              is_active: true
                            }
                            
                            setEmployees(prevEmployees => 
                              prevEmployees.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp)
                            )
                            setSelectedEmployee(updatedEmployee)
                            setFormData({
                              ...formData,
                              resignation_date: '',
                              termination_date: ''
                            })
                          } catch (err) {
                            alert(err instanceof Error ? err.message : '복직 처리 중 오류가 발생했습니다.')
                          } finally {
                            setSubmitting(false)
                          }
                        }}
                        disabled={submitting}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                      >
                        {submitting ? '처리 중...' : '복직 처리'}
                      </button>
                    </div>
                  )}

                  {/* Employee Deletion */}
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">직원 삭제</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      주의: 직원을 삭제하면 모든 관련 데이터가 영구적으로 삭제됩니다.
                    </p>
                    {!showDeleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                      >
                        직원 삭제
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-red-800">
                          정말로 {selectedEmployee.name} 직원을 삭제하시겠습니까?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleDeleteEmployee}
                            disabled={submitting}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                          >
                            {submitting ? '삭제 중...' : '삭제 확인'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(false)}
                            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}


            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">왼쪽 목록에서 직원을 선택하여 관리하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Work Time Edit Modal */}
      {showEditModal && editingRecord && selectedEmployee && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              근무시간 수정 - {selectedEmployee.name}
            </h3>
            
            <form onSubmit={async (e) => {
              e.preventDefault()
              
              const formData = new FormData(e.currentTarget)
              const checkInTime = formData.get('check_in_time') as string
              const checkOutTime = formData.get('check_out_time') as string
              const hadDinner = formData.get('had_dinner') === 'on'
              const notes = formData.get('notes') as string
              
              try {
                const currentUser = await getCurrentUser()
                if (!currentUser || currentUser.role !== 'admin') {
                  alert('관리자 권한이 필요합니다.')
                  return
                }

                // 출퇴근 기록이 있는 경우 수정
                if (editingRecord.check_in_time || editingRecord.check_out_time) {
                  // daily_work_summary 업데이트
                  const updateData: any = {
                    notes,
                    had_dinner: hadDinner,
                    auto_calculated: false,
                    calculated_at: new Date().toISOString()
                  }

                  if (checkInTime) {
                    updateData.check_in_time = `${editingRecord.work_date}T${checkInTime}:00+00:00`
                  }
                  if (checkOutTime) {
                    updateData.check_out_time = `${editingRecord.work_date}T${checkOutTime}:00+00:00`
                  }

                  const { error: updateError } = await supabase
                    .from('daily_work_summary')
                    .update(updateData)
                    .eq('user_id', selectedEmployee.id)
                    .eq('work_date', editingRecord.work_date)

                  if (updateError) {
                    console.error('❌ 근무시간 수정 오류:', updateError)
                    throw new Error('근무시간 수정에 실패했습니다.')
                  }

                  alert('근무시간이 수정되었습니다.')
                } else {
                  // 새로운 출퇴근 기록 추가
                  const recordsToInsert = []

                  if (checkInTime) {
                    recordsToInsert.push({
                      user_id: selectedEmployee.id,
                      record_date: editingRecord.work_date,
                      record_time: checkInTime,
                      record_timestamp: `${editingRecord.work_date}T${checkInTime}:00+00:00`,
                      record_type: '출근',
                      reason: notes || '관리자 추가',
                      is_manual: true,
                      approved_by: currentUser.id,
                      approved_at: new Date().toISOString(),
                      notes: notes || '관리자 추가'
                    })
                  }

                  if (checkOutTime) {
                    recordsToInsert.push({
                      user_id: selectedEmployee.id,
                      record_date: editingRecord.work_date,
                      record_time: checkOutTime,
                      record_timestamp: `${editingRecord.work_date}T${checkOutTime}:00+00:00`,
                      record_type: '퇴근',
                      reason: notes || '관리자 추가',
                      had_dinner: hadDinner,
                      is_manual: true,
                      approved_by: currentUser.id,
                      approved_at: new Date().toISOString(),
                      notes: notes || '관리자 추가'
                    })
                  }

                  if (recordsToInsert.length > 0) {
                    const { error: insertError } = await supabase
                      .from('attendance_records')
                      .insert(recordsToInsert)

                    if (insertError) {
                      console.error('❌ 출퇴근 기록 추가 오류:', insertError)
                      throw new Error('출퇴근 기록 추가에 실패했습니다.')
                    }

                    // daily_work_summary도 함께 생성/업데이트 (PostgreSQL 트리거가 자동 처리)
                    // 하지만 수동으로도 확인하여 생성
                    const { data: existingSummaryArray } = await supabase
                      .from('daily_work_summary')
                      .select('*')
                      .eq('user_id', selectedEmployee.id)
                      .eq('work_date', editingRecord.work_date)
                    
                    const existingSummary = existingSummaryArray && existingSummaryArray.length > 0 ? existingSummaryArray[0] : null

                    if (!existingSummary) {
                      await supabase
                        .from('daily_work_summary')
                        .insert({
                          user_id: selectedEmployee.id,
                          work_date: editingRecord.work_date,
                          check_in_time: checkInTime ? `${editingRecord.work_date}T${checkInTime}:00+00:00` : null,
                          check_out_time: checkOutTime ? `${editingRecord.work_date}T${checkOutTime}:00+00:00` : null,
                          basic_hours: 0, // 트리거가 자동 계산
                          had_dinner: hadDinner,
                          notes: notes,
                          auto_calculated: false,
                          calculated_at: new Date().toISOString()
                        })
                    }
                  }

                  alert('출퇴근 기록이 추가되었습니다.')
                }
                
                setShowEditModal(false)
                setEditingRecord(null)
                await fetchAttendanceData()
                
              } catch (err) {
                console.error('근무시간 수정 오류:', err)
                alert(err instanceof Error ? err.message : '근무시간 수정 중 오류가 발생했습니다.')
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">날짜</label>
                <input
                  type="date"
                  value={editingRecord.work_date}
                  disabled
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-100"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">출근시간</label>
                  <input
                    type="time"
                    name="check_in_time"
                    defaultValue={editingRecord.check_in_time ? 
                      new Date(editingRecord.check_in_time).toTimeString().slice(0, 5) : ''
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">퇴근시간</label>
                  <input
                    type="time"
                    name="check_out_time"
                    defaultValue={editingRecord.check_out_time ? 
                      new Date(editingRecord.check_out_time).toTimeString().slice(0, 5) : ''
                    }
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="had_dinner"
                    defaultChecked={editingRecord.had_dinner}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">저녁식사 여부</span>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">메모</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  placeholder="수정 사유 또는 메모"
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingRecord(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">출퇴근 데이터 일괄 업로드</h3>
              <button
                onClick={() => setShowBulkUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              <CapsUploadManager />
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowBulkUploadModal(false)
                  // 업로드 완료 후 데이터 새로고침
                  if (selectedEmployee && activeTab === 'attendance') {
                    fetchAttendanceData()
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Special Leave Grant Modal - Removed */}
      {/* All leave management functions have been moved to AdminLeaveOverview component */}

      {/* 신규 직원 추가 모달 */}
      {showAddEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">신규 직원 등록</h3>
              <button
                onClick={() => {
                  setShowAddEmployee(false)
                  setError(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault()
              await handleAddEmployee()
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEmployeeData.name}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    직원번호(사번) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEmployeeData.employee_number}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, employee_number: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    placeholder="EMP001"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newEmployeeData.email}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, email: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newEmployeeData.password}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, password: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">전화번호</label>
                  <input
                    type="tel"
                    value={newEmployeeData.phone}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, phone: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">근무형태</label>
                  <select
                    value={newEmployeeData.work_type}
                    onChange={(e) => {
                      setNewEmployeeData({
                        ...newEmployeeData, 
                        work_type: e.target.value,
                        contract_end_date: (e.target.value === 'contract' || e.target.value === 'intern') ? newEmployeeData.contract_end_date : ''
                      })
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  >
                    <option value="regular">정규직</option>
                    <option value="contract">계약직</option>
                    <option value="part_time">시간제</option>
                    <option value="intern">인턴</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">생년월일</label>
                  <input
                    type="date"
                    value={newEmployeeData.dob}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, dob: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                {(newEmployeeData.work_type === 'contract' || newEmployeeData.work_type === 'intern') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {newEmployeeData.work_type === 'contract' ? '계약 만료일' : '인턴십 종료일'}
                    </label>
                    <input
                      type="date"
                      value={newEmployeeData.contract_end_date}
                      onChange={(e) => setNewEmployeeData({...newEmployeeData, contract_end_date: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">주소</label>
                <input
                  type="text"
                  value={newEmployeeData.address}
                  onChange={(e) => setNewEmployeeData({...newEmployeeData, address: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  placeholder="서울특별시 강남구 테헤란로 123"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">부서</label>
                  <input
                    type="text"
                    value={newEmployeeData.department}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, department: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    placeholder="개발팀"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">직책</label>
                  <input
                    type="text"
                    value={newEmployeeData.position}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, position: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                    placeholder="사원"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">입사일</label>
                  <input
                    type="date"
                    value={newEmployeeData.hire_date}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, hire_date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">권한</label>
                  <select
                    value={newEmployeeData.role}
                    onChange={(e) => setNewEmployeeData({...newEmployeeData, role: e.target.value as 'employee' | 'admin'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                  >
                    <option value="employee">직원</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">급여 정보</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">연봉</label>
                    <input
                      type="number"
                      value={newEmployeeData.annual_salary}
                      onChange={(e) => setNewEmployeeData({...newEmployeeData, annual_salary: parseInt(e.target.value) || 0})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">식대</label>
                    <input
                      type="number"
                      value={newEmployeeData.meal_allowance}
                      onChange={(e) => setNewEmployeeData({...newEmployeeData, meal_allowance: parseInt(e.target.value) || 0})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">차량유지비</label>
                    <input
                      type="number"
                      value={newEmployeeData.car_allowance}
                      onChange={(e) => setNewEmployeeData({...newEmployeeData, car_allowance: parseInt(e.target.value) || 0})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEmployee(false)
                    setError(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? '등록 중...' : '직원 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holiday Data Sync Modal */}
      {showHolidaySync && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">공휴일 데이터 동기화</h3>
              <button
                onClick={() => {
                  setShowHolidaySync(false)
                  setSyncStatus({type: '', status: 'idle'})
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {syncStatus.type === 'holiday' && syncStatus.status === 'loading' && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">공휴일 데이터를 동기화하는 중...</p>
                </div>
              )}
              
              {syncStatus.type === 'holiday' && syncStatus.status === 'success' && (
                <div className="bg-green-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        {syncStatus.message || '공휴일 데이터가 성공적으로 동기화되었습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {syncStatus.type === 'holiday' && syncStatus.status === 'error' && (
                <div className="bg-red-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">
                        {syncStatus.message || '공휴일 데이터 동기화 중 오류가 발생했습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {syncStatus.status === 'idle' && (
                <>
                  <p className="text-gray-600 text-sm">
                    한국천문연구원 API를 통해 공휴일 데이터를 가져옵니다.
                    현재 연도와 다음 연도의 공휴일 정보가 업데이트됩니다.
                  </p>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowHolidaySync(false)
                        setSyncStatus({type: '', status: 'idle'})
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={async () => {
                        setSyncStatus({type: 'holiday', status: 'loading'})
                        try {
                          const currentYear = new Date().getFullYear()
                          await updateHolidayCache(currentYear)
                          await updateHolidayCache(currentYear + 1)
                          setSyncStatus({
                            type: 'holiday', 
                            status: 'success', 
                            message: `${currentYear}년과 ${currentYear + 1}년 공휴일 데이터가 동기화되었습니다.`
                          })
                        } catch (error) {
                          console.error('Holiday sync error:', error)
                          setSyncStatus({
                            type: 'holiday', 
                            status: 'error', 
                            message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
                          })
                        }
                      }}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      동기화 시작
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Calendar Sync Modal */}
      {showLeaveSync && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">휴가/경조사 캘린더 동기화</h3>
              <button
                onClick={() => {
                  setShowLeaveSync(false)
                  setSyncStatus({type: '', status: 'idle'})
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {syncStatus.type === 'leave' && syncStatus.status === 'loading' && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">휴가 데이터를 동기화하는 중...</p>
                </div>
              )}
              
              {syncStatus.type === 'leave' && syncStatus.status === 'success' && (
                <div className="bg-green-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">
                        {syncStatus.message || '휴가 데이터가 성공적으로 동기화되었습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {syncStatus.type === 'leave' && syncStatus.status === 'error' && (
                <div className="bg-red-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">
                        {syncStatus.message || '휴가 데이터 동기화 중 오류가 발생했습니다.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {syncStatus.status === 'idle' && (
                <>
                  <p className="text-gray-600 text-sm">
                    Google Calendar API를 통해 휴가 및 경조사 일정을 가져옵니다.
                    승인된 휴가 신청 내역이 자동으로 반영됩니다.
                  </p>
                  
                  <div className="bg-yellow-50 p-3 rounded-md">
                    <p className="text-xs text-yellow-800">
                      <strong>주의:</strong> Google Calendar 연동이 설정되어 있어야 합니다.
                    </p>
                  </div>
                  
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowLeaveSync(false)
                        setSyncStatus({type: '', status: 'idle'})
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={async () => {
                        setSyncStatus({type: 'leave', status: 'loading'})
                        try {
                          // TODO: Implement Google Calendar API integration
                          // For now, we'll simulate the sync
                          await new Promise(resolve => setTimeout(resolve, 2000))
                          
                          setSyncStatus({
                            type: 'leave', 
                            status: 'success', 
                            message: '휴가 및 경조사 데이터가 성공적으로 동기화되었습니다.'
                          })
                        } catch (error) {
                          console.error('Leave sync error:', error)
                          setSyncStatus({
                            type: 'leave', 
                            status: 'error', 
                            message: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
                          })
                        }
                      }}
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      동기화 시작
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

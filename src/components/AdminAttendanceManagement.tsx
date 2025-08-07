'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Search, 
  Calendar, 
  Clock, 
  Edit, 
  Plus, 
  Download, 
  Filter,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Upload,
  Trash2
} from 'lucide-react'
import { getCurrentUser, checkPermission, type User as AuthUser } from '@/lib/auth'
import { useSupabase } from '@/components/SupabaseProvider'
import CapsUploadManager from './CapsUploadManager'
import CapsTestDataGenerator from './CapsTestDataGenerator'

interface Employee {
  id: string
  name: string
  department: string
  position: string
}

interface AttendanceRecord {
  id: string
  user_id: string
  record_date: string
  record_time: string
  record_type: '출근' | '퇴근' | '해제' | '세트' | '출입' // CAPS 호환
  reason?: string
  had_dinner?: boolean
  is_manual?: boolean
  source?: string // CAPS/WEB 구분
  users: {
    name: string
    department: string
    position: string
  }
}

interface MissingRecordRequest {
  user_id: string
  date_string: string
  time_string: string
  record_type: '출근' | '퇴근' | '해제' | '세트' | '출입' // CAPS 호환
  reason: string
}

interface OvertimeRequest {
  id: string
  user_id: string
  user_name: string
  department: string
  position: string
  work_date: string
  basic_hours: number
  overtime_hours: number
  night_hours: number
  requested_overtime_hours: number
  requested_night_hours: number
  work_reason?: string
  status: 'pending' | 'approved' | 'rejected'
  approved_overtime_hours?: number
  approved_night_hours?: number
  weekly_total_hours?: number
  four_week_average_hours?: number
  is_flexible_period_violation: boolean
  expected_compensatory_hours: number
  approved_by_name?: string
  approved_at?: string
  admin_notes?: string
  created_at: string
  // 3개월 탄력근무제 지원 필드 추가
  work_system_type?: string
  max_weekly_hours?: number
  settlement_period_months?: number
  flexible_work_description?: string
}

// 근무 보상 승인 항목 타입
interface WorkCompensationItem {
  id: string
  user_id: string
  user_name: string
  department: string
  position: string
  work_date: string
  item_type: 'substitute_leave' | 'compensatory_leave' | 'overtime_allowance' | 'night_allowance'
  item_type_name: string
  calculated_hours?: number
  calculated_amount?: number
  calculation_basis: string
  policy_reference: string
  work_hours: number
  day_type: 'saturday' | 'sunday' | 'holiday' | 'weekday'
  is_flexible_period: boolean
  hourly_rate?: number
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_by_name?: string
  approved_at?: string
  admin_notes?: string
  processed_hours?: number
  processed_amount?: number
  processed_at?: string
  created_at: string
  updated_at: string
}

export default function AdminAttendanceManagement() {
  const { supabase } = useSupabase()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [filterType, setFilterType] = useState<'all' | '출근' | '퇴근' | '해제' | '세트' | '출입' | 'missing'>('all')
  const [showMissingForm, setShowMissingForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'attendance' | 'upload' | 'test' | 'overtime' | 'compensation'>('attendance')
  const [missingFormData, setMissingFormData] = useState<MissingRecordRequest>({
    user_id: '',
    date_string: '',
    time_string: '',
    record_type: '출근',
    reason: ''
  })
  
  // 초과근무 승인 관련 상태
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([])
  const [overtimeLoading, setOvertimeLoading] = useState(false)
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
  
  // 근무 보상 승인 관련 상태
  const [compensationItems, setCompensationItems] = useState<WorkCompensationItem[]>([])
  const [compensationLoading, setCompensationLoading] = useState(false)
  const [compensationFilter, setCompensationFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processingItemId, setProcessingItemId] = useState<string | null>(null)
  const [overtimeFilter, setOvertimeFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM

  // 편집/삭제 핸들러 함수들
  const handleEditRecord = (status: any) => {
    console.log('🔧 출퇴근 기록 편집:', status)
    
    // 편집 모달을 위한 상태 설정
    if (status.checkIn || status.checkOut) {
      const record = status.checkIn || status.checkOut
      setMissingFormData({
        user_id: status.employee.id,
        date_string: selectedDate,
        time_string: record.record_time,
        record_type: record.record_type,
        reason: '관리자 수정'
      })
      setShowMissingForm(true)
    } else {
      alert('편집할 출퇴근 기록이 없습니다.')
    }
  }

  const handleDeleteRecord = async (status: any) => {
    const employeeName = status.employee.name
    
    if (!confirm(`${employeeName}님의 ${selectedDate} 출퇴근 기록을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      console.log('🗑️ 출퇴근 기록 삭제:', { date: selectedDate, employeeName })
      
      // 출근 기록 삭제
      if (status.checkIn) {
        const { error } = await supabase
          .from('attendance_records')
          .delete()
          .eq('id', status.checkIn.id)
        
        if (error) throw error
      }
      
      // 퇴근 기록 삭제
      if (status.checkOut) {
        const { error } = await supabase
          .from('attendance_records')
          .delete()
          .eq('id', status.checkOut.id)
        
        if (error) throw error
      }
      
      alert('출퇴근 기록이 삭제되었습니다.')
      await fetchAttendanceRecords()
    } catch (error) {
      console.error('❌ 출퇴근 기록 삭제 오류:', error)
      alert('출퇴근 기록 삭제에 실패했습니다.')
    }
  }

  // 관리자 인증 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        if (user && checkPermission(user, 'admin')) {
          setCurrentUser(user)
        } else {
          console.error('관리자 권한이 필요합니다')
        }
      } catch (error) {
        console.error('관리자 인증 확인 오류:', error)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  // 직원 목록 조회
  const fetchEmployees = async () => {
    try {
      console.log('👥 관리자 - 전체 직원 목록 조회 요청')
      
      // 전체 직원 정보 조회
      const { data: employees, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          department,
          position,
          phone,
          start_date,
          role,
          salary,
          hourly_rate,
          annual_leave_days,
          used_leave_days,
          remaining_leave_days,
          created_at
        `)
        .order('department', { ascending: true })
        .order('name', { ascending: true })

      if (error) {
        console.error('❌ 직원 목록 조회 오류:', error)
        alert('직원 목록 조회에 실패했습니다.')
        return
      }

      console.log('✅ 직원 목록 조회 성공:', {
        count: employees?.length || 0,
        departments: [...new Set(employees?.map(emp => emp.department))].length
      })

      setEmployees(employees || [])
    } catch (error) {
      console.error('❌ 직원 목록 조회 오류:', error)
      alert('직원 목록 조회 중 오류가 발생했습니다.')
    }
  }

  // 출퇴근 기록 조회
  const fetchAttendanceRecords = async () => {
    setLoading(true)
    try {
      console.log('📋 출퇴근 기록 조회 요청:', {
        selectedDate,
        filterType,
        searchTerm
      })

      let query = supabase
        .from('attendance_records')
        .select(`
          id,
          user_id,
          record_date,
          record_time,
          record_timestamp,
          record_type,
          reason,
          location_lat,
          location_lng,
          source,
          had_dinner,
          is_manual,
          created_at,
          users(name, department, position)
        `)
        .order('record_timestamp', { ascending: false })
        .limit(100)

      // 날짜 필터 적용
      query = query.gte('record_date', selectedDate)
      query = query.lte('record_date', selectedDate)

      // 기록 유형 필터 적용 (CAPS 호환)
      if (filterType !== 'all' && filterType !== 'missing' && ['출근', '퇴근', '해제', '세트', '출입'].includes(filterType)) {
        query = query.eq('record_type', filterType)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ 출퇴근 기록 조회 오류:', error)
        alert('출퇴근 기록 조회에 실패했습니다.')
        return
      }

      let filteredRecords = data || []
      
      // 검색어 필터링
      if (searchTerm) {
        filteredRecords = filteredRecords.filter((record: any) =>
          record.users?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.users?.department?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }

      console.log('✅ 출퇴근 기록 조회 성공:', {
        count: filteredRecords.length,
        date_range: selectedDate
      })

      setRecords(filteredRecords as unknown as AttendanceRecord[])
    } catch (error) {
      console.error('❌ 출퇴근 기록 조회 오류:', error)
      alert('출퇴근 기록 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 누락 기록 추가
  const addMissingRecord = async () => {
    if (!currentUser?.id) {
      alert('관리자 인증이 필요합니다.')
      return
    }

    if (!missingFormData.user_id || !missingFormData.date_string || 
        !missingFormData.time_string || !missingFormData.reason) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    if (!['출근', '퇴근', '해제', '세트', '출입'].includes(missingFormData.record_type)) {
      alert('기록 유형이 올바르지 않습니다.')
      return
    }

    try {
      console.log('➕ 누락 기록 추가 요청:', {
        user_id: missingFormData.user_id,
        date_string: missingFormData.date_string,
        time_string: missingFormData.time_string,
        record_type: missingFormData.record_type,
        admin_user_id: currentUser.id
      })

      // 대상 사용자 확인
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, department')
        .eq('id', missingFormData.user_id)
        .single()

      if (userError || !user) {
        alert('사용자를 찾을 수 없습니다.')
        return
      }

      // 날짜와 시간 파싱
      const [year, month, day] = missingFormData.date_string.split('-').map(Number)
      const [hours, minutes] = missingFormData.time_string.split(':').map(Number)
      
      if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
        alert('날짜 또는 시간 형식이 올바르지 않습니다.')
        return
      }

      const timestamp = new Date(year, month - 1, day, hours, minutes)
      
      // 미래 시간 검증
      if (timestamp > new Date()) {
        alert('미래 시간으로는 기록할 수 없습니다.')
        return
      }

      // 중복 기록 검사
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('id, record_time')
        .eq('user_id', missingFormData.user_id)
        .eq('record_date', missingFormData.date_string)
        .eq('record_type', missingFormData.record_type)
        .single()

      if (existingRecord) {
        alert(`${missingFormData.record_type} 기록이 이미 존재합니다. (${existingRecord.record_time})`)
        return
      }

      // 누락 기록 추가
      const { data: newRecord, error: insertError } = await supabase
        .from('attendance_records')
        .insert({
          user_id: missingFormData.user_id,
          record_date: missingFormData.date_string,
          record_time: missingFormData.time_string,
          record_timestamp: timestamp.toISOString(),
          record_type: missingFormData.record_type,
          reason: missingFormData.reason?.trim() || '누락 기록 보충',
          source: 'manual',
          is_manual: true,
          approved_by: currentUser.id,
          approved_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ 누락 기록 추가 오류:', insertError)
        alert('누락 기록 추가에 실패했습니다.')
        return
      }

      console.log('✅ 누락 기록 추가 성공:', {
        user: user.name,
        type: missingFormData.record_type,
        date: missingFormData.date_string,
        time: missingFormData.time_string
      })

      alert(`✅ ${user.name}님의 ${missingFormData.record_type} 기록이 추가되었습니다. (${missingFormData.date_string} ${missingFormData.time_string})`)
      
      setShowMissingForm(false)
      setMissingFormData({
        user_id: '',
        date_string: '',
        time_string: '',
        record_type: '출근',
        reason: ''
      })
      fetchAttendanceRecords()

    } catch (error) {
      console.error('❌ 누락 기록 추가 오류:', error)
      alert('누락 기록 추가 중 오류가 발생했습니다.')
    }
  }

  // 근무 보상 항목 조회
  const fetchCompensationItems = useCallback(async () => {
    if (!currentUser) return

    setCompensationLoading(true)
    try {
      let query = supabase
        .from('admin_work_compensation_view')
        .select('*')
        .order('created_at', { ascending: false })

      // 상태 필터 적용
      if (compensationFilter !== 'all') {
        query = query.eq('status', compensationFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error('근무 보상 항목 조회 오류:', error)
        throw error
      }

      setCompensationItems(data || [])
    } catch (error) {
      console.error('근무 보상 항목 조회 실패:', error)
    } finally {
      setCompensationLoading(false)
    }
  }, [currentUser, compensationFilter])

  // 근무 보상 승인/거부 처리
  const handleCompensationAction = async (itemId: string, action: 'approve' | 'reject') => {
    if (!currentUser) return

    const item = compensationItems.find(i => i.id === itemId)
    if (!item) {
      alert('항목을 찾을 수 없습니다.')
      return
    }

    setProcessingItemId(itemId)

    try {
      let adminNotes = ''
      let processedHours = item.calculated_hours
      let processedAmount = item.calculated_amount

      if (action === 'approve') {
        // 승인 시 조정 가능한 값들 입력받기
        if (item.item_type === 'substitute_leave' || item.item_type === 'compensatory_leave') {
          const hoursInput = prompt(
            `승인할 ${item.item_type_name} 시간을 입력하세요 (계산값: ${item.calculated_hours}시간):`,
            item.calculated_hours?.toString() || '0'
          )
          if (hoursInput === null) return
          processedHours = parseFloat(hoursInput) || 0
        } else {
          const amountInput = prompt(
            `승인할 ${item.item_type_name} 금액을 입력하세요 (계산값: ${item.calculated_amount?.toLocaleString()}원):`,
            item.calculated_amount?.toString() || '0'
          )
          if (amountInput === null) return
          processedAmount = parseFloat(amountInput) || 0
        }

        adminNotes = prompt('관리자 메모를 입력하세요 (선택사항):') || ''
      } else {
        adminNotes = prompt('거부 사유를 입력하세요:') || ''
        if (!adminNotes) {
          alert('거부 사유는 필수입니다.')
          return
        }
      }

      // PostgreSQL 함수 호출
      const functionName = action === 'approve' ? 'approve_compensation_item' : 'reject_compensation_item'
      const params = action === 'approve' 
        ? {
            p_item_id: itemId,
            p_approved_by: currentUser.id,
            p_admin_notes: adminNotes,
            p_processed_hours: processedHours,
            p_processed_amount: processedAmount
          }
        : {
            p_item_id: itemId,
            p_rejected_by: currentUser.id,
            p_admin_notes: adminNotes
          }

      const { error } = await supabase.rpc(functionName, params)

      if (error) {
        console.error(`근무 보상 ${action === 'approve' ? '승인' : '거부'} 오류:`, error)
        throw error
      }

      const successMessage = action === 'approve' ? '승인되었습니다.' : '거부되었습니다.'
      alert(`${item.item_type_name}이(가) ${successMessage}`)

      // 목록 새로고침
      await fetchCompensationItems()

    } catch (error) {
      console.error(`근무 보상 ${action === 'approve' ? '승인' : '거부'} 실패:`, error)
      alert(`처리 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setProcessingItemId(null)
    }
  }

  // 초과근무 요청 조회
  const fetchOvertimeRequests = async () => {
    setOvertimeLoading(true)
    try {
      console.log('📋 초과근무 요청 조회:', { selectedMonth, overtimeFilter })

      let query = supabase
        .from('admin_overtime_requests')  // 뷰 사용
        .select('*')
        .order('created_at', { ascending: false })

      // 월 필터 적용
      if (selectedMonth) {
        const startOfMonth = `${selectedMonth}-01`
        const endOfMonth = new Date(selectedMonth + '-01')
        endOfMonth.setMonth(endOfMonth.getMonth() + 1)
        endOfMonth.setDate(0) // 마지막 날
        const endOfMonthStr = endOfMonth.toISOString().split('T')[0]
        
        query = query.gte('work_date', startOfMonth)
        query = query.lte('work_date', endOfMonthStr)
      }

      // 상태 필터 적용
      if (overtimeFilter !== 'all') {
        query = query.eq('status', overtimeFilter)
      }

      const { data, error } = await query

      if (error) {
        console.error('❌ 초과근무 요청 조회 오류:', error)
        alert('초과근무 요청 조회에 실패했습니다.')
        return
      }

      console.log('✅ 초과근무 요청 조회 성공:', {
        count: data?.length || 0,
        month: selectedMonth
      })

      setOvertimeRequests(data || [])
    } catch (error) {
      console.error('❌ 초과근무 요청 조회 오류:', error)
      alert('초과근무 요청 조회 중 오류가 발생했습니다.')
    } finally {
      setOvertimeLoading(false)
    }
  }

  // 초과근무 승인/거부 처리
  const handleOvertimeApproval = async (requestId: string, action: 'approve' | 'reject') => {
    if (processingRequestId) return

    const request = overtimeRequests.find(r => r.id === requestId)
    if (!request) {
      alert('요청을 찾을 수 없습니다.')
      return
    }

    // 승인 시간 확인 (관리자가 조정 가능)
    let approvedOvertimeHours = request.requested_overtime_hours
    let approvedNightHours = request.requested_night_hours
    let adminNotes = ''

    if (action === 'approve') {
      // 탄력근무제 위반 경고
      if (request.is_flexible_period_violation) {
        // 3개월 탄력근무제 vs 일반 근무제 구분하여 메시지 표시
        const violationMessage = request.work_system_type === '3개월 탄력근무제' 
          ? `⚠️ 3개월 탄력근무제 위반 사항이 있습니다.\n주간 총 근무시간: ${request.weekly_total_hours}시간 (한도: 64시간)\n3개월 평균: ${request.four_week_average_hours?.toFixed(1)}시간/주 (기준: 40시간)\n\n그래도 승인하시겠습니까?`
          : `⚠️ 근로기준법 위반 사항이 있습니다.\n주간 총 근무시간: ${request.weekly_total_hours}시간 (한도: 52시간)\n\n그래도 승인하시겠습니까?`
        
        if (!confirm(violationMessage)) {
          return
        }
      }

      // 승인 시간 확인
      const overtimeInput = prompt(`승인할 초과근무 시간을 입력하세요 (요청: ${request.requested_overtime_hours}시간):`, request.requested_overtime_hours.toString())
      const nightInput = prompt(`승인할 야간근무 시간을 입력하세요 (요청: ${request.requested_night_hours}시간):`, request.requested_night_hours.toString())
      
      if (overtimeInput === null || nightInput === null) return

      approvedOvertimeHours = parseFloat(overtimeInput) || 0
      approvedNightHours = parseFloat(nightInput) || 0

      if (approvedOvertimeHours < 0 || approvedNightHours < 0) {
        alert('승인 시간은 0 이상이어야 합니다.')
        return
      }

      adminNotes = prompt('승인 메모 (선택사항):') || ''
    } else {
      // 거부 사유 입력
      adminNotes = prompt('거부 사유를 입력하세요:') || ''
      if (!adminNotes.trim()) {
        alert('거부 사유를 입력해주세요.')
        return
      }
    }

    setProcessingRequestId(requestId)
    try {
      if (action === 'approve') {
        // 승인 처리 (PostgreSQL 함수 호출)
        const { error } = await supabase.rpc('approve_overtime_request', {
          p_request_id: requestId,
          p_approved_by: currentUser!.id,
          p_approved_overtime_hours: approvedOvertimeHours,
          p_approved_night_hours: approvedNightHours,
          p_admin_notes: adminNotes
        })

        if (error) {
          console.error('❌ 초과근무 승인 오류:', error)
          throw error
        }

        const compensatoryHours = approvedOvertimeHours + (approvedNightHours * 1.5)
        alert(`✅ 초과근무가 승인되었습니다.\n보상휴가 적립: ${compensatoryHours.toFixed(1)}시간`)
      } else {
        // 거부 처리 (PostgreSQL 함수 호출)
        const { error } = await supabase.rpc('reject_overtime_request', {
          p_request_id: requestId,
          p_rejected_by: currentUser!.id,
          p_admin_notes: adminNotes
        })

        if (error) {
          console.error('❌ 초과근무 거부 오류:', error)
          throw error
        }

        alert('✅ 초과근무가 거부되었습니다.')
      }

      // 목록 새로고침
      await fetchOvertimeRequests()

      // 직원 화면 실시간 업데이트
      const refreshEvent = new CustomEvent('formSubmitSuccess')
      window.dispatchEvent(refreshEvent)

    } catch (error) {
      console.error(`❌ 초과근무 ${action === 'approve' ? '승인' : '거부'} 오류:`, error)
      alert(`초과근무 ${action === 'approve' ? '승인' : '거부'} 처리에 실패했습니다.`)
    } finally {
      setProcessingRequestId(null)
    }
  }

  // 데이터 로드 - 직원 목록 먼저 로드 후 출퇴근 기록 로드
  useEffect(() => {
    const loadInitialData = async () => {
      if (currentUser) {
        await fetchEmployees()  // 직원 목록 먼저 로드
        await fetchAttendanceRecords()  // 그 다음 출퇴근 기록 로드
      }
    }
    loadInitialData()
  }, [currentUser])

  // 필터 변경 시 출퇴근 기록만 다시 로드 (직원 목록이 있을 때만)
  useEffect(() => {
    if (currentUser && employees.length > 0) {
      fetchAttendanceRecords()
    }
  }, [selectedDate, filterType, searchTerm])

  // 초과근무 탭 데이터 로드
  useEffect(() => {
    if (currentUser && activeTab === 'overtime') {
      fetchOvertimeRequests()
    }
  }, [currentUser, activeTab, selectedMonth, overtimeFilter])

  useEffect(() => {
    if (currentUser && activeTab === 'compensation') {
      fetchCompensationItems()
    }
  }, [currentUser, activeTab, fetchCompensationItems])

  // 출근/퇴근 상태 분석
  const getAttendanceStatus = () => {
    const employeeStatus = new Map()

    // 각 직원별 출퇴근 상태 분석
    employees.forEach(emp => {
      employeeStatus.set(emp.id, {
        employee: {
          id: emp.id,
          name: emp.name,
          department: emp.department,
          position: emp.position
        },
        checkIn: null as AttendanceRecord | null,
        checkOut: null as AttendanceRecord | null,
        status: '결근',
        date: selectedDate
      })
    })

    // 출퇴근 기록 매칭
    records.forEach(record => {
      const empStatus = employeeStatus.get(record.user_id)
      if (empStatus) {
        // 출근 또는 세트(CAPS 출근) 기록
        if (record.record_type === '출근' || record.record_type === '세트') {
          if (!empStatus.checkIn || record.record_time < empStatus.checkIn.record_time) {
            empStatus.checkIn = record
          }
        }
        // 퇴근 또는 해제(CAPS 퇴근) 기록
        else if (record.record_type === '퇴근' || record.record_type === '해제') {
          if (!empStatus.checkOut || record.record_time > empStatus.checkOut.record_time) {
            empStatus.checkOut = record
          }
        }
      }
    })

    // 상태 업데이트
    employeeStatus.forEach(status => {
      if (status.checkIn && status.checkOut) {
        status.status = '정상근무'
      } else if (status.checkIn && !status.checkOut) {
        status.status = '퇴근미기록'
      } else if (!status.checkIn && status.checkOut) {
        status.status = '출근미기록'
      }
    })

    return Array.from(employeeStatus.values())
  }

  const attendanceStatus = getAttendanceStatus()
  const normalCount = attendanceStatus.filter(s => s.status === '정상근무').length
  const missingCount = attendanceStatus.filter(s => s.status.includes('미기록')).length
  const absentCount = attendanceStatus.filter(s => s.status === '결근').length

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 인증 확인 중...</h3>
          <div className="w-full max-w-xs mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 권한이 필요합니다</h3>
          <p className="text-gray-600 mb-4">출퇴근 관리 기능은 관리자만 접근할 수 있습니다.</p>
          <div className="space-x-3">
            <a 
              href="/auth/login"
              className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              로그인하기
            </a>
            <a 
              href="/admin"
              className="inline-flex items-center px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              관리자 대시보드
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">출퇴근 관리</h2>
          <p className="text-gray-600">직원들의 출퇴근 현황을 관리합니다</p>
        </div>
        {activeTab === 'attendance' && (
          <button
            onClick={() => setShowMissingForm(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            누락 기록 추가
          </button>
        )}
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'attendance'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          출퇴근 현황
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'upload'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Upload className="h-4 w-4 mr-2" />
          CAPS 데이터 업로드
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'test'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          테스트 데이터
        </button>
        <button
          onClick={() => setActiveTab('overtime')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'overtime'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="h-4 w-4 mr-2" />
          초과근무 승인
        </button>
        <button
          onClick={() => setActiveTab('compensation')}
          className={`px-4 py-2 font-medium flex items-center ${
            activeTab === 'compensation'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
          근무 보상 승인
        </button>
      </div>

      {/* 출퇴근 현황 탭 */}
      {activeTab === 'attendance' && (
        <>
          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-blue-600">전체 직원</p>
              <p className="text-2xl font-bold text-blue-700">{employees.length}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-600">정상근무</p>
              <p className="text-2xl font-bold text-green-700">{normalCount}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm text-yellow-600">기록 누락</p>
              <p className="text-2xl font-bold text-yellow-700">{missingCount}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-lg">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-600">결근</p>
              <p className="text-2xl font-bold text-red-700">{absentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">구분</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="출근">출근</option>
            <option value="퇴근">퇴근</option>
            <option value="해제">해제 (CAPS)</option>
            <option value="세트">세트 (CAPS)</option>
            <option value="출입">출입 (CAPS)</option>
            <option value="missing">누락</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">검색</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름 또는 부서 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={fetchAttendanceRecords}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            <Filter className="h-4 w-4 inline mr-2" />
            조회
          </button>
        </div>
      </div>

      {/* 출퇴근 현황 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">
            {selectedDate} 출퇴근 현황
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse">데이터를 불러오는 중...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원정보
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    저녁식사
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceStatus.map((status, index) => (
                  <tr key={status.employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {status.employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {status.employee.department} · {status.employee.position}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkIn ? (
                        <div className="text-sm text-gray-900">
                          {status.checkIn.record_time}
                          {status.checkIn.is_manual && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              수동
                            </span>
                          )}
                          {/* CAPS 기록 표시 */}
                          {status.checkIn.source?.includes('CAPS') && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              CAPS
                            </span>
                          )}
                          {status.checkIn.source === 'WEB' && (
                            <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              웹
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkOut ? (
                        <div className="text-sm text-gray-900">
                          {status.checkOut.record_time}
                          {status.checkOut.is_manual && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                              수동
                            </span>
                          )}
                          {/* CAPS 기록 표시 */}
                          {status.checkOut.source?.includes('CAPS') && (
                            <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                              CAPS
                            </span>
                          )}
                          {status.checkOut.source === 'WEB' && (
                            <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                              웹
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        status.status === '정상근무' 
                          ? 'bg-green-100 text-green-800'
                          : status.status.includes('미기록')
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {status.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status.checkOut?.had_dinner ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-300" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditRecord(status)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="출퇴근 기록 수정"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRecord(status)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="출퇴근 기록 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 누락 기록 추가 모달 */}
      {showMissingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">누락 기록 추가</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직원 선택
                </label>
                <select
                  value={missingFormData.user_id}
                  onChange={(e) => setMissingFormData({...missingFormData, user_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  날짜
                </label>
                <input
                  type="date"
                  value={missingFormData.date_string}
                  onChange={(e) => setMissingFormData({...missingFormData, date_string: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시간
                </label>
                <input
                  type="time"
                  value={missingFormData.time_string}
                  onChange={(e) => setMissingFormData({...missingFormData, time_string: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  구분
                </label>
                <select
                  value={missingFormData.record_type}
                  onChange={(e) => setMissingFormData({...missingFormData, record_type: e.target.value as '출근' | '퇴근' | '해제' | '세트' | '출입'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="출근">출근</option>
                  <option value="퇴근">퇴근</option>
                  <option value="해제">해제 (CAPS)</option>
                  <option value="세트">세트 (CAPS)</option>
                  <option value="출입">출입 (CAPS)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사유
                </label>
                <textarea
                  value={missingFormData.reason}
                  onChange={(e) => setMissingFormData({...missingFormData, reason: e.target.value})}
                  placeholder="누락 사유를 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowMissingForm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={addMissingRecord}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* CAPS 업로드 탭 */}
      {activeTab === 'upload' && (
        <CapsUploadManager />
      )}

      {/* 테스트 데이터 생성 탭 */}
      {activeTab === 'test' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CapsTestDataGenerator />
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">테스트 가이드</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-700">1. 테스트 데이터 생성</h4>
                <p>직원 수와 날짜 범위를 선택하여 CAPS 형식의 테스트 데이터를 생성합니다.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">2. 데이터 업로드</h4>
                <p>생성된 파일을 다운로드한 후, CAPS 데이터 업로드 탭에서 업로드합니다.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700">3. 결과 확인</h4>
                <p>출퇴근 현황 탭에서 업로드된 데이터를 확인할 수 있습니다.</p>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 rounded-md">
                <p className="text-yellow-800">
                  <strong>주의:</strong> 테스트 데이터에 포함된 직원명이 실제 데이터베이스에 존재해야 업로드가 성공합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 초과근무 승인 탭 */}
      {activeTab === 'overtime' && (
        <>
          {/* 필터 및 검색 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">월 선택</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={overtimeFilter}
                onChange={(e) => setOvertimeFilter(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">승인 대기</option>
                <option value="approved">승인됨</option>
                <option value="rejected">거절됨</option>
                <option value="all">전체</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchOvertimeRequests}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                <Filter className="h-4 w-4 inline mr-2" />
                조회
              </button>
            </div>
          </div>

          {/* 초과근무 승인 목록 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedMonth} 초과근무 승인 요청
              </h3>
            </div>

            {overtimeLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">데이터를 불러오는 중...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        직원정보
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무일 / 사유
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무시간
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        탄력근무제
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        보상휴가
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태 / 관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {overtimeRequests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                          {overtimeFilter === 'pending' ? '승인 대기 중인 요청이 없습니다.' : '표시할 요청이 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      overtimeRequests.map((request, index) => (
                        <tr key={request.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {request.user_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {request.department} · {request.position}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {new Date(request.work_date).toLocaleDateString('ko-KR')}
                            </div>
                            {request.work_reason && (
                              <div className="text-sm text-gray-500 mt-1">
                                {request.work_reason}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm space-y-1">
                              <div>기본: {request.basic_hours}h</div>
                              {request.requested_overtime_hours > 0 && (
                                <div className="text-orange-600">
                                  초과: {request.requested_overtime_hours}h
                                </div>
                              )}
                              {request.requested_night_hours > 0 && (
                                <div className="text-purple-600">
                                  야간: {request.requested_night_hours}h
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div>주간: {request.weekly_total_hours}h</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {request.work_system_type === '3개월 탄력근무제' 
                                  ? `3개월 평균: ${request.four_week_average_hours?.toFixed(1)}h/주`
                                  : '일반 근무제'
                                }
                              </div>
                              {request.is_flexible_period_violation && (
                                <div className="text-red-600 font-medium mt-1">
                                  ⚠️ {request.work_system_type === '3개월 탄력근무제' ? '탄력근무제' : '근로기준법'} 위반
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-green-600">
                              {request.expected_compensatory_hours.toFixed(1)}h
                            </div>
                            <div className="text-xs text-gray-500">
                              (야간 1.5배)
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {request.status === 'pending' ? (
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  대기중
                                </span>
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleOvertimeApproval(request.id, 'approve')}
                                    disabled={processingRequestId === request.id}
                                    className="bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={() => handleOvertimeApproval(request.id, 'reject')}
                                    disabled={processingRequestId === request.id}
                                    className="bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                                  >
                                    거부
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  request.status === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {request.status === 'approved' ? '승인됨' : '거절됨'}
                                </span>
                                {request.approved_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(request.approved_at).toLocaleDateString('ko-KR')}
                                  </div>
                                )}
                                {request.admin_notes && (
                                  <div className="text-xs text-gray-600 mt-1 max-w-32 truncate" title={request.admin_notes}>
                                    메모: {request.admin_notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 근무 보상 승인 탭 */}
      {activeTab === 'compensation' && (
        <>
          {/* 필터 및 검색 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">월 선택</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태 필터</label>
              <select
                value={compensationFilter}
                onChange={(e) => setCompensationFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">전체</option>
                <option value="pending">승인 대기</option>
                <option value="approved">승인완료</option>
                <option value="rejected">거부됨</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchCompensationItems}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center"
              >
                <Filter className="h-4 w-4 inline mr-2" />
                조회
              </button>
            </div>
          </div>

          {/* 근무 보상 승인 목록 */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedMonth} 근무 보상 승인 요청
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                대체휴가, 보상휴가, 초과근무수당, 야간근무수당 승인 관리
              </p>
            </div>

            {compensationLoading ? (
              <div className="text-center py-8">
                <div className="animate-pulse">데이터를 불러오는 중...</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        직원정보
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무일 / 유형
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        보상내용
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        계산근거
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        상태 / 관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {compensationItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                          {compensationFilter === 'pending' ? '승인 대기 중인 보상이 없습니다.' : '표시할 보상이 없습니다.'}
                        </td>
                      </tr>
                    ) : (
                      compensationItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.user_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.department} · {item.position}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {new Date(item.work_date).toLocaleDateString('ko-KR')}
                            </div>
                            <div className={`text-sm font-medium mt-1 ${
                              item.item_type === 'substitute_leave' ? 'text-blue-600' :
                              item.item_type === 'compensatory_leave' ? 'text-green-600' :
                              item.item_type === 'overtime_allowance' ? 'text-orange-600' :
                              'text-purple-600'
                            }`}>
                              {item.item_type_name}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {item.day_type === 'saturday' ? '토요일 근무' :
                               item.day_type === 'sunday' ? '일요일 근무' :
                               item.day_type === 'holiday' ? '공휴일 근무' :
                               '평일 근무'}
                              {item.is_flexible_period && ' · 탄력근무제'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {item.calculated_hours !== undefined ? (
                              <div className="text-sm">
                                <div className="font-medium text-green-600">
                                  {item.calculated_hours}시간
                                </div>
                                <div className="text-xs text-gray-500">
                                  휴가 적립
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div className="font-medium text-blue-600">
                                  {item.calculated_amount?.toLocaleString()}원
                                </div>
                                <div className="text-xs text-gray-500">
                                  수당 지급
                                  {item.hourly_rate && ` (시급: ${item.hourly_rate.toLocaleString()}원)`}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="text-gray-900 max-w-48 break-words">
                                {item.calculation_basis}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 max-w-48 break-words">
                                {item.policy_reference}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {item.status === 'pending' ? (
                              <div className="flex items-center space-x-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  대기중
                                </span>
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleCompensationAction(item.id, 'approve')}
                                    disabled={processingItemId === item.id}
                                    className="bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                                  >
                                    승인
                                  </button>
                                  <button
                                    onClick={() => handleCompensationAction(item.id, 'reject')}
                                    disabled={processingItemId === item.id}
                                    className="bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                                  >
                                    거부
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === 'approved'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.status === 'approved' ? '승인됨' : '거절됨'}
                                </span>
                                {item.approved_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(item.approved_at).toLocaleDateString('ko-KR')}
                                    {item.approved_by_name && ` · ${item.approved_by_name}`}
                                  </div>
                                )}
                                {item.processed_hours !== item.calculated_hours && item.processed_hours && (
                                  <div className="text-xs text-green-600 mt-1">
                                    실제 적립: {item.processed_hours}시간
                                  </div>
                                )}
                                {item.processed_amount !== item.calculated_amount && item.processed_amount && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    실제 지급: {item.processed_amount.toLocaleString()}원
                                  </div>
                                )}
                                {item.admin_notes && (
                                  <div className="text-xs text-gray-600 mt-1 max-w-32 truncate" title={item.admin_notes}>
                                    메모: {item.admin_notes}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 승인 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="ml-2 text-sm font-medium text-yellow-800">
                  승인 대기
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-yellow-900">
                {compensationItems.filter(item => item.status === 'pending').length}
              </div>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="ml-2 text-sm font-medium text-green-800">
                  승인 완료
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-green-900">
                {compensationItems.filter(item => item.status === 'approved').length}
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="ml-2 text-sm font-medium text-red-800">
                  거부됨
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-red-900">
                {compensationItems.filter(item => item.status === 'rejected').length}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="ml-2 text-sm font-medium text-blue-800">
                  전체 항목
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-900">
                {compensationItems.length}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
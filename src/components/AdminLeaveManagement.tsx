'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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
    termination_date?: string
  }
}

interface LeaveRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  request_data: {
    leave_type?: string
    start_date?: string
    end_date?: string
    days?: number
    reason?: string
  } | null
  submitted_at: string
  user?: {
    name: string
    department: string
    position: string
  }
}

interface LeavePromotionData {
  employee: {
    id: string
    name: string
    department: string
    position: string
    hire_date: string
  }
  leaveData: LeaveData | null
  remainingDays: number
  workingMonths: number
  isLegalRequired: boolean
}

export default function AdminLeaveManagement() {
  const [leaveData, setLeaveData] = useState<LeaveData[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [promotionData, setPromotionData] = useState<LeavePromotionData[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<LeaveData | null>(null)
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [showRequests, setShowRequests] = useState(false)
  const [showPromotion, setShowPromotion] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingLeave, setEditingLeave] = useState<LeaveData | null>(null)
  const [editForm, setEditForm] = useState({
    annual_days: 0,
    used_annual_days: 0,
    sick_days: 0,
    used_sick_days: 0
  })
  const [showAddLeave, setShowAddLeave] = useState(false)
  const [addLeaveForm, setAddLeaveForm] = useState({
    employee_id: '',
    employee_name: '',
    leave_type: 'annual' as 'annual' | 'sick',
    start_date: '',
    end_date: '',
    days: 1,
    reason: ''
  })

  useEffect(() => {
    fetchLeaveData()
    fetchLeaveRequests()
    fetchPromotionData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeaveData = async () => {
    try {
      const response = await fetch('/api/admin/leave-data')
      const result = await response.json()

      if (result.success) {
        setLeaveData(result.data || [])
      } else {
        console.error('휴가 데이터 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('휴가 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch('/api/admin/leave-requests')
      const result = await response.json()

      if (result.success) {
        setLeaveRequests(result.data || [])
      } else {
        console.error('휴가 신청 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('휴가 신청 조회 오류:', error)
    }
  }
  
  const handleApproveLeave = async (request: LeaveRequest) => {
    if (!request.request_data?.days || !request.request_data?.leave_type) {
      alert('유효하지 않은 신청 데이터입니다.')
      return
    }
    
    try {
      // 1. 휴가 신청 승인 처리
      const { error: requestError } = await supabase
        .from('form_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: 'admin'
        })
        .eq('id', request.id)
        
      if (requestError) {
        console.error('신청 승인 실패:', requestError)
        alert('신청 승인에 실패했습니다.')
        return
      }
      
      // 2. 휴가 사용일수 업데이트
      const userLeave = leaveData.find(leave => leave.user_id === request.user_id)
      if (userLeave) {
        const updatedLeaveTypes = { ...userLeave.leave_types }
        const daysToUse = parseFloat(request.request_data.days.toString());

        if (request.request_data.leave_type === 'annual') {
          updatedLeaveTypes.used_annual_days = (updatedLeaveTypes.used_annual_days || 0) + daysToUse;
        } else if (request.request_data.leave_type === 'sick') {
          updatedLeaveTypes.used_sick_days = (updatedLeaveTypes.used_sick_days || 0) + daysToUse;
        }
        
        const { error: leaveError } = await supabase
          .from('leave_days')
          .update({ leave_types: updatedLeaveTypes })
          .eq('user_id', request.user_id)
          
        if (leaveError) {
          console.error('휴가 데이터 업데이트 실패:', leaveError)
          alert('휴가 데이터 업데이트에 실패했습니다.')
          return
        }
      }
      
      alert('휴가 신청이 승인되었습니다.')
      fetchLeaveData()
      fetchLeaveRequests()
    } catch (error) {
      console.error('휴가 승인 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }
  
  const handleRejectLeave = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('form_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: 'admin'
        })
        .eq('id', requestId)
        
      if (error) {
        console.error('신청 거부 실패:', error)
        alert('신청 거부에 실패했습니다.')
      } else {
        alert('휴가 신청이 거부되었습니다.')
        fetchLeaveRequests()
      }
    } catch (error) {
      console.error('휴가 거부 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }
  
  const handleEditLeave = (leave: LeaveData) => {
    setEditForm({
      annual_days: leave.leave_types.annual_days,
      used_annual_days: leave.leave_types.used_annual_days,
      sick_days: leave.leave_types.sick_days,
      used_sick_days: leave.leave_types.used_sick_days
    })
    setEditingLeave(leave)
  }
  
  const handleSaveLeave = async () => {
    if (!editingLeave) return
    
    try {
      const response = await fetch('/api/admin/leave-data/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: editingLeave.user_id,
          leave_types: editForm
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        alert('휴가 정보가 수정되었습니다.')
        setEditingLeave(null)
        fetchLeaveData()
        fetchPromotionData() // 촉진 데이터도 업데이트
        setSelectedEmployee(null)
      } else {
        console.error('휴가 수정 실패:', result.error)
        alert('휴가 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('휴가 수정 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }
  
  const fetchPromotionData = useCallback(async () => {
    try {
      // 모든 직원 정보 가져오기
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select('id, name, department, position, hire_date, termination_date')
        .eq('role', 'user')
        .order('department', { ascending: true })

      if (employeesError) {
        console.error('직원 정보 조회 실패:', employeesError)
        return
      }

      // 재직자만 필터링
      const activeEmployees = employees?.filter(emp => !emp.termination_date || new Date(emp.termination_date) > new Date()) || []

      // 데이터 조합 및 분석
      const combinedData: LeavePromotionData[] = activeEmployees.map(employee => {
        const userLeaveData = leaveData.find(leave => leave.user_id === employee.id) || null
        
        // 근무 개월 수 계산
        const hireDate = new Date(employee.hire_date)
        const today = new Date()
        const workingMonths = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
        
        // 잔여 연차 계산
        const remainingDays = userLeaveData 
          ? userLeaveData.leave_types.annual_days - userLeaveData.leave_types.used_annual_days
          : 0

        // 법적 연차 촉진 기준 (1년 이상 근무, 잔여 연차 5일 이상)
        const isLegalRequired = workingMonths >= 12 && remainingDays >= 5

        return {
          employee,
          leaveData: userLeaveData,
          remainingDays,
          workingMonths,
          isLegalRequired
        }
      })

      setPromotionData(combinedData)
    } catch (error) {
      console.error('연차 촉진 데이터 조회 오류:', error)
    }
  }, [leaveData])
  
  const sendPromotionNotice = async (employeeId: string, employeeName: string) => {
    try {
      const confirmed = confirm(`${employeeName}님에게 연차 촉진 안내를 발송하시겠습니까?`)
      
      if (confirmed) {
        // TODO: 실제 이메일 발송 로직 구현
        alert(`${employeeName}님에게 연차 촉진 안내가 발송되었습니다.`)
      }
    } catch (error) {
      console.error('연차 촉진 안내 발송 오류:', error)
      alert('안내 발송에 실패했습니다.')
    }
  }

  const handleInitializeLeaveData = async () => {
    try {
      const confirmed = confirm('휴가 데이터가 없는 직원들을 위해 초기 휴가 데이터를 생성하시겠습니까?')
      
      if (confirmed) {
        const response = await fetch('/api/admin/leave-data/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        const result = await response.json()
        
        if (result.success) {
          alert(`휴가 데이터 초기화 완료: ${result.new_leave_count}명의 직원에게 휴가 데이터가 생성되었습니다.`)
          fetchLeaveData()
          fetchPromotionData()
        } else {
          alert('휴가 데이터 초기화에 실패했습니다: ' + result.error)
        }
      }
    } catch (error) {
      console.error('휴가 데이터 초기화 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }
  
  const handleAddLeave = (employee: LeaveData) => {
    setAddLeaveForm({
      employee_id: employee.user_id,
      employee_name: employee.user?.name || '',
      leave_type: 'annual',
      start_date: '',
      end_date: '',
      days: 1,
      reason: ''
    })
    setShowAddLeave(true)
  }
  
  const handleSubmitAddLeave = async () => {
    if (!addLeaveForm.start_date || !addLeaveForm.end_date || addLeaveForm.days <= 0) {
      alert('모든 필드를 입력해주세요.')
      return
    }
    
    try {
      // 1. 휴가 사용일수 업데이트
      const userLeave = leaveData.find(leave => leave.user_id === addLeaveForm.employee_id)
      if (userLeave) {
        const updatedLeaveTypes = { ...userLeave.leave_types }
        const daysToUse = parseFloat(addLeaveForm.days.toString());

        if (addLeaveForm.leave_type === 'annual') {
          if ((updatedLeaveTypes.used_annual_days || 0) + daysToUse > updatedLeaveTypes.annual_days) {
            alert('연차 사용 일수가 총 연차를 초과합니다.')
            return
          }
          updatedLeaveTypes.used_annual_days = (updatedLeaveTypes.used_annual_days || 0) + daysToUse;
        } else if (addLeaveForm.leave_type === 'sick') {
          if ((updatedLeaveTypes.used_sick_days || 0) + daysToUse > updatedLeaveTypes.sick_days) {
            alert('병가 사용 일수가 총 병가를 초과합니다.')
            return
          }
          updatedLeaveTypes.used_sick_days = (updatedLeaveTypes.used_sick_days || 0) + daysToUse;
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
      }
      
      // 2. form_requests 테이블에 수동 입력 기록 추가
      const { error: requestError } = await supabase
        .from('form_requests')
        .insert([{
          user_id: addLeaveForm.employee_id,
          form_type: 'manual_leave',
          status: 'approved',
          request_data: {
            leave_type: addLeaveForm.leave_type,
            start_date: addLeaveForm.start_date,
            end_date: addLeaveForm.end_date,
            days: addLeaveForm.days,
            reason: addLeaveForm.reason,
            manual_entry: true
          },
          submitted_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
          processed_by: 'admin'
        }])
        
      if (requestError) {
        console.error('수동 입력 기록 추가 실패:', requestError)
      }
      
      // 3. 구글 캘린더에 이벤트 추가 (TODO: 실제 API 연동)
      // 임시로 콘솔 로그로 대체
      console.log('구글 캘린더 이벤트 추가:', {
        title: `${addLeaveForm.employee_name} ${addLeaveForm.leave_type === 'annual' ? '연차' : '병가'}`,
        start: addLeaveForm.start_date,
        end: addLeaveForm.end_date,
        description: addLeaveForm.reason
      })
      
      alert(`${addLeaveForm.employee_name}님의 ${addLeaveForm.leave_type === 'annual' ? '연차' : '병가'} ${addLeaveForm.days}일이 등록되었습니다.`)
      setShowAddLeave(false)
      setAddLeaveForm({
        employee_id: '',
        employee_name: '',
        leave_type: 'annual',
        start_date: '',
        end_date: '',
        days: 1,
        reason: ''
      })
      fetchLeaveData()
      fetchPromotionData()
      setSelectedEmployee(null)
    } catch (error) {
      console.error('수동 연차 입력 오류:', error)
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

  // 휴가 데이터가 없으면 초기화 안내 표시
  if (leaveData.length === 0) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">휴가 데이터가 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              직원들의 휴가 데이터를 초기화해주세요.
            </p>
            <div className="mt-6">
              <button
                onClick={handleInitializeLeaveData}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                휴가 데이터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 퇴사자와 재직자 구분
  const activeEmployees = leaveData.filter(emp => !emp.user?.termination_date || new Date(emp.user.termination_date) > new Date())
  const retiredEmployees = leaveData.filter(emp => emp.user?.termination_date && new Date(emp.user.termination_date) <= new Date())
  
  const displayEmployees = showActiveOnly ? activeEmployees : retiredEmployees
  
  
  const totalEmployees = activeEmployees.length
  const averageUsage = activeEmployees.length > 0 
    ? Math.round(activeEmployees.reduce((sum, item) => 
        sum + (item.leave_types.used_annual_days / item.leave_types.annual_days * 100), 0
      ) / activeEmployees.length) 
    : 0
  
  const pendingRequests = leaveRequests.length
  const legalRequiredEmployees = promotionData.filter(data => data.isLegalRequired)

  return (
    <div className="space-y-6">
      {/* 요약 위젯 */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  휴가 관리
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  전체 직원 휴가 현황
                </dd>
              </dl>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-gray-600 space-y-1">
              <p>관리 대상: {totalEmployees}명</p>
              <p>평균 연차 사용률: {averageUsage}%</p>
              <p className="text-red-600 font-medium">연차 촉진 대상: {legalRequiredEmployees.length}명</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-5 py-3">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4 text-sm">
              <button
                onClick={() => setShowRequests(!showRequests)}
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                대기 중인 신청 {pendingRequests}건 {showRequests ? '숨기기' : '보기'}
              </button>
              <button
                onClick={() => setShowPromotion(!showPromotion)}
                className="font-medium text-red-600 hover:text-red-500"
              >
                연차 촉진 {legalRequiredEmployees.length}건 {showPromotion ? '숨기기' : '보기'}
              </button>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleInitializeLeaveData}
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                휴가 데이터 초기화
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 대기 중인 휴가 신청 */}
      {showRequests && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">대기 중인 휴가 신청</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              승인 대기 중인 휴가 신청 목록
            </p>
          </div>
          {leaveRequests.length > 0 ? (
            <ul className="border-t border-gray-200 divide-y divide-gray-200">
              {leaveRequests.map((request) => (
                <li key={request.id}>
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-yellow-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-yellow-700">
                              {request.user?.name?.charAt(0) || '?'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {request.user?.name || '알 수 없음'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {request.user?.department} | {request.user?.position}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-sm text-gray-900">
                          <div>종류: {request.request_data?.leave_type === 'annual' ? '연차' : '병가'}</div>
                          <div>기간: {request.request_data?.start_date} ~ {request.request_data?.end_date}</div>
                          <div>일수: {request.request_data?.days}일</div>
                          {request.request_data?.reason && (
                            <div>사유: {request.request_data.reason}</div>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproveLeave(request)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleRejectLeave(request.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                          >
                            거부
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 border-t border-gray-200">
              대기 중인 휴가 신청이 없습니다.
            </div>
          )}
        </div>
      )}
      
      {/* 연차 촉진 관리 */}
      {showPromotion && (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">연차 촉진 관리</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              근로기준법에 따른 연차 촉진 의무 대상자 관리 (근무 1년 이상, 잔여 연차 5일 이상)
            </p>
          </div>
          
          {/* 촉진 대상자 */}
          {legalRequiredEmployees.length > 0 ? (
            <div className="border-t border-gray-200">
              <div className="px-4 py-3 bg-red-50">
                <h4 className="text-sm font-medium text-red-800">촉진 대상자 ({legalRequiredEmployees.length}명)</h4>
              </div>
              <ul className="divide-y divide-gray-200">
                {legalRequiredEmployees.map((data) => (
                  <li key={data.employee.id}>
                    <div className="px-4 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-red-700">
                              {data.employee.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{data.employee.name}</div>
                          <div className="text-sm text-gray-500">
                            {data.employee.department} | {data.employee.position}
                          </div>
                          <div className="text-xs text-red-600">
                            근무: {Math.floor(data.workingMonths / 12)}년 {data.workingMonths % 12}개월 | 
                            잔여연차: {data.remainingDays}일
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          촉진 필요
                        </span>
                        <button
                          onClick={() => sendPromotionNotice(data.employee.id, data.employee.name)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          안내 발송
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 border-t border-gray-200">
              현재 연차 촉진 대상자가 없습니다.
            </div>
          )}
        </div>
      )}
      
      {/* 직원별 휴가 현황 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">직원별 휴가 현황</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                직원을 선택하여 휴가 상세 정보를 확인하고 수정하세요
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowActiveOnly(true)}
                className={`px-3 py-1 text-sm rounded-md ${showActiveOnly ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
              >
                재직자 ({activeEmployees.length})
              </button>
              <button
                onClick={() => setShowActiveOnly(false)}
                className={`px-3 py-1 text-sm rounded-md ${!showActiveOnly ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}
              >
                퇴사자 ({retiredEmployees.length})
              </button>
            </div>
          </div>
          
          {/* 직원 선택 드롭다운 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {showActiveOnly ? '재직자' : '퇴사자'} 선택
            </label>
            <select
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const employee = displayEmployees.find(emp => emp.id === e.target.value)
                setSelectedEmployee(employee || null)
                setEditingLeave(null)
              }}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">직원을 선택하세요</option>
              {displayEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.user?.name} - {employee.user?.department} {employee.user?.position}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* 선택된 직원 휴가 상세 정보 */}
        {selectedEmployee && (
          <div className="border-t border-gray-200 px-4 py-5">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 h-12 w-12">
                    <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-700">
                        {selectedEmployee.user?.name?.charAt(0) || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">{selectedEmployee.user?.name}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedEmployee.user?.department} | {selectedEmployee.user?.position}
                    </p>
                    {selectedEmployee.user?.termination_date && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                        퇴사일: {selectedEmployee.user.termination_date}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-2">연차</h5>
                    <div className="text-sm text-blue-700">
                      <p>총 연차: {selectedEmployee.leave_types.annual_days}일</p>
                      <p>사용: {selectedEmployee.leave_types.used_annual_days}일</p>
                      <p>잔여: {selectedEmployee.leave_types.annual_days - selectedEmployee.leave_types.used_annual_days}일</p>
                    </div>
                    <div className="mt-2">
                      <div className="bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{
                            width: `${Math.min((selectedEmployee.leave_types.used_annual_days / selectedEmployee.leave_types.annual_days) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {Math.round((selectedEmployee.leave_types.used_annual_days / selectedEmployee.leave_types.annual_days) * 100)}% 사용
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h5 className="font-medium text-red-900 mb-2">병가</h5>
                    <div className="text-sm text-red-700">
                      <p>총 병가: {selectedEmployee.leave_types.sick_days}일</p>
                      <p>사용: {selectedEmployee.leave_types.used_sick_days}일</p>
                      <p>잔여: {selectedEmployee.leave_types.sick_days - selectedEmployee.leave_types.used_sick_days}일</p>
                    </div>
                    <div className="mt-2">
                      <div className="bg-red-200 rounded-full h-2">
                        <div 
                          className="bg-red-600 h-2 rounded-full" 
                          style={{
                            width: `${Math.min((selectedEmployee.leave_types.used_sick_days / selectedEmployee.leave_types.sick_days) * 100, 100)}%`
                          }}
                        ></div>
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        {Math.round((selectedEmployee.leave_types.used_sick_days / selectedEmployee.leave_types.sick_days) * 100)}% 사용
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="ml-4 space-y-2">
                <button
                  onClick={() => handleEditLeave(selectedEmployee)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 block w-full"
                >
                  휴가 수정
                </button>
                <button
                  onClick={() => handleAddLeave(selectedEmployee)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 block w-full"
                >
                  수동 연차 추가
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* 휴가 수정 모달 */}
      {editingLeave && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingLeave.user?.name} 휴가 수정
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">총 연차</label>
                  <input
                    type="number"
                    value={editForm.annual_days}
                    onChange={(e) => setEditForm({...editForm, annual_days: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">사용 연차</label>
                  <input
                    type="number"
                    value={editForm.used_annual_days}
                    onChange={(e) => setEditForm({...editForm, used_annual_days: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">총 병가</label>
                  <input
                    type="number"
                    value={editForm.sick_days}
                    onChange={(e) => setEditForm({...editForm, sick_days: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">사용 병가</label>
                  <input
                    type="number"
                    value={editForm.used_sick_days}
                    onChange={(e) => setEditForm({...editForm, used_sick_days: parseInt(e.target.value) || 0})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setEditingLeave(null)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveLeave}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 수동 연차 추가 모달 */}
      {showAddLeave && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {addLeaveForm.employee_name} 수동 연차 추가
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 종류</label>
                  <select
                    value={addLeaveForm.leave_type}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, leave_type: e.target.value as 'annual' | 'sick'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
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
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">종료일</label>
                  <input
                    type="date"
                    value={addLeaveForm.end_date}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, end_date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 일수</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={addLeaveForm.days}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, days: parseFloat(e.target.value) || 0})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">사유 (선택)</label>
                  <textarea
                    value={addLeaveForm.reason}
                    onChange={(e) => setAddLeaveForm({...addLeaveForm, reason: e.target.value})}
                    rows={2}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="휴가 사유"
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
                  className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
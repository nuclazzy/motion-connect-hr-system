'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

interface Employee {
  id: string
  name: string
  department: string
  position: string
  hire_date: string
  termination_date?: string
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
}

interface LeavePromotionData {
  employee: Employee
  leaveData: LeaveData | null
  remainingDays: number
  workingMonths: number
  isLegalRequired: boolean
}

export default function AdminLeavePromotion() {
  const [promotionData, setPromotionData] = useState<LeavePromotionData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState<LeavePromotionData | null>(null)
  const [showLeaveEntryForm, setShowLeaveEntryForm] = useState(false)
  const [leaveFormData, setLeaveFormData] = useState({
    employeeId: '',
    leaveType: 'annual',
    customLeaveType: '',
    startDate: '',
    endDate: '',
    description: '',
    days: 1,
    isHalfDay: false,
    halfDayType: 'morning'
  })

  useEffect(() => {
    fetchPromotionData()
  }, [])

  const fetchPromotionData = async () => {
    try {
      setLoading(true)
      
      // 재직자 정보 가져오기
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
      const activeEmployees = employees?.filter(emp => 
        !emp.termination_date || new Date(emp.termination_date) > new Date()
      ) || []

      // 휴가 데이터 가져오기
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_days')
        .select('*')

      if (leaveError) {
        console.error('휴가 데이터 조회 실패:', leaveError)
        return
      }

      // 데이터 조합 및 분석
      const combinedData: LeavePromotionData[] = activeEmployees.map(employee => {
        const userLeaveData = leaveData?.find(leave => leave.user_id === employee.id) || null
        
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

      // 연차 촉진 대상자 우선 정렬
      const sortedData = combinedData.sort((a, b) => {
        if (a.isLegalRequired && !b.isLegalRequired) return -1
        if (!a.isLegalRequired && b.isLegalRequired) return 1
        return b.remainingDays - a.remainingDays
      })

      setPromotionData(sortedData)
    } catch (error) {
      console.error('연차 촉진 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendPromotionNotice = async (employeeData: LeavePromotionData) => {
    try {
      const confirmed = confirm(`${employeeData.employee.name}님에게 연차 촉진 안내를 발송하시겠습니까?`)
      
      if (confirmed) {
        // TODO: 실제 이메일 발송 로직 구현
        // 여기서는 알림 기록만 남김
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: employeeData.employee.id,
            type: 'leave_promotion',
            title: '연차 사용 촉진 안내',
            message: `잔여 연차 ${employeeData.remainingDays}일이 있습니다. 연차 소멸 전 사용해주세요.`,
            created_at: new Date().toISOString()
          })

        if (error) {
          console.error('알림 저장 실패:', error)
        }

        alert(`${employeeData.employee.name}님에게 연차 촉진 안내가 발송되었습니다.`)
      }
    } catch (error) {
      console.error('연차 촉진 안내 발송 오류:', error)
      alert('안내 발송에 실패했습니다.')
    }
  }

  const handleManualLeaveEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const selectedEmployeeData = promotionData.find(data => data.employee.id === leaveFormData.employeeId)
      if (!selectedEmployeeData) {
        alert('선택된 직원 정보를 찾을 수 없습니다.')
        return
      }

      const startDate = new Date(leaveFormData.startDate)
      const endDate = new Date(leaveFormData.endDate)
      const daysDifference = leaveFormData.isHalfDay ? 0.5 : Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

      // 휴가 유형 결정
      const finalLeaveType = leaveFormData.leaveType === 'custom' ? leaveFormData.customLeaveType : leaveFormData.leaveType
      const displayLeaveType = finalLeaveType === 'annual' ? '연차' : 
                              finalLeaveType === 'sick' ? '병가' :
                              finalLeaveType === 'personal' ? '개인사유' :
                              finalLeaveType === 'family' ? '경조사' : finalLeaveType
      
      // 반차 표시
      const halfDayDisplay = leaveFormData.isHalfDay ? ` (${leaveFormData.halfDayType === 'morning' ? '오전' : '오후'} 반차)` : ''

      // 1. Google Calendar에 휴가 일정 추가
      const calendarEventData = {
        summary: `${selectedEmployeeData.employee.name} - ${displayLeaveType}${halfDayDisplay}`,
        description: leaveFormData.description || `${selectedEmployeeData.employee.name}님의 ${displayLeaveType}${halfDayDisplay} (${daysDifference}일)`,
        start: {
          date: leaveFormData.startDate,
          timeZone: 'Asia/Seoul'
        },
        end: {
          date: new Date(endDate.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 종료일 다음날
          timeZone: 'Asia/Seoul'
        }
      }

      const calendarResponse = await fetch('/api/calendar/create-event-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: CALENDAR_IDS.LEAVE_MANAGEMENT,
          eventData: calendarEventData
        }),
      })

      let googleEventId = null
      if (calendarResponse.ok) {
        const calendarResult = await calendarResponse.json()
        if (calendarResult.success) {
          googleEventId = calendarResult.event.id
        }
      }

      // 2. 휴가 사용 기록 업데이트
      if (finalLeaveType === 'annual' && selectedEmployeeData.leaveData) {
        const newUsedAnnualDays = selectedEmployeeData.leaveData.leave_types.used_annual_days + daysDifference
        
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({
            leave_types: {
              ...selectedEmployeeData.leaveData.leave_types,
              used_annual_days: newUsedAnnualDays
            }
          })
          .eq('user_id', leaveFormData.employeeId)

        if (updateError) {
          console.error('휴가 데이터 업데이트 실패:', updateError)
        }
      }

      // 3. 휴가 기록 로그 저장
      const { error: logError } = await supabase
        .from('leave_records')
        .insert([{
          user_id: leaveFormData.employeeId,
          leave_type: finalLeaveType,
          start_date: leaveFormData.startDate,
          end_date: leaveFormData.endDate,
          days: daysDifference,
          description: leaveFormData.description,
          google_event_id: googleEventId,
          created_at: new Date().toISOString()
        }])

      if (logError) {
        console.error('휴가 기록 저장 실패:', logError)
      }

      alert(`${selectedEmployeeData.employee.name}님의 ${displayLeaveType}${halfDayDisplay} (${daysDifference}일)이 성공적으로 등록되었습니다.`)
      
      // 폼 초기화 및 모달 닫기
      setLeaveFormData({
        employeeId: '',
        leaveType: 'annual',
        customLeaveType: '',
        startDate: '',
        endDate: '',
        description: '',
        days: 1,
        isHalfDay: false,
        halfDayType: 'morning'
      })
      setShowLeaveEntryForm(false)
      
      // 데이터 새로고침
      fetchPromotionData()
      
    } catch (error) {
      console.error('휴가 등록 오류:', error)
      alert('휴가 등록 중 오류가 발생했습니다.')
    }
  }

  const legalRequiredEmployees = promotionData.filter(data => data.isLegalRequired)
  const recommendedEmployees = promotionData.filter(data => !data.isLegalRequired && data.remainingDays >= 3)

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
      {/* 요약 정보 */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    연차 촉진 관리
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    총 {promotionData.length}명 중 {legalRequiredEmployees.length}명 법적 촉진 대상
                  </dd>
                </dl>
              </div>
            </div>
            <div>
              <button
                onClick={() => setShowLeaveEntryForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                휴가 수동 입력
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-gray-600 space-y-1">
              <p className="text-red-600 font-medium">법적 촉진 대상: {legalRequiredEmployees.length}명 (1년 이상 근무, 잔여 연차 5일 이상)</p>
              <p className="text-orange-600">권장 촉진 대상: {recommendedEmployees.length}명 (잔여 연차 3일 이상)</p>
            </div>
          </div>
        </div>
      </div>

      {/* 법적 촉진 대상자 */}
      {legalRequiredEmployees.length > 0 && (
        <div className="bg-red-50 border border-red-200 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-red-900">법적 연차 촉진 대상자</h3>
            <p className="mt-1 max-w-2xl text-sm text-red-700">
              근로기준법에 따라 연차 촉진이 필요한 직원들입니다.
            </p>
          </div>
          <div className="border-t border-red-200">
            <ul className="divide-y divide-red-200">
              {legalRequiredEmployees.map((data) => (
                <li key={data.employee.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-red-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-red-700">
                            {data.employee.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {data.employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.employee.department} | {data.employee.position}
                        </div>
                        <div className="text-sm">
                          <span className="text-red-600 font-medium">
                            잔여 연차: {data.remainingDays}일
                          </span>
                          <span className="text-gray-500 ml-2">
                            (총 {data.leaveData?.leave_types.annual_days || 0}일 중 {data.leaveData?.leave_types.used_annual_days || 0}일 사용)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedEmployee(data)}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-200"
                      >
                        상세보기
                      </button>
                      <button
                        onClick={() => sendPromotionNotice(data)}
                        className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700"
                      >
                        촉진 안내 발송
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 권장 촉진 대상자 */}
      {recommendedEmployees.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-orange-900">권장 연차 촉진 대상자</h3>
            <p className="mt-1 max-w-2xl text-sm text-orange-700">
              연차 소멸 방지를 위해 사용을 권장하는 직원들입니다.
            </p>
          </div>
          <div className="border-t border-orange-200">
            <ul className="divide-y divide-orange-200">
              {recommendedEmployees.map((data) => (
                <li key={data.employee.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-orange-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-orange-700">
                            {data.employee.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {data.employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {data.employee.department} | {data.employee.position}
                        </div>
                        <div className="text-sm">
                          <span className="text-orange-600 font-medium">
                            잔여 연차: {data.remainingDays}일
                          </span>
                          <span className="text-gray-500 ml-2">
                            (총 {data.leaveData?.leave_types.annual_days || 0}일 중 {data.leaveData?.leave_types.used_annual_days || 0}일 사용)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedEmployee(data)}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-md text-sm font-medium hover:bg-gray-200"
                      >
                        상세보기
                      </button>
                      <button
                        onClick={() => sendPromotionNotice(data)}
                        className="bg-orange-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-orange-700"
                      >
                        촉진 안내 발송
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 상세보기 모달 */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedEmployee.employee.name}님 연차 현황
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">부서</dt>
                    <dd className="text-sm text-gray-900">{selectedEmployee.employee.department}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">직책</dt>
                    <dd className="text-sm text-gray-900">{selectedEmployee.employee.position}</dd>
                  </div>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">입사일</dt>
                  <dd className="text-sm text-gray-900">{selectedEmployee.employee.hire_date}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-500">근무 개월 수</dt>
                  <dd className="text-sm text-gray-900">{selectedEmployee.workingMonths}개월</dd>
                </div>
                
                <div className="border-t pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">총 연차</dt>
                      <dd className="text-sm text-gray-900">{selectedEmployee.leaveData?.leave_types.annual_days || 0}일</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">사용 연차</dt>
                      <dd className="text-sm text-gray-900">{selectedEmployee.leaveData?.leave_types.used_annual_days || 0}일</dd>
                    </div>
                  </div>
                  <div className="mt-2">
                    <dt className="text-sm font-medium text-gray-500">잔여 연차</dt>
                    <dd className={`text-lg font-medium ${selectedEmployee.isLegalRequired ? 'text-red-600' : 'text-orange-600'}`}>
                      {selectedEmployee.remainingDays}일
                    </dd>
                  </div>
                </div>
                
                {selectedEmployee.isLegalRequired && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-700 font-medium">
                      ⚠️ 법적 연차 촉진 대상자입니다.
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      근로기준법에 따라 연차 사용을 촉진해야 합니다.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setSelectedEmployee(null)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400"
                >
                  닫기
                </button>
                <button
                  onClick={() => {
                    sendPromotionNotice(selectedEmployee)
                    setSelectedEmployee(null)
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  촉진 안내 발송
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 휴가 수동 입력 모달 */}
      {showLeaveEntryForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                휴가 수동 입력
              </h3>
              
              <form onSubmit={handleManualLeaveEntry} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">직원 선택</label>
                  <select
                    value={leaveFormData.employeeId}
                    onChange={(e) => setLeaveFormData({...leaveFormData, employeeId: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  >
                    <option value="">직원을 선택하세요</option>
                    {promotionData.map((data) => (
                      <option key={data.employee.id} value={data.employee.id}>
                        {data.employee.name} ({data.employee.department} {data.employee.position})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">휴가 유형</label>
                  <select
                    value={leaveFormData.leaveType}
                    onChange={(e) => setLeaveFormData({...leaveFormData, leaveType: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  >
                    <option value="annual">연차</option>
                    <option value="sick">병가</option>
                    <option value="personal">개인사유</option>
                    <option value="family">경조사</option>
                    <option value="custom">기타 (직접입력)</option>
                  </select>
                </div>

                {leaveFormData.leaveType === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">기타 휴가 유형</label>
                    <input
                      type="text"
                      value={leaveFormData.customLeaveType}
                      onChange={(e) => setLeaveFormData({...leaveFormData, customLeaveType: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="휴가 유형을 입력하세요"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={leaveFormData.isHalfDay}
                      onChange={(e) => setLeaveFormData({...leaveFormData, isHalfDay: e.target.checked, endDate: e.target.checked ? leaveFormData.startDate : leaveFormData.endDate})}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">반차</span>
                  </label>
                </div>

                {leaveFormData.isHalfDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">반차 유형</label>
                    <select
                      value={leaveFormData.halfDayType}
                      onChange={(e) => setLeaveFormData({...leaveFormData, halfDayType: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    >
                      <option value="morning">오전 반차</option>
                      <option value="afternoon">오후 반차</option>
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">시작일</label>
                    <input
                      type="date"
                      value={leaveFormData.startDate}
                      onChange={(e) => setLeaveFormData({...leaveFormData, startDate: e.target.value, endDate: leaveFormData.isHalfDay ? e.target.value : leaveFormData.endDate})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">종료일</label>
                    <input
                      type="date"
                      value={leaveFormData.endDate}
                      onChange={(e) => setLeaveFormData({...leaveFormData, endDate: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={leaveFormData.isHalfDay}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명 (선택사항)</label>
                  <textarea
                    rows={3}
                    value={leaveFormData.description}
                    onChange={(e) => setLeaveFormData({...leaveFormData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="휴가 사유나 추가 정보를 입력하세요"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-700">
                    ℹ️ 외부 웹앱에서 신청받은 휴가를 수동으로 등록하는 기능입니다.
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    등록하면 Google Calendar에 일정이 추가되고 직원의 휴가 사용 기록이 업데이트됩니다.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLeaveEntryForm(false)
                      setLeaveFormData({
                        employeeId: '',
                        leaveType: 'annual',
                        customLeaveType: '',
                        startDate: '',
                        endDate: '',
                        description: '',
                        days: 1,
                        isHalfDay: false,
                        halfDayType: 'morning'
                      })
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
                  >
                    휴가 등록
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
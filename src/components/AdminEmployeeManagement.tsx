'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Assuming a more complete User type
interface Employee {
  id: string
  name: string
  email: string
  department: string
  position: string
  work_type: string
  hire_date: string
  dob: string
  phone: string
  address: string
  is_active: boolean
  resignation_date?: string
  termination_date?: string
  contract_end_date?: string
  annual_leave: number
  sick_leave: number
  substitute_leave_hours: number
  compensatory_leave_hours: number
  // 급여 관련 필드
  annual_salary?: number
  monthly_salary?: number
  basic_salary?: number
  bonus?: number
  meal_allowance?: number
  transportation_allowance?: number
  hourly_wage?: number
  salary_details_updated_at?: string
  // Add other fields as necessary
}

export default function AdminEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'leave' | 'salary' | 'management'>('info')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned' | 'contract'>('all')


  useEffect(() => {
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

        // Supabase에서 직접 users 테이블 조회 (기본 컬럼 먼저 시도)
        let { data: users, error } = await supabase
          .from('users')
          .select(`
            id, name, email, department, position, hire_date,
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
              id, name, email, department, position, hire_date,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return

    setSubmitting(true)
    setError(null)

    try {
      // Supabase로 직접 업데이트
      const { error } = await supabase
        .from('users')
        .update(formData)
        .eq('id', selectedEmployee.id)

      if (error) {
        console.error('❌ Supabase update error:', error)
        throw new Error('직원 정보 업데이트에 실패했습니다.')
      }
      
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
        // 연차/병가 업데이트
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
        
        // 잔여 일수 재계산
        if (leaveType === 'annual_leave') {
          updatedEmployee.annual_leave = (leaveData.annual_days || 0) - (leaveData.used_annual_days || 0);
        } else {
          updatedEmployee.sick_leave = (leaveData.sick_days || 0) - (leaveData.used_sick_days || 0);
        }
        
        (updatedEmployee as any).leave_data = leaveData;
      }
      
      // 직원 목록에서도 업데이트
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp)
      )
      setSelectedEmployee(updatedEmployee)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : '휴가 일수 조정 중 오류가 발생했습니다.')
    }
  }

  const handleResignation = async () => {
    if (!selectedEmployee || !formData.resignation_date) return

    setSubmitting(true)
    setError(null)

    try {
      // Supabase로 직접 퇴사 처리
      const { error } = await supabase
        .from('users')
        .update({ 
          resignation_date: formData.resignation_date,
          termination_date: formData.resignation_date,
          is_active: false
        })
        .eq('id', selectedEmployee.id)

      if (error) {
        console.error('❌ Supabase resignation error:', error)
        throw new Error('퇴사 처리에 실패했습니다.')
      }
      
      alert('퇴사 처리가 완료되었습니다.')
      
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
                    onClick={() => setActiveTab('leave')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'leave'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    휴가 관리
                  </button>
                  <button
                    onClick={() => setActiveTab('salary')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'salary'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    급여 관리
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

              {/* Leave Management Tab */}
              {activeTab === 'leave' && (
                <div className="space-y-6">
                  <h4 className="font-medium text-gray-900 mb-4">휴가 현황 및 조정</h4>
                  <p className="text-sm text-gray-600 mb-4">각 항목을 클릭하여 직접 수정할 수 있습니다.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 연차 카드 */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-lg font-semibold text-blue-900">연차</h5>
                        <div className="text-2xl font-bold text-blue-600">
                          {selectedEmployee.annual_leave || 0}일 잔여
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {/* 지급 일수 */}
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('annual_granted', (selectedEmployee as any)?.leave_data?.annual_days || 0)}>
                          <span className="text-sm font-medium text-gray-700">지급 일수</span>
                          {editingField === 'annual_granted' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('annual_granted', 'annual_leave', 'granted')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('annual_granted', 'annual_leave', 'granted')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-blue-600">{(selectedEmployee as any)?.leave_data?.annual_days || 0}일</span>
                          )}
                        </div>
                        
                        {/* 사용 일수 */}
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('annual_used', (selectedEmployee as any)?.leave_data?.used_annual_days || 0)}>
                          <span className="text-sm font-medium text-gray-700">사용 일수</span>
                          {editingField === 'annual_used' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('annual_used', 'annual_leave', 'used')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('annual_used', 'annual_leave', 'used')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-red-600">{(selectedEmployee as any)?.leave_data?.used_annual_days || 0}일</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 병가 카드 */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-lg font-semibold text-red-900">병가</h5>
                        <div className="text-2xl font-bold text-red-600">
                          {selectedEmployee.sick_leave || 0}일 잔여
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {/* 지급 일수 */}
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('sick_granted', (selectedEmployee as any)?.leave_data?.sick_days || 0)}>
                          <span className="text-sm font-medium text-gray-700">지급 일수</span>
                          {editingField === 'sick_granted' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('sick_granted', 'sick_leave', 'granted')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('sick_granted', 'sick_leave', 'granted')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-blue-600">{(selectedEmployee as any)?.leave_data?.sick_days || 0}일</span>
                          )}
                        </div>
                        
                        {/* 사용 일수 */}
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('sick_used', (selectedEmployee as any)?.leave_data?.used_sick_days || 0)}>
                          <span className="text-sm font-medium text-gray-700">사용 일수</span>
                          {editingField === 'sick_used' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('sick_used', 'sick_leave', 'used')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('sick_used', 'sick_leave', 'used')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-red-600">{(selectedEmployee as any)?.leave_data?.used_sick_days || 0}일</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 대체휴가 카드 */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-lg font-semibold text-purple-900">대체휴가</h5>
                        <div className="text-2xl font-bold text-purple-600">
                          {selectedEmployee.substitute_leave_hours || 0}시간
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('substitute_hours', selectedEmployee.substitute_leave_hours || 0)}>
                          <span className="text-sm font-medium text-gray-700">보유 시간</span>
                          {editingField === 'substitute_hours' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('substitute_hours', 'substitute_leave_hours', 'granted')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('substitute_hours', 'substitute_leave_hours', 'granted')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-purple-600">{selectedEmployee.substitute_leave_hours || 0}시간</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 보상휴가 카드 */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-lg font-semibold text-orange-900">보상휴가</h5>
                        <div className="text-2xl font-bold text-orange-600">
                          {selectedEmployee.compensatory_leave_hours || 0}시간
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-white rounded border hover:bg-gray-50 cursor-pointer"
                             onClick={() => handleFieldEdit('compensatory_hours', selectedEmployee.compensatory_leave_hours || 0)}>
                          <span className="text-sm font-medium text-gray-700">보유 시간</span>
                          {editingField === 'compensatory_hours' ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.1"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleFieldSave('compensatory_hours', 'compensatory_leave_hours', 'granted')
                                  } else if (e.key === 'Escape') {
                                    handleFieldCancel()
                                  }
                                }}
                                className="w-16 px-2 py-1 text-sm border rounded"
                                autoFocus
                              />
                              <button onClick={(e) => {e.stopPropagation(); handleFieldSave('compensatory_hours', 'compensatory_leave_hours', 'granted')}} className="text-green-600 hover:text-green-800">✓</button>
                              <button onClick={(e) => {e.stopPropagation(); handleFieldCancel()}} className="text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span className="text-lg font-semibold text-orange-600">{selectedEmployee.compensatory_leave_hours || 0}시간</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-yellow-800 mb-2">💡 사용 안내</h5>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• 각 항목을 클릭하면 직접 수정할 수 있습니다</li>
                      <li>• Enter 키로 저장, Esc 키로 취소할 수 있습니다</li>
                      <li>• 연차/병가는 지급 일수와 사용 일수를 별도로 관리합니다</li>
                      <li>• 대체휴가/보상휴가는 보유 시간을 직접 설정합니다</li>
                    </ul>
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
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleResignation}
                        disabled={submitting || !formData.resignation_date}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50"
                      >
                        {submitting ? '처리 중...' : '퇴사 처리'}
                      </button>
                    </div>
                  </div>

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

              {/* Salary Management Tab */}
              {activeTab === 'salary' && (
                <div className="space-y-6">
                  {/* 급여 정보 입력/수정 */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">급여 정보</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="annual_salary" className="block text-sm font-medium text-gray-700">연봉 (만원)</label>
                        <input
                          type="number"
                          name="annual_salary"
                          id="annual_salary"
                          value={formData.annual_salary || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="monthly_salary" className="block text-sm font-medium text-gray-700">월급여 (만원)</label>
                        <input
                          type="number"
                          name="monthly_salary"
                          id="monthly_salary"
                          value={formData.monthly_salary || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="basic_salary" className="block text-sm font-medium text-gray-700">기본급 (만원)</label>
                        <input
                          type="number"
                          name="basic_salary"
                          id="basic_salary"
                          value={formData.basic_salary || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="bonus" className="block text-sm font-medium text-gray-700">상여 (만원)</label>
                        <input
                          type="number"
                          name="bonus"
                          id="bonus"
                          value={formData.bonus || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="meal_allowance" className="block text-sm font-medium text-gray-700">식대 (만원)</label>
                        <input
                          type="number"
                          name="meal_allowance"
                          id="meal_allowance"
                          value={formData.meal_allowance || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="transportation_allowance" className="block text-sm font-medium text-gray-700">자가운전 수당 (만원)</label>
                        <input
                          type="number"
                          name="transportation_allowance"
                          id="transportation_allowance"
                          value={formData.transportation_allowance || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="hourly_wage" className="block text-sm font-medium text-gray-700">통상 시급 (원)</label>
                        <input
                          type="number"
                          name="hourly_wage"
                          id="hourly_wage"
                          value={formData.hourly_wage || ''}
                          onChange={handleInputChange}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          placeholder="0"
                        />
                        {formData.hourly_wage && formData.hourly_wage < 9860 && (
                          <p className="mt-1 text-sm text-red-600">⚠️ 2024년 최저시급(9,860원) 미달</p>
                        )}
                      </div>
                    </div>
                    
                    {/* 급여 계산 정보 표시 */}
                    {formData.hourly_wage && (
                      <div className="mt-4 p-3 bg-white rounded border">
                        <h5 className="text-sm font-medium text-gray-900 mb-2">수당 계산 미리보기</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                          <div>초과근무수당 (1시간): {Math.round(formData.hourly_wage * 1.5).toLocaleString()}원</div>
                          <div>야간근로수당 (1시간): {Math.round(formData.hourly_wage * 1.5).toLocaleString()}원</div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => handleSubmit({} as React.FormEvent)}
                        disabled={submitting}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {submitting ? '저장 중...' : '급여 정보 저장'}
                      </button>
                    </div>

                    {/* 급여 정보 수정 이력 */}
                    {selectedEmployee?.salary_details_updated_at && (
                      <div className="mt-4 text-sm text-gray-500">
                        최종 수정: {new Date(selectedEmployee.salary_details_updated_at).toLocaleString('ko-KR')}
                      </div>
                    )}
                  </div>

                  {/* 급여 계산 가이드 */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">급여 계산 가이드</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>• <strong>연봉:</strong> 연간 총 급여 (세전)</div>
                      <div>• <strong>월급여:</strong> 월별 기본 급여</div>
                      <div>• <strong>기본급:</strong> 고정 기본급</div>
                      <div>• <strong>상여:</strong> 연간 상여금</div>
                      <div>• <strong>식대:</strong> 월별 식대 지원</div>
                      <div>• <strong>자가운전 수당:</strong> 월별 교통비 지원</div>
                      <div>• <strong>통상 시급:</strong> 초과근무 및 야간근로 수당 계산 기준</div>
                    </div>
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
    </div>
  )
}

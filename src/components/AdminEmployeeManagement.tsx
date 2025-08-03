'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'
import { getAuthHeaders } from '@/lib/auth'

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
  annual_leave: number
  sick_leave: number
  substitute_leave_hours: number
  compensatory_leave_hours: number
  // Add other fields as necessary
}

export default function AdminEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [formData, setFormData] = useState<Partial<Employee>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'leave' | 'management'>('info')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned'>('all')


  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/employees', {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error('직원 목록을 불러오는데 실패했습니다.')
      }
      const data = await response.json()
      const newEmployees = data.employees || []
      setEmployees(newEmployees)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedEmployee) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '직원 정보 업데이트에 실패했습니다.')
      }
      
      alert('직원 정보가 성공적으로 업데이트되었습니다.')
      // Refresh the list to show updated data
      fetchEmployees()
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

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/employees/${selectedEmployee.id}/adjust-leave`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leaveType, adjustmentType, amount }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '휴가 일수 조정에 실패했습니다.')
      }
      
      alert('휴가 일수가 성공적으로 조정되었습니다.')
      // 직원 목록 새로고침 (선택된 직원도 자동 업데이트됨)
      fetchEmployees()
    } catch (err) {
      setError(err instanceof Error ? err.message : '휴가 일수 조정 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResignation = async () => {
    if (!selectedEmployee || !formData.resignation_date) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/employees/${selectedEmployee.id}/resign`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ resignation_date: formData.resignation_date }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '퇴사 처리에 실패했습니다.')
      }
      
      alert('퇴사 처리가 완료되었습니다.')
      fetchEmployees()
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
      const response = await fetch(`/api/admin/employees/${selectedEmployee.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '직원 삭제에 실패했습니다.')
      }
      
      alert('직원이 성공적으로 삭제되었습니다.')
      setSelectedEmployee(null)
      setShowDeleteConfirm(false)
      fetchEmployees()
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
        return employees.filter(emp => !emp.termination_date)
      case 'resigned':
        return employees.filter(emp => !!emp.termination_date)
      default:
        return employees
    }
  }

  const filteredEmployees = getFilteredEmployees()

  if (loading) return <div className="p-4">직원 목록을 불러오는 중...</div>
  if (error && !employees.length) return <div className="p-4 text-red-500">오류: {error}</div>

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
                  <div className="flex items-center">
                    <input
                        id="is_active"
                        name="is_active"
                        type="checkbox"
                        checked={formData.is_active ?? true}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                        재직 중
                    </label>
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

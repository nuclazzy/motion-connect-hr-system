'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'

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

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/employees')
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
        headers: { 'Content-Type': 'application/json' },
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

  const handleLeaveAdjustment = async (leaveType: string, amount: number) => {
    if (!selectedEmployee) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/employees/${selectedEmployee.id}/adjust-leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, amount }),
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
        headers: { 'Content-Type': 'application/json' },
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

  if (loading) return <div className="p-4">직원 목록을 불러오는 중...</div>
  if (error && !employees.length) return <div className="p-4 text-red-500">오류: {error}</div>

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <h3 className="text-lg font-medium text-gray-900">직원 정보 관리</h3>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>
      <div className="border-t border-gray-200 md:grid md:grid-cols-3">
        {/* Employee List */}
        <div className="md:col-span-1 border-r border-gray-200 h-96 overflow-y-auto">
          <ul>
            {employees.map(emp => (
              <li key={emp.id}>
                <button
                  onClick={() => handleSelectEmployee(emp)}
                  className={`w-full text-left p-4 ${selectedEmployee?.id === emp.id ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <p className="font-medium text-indigo-600">{emp.name} ({emp.position})</p>
                  <p className="text-sm text-gray-500">{emp.department}</p>
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
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-4">현재 휴가 잔여 현황</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">연차</div>
                        <div className="text-lg font-semibold">{selectedEmployee.annual_leave || 0}일</div>
                        <div className="text-xs text-gray-500 mt-1">
                          (사용: {(15 - (selectedEmployee.annual_leave || 0))}일 / 전체: 15일)
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">병가</div>
                        <div className="text-lg font-semibold">{selectedEmployee.sick_leave || 0}일</div>
                        <div className="text-xs text-gray-500 mt-1">
                          (사용: {(60 - (selectedEmployee.sick_leave || 0))}일 / 전체: 60일)
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">대체휴가</div>
                        <div className="text-lg font-semibold">{selectedEmployee.substitute_leave_hours || 0}시간</div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm text-gray-600">보상휴가</div>
                        <div className="text-lg font-semibold">{selectedEmployee.compensatory_leave_hours || 0}시간</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">휴가 일수 조정</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">연차 조정</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="일수 (예: 5, -2.5)"
                            className="flex-1 border-gray-300 rounded-md shadow-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                const amount = parseFloat(input.value)
                                if (!isNaN(amount)) {
                                  handleLeaveAdjustment('annual_leave', amount)
                                  input.value = ''
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                              const amount = parseFloat(input.value)
                              if (!isNaN(amount)) {
                                handleLeaveAdjustment('annual_leave', amount)
                                input.value = ''
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            조정
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">병가 조정</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="일수 (예: 5, -2.5)"
                            className="flex-1 border-gray-300 rounded-md shadow-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                const amount = parseFloat(input.value)
                                if (!isNaN(amount)) {
                                  handleLeaveAdjustment('sick_leave', amount)
                                  input.value = ''
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                              const amount = parseFloat(input.value)
                              if (!isNaN(amount)) {
                                handleLeaveAdjustment('sick_leave', amount)
                                input.value = ''
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            조정
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">대체휴가 조정 (시간)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="시간 (예: 8, -4)"
                            className="flex-1 border-gray-300 rounded-md shadow-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                const amount = parseFloat(input.value)
                                if (!isNaN(amount)) {
                                  handleLeaveAdjustment('substitute_leave_hours', amount)
                                  input.value = ''
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                              const amount = parseFloat(input.value)
                              if (!isNaN(amount)) {
                                handleLeaveAdjustment('substitute_leave_hours', amount)
                                input.value = ''
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            조정
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">보상휴가 조정 (시간)</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="시간 (예: 8, -4)"
                            className="flex-1 border-gray-300 rounded-md shadow-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                const amount = parseFloat(input.value)
                                if (!isNaN(amount)) {
                                  handleLeaveAdjustment('compensatory_leave_hours', amount)
                                  input.value = ''
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                              const amount = parseFloat(input.value)
                              if (!isNaN(amount)) {
                                handleLeaveAdjustment('compensatory_leave_hours', amount)
                                input.value = ''
                              }
                            }}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                          >
                            조정
                          </button>
                        </div>
                      </div>
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: string
  name: string
  email: string
  department: string
  position: string
  hire_date: string
  work_type: string
  annual_salary?: number
  monthly_salary?: number
  basic_salary?: number
  bonus?: number
  meal_allowance?: number
  transportation_allowance?: number
  hourly_wage?: number
  salary_details_updated_at?: string
  termination_date?: string
  contract_end_date?: string
}

interface SalaryDetails {
  annual_salary: number
  monthly_salary: number
  basic_salary: number
  bonus: number
  meal_allowance: number
  transportation_allowance: number
  hourly_wage: number
}

interface MinimumWageData {
  currentMinimumWage: number
  currentYear: number
}

export default function AdminDetailedSalaryManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [editData, setEditData] = useState<SalaryDetails>({
    annual_salary: 0,
    monthly_salary: 0,
    basic_salary: 0,
    bonus: 0,
    meal_allowance: 0,
    transportation_allowance: 0,
    hourly_wage: 0
  })
  const [minimumWage, setMinimumWage] = useState<MinimumWageData>({
    currentMinimumWage: 9860,
    currentYear: 2024
  })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'resigned' | 'contract'>('active')

  const fetchMinimumWage = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/minimum-wage')
      const data = await response.json()
      
      if (data.success) {
        setMinimumWage({
          currentMinimumWage: data.currentMinimumWage,
          currentYear: data.currentYear
        })
      }
    } catch (error) {
      console.error('최저임금 조회 오류:', error)
    }
  }, [])

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('users')
        .select(`
          id, name, email, department, position, hire_date, work_type,
          annual_salary, monthly_salary, basic_salary, bonus, meal_allowance,
          transportation_allowance, hourly_wage, salary_details_updated_at,
          termination_date, contract_end_date
        `)
        .neq('role', 'admin')
        .order('name')

      // 필터 적용
      if (filter === 'active') {
        query = query.eq('work_type', '정규직')
      } else if (filter === 'resigned') {
        query = query.eq('work_type', '퇴사자')
      } else if (filter === 'contract') {
        query = query.eq('work_type', '계약직')
      }

      const { data, error } = await query

      if (error) {
        console.error('직원 데이터 조회 오류:', error)
        return
      }

      setEmployees(data || [])
    } catch (err) {
      console.error('직원 목록 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchEmployees()
    fetchMinimumWage()
  }, [fetchEmployees, fetchMinimumWage])

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee.id)
    setEditData({
      annual_salary: employee.annual_salary || 0,
      monthly_salary: employee.monthly_salary || 0,
      basic_salary: employee.basic_salary || 0,
      bonus: employee.bonus || 0,
      meal_allowance: employee.meal_allowance || 0,
      transportation_allowance: employee.transportation_allowance || 0,
      hourly_wage: employee.hourly_wage || 0
    })
  }

  const handleSave = async (employeeId: string) => {
    // 유효성 검사
    if (editData.hourly_wage <= 0) {
      alert('통상 시급을 입력해주세요.')
      return
    }

    setSavingId(employeeId)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          ...editData,
          salary_details_updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)

      if (error) {
        console.error('급여 정보 업데이트 오류:', error)
        alert('급여 정보 업데이트에 실패했습니다.')
        return
      }

      // 성공 시 상태 업데이트
      setEmployees(employees.map(emp => 
        emp.id === employeeId 
          ? { ...emp, ...editData, salary_details_updated_at: new Date().toISOString() }
          : emp
      ))

      setEditingEmployee(null)
      alert('급여 정보가 성공적으로 업데이트되었습니다.')
    } catch (err) {
      console.error('급여 정보 저장 오류:', err)
      alert('급여 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  const handleCancel = () => {
    setEditingEmployee(null)
    setEditData({
      annual_salary: 0,
      monthly_salary: 0,
      basic_salary: 0,
      bonus: 0,
      meal_allowance: 0,
      transportation_allowance: 0,
      hourly_wage: 0
    })
  }

  const calculateOvertimePay = (hourlyWage: number, overtimeHours: number) => {
    return Math.round(hourlyWage * overtimeHours * 1.5)
  }

  const calculateNightPay = (hourlyWage: number, nightHours: number) => {
    return Math.round(hourlyWage * nightHours * 1.5)
  }

  const isMinimumWageViolation = (hourlyWage: number) => {
    return hourlyWage < minimumWage.currentMinimumWage
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR')
  }

  const getWorkTypeColor = (workType: string) => {
    switch (workType) {
      case '정규직': return 'bg-green-100 text-green-800'
      case '계약직': return 'bg-blue-100 text-blue-800'
      case '퇴사자': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
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

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">상세 급여 관리</h3>
            <p className="text-sm text-gray-500">
              {minimumWage.currentYear}년 최저시급: {formatCurrency(minimumWage.currentMinimumWage)}원
            </p>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              재직자
            </button>
            <button
              onClick={() => setFilter('contract')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'contract' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              계약직
            </button>
            <button
              onClick={() => setFilter('resigned')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'resigned' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              퇴사자
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              전체
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원정보</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연봉/월급여</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">기본급/상여</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수당</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">통상시급</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length > 0 ? (
                employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                        <div className="text-sm text-gray-500">{employee.department} · {employee.position}</div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getWorkTypeColor(employee.work_type)} mt-1 w-fit`}>
                          {employee.work_type}
                        </span>
                      </div>
                    </td>
                    
                    {editingEmployee === employee.id ? (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editData.annual_salary}
                              onChange={(e) => setEditData({...editData, annual_salary: parseInt(e.target.value) || 0})}
                              placeholder="연봉(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                            <input
                              type="number"
                              value={editData.monthly_salary}
                              onChange={(e) => setEditData({...editData, monthly_salary: parseInt(e.target.value) || 0})}
                              placeholder="월급여(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editData.basic_salary}
                              onChange={(e) => setEditData({...editData, basic_salary: parseInt(e.target.value) || 0})}
                              placeholder="기본급(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                            <input
                              type="number"
                              value={editData.bonus}
                              onChange={(e) => setEditData({...editData, bonus: parseInt(e.target.value) || 0})}
                              placeholder="상여(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-2">
                            <input
                              type="number"
                              value={editData.meal_allowance}
                              onChange={(e) => setEditData({...editData, meal_allowance: parseInt(e.target.value) || 0})}
                              placeholder="식대(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                            <input
                              type="number"
                              value={editData.transportation_allowance}
                              onChange={(e) => setEditData({...editData, transportation_allowance: parseInt(e.target.value) || 0})}
                              placeholder="교통비(만원)"
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            value={editData.hourly_wage}
                            onChange={(e) => setEditData({...editData, hourly_wage: parseInt(e.target.value) || 0})}
                            placeholder="시급(원)"
                            className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleSave(employee.id)}
                              disabled={savingId === employee.id}
                              className="bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-green-50 disabled:text-green-400 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              {savingId === employee.id ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={handleCancel}
                              disabled={savingId === employee.id}
                              className="bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              연봉: {employee.annual_salary ? `${formatCurrency(employee.annual_salary)}만원` : '-'}
                            </div>
                            <div className="text-gray-500">
                              월급여: {employee.monthly_salary ? `${formatCurrency(employee.monthly_salary)}만원` : '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              기본급: {employee.basic_salary ? `${formatCurrency(employee.basic_salary)}만원` : '-'}
                            </div>
                            <div className="text-gray-500">
                              상여: {employee.bonus ? `${formatCurrency(employee.bonus)}만원` : '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              식대: {employee.meal_allowance ? `${formatCurrency(employee.meal_allowance)}만원` : '-'}
                            </div>
                            <div className="text-gray-500">
                              교통비: {employee.transportation_allowance ? `${formatCurrency(employee.transportation_allowance)}만원` : '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className={`font-medium ${isMinimumWageViolation(employee.hourly_wage || 0) ? 'text-red-600' : 'text-gray-900'}`}>
                              {employee.hourly_wage ? `${formatCurrency(employee.hourly_wage)}원` : '-'}
                            </div>
                            {employee.hourly_wage && isMinimumWageViolation(employee.hourly_wage) && (
                              <div className="text-red-500 text-xs">최저임금 미달</div>
                            )}
                            {employee.hourly_wage && (
                              <div className="text-gray-400 text-xs mt-1">
                                초과수당: {formatCurrency(calculateOvertimePay(employee.hourly_wage, 1))}원/시간
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleEdit(employee)}
                            className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            수정
                          </button>
                          {employee.salary_details_updated_at && (
                            <div className="text-xs text-gray-400 mt-1">
                              {formatDate(employee.salary_details_updated_at)}
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {filter === 'active' ? '재직 중인 직원이 없습니다.' :
                     filter === 'resigned' ? '퇴사한 직원이 없습니다.' :
                     filter === 'contract' ? '계약직 직원이 없습니다.' :
                     '직원이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 급여 계산 정보 */}
        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">급여 계산 정보</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div>
              <strong>초과근무수당:</strong> 통상시급 × 1.5배 × 초과근무시간
            </div>
            <div>
              <strong>야간근로수당:</strong> 통상시급 × 1.5배 × 야간근무시간
            </div>
            <div>
              <strong>최저임금 기준:</strong> {minimumWage.currentYear}년 {formatCurrency(minimumWage.currentMinimumWage)}원/시간
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
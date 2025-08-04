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
  salary?: number
  salary_updated_at?: string
  termination_date?: string
  contract_end_date?: string
}

export default function AdminSalaryManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSalary, setEditingSalary] = useState<{ [key: string]: string }>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'resigned' | 'contract'>('active')

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('users')
        .select(`
          id, name, email, department, position, hire_date, work_type,
          salary, salary_updated_at, termination_date, contract_end_date
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
  }, [fetchEmployees])

  const handleSalaryEdit = (employeeId: string, currentSalary: number | undefined) => {
    setEditingSalary({
      ...editingSalary,
      [employeeId]: (currentSalary || 0).toString()
    })
  }

  const handleSalarySave = async (employeeId: string) => {
    const newSalary = editingSalary[employeeId]
    if (!newSalary || isNaN(Number(newSalary))) {
      alert('유효한 연봉을 입력해주세요.')
      return
    }

    const salaryValue = parseInt(newSalary)
    if (salaryValue < 0) {
      alert('연봉은 0 이상이어야 합니다.')
      return
    }

    setSavingId(employeeId)
    try {
      const { error } = await supabase
        .from('users')
        .update({
          salary: salaryValue,
          salary_updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)

      if (error) {
        console.error('연봉 업데이트 오류:', error)
        alert('연봉 업데이트에 실패했습니다.')
        return
      }

      // 성공 시 상태 업데이트
      setEmployees(employees.map(emp => 
        emp.id === employeeId 
          ? { ...emp, salary: salaryValue, salary_updated_at: new Date().toISOString() }
          : emp
      ))

      // 편집 모드 종료
      const newEditingSalary = { ...editingSalary }
      delete newEditingSalary[employeeId]
      setEditingSalary(newEditingSalary)

      alert('연봉이 성공적으로 업데이트되었습니다.')
    } catch (err) {
      console.error('연봉 저장 오류:', err)
      alert('연봉 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  const handleSalaryCancel = (employeeId: string) => {
    const newEditingSalary = { ...editingSalary }
    delete newEditingSalary[employeeId]
    setEditingSalary(newEditingSalary)
  }

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ko-KR').format(amount) + '만원'
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
          <h3 className="text-lg font-medium text-gray-900">직원별 연봉 관리</h3>
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">근무형태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">입사일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연봉</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수정일</th>
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
                        <div className="text-xs text-gray-400">{employee.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getWorkTypeColor(employee.work_type)}`}>
                        {employee.work_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(employee.hire_date)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingSalary[employee.id] !== undefined ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={editingSalary[employee.id]}
                            onChange={(e) => setEditingSalary({
                              ...editingSalary,
                              [employee.id]: e.target.value
                            })}
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="연봉"
                            min="0"
                          />
                          <span className="text-sm text-gray-500">만원</span>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(employee.salary)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(employee.salary_updated_at)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {editingSalary[employee.id] !== undefined ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSalarySave(employee.id)}
                            disabled={savingId === employee.id}
                            className="bg-green-100 text-green-800 hover:bg-green-200 disabled:bg-green-50 disabled:text-green-400 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            {savingId === employee.id ? '저장 중...' : '저장'}
                          </button>
                          <button
                            onClick={() => handleSalaryCancel(employee.id)}
                            disabled={savingId === employee.id}
                            className="bg-gray-100 text-gray-800 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSalaryEdit(employee.id, employee.salary)}
                          className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                        >
                          연봉 수정
                        </button>
                      )}
                    </td>
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
      </div>
    </div>
  )
}
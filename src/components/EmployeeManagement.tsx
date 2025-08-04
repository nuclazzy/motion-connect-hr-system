'use client'

import { useState, useEffect } from 'react'

interface Employee {
  id: string
  email: string
  name: string
  position: string
  department: string
  hire_date: string
  annual_leave: number
  sick_leave: number
  substitute_leave_hours: number
  compensatory_leave_hours: number
}

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadEmployees = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const userStr = localStorage.getItem('motion-connect-user')
      if (!userStr) {
        throw new Error('사용자 인증 정보가 없습니다')
      }
      
      const user = JSON.parse(userStr)
      
      const response = await fetch('/api/admin/employees-simple', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.id}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`서버 오류: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.employees) {
        setEmployees(data.employees)
      } else {
        throw new Error('직원 데이터를 불러올 수 없습니다')
      }
    } catch (err) {
      console.error('직원 목록 로딩 오류:', err)
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          직원 관리
        </h3>
        
        {loading && (
          <div className="text-center py-4">
            <div className="text-gray-600">직원 목록을 불러오는 중...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="text-red-800 font-medium">오류</div>
            <div className="text-red-700 text-sm mt-1">{error}</div>
            <button
              onClick={loadEmployees}
              className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && employees.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    부서/직급
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연차
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    병가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    대체휴가
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    보상휴가
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {employee.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employee.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {employee.department}
                      </div>
                      <div className="text-sm text-gray-500">
                        {employee.position}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.annual_leave}일
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.sick_leave}일
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.substitute_leave_hours}시간
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {employee.compensatory_leave_hours}시간
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && employees.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            등록된 직원이 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
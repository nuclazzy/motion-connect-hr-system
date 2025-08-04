'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Employee {
  id: string
  name: string
  department: string
  position: string
  hourly_wage?: number
}

interface OvertimeRecord {
  id: string
  user_id: string
  work_date: string
  overtime_hours: number
  night_hours: number
  overtime_pay: number
  night_pay: number
  total_pay: number
  notes?: string
  status: 'pending' | 'approved' | 'rejected'
  approved_by?: string
  approved_at?: string
  created_at: string
  users: {
    name: string
    department: string
    position: string
  }
}

export default function AdminOvertimeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  
  // 새 초과근무 기록 입력 폼 상태
  const [formData, setFormData] = useState({
    user_id: '',
    work_date: '',
    overtime_hours: 0,
    night_hours: 0,
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchEmployees = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, department, position, hourly_wage')
        .neq('role', 'admin')
        .eq('work_type', '정규직')
        .order('name')

      if (error) {
        console.error('직원 목록 조회 오류:', error)
        return
      }

      setEmployees(data || [])
    } catch (err) {
      console.error('직원 목록 fetch 오류:', err)
    }
  }, [])

  const fetchOvertimeRecords = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/overtime?month=${selectedMonth}`)
      const result = await response.json()

      if (result.success) {
        setOvertimeRecords(result.data)
      } else {
        console.error('초과근무 기록 조회 오류:', result.error)
      }
    } catch (err) {
      console.error('초과근무 기록 fetch 오류:', err)
    }
  }, [selectedMonth])

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchOvertimeRecords()]).finally(() => {
      setLoading(false)
    })
  }, [fetchEmployees, fetchOvertimeRecords])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.user_id || !formData.work_date) {
      alert('직원과 근무일을 선택해주세요.')
      return
    }

    if (formData.overtime_hours <= 0 && formData.night_hours <= 0) {
      alert('초과근무시간 또는 야간근무시간 중 하나는 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/overtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        alert('초과근무 기록이 생성되었습니다.')
        setFormData({
          user_id: '',
          work_date: '',
          overtime_hours: 0,
          night_hours: 0,
          notes: ''
        })
        setShowAddForm(false)
        await fetchOvertimeRecords()
      } else {
        alert(result.error || '초과근무 기록 생성에 실패했습니다.')
      }
    } catch (err) {
      console.error('초과근무 기록 생성 오류:', err)
      alert('초과근무 기록 생성 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApproval = async (recordId: string, status: 'approved' | 'rejected') => {
    const adminNotes = status === 'rejected' ? prompt('거절 사유를 입력하세요:') : undefined
    if (status === 'rejected' && !adminNotes) return

    try {
      const response = await fetch(`/api/admin/overtime/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(result.message)
        await fetchOvertimeRecords()
      } else {
        alert(result.error || '처리에 실패했습니다.')
      }
    } catch (err) {
      console.error('초과근무 승인/거절 오류:', err)
      alert('처리 중 오류가 발생했습니다.')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR')
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
          <h3 className="text-lg font-medium text-gray-900">초과근무 관리</h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label htmlFor="month" className="text-sm font-medium text-gray-700">
                조회 월:
              </label>
              <input
                type="month"
                id="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              {showAddForm ? '취소' : '초과근무 추가'}
            </button>
          </div>
        </div>

        {/* 초과근무 추가 폼 */}
        {showAddForm && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-gray-900 mb-4">초과근무 기록 추가</h4>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  직원 선택
                </label>
                <select
                  value={formData.user_id}
                  onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  <option value="">선택하세요</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.department})
                      {emp.hourly_wage ? ` - ${formatCurrency(emp.hourly_wage)}원/시간` : ' - 시급 미설정'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  근무일
                </label>
                <input
                  type="date"
                  value={formData.work_date}
                  onChange={(e) => setFormData({...formData, work_date: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  초과근무시간
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.overtime_hours}
                  onChange={(e) => setFormData({...formData, overtime_hours: parseFloat(e.target.value) || 0})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="0.0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  야간근무시간
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.night_hours}
                  onChange={(e) => setFormData({...formData, night_hours: parseFloat(e.target.value) || 0})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="0.0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비고
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="추가 메모"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:bg-green-300"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 초과근무 기록 목록 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원정보</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">근무일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">초과/야간시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수당</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {overtimeRecords.length > 0 ? (
                overtimeRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{record.users.name}</div>
                      <div className="text-sm text-gray-500">{record.users.department}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatDate(record.work_date)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div>초과: {record.overtime_hours}시간</div>
                      <div>야간: {record.night_hours}시간</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                      <div className="font-medium">총: {formatCurrency(record.total_pay)}원</div>
                      <div className="text-xs text-gray-500">
                        초과: {formatCurrency(record.overtime_pay)}원 / 야간: {formatCurrency(record.night_pay)}원
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(record.status)}`}>
                        {getStatusText(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {record.status === 'pending' ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApproval(record.id, 'approved')}
                            className="bg-green-100 text-green-800 hover:bg-green-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleApproval(record.id, 'rejected')}
                            className="bg-red-100 text-red-800 hover:bg-red-200 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">
                          {record.approved_at ? formatDate(record.approved_at) : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {selectedMonth} 초과근무 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 계산 정보 */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">수당 계산 방식</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>초과근무수당:</strong> 통상시급 × 초과근무시간 × 1.5배
            </div>
            <div>
              <strong>야간근로수당:</strong> 통상시급 × 야간근무시간 × 1.5배
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            * 시급이 설정되지 않은 직원은 초과근무 기록을 생성할 수 없습니다.
          </div>
        </div>
      </div>
    </div>
  )
}
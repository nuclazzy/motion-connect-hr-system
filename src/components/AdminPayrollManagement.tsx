'use client'

import { useState, useEffect } from 'react'
import { 
  Calculator, 
  DollarSign, 
  Moon, 
  Clock,
  FileText,
  Save,
  RefreshCw,
  AlertCircle,
  TrendingUp
} from 'lucide-react'
import { formatTimeWithNextDay } from '@/lib/time-utils'

interface Employee {
  id: string
  name: string
  email: string
  department: string
  position: string
  // 급여 정보
  annual_salary?: number // 연봉
  meal_allowance?: number // 식대
  car_allowance?: number // 자가운전
  bonus?: number // 상여
  // 계산된 값들
  monthly_salary?: number // 월급여
  basic_salary?: number // 기본급
  hourly_rate?: number // 통상시급
  // 근무시간 (이번달)
  overtime_hours?: number // 초과근무시간
  night_hours?: number // 야간근무시간
  overtime_pay?: number // 초과근무수당
  night_pay?: number // 야간근무수당
  total_pay?: number // 지급액 합계
}

interface WorkSummary {
  user_id: string
  total_overtime_hours: number
  total_night_hours: number
}

const MONTHLY_STANDARD_HOURS = 209 // 월 소정근로시간

export default function AdminPayrollManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [workSummaries, setWorkSummaries] = useState<WorkSummary[]>([])
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    annual_salary: string
    meal_allowance: string
    car_allowance: string
    bonus: string
  }>({
    annual_salary: '',
    meal_allowance: '',
    car_allowance: '',
    bonus: ''
  })

  // 직원 데이터 조회
  const fetchEmployees = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/employees')
      const data = await response.json()
      
      if (data.success && data.data) {
        const activeEmployees = data.data.filter((emp: any) => emp.work_type === '정규직')
        setEmployees(activeEmployees)
      }
    } catch (error) {
      console.error('직원 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 근무시간 데이터 조회
  const fetchWorkSummaries = async () => {
    try {
      const response = await fetch(`/api/attendance/summary?month=${selectedMonth}`)
      const data = await response.json()
      
      if (data.success && data.summaries) {
        const summaries: WorkSummary[] = data.summaries.map((s: any) => ({
          user_id: s.user_id,
          total_overtime_hours: s.total_overtime_hours || 0,
          total_night_hours: s.total_night_hours || 0
        }))
        setWorkSummaries(summaries)
      }
    } catch (error) {
      console.error('근무시간 데이터 조회 오류:', error)
    }
  }

  // 급여 계산
  const calculatePayroll = (employee: Employee, workSummary?: WorkSummary): Employee => {
    const annualSalary = employee.annual_salary || 0
    const mealAllowance = employee.meal_allowance || 0
    const carAllowance = employee.car_allowance || 0
    const bonus = employee.bonus || 0
    
    // 월급여 = 연봉 / 12
    const monthlySalary = Math.round(annualSalary / 12)
    
    // 기본급 = 월급여 - 식대 - 자가운전
    const basicSalary = monthlySalary - mealAllowance - carAllowance
    
    // 통상시급 = (기본급 + 식대 + 자가운전) / 209
    const hourlyRate = Math.round((basicSalary + mealAllowance + carAllowance) / MONTHLY_STANDARD_HOURS)
    
    // 근무시간 데이터
    const overtimeHours = workSummary?.total_overtime_hours || 0
    const nightHours = workSummary?.total_night_hours || 0
    
    // 초과근무수당 = 초과근무시간 × 통상시급 × 1.5
    const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5)
    
    // 야간근무수당 = 야간근무시간 × 통상시급 × 1.5
    const nightPay = Math.round(nightHours * hourlyRate * 1.5)
    
    // 지급액 합계 = 기본급 + 상여 + 식대 + 자가운전 + 초과수당 + 야간수당
    const totalPay = basicSalary + bonus + mealAllowance + carAllowance + overtimePay + nightPay
    
    return {
      ...employee,
      monthly_salary: monthlySalary,
      basic_salary: basicSalary,
      hourly_rate: hourlyRate,
      overtime_hours: overtimeHours,
      night_hours: nightHours,
      overtime_pay: overtimePay,
      night_pay: nightPay,
      total_pay: totalPay
    }
  }

  // 직원 급여 정보 저장
  const saveEmployeePayroll = async (employeeId: string) => {
    setSaving(employeeId)
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annual_salary: parseInt(editForm.annual_salary) || 0,
          meal_allowance: parseInt(editForm.meal_allowance) || 0,
          car_allowance: parseInt(editForm.car_allowance) || 0,
          bonus: parseInt(editForm.bonus) || 0
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // 업데이트된 직원 정보로 갱신
        setEmployees(prev => prev.map(emp => {
          if (emp.id === employeeId) {
            return calculatePayroll({
              ...emp,
              annual_salary: parseInt(editForm.annual_salary) || 0,
              meal_allowance: parseInt(editForm.meal_allowance) || 0,
              car_allowance: parseInt(editForm.car_allowance) || 0,
              bonus: parseInt(editForm.bonus) || 0
            }, workSummaries.find(w => w.user_id === employeeId))
          }
          return emp
        }))
        setEditingEmployee(null)
        alert('급여 정보가 저장되었습니다.')
      } else {
        alert(`저장 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('급여 정보 저장 오류:', error)
      alert('급여 정보 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(null)
    }
  }

  // 편집 모드 시작
  const startEdit = (employee: Employee) => {
    setEditingEmployee(employee.id)
    setEditForm({
      annual_salary: (employee.annual_salary || 0).toString(),
      meal_allowance: (employee.meal_allowance || 0).toString(),
      car_allowance: (employee.car_allowance || 0).toString(),
      bonus: (employee.bonus || 0).toString()
    })
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (!loading && employees.length > 0) {
      fetchWorkSummaries()
    }
  }, [selectedMonth, loading, employees])

  // 직원 데이터와 근무시간 데이터 결합
  const employeesWithPayroll = employees.map(emp => {
    const workSummary = workSummaries.find(w => w.user_id === emp.id)
    return calculatePayroll(emp, workSummary)
  })

  // 통계 계산
  const totalStats = employeesWithPayroll.reduce((acc, emp) => ({
    totalBasicSalary: acc.totalBasicSalary + (emp.basic_salary || 0),
    totalOvertimePay: acc.totalOvertimePay + (emp.overtime_pay || 0),
    totalNightPay: acc.totalNightPay + (emp.night_pay || 0),
    totalPay: acc.totalPay + (emp.total_pay || 0)
  }), {
    totalBasicSalary: 0,
    totalOvertimePay: 0,
    totalNightPay: 0,
    totalPay: 0
  })

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Calculator className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">급여 관리</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">월 선택:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            />
          </div>
          <button
            onClick={() => {
              fetchEmployees()
              fetchWorkSummaries()
            }}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-blue-600">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600">기본급 합계</p>
              <p className="text-lg font-semibold text-blue-900">
                {totalStats.totalBasicSalary.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-orange-600">
              <Clock className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm text-orange-600">초과근무 수당</p>
              <p className="text-lg font-semibold text-orange-900">
                {totalStats.totalOvertimePay.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-purple-600">
              <Moon className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm text-purple-600">야간근무 수당</p>
              <p className="text-lg font-semibold text-purple-900">
                {totalStats.totalNightPay.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600">총 지급액</p>
              <p className="text-lg font-semibold text-green-900">
                {totalStats.totalPay.toLocaleString()}원
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 급여 계산 공식 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center mb-2">
          <AlertCircle className="h-5 w-5 text-gray-500 mr-2" />
          <h4 className="text-sm font-medium text-gray-700">급여 계산 공식</h4>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <p>• 월급여 = 연봉 ÷ 12</p>
            <p>• 기본급 = 월급여 - 식대 - 자가운전</p>
            <p>• 통상시급 = (기본급 + 식대 + 자가운전) ÷ 209</p>
          </div>
          <div>
            <p>• 초과근무수당 = 초과근무시간 × 통상시급 × 1.5</p>
            <p>• 야간근무수당 = 야간근무시간 × 통상시급 × 1.5</p>
            <p>• 지급액 = 기본급 + 상여 + 식대 + 자가운전 + 수당</p>
          </div>
        </div>
      </div>

      {/* 직원 급여 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                직원
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                연봉
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                기본급
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                식대
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                자가운전
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상여
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                시급
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                초과(h)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                야간(h)
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                지급액
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                  데이터를 불러오는 중...
                </td>
              </tr>
            ) : employeesWithPayroll.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                  직원 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              employeesWithPayroll.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                      <div className="text-xs text-gray-500">{employee.department} · {employee.position}</div>
                    </div>
                  </td>
                  
                  {editingEmployee === employee.id ? (
                    <>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={editForm.annual_salary}
                          onChange={(e) => setEditForm(prev => ({ ...prev, annual_salary: e.target.value }))}
                          className="w-24 px-2 py-1 border rounded text-sm"
                          placeholder="연봉"
                        />
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {calculatePayroll({
                          ...employee,
                          annual_salary: parseInt(editForm.annual_salary) || 0,
                          meal_allowance: parseInt(editForm.meal_allowance) || 0,
                          car_allowance: parseInt(editForm.car_allowance) || 0
                        }).basic_salary?.toLocaleString()}
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={editForm.meal_allowance}
                          onChange={(e) => setEditForm(prev => ({ ...prev, meal_allowance: e.target.value }))}
                          className="w-20 px-2 py-1 border rounded text-sm"
                          placeholder="식대"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={editForm.car_allowance}
                          onChange={(e) => setEditForm(prev => ({ ...prev, car_allowance: e.target.value }))}
                          className="w-20 px-2 py-1 border rounded text-sm"
                          placeholder="차량"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          value={editForm.bonus}
                          onChange={(e) => setEditForm(prev => ({ ...prev, bonus: e.target.value }))}
                          className="w-20 px-2 py-1 border rounded text-sm"
                          placeholder="상여"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {employee.annual_salary?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {employee.basic_salary?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {employee.meal_allowance?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {employee.car_allowance?.toLocaleString() || '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900">
                        {employee.bonus?.toLocaleString() || '-'}
                      </td>
                    </>
                  )}
                  
                  <td className="px-3 py-4 text-sm text-gray-900">
                    {employee.hourly_rate?.toLocaleString() || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm">
                    <span className="text-orange-600">
                      {employee.overtime_hours?.toFixed(1) || '0.0'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm">
                    <span className="text-purple-600">
                      {employee.night_hours?.toFixed(1) || '0.0'}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-sm font-medium text-green-600">
                    {employee.total_pay?.toLocaleString() || '-'}
                  </td>
                  <td className="px-3 py-4 text-sm">
                    {editingEmployee === employee.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => saveEmployeePayroll(employee.id)}
                          disabled={saving === employee.id}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving === employee.id ? '저장중...' : '저장'}
                        </button>
                        <button
                          onClick={() => setEditingEmployee(null)}
                          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(employee)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        수정
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 하단 안내 */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center">
          <FileText className="h-4 w-4 mr-1" />
          <span>총 {employeesWithPayroll.length}명의 직원</span>
        </div>
        <div>
          초과/야간 근무시간은 {selectedMonth} 기준
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { 
  Calendar, 
  Clock, 
  Users, 
  Calculator,
  CheckCircle,
  AlertTriangle,
  Plus,
  Settings,
  TrendingUp,
  FileText,
  Download
} from 'lucide-react'
import { 
  calculateQuarterlySettlement, 
  convertAttendanceToMonthly, 
  calculateSettlementSummary,
  exportSettlementToCSV,
  type QuarterlySettlement
} from '@/lib/quarterly-settlement'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import { getSystemSettings } from '@/lib/settings'

interface FlexibleWorkPeriod {
  id: string
  period_name: string
  start_date: string
  end_date: string
  quarter: number
  year: number
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  settlement_completed: boolean
  employee_count?: number
  total_work_hours?: number
  avg_weekly_hours?: number
}

interface SettlementSummary {
  total_employees: number
  total_overtime_allowance: number
  employees_with_overtime: number
  avg_weekly_hours: number
  total_night_hours?: number
  estimated_night_allowance_paid?: number
}

export default function QuarterlyFlexibleWorkManager() {
  const { supabase } = useSupabase()
  const [periods, setPeriods] = useState<FlexibleWorkPeriod[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'periods' | 'settlement' | 'create'>('periods')
  const [selectedPeriod, setSelectedPeriod] = useState<FlexibleWorkPeriod | null>(null)
  const [settlementData, setSettlementData] = useState<SettlementSummary | null>(null)
  const [detailedSettlements, setDetailedSettlements] = useState<QuarterlySettlement[]>([])
  const [showDetailedView, setShowDetailedView] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // 새 기간 생성 폼 데이터
  const [newPeriod, setNewPeriod] = useState({
    period_name: '',
    start_date: '',
    end_date: '',
    quarter: 1,
    year: new Date().getFullYear(),
    standard_weekly_hours: 40.0,
    max_daily_hours: 12.0,
    max_weekly_hours: 52.0
  })

  // 현재 시스템에서 활성화된 탄력근로제 상태 조회 (직접 Supabase 연동)
  const fetchCurrentFlexibleWorkStatus = async () => {
    try {
      // 권한 확인
      const user = await getCurrentUser()
      if (!user || user.role !== 'admin') {
        console.error('관리자 권한이 필요합니다.')
        return
      }
      setCurrentUser(user)

      // 현재 진행 중인 탄력근로제 기간 조회 (임시로 하드코딩된 데이터 사용)
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      
      // 2025년 2분기 (6-7-8월) 탄력근로제 기간 설정
      const flexiblePeriod: FlexibleWorkPeriod = {
        id: 'current-active-2025-q2',
        period_name: '2025년 2분기 탄력근로제 (6-7-8월)',
        start_date: '2025-06-01',
        end_date: '2025-08-31',
        quarter: 2,
        year: 2025,
        status: 'active',
        settlement_completed: false,
        employee_count: 0,
        total_work_hours: 0,
        avg_weekly_hours: 0
      }
      
      setPeriods([flexiblePeriod])
      
      // 참여 직원 수 계산
      const { data: employees, error: empError } = await supabase
        .from('users')
        .select('id')
        .eq('work_type', '정규직')
      
      if (!empError && employees) {
        setPeriods(prev => prev.map(p => p.id === flexiblePeriod.id ? {
          ...p,
          employee_count: employees.length
        } : p))
      }
      
    } catch (error) {
      console.error('탄력근로제 상태 조회 오류:', error)
    }
  }

  // 3개월 출퇴근 데이터를 기반으로 통계 계산 및 정산 수행 (직접 Supabase 연동)
  const calculateFlexibleWorkStatistics = async () => {
    try {
      setLoading(true)
      
      // 권한 확인
      if (!currentUser || currentUser.role !== 'admin') {
        console.error('관리자 권한이 필요합니다.')
        return
      }

      // 시스템 설정 조회
      const settings = await getSystemSettings()
      
      // 6-7-8월 데이터 조회 (직접 Supabase 쿼리)
      const months = ['2025-06', '2025-07', '2025-08']
      const allMonthlyData = []
      
      for (const month of months) {
        const monthStart = `${month}-01`
        const nextMonth = new Date(monthStart)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        const monthEnd = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0]
        
        // 월별 통계 조회
        const { data: monthlyStats, error: monthlyError } = await supabase
          .from('monthly_work_stats')
          .select(`
            user_id,
            total_work_days,
            total_basic_hours,
            total_overtime_hours,
            total_night_hours
          `)
          .eq('work_month', monthStart)
        
        if (monthlyError && monthlyError.code !== 'PGRST116') {
          console.error(`${month} 월별 통계 조회 오류:`, monthlyError)
          continue
        }
        
        if (monthlyStats && monthlyStats.length > 0) {
          // 월별 데이터를 탄력근무제 정산용 형태로 변환
          const monthlyWorkData = monthlyStats.map((stat: any) => ({
            user_id: stat.user_id,
            user_name: stat.users?.name || '',
            department: stat.users?.department || '',
            position: stat.users?.position || '',
            month: month === '2025-06' ? '6월' : month === '2025-07' ? '7월' : '8월',
            work_days: stat.total_work_days || 0,
            basic_hours: stat.total_basic_hours || 0,
            overtime_hours: stat.total_overtime_hours || 0,
            night_hours: stat.total_night_hours || 0,
            total_work_hours: (stat.total_basic_hours || 0) + (stat.total_overtime_hours || 0),
            weekly_avg_hours: Math.round(((stat.total_basic_hours || 0) + (stat.total_overtime_hours || 0)) / 4 * 10) / 10,
            night_allowance_paid: (stat.total_night_hours || 0) * (settings?.night_rate || 1.5) * 15000 // 추정 야간수당
          }))
          
          allMonthlyData.push(...monthlyWorkData)
        } else {
          console.log(`${month} 데이터 없음, 일별 데이터에서 계산 시도`)
          
          // 일별 데이터에서 월별 집계 계산
          const { data: dailyStats, error: dailyError } = await supabase
            .from('daily_work_summary')
            .select(`
              user_id,
              basic_hours,
              overtime_hours,
              night_hours
            `)
            .gte('work_date', monthStart)
            .lte('work_date', monthEnd)
          
          if (!dailyError && dailyStats) {
            // 사용자별로 집계
            const userSummaries = new Map()
            
            dailyStats.forEach((daily: any) => {
              const userId = daily.user_id
              if (!userSummaries.has(userId)) {
                userSummaries.set(userId, {
                  user_id: userId,
                  user_name: daily.users?.name || '',
                  department: daily.users?.department || '',
                  position: daily.users?.position || '',
                  work_days: 0,
                  basic_hours: 0,
                  overtime_hours: 0,
                  night_hours: 0
                })
              }
              
              const summary = userSummaries.get(userId)
              summary.work_days += 1
              summary.basic_hours += daily.basic_hours || 0
              summary.overtime_hours += daily.overtime_hours || 0
              summary.night_hours += daily.night_hours || 0
            })
            
            // 월별 데이터로 변환
            const monthlyWorkData = Array.from(userSummaries.values()).map((summary: any) => ({
              ...summary,
              month: month === '2025-06' ? '6월' : month === '2025-07' ? '7월' : '8월',
              total_work_hours: summary.basic_hours + summary.overtime_hours,
              weekly_avg_hours: Math.round((summary.basic_hours + summary.overtime_hours) / 4 * 10) / 10,
              night_allowance_paid: summary.night_hours * (settings?.night_rate || 1.5) * 15000
            }))
            
            allMonthlyData.push(...monthlyWorkData)
          }
        }
      }
      
      if (allMonthlyData.length === 0) {
        console.log('탄력근무제 기간 데이터가 없습니다.')
        return
      }
      
      // 3개월 탄력근무제 정산 계산
      const avgHourlyRate = settings?.monthly_standard_hours ? 
        Math.round(2500000 / settings.monthly_standard_hours) : 15000 // 임시 평균 시급
      
      const settlements = calculateQuarterlySettlement(allMonthlyData, 40.0, avgHourlyRate)
      const summary = calculateSettlementSummary(settlements)
      
      setDetailedSettlements(settlements)
      setSettlementData(summary)
      
      // 현재 활성 기간 업데이트
      setPeriods(prev => prev.map(p => p.id === 'current-active-2025-q2' ? {
        ...p,
        employee_count: summary.total_employees,
        total_work_hours: settlements.reduce((sum, s) => sum + s.total_work_hours, 0),
        avg_weekly_hours: summary.avg_weekly_hours
      } : p))
      
      console.log('✅ 탄력근무제 정산 계산 완료:', summary)
      
    } catch (error) {
      console.error('탄력근무제 통계 계산 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 새 분기 생성
  const createNewPeriod = async () => {
    try {
      setLoading(true)
      
      // 기간 겹침 검사
      const startDate = new Date(newPeriod.start_date)
      const endDate = new Date(newPeriod.end_date)
      
      if (startDate >= endDate) {
        alert('시작일은 종료일보다 이전이어야 합니다.')
        return
      }
      
      // 3개월 기간 확인
      const monthDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth())
      if (monthDiff < 2 || monthDiff > 3) {
        alert('탄력근로제 기간은 3개월이어야 합니다.')
        return
      }
      
      // 새 기간 추가
      const newId = `period-${Date.now()}`
      const newPeriodData: FlexibleWorkPeriod = {
        id: newId,
        period_name: newPeriod.period_name,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        quarter: newPeriod.quarter,
        year: newPeriod.year,
        status: 'planned',
        settlement_completed: false,
        employee_count: 0,
        total_work_hours: 0,
        avg_weekly_hours: 0
      }
      
      setPeriods(prev => [...prev, newPeriodData])
      
      // 폼 초기화
      setNewPeriod({
        period_name: '',
        start_date: '',
        end_date: '',
        quarter: 1,
        year: new Date().getFullYear(),
        standard_weekly_hours: 40.0,
        max_daily_hours: 12.0,
        max_weekly_hours: 52.0
      })
      
      setActiveTab('periods')
      alert('새 탄력근로제 기간이 생성되었습니다.')
      
    } catch (error) {
      console.error('기간 생성 오류:', error)
      alert('기간 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 기간 상태 변경
  const updatePeriodStatus = async (periodId: string, newStatus: 'planned' | 'active' | 'completed' | 'cancelled') => {
    try {
      if (newStatus === 'active') {
        // 다른 활성 기간들을 완료로 변경
        setPeriods(prev => prev.map(p => p.status === 'active' ? { ...p, status: 'completed' } : p))
      }
      
      setPeriods(prev => prev.map(p => p.id === periodId ? { ...p, status: newStatus } : p))
      
      alert('상태가 업데이트되었습니다.')
    } catch (error) {
      console.error('상태 업데이트 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 정산 실행
  const executeSettlement = async (period: FlexibleWorkPeriod) => {
    try {
      if (period.settlement_completed) {
        alert('이미 정산이 완료된 기간입니다.')
        return
      }
      
      setLoading(true)
      
      // 상세 정산 정보 확인
      const nightAllowanceTotal = settlementData?.estimated_night_allowance_paid || 0
      const confirmMessage = `${period.period_name}에 대한 정산을 실행하시겠습니까?\n\n` +
        `총 직원: ${settlementData?.total_employees}명\n` +
        `초과근무 수당: ${settlementData?.total_overtime_allowance?.toLocaleString()}원\n` +
        `야간근무 수당 (이미 지급): ${nightAllowanceTotal.toLocaleString()}원\n` +
        `초과근무 대상: ${settlementData?.employees_with_overtime}명`
      
      if (!confirm(confirmMessage)) {
        return
      }
      
      // 정산 완료로 표시
      setPeriods(prev => prev.map(p => p.id === period.id ? { 
        ...p, 
        settlement_completed: true,
        status: 'completed'
      } : p))
      
      alert('정산이 완료되었습니다.')
      
    } catch (error) {
      console.error('정산 실행 오류:', error)
      alert('정산 실행 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // CSV 다운로드
  const downloadSettlementCSV = () => {
    if (detailedSettlements.length === 0) {
      alert('정산 데이터가 없습니다.')
      return
    }
    
    const csvContent = exportSettlementToCSV(detailedSettlements)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `탄력근로제_정산결과_${selectedPeriod?.period_name || '2025년2분기'}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  useEffect(() => {
    fetchCurrentFlexibleWorkStatus()
  }, [])

  // 통계 계산은 수동으로만 실행하도록 변경 (무한 루프 방지)
  const handleCalculateStatistics = () => {
    if (currentUser && periods.length > 0 && !loading) {
      calculateFlexibleWorkStatistics()
    }
  }

  // 분기 이름 생성
  const getQuarterName = (quarter: number) => {
    const quarters = {
      1: '1분기 (1-2-3월)',
      2: '2분기 (4-5-6월)', 
      3: '3분기 (7-8-9월)',
      4: '4분기 (10-11-12월)'
    }
    return quarters[quarter as keyof typeof quarters] || `${quarter}분기`
  }

  // 실제로는 6-7-8월이므로 수정
  const getActualQuarterName = (quarter: number, startDate: string) => {
    if (startDate.includes('2025-06')) {
      return '2분기 (6-7-8월)' // 실제 탄력근로제 기간
    }
    return getQuarterName(quarter)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          분기별 탄력근로제 관리
        </h2>
        <p className="text-gray-600">
          3개월 단위 탄력근로제 기간을 관리하고 정산을 수행합니다
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('periods')}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'periods'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="h-4 w-4 mr-2" />
          기간 관리
        </button>
        <button
          onClick={() => setActiveTab('settlement')}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'settlement'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calculator className="h-4 w-4 mr-2" />
          정산 관리
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Plus className="h-4 w-4 mr-2" />
          새 기간 생성
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'periods' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">탄력근로제 기간 목록</h3>
            <div className="flex items-center space-x-2">
              {loading && <div className="text-sm text-gray-500">계산 중...</div>}
              <button
                onClick={handleCalculateStatistics}
                disabled={loading || !currentUser || periods.length === 0}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                통계 계산
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {periods.map(period => (
              <div key={period.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{period.period_name}</h4>
                    <p className="text-sm text-gray-600">
                      {period.start_date} ~ {period.end_date} | {getActualQuarterName(period.quarter, period.start_date)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      period.status === 'active' ? 'bg-green-100 text-green-800' :
                      period.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      period.status === 'planned' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {period.status === 'active' ? '활성' :
                       period.status === 'completed' ? '완료' :
                       period.status === 'planned' ? '예정' : '취소'}
                    </span>
                    {period.settlement_completed && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{period.employee_count || 0}</div>
                    <div className="text-sm text-gray-600">참여 직원</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{period.total_work_hours || 0}h</div>
                    <div className="text-sm text-gray-600">총 근무시간</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{period.avg_weekly_hours || 0}h</div>
                    <div className="text-sm text-gray-600">주당 평균</div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {period.status === 'planned' && (
                    <>
                      <button
                        onClick={() => updatePeriodStatus(period.id, 'active')}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        활성화
                      </button>
                      <button
                        onClick={() => updatePeriodStatus(period.id, 'cancelled')}
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                      >
                        취소
                      </button>
                    </>
                  )}
                  {period.status === 'active' && (
                    <button
                      onClick={() => updatePeriodStatus(period.id, 'completed')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      완료
                    </button>
                  )}
                  {(period.status === 'completed' || period.status === 'active') && (
                    <button
                      onClick={() => setSelectedPeriod(period)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                    >
                      정산 보기
                    </button>
                  )}
                </div>
              </div>
            ))}

            {periods.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 탄력근로제 기간이 없습니다</h3>
                <p className="text-gray-600 mb-4">새로운 3개월 탄력근로제 기간을 생성해보세요</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  새 기간 생성
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settlement' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">정산 관리</h3>

          {selectedPeriod ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{selectedPeriod.period_name}</h4>
                  <p className="text-sm text-gray-600">
                    {selectedPeriod.start_date} ~ {selectedPeriod.end_date}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPeriod(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {settlementData && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{settlementData.total_employees}</div>
                      <div className="text-sm text-gray-600">총 직원</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{settlementData.employees_with_overtime}</div>
                      <div className="text-sm text-gray-600">초과근무 대상</div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-bold text-gray-900">{settlementData.avg_weekly_hours}h</div>
                      <div className="text-sm text-gray-600">주당 평균</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-900">
                        {settlementData.total_overtime_allowance.toLocaleString()}원
                      </div>
                      <div className="text-sm text-green-600">초과근무 수당</div>
                    </div>
                  </div>

                  {/* 야간근무 정보 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">{settlementData.total_night_hours || 0}h</div>
                      <div className="text-sm text-blue-600">총 야간근무시간</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-900">
                        {(settlementData.estimated_night_allowance_paid || 0).toLocaleString()}원
                      </div>
                      <div className="text-sm text-blue-600">야간수당 (이미 지급)</div>
                    </div>
                  </div>

                  {/* 상세 버튼 */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => setShowDetailedView(!showDetailedView)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    >
                      {showDetailedView ? '간단히 보기' : '직원별 상세 보기'}
                    </button>
                  </div>

                  {/* 직원별 상세 정보 */}
                  {showDetailedView && detailedSettlements.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="text-lg font-medium text-gray-900 mb-4">직원별 정산 상세</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">직원명</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">부서</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">총시간</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">주당평균</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">야간시간</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">초과수당</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {detailedSettlements.slice(0, 10).map((settlement) => (
                              <tr key={settlement.user_id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-sm font-medium text-gray-900">{settlement.user_name}</td>
                                <td className="px-3 py-2 text-sm text-gray-600">{settlement.department}</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{settlement.total_work_hours}h</td>
                                <td className="px-3 py-2 text-sm text-gray-900">{settlement.weekly_avg_hours}h</td>
                                <td className="px-3 py-2 text-sm text-blue-600">{settlement.total_night_hours}h</td>
                                <td className="px-3 py-2 text-sm font-medium text-green-600">
                                  {settlement.overtime_allowance_amount.toLocaleString()}원
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {detailedSettlements.length > 10 && (
                          <div className="text-center text-sm text-gray-500 mt-2">
                            ... 외 {detailedSettlements.length - 10}명 (CSV 다운로드로 전체 확인 가능)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                  <h4 className="text-sm font-medium text-yellow-800">정산 안내</h4>
                </div>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>• 3개월 평균 주당 40시간 초과분에 대해 1.5배 수당 지급</p>
                  <p>• 이미 지급된 야간근무 수당 시간은 초과근무 수당에서 차감</p>
                  <p>• 정산 완료 후 수정이 어려우니 신중히 검토해주세요</p>
                </div>
              </div>

              <div className="flex space-x-4">
                {!selectedPeriod.settlement_completed ? (
                  <button
                    onClick={() => executeSettlement(selectedPeriod)}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? '처리 중...' : '정산 실행'}
                  </button>
                ) : (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    정산 완료
                  </div>
                )}
                <button
                  onClick={downloadSettlementCSV}
                  className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  <Download className="h-4 w-4 mr-2 inline" />
                  정산 결과 CSV 다운로드
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">정산할 기간을 선택해주세요</h3>
              <p className="text-gray-600">기간 관리 탭에서 정산 보기 버튼을 클릭하세요</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">새 탄력근로제 기간 생성</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기간 이름
              </label>
              <input
                type="text"
                value={newPeriod.period_name}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, period_name: e.target.value }))}
                placeholder="예: 2025년 3분기 탄력근로제"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                분기
              </label>
              <select
                value={newPeriod.quarter}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, quarter: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>1분기</option>
                <option value={2}>2분기</option>
                <option value={3}>3분기</option>
                <option value={4}>4분기</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일
              </label>
              <input
                type="date"
                value={newPeriod.start_date}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일
              </label>
              <input
                type="date"
                value={newPeriod.end_date}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                주당 기준 근무시간
              </label>
              <input
                type="number"
                step="0.5"
                value={newPeriod.standard_weekly_hours}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, standard_weekly_hours: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                연도
              </label>
              <input
                type="number"
                value={newPeriod.year}
                onChange={(e) => setNewPeriod(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">탄력근로제 기본 설정</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
              <div>• 일일 최대 근무시간: {newPeriod.max_daily_hours}시간</div>
              <div>• 주간 최대 근무시간: {newPeriod.max_weekly_hours}시간</div>
            </div>
          </div>

          <div className="mt-6 flex space-x-4">
            <button
              onClick={createNewPeriod}
              disabled={loading || !newPeriod.period_name || !newPeriod.start_date || !newPeriod.end_date}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '생성 중...' : '기간 생성'}
            </button>
            <button
              onClick={() => setActiveTab('periods')}
              className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
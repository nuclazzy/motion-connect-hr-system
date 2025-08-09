'use client'

import { useState, useEffect } from 'react'
import { 
  Clock, 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  Coffee, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react'
import { getCurrentUser, type User as AuthUser } from '@/lib/auth'
import { useSupabase } from '@/components/SupabaseProvider'
import { isWeekendOrHoliday, getHolidayInfo, formatDateForHoliday, initializeHolidayCache } from '@/lib/holidays'

interface WorkSummaryData {
  user: {
    id: string
    name: string
    department: string
    position: string
  }
  period: {
    month: string
    startDate: string
    endDate: string
    totalDays: number
  }
  workStats: {
    totalWorkDays: number
    totalBasicHours: number
    totalOvertimeHours: number
    totalNightHours: number
    totalWorkHours: number
    averageDailyHours: number
    dinnerCount: number
  }
  attendanceStats: {
    onTimeCount: number
    lateCount: number
    earlyLeaveCount: number
    absentCount: number
    attendanceRate: number
  }
  recentStats?: Array<{
    work_date: string
    basic_hours: number
    overtime_hours: number
    work_status: string
  }>
}

interface MissingRecord {
  work_date: string
  missing_types: string[]
  work_status?: string
  check_in_time?: string
  check_out_time?: string
  day_type?: 'holiday' | 'weekend' | 'workday'
  holiday_name?: string
}

interface LeaveRequest {
  id: string
  form_data: string
  status: string
  leave_start_date?: string
  leave_end_date?: string
}

export default function AttendanceDashboard() {
  const { supabase } = useSupabase()
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7))
  const [summaryData, setSummaryData] = useState<WorkSummaryData | null>(null)
  const [missingRecords, setMissingRecords] = useState<MissingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'missing' | 'recent'>('summary')
  const [holidayInitialized, setHolidayInitialized] = useState(false)

  // 공휴일 캐시 초기화
  useEffect(() => {
    const initHolidays = async () => {
      try {
        await initializeHolidayCache()
        setHolidayInitialized(true)
        console.log('📅 공휴일 캐시 초기화 완료')
      } catch (error) {
        console.error('공휴일 캐시 초기화 오류:', error)
        setHolidayInitialized(true) // 실패해도 계속 진행
      }
    }
    initHolidays()
  }, [])

  // 사용자 인증 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
      } catch (error) {
        console.error('사용자 인증 확인 오류:', error)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  // 월별 요약 데이터 조회 (Supabase 직접 연동)
  const fetchSummaryData = async () => {
    if (!currentUser?.id) return

    setLoading(true)
    try {
      const startDate = `${currentMonth}-01`
      const endDate = new Date(currentMonth + '-01')
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      const endDateStr = endDate.toISOString().split('T')[0]

      // 사용자 정보 조회
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, name, department, position')
        .eq('id', currentUser.id)
        .single()

      if (userError || !user) {
        console.error('사용자 정보 조회 오류:', userError)
        return
      }

      // 월별 근무 통계 조회
      const { data: monthlyStats, error: statsError } = await supabase
        .from('monthly_work_stats')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('work_month', startDate)
        .single()

      // 일별 근무 요약 조회 (최근 기록용)
      const { data: dailyStats, error: dailyError } = await supabase
        .from('daily_work_summary')
        .select('work_date, basic_hours, overtime_hours, work_status')
        .eq('user_id', currentUser.id)
        .gte('work_date', startDate)
        .lte('work_date', endDateStr)
        .order('work_date', { ascending: false })
        .limit(10)

      if (statsError && statsError.code !== 'PGRST116') {
        console.error('월별 통계 조회 오류:', statsError)
      }

      if (dailyError) {
        console.error('일별 통계 조회 오류:', dailyError)
      }

      // 출근 현황 계산 (일별 데이터 기반 + 공휴일/주말 제외)
      let onTimeCount = 0, lateCount = 0, earlyLeaveCount = 0, absentCount = 0
      
      if (dailyStats && holidayInitialized) {
        for (const day of dailyStats) {
          const workDate = new Date(day.work_date + 'T00:00:00')
          const dayTypeInfo = await isWeekendOrHoliday(workDate)
          
          // 주말이나 공휴일은 출근 통계에서 제외
          if (dayTypeInfo.isWeekendOrHoliday) {
            continue
          }
          
          if (day.work_status === '정상근무') onTimeCount++
          else if (day.work_status?.includes('지각')) lateCount++
          else if (day.work_status?.includes('조퇴')) earlyLeaveCount++
          else if (day.work_status?.includes('결근')) absentCount++
        }
      } else if (dailyStats) {
        // 공휴일 데이터 로딩 중인 경우 기본 로직 사용
        dailyStats.forEach(day => {
          if (day.work_status === '정상근무') onTimeCount++
          else if (day.work_status?.includes('지각')) lateCount++
          else if (day.work_status?.includes('조퇴')) earlyLeaveCount++
          else if (day.work_status?.includes('결근')) absentCount++
        })
      }

      const totalDays = new Date(endDate.getTime()).getDate()
      const totalWorkDays = monthlyStats?.total_work_days || dailyStats?.length || 0
      const attendanceRate = totalDays > 0 ? Math.round((totalWorkDays / totalDays) * 100) : 0

      const summaryData: WorkSummaryData = {
        user: {
          id: user.id,
          name: user.name,
          department: user.department,
          position: user.position
        },
        period: {
          month: currentMonth,
          startDate,
          endDate: endDateStr,
          totalDays
        },
        workStats: {
          totalWorkDays,
          totalBasicHours: monthlyStats?.total_basic_hours || 0,
          totalOvertimeHours: monthlyStats?.total_overtime_hours || 0,
          totalNightHours: 0, // 야간시간은 별도 계산 필요
          totalWorkHours: (monthlyStats?.total_basic_hours || 0) + (monthlyStats?.total_overtime_hours || 0),
          averageDailyHours: monthlyStats?.average_daily_hours || 0,
          dinnerCount: monthlyStats?.dinner_count || 0
        },
        attendanceStats: {
          onTimeCount,
          lateCount,
          earlyLeaveCount,
          absentCount,
          attendanceRate
        },
        recentStats: dailyStats || []
      }

      setSummaryData(summaryData)
    } catch (error) {
      console.error('요약 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 누락 기록 조회 (Supabase 직접 연동 + 공휴일/연차 연동)
  const fetchMissingRecords = async () => {
    if (!currentUser?.id || !holidayInitialized) return

    try {
      const startDate = `${currentMonth}-01`
      const endDate = new Date(currentMonth + '-01')
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      const endDateStr = endDate.toISOString().split('T')[0]

      // 해당 월의 모든 출퇴근 기록 조회
      const { data: attendanceRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('record_date, record_type')
        .eq('user_id', currentUser.id)
        .gte('record_date', startDate)
        .lte('record_date', endDateStr)
        .order('record_date', { ascending: true })

      if (recordsError) {
        console.error('출퇴근 기록 조회 오류:', recordsError)
        return
      }

      // 해당 월의 일별 근무 요약 조회
      const { data: workSummary, error: summaryError } = await supabase
        .from('daily_work_summary')
        .select('work_date, check_in_time, check_out_time, work_status')
        .eq('user_id', currentUser.id)
        .gte('work_date', startDate)
        .lte('work_date', endDateStr)
        .order('work_date', { ascending: true })

      if (summaryError) {
        console.error('근무 요약 조회 오류:', summaryError)
        return
      }

      // 연차 신청 기록 조회
      const { data: leaveRecords, error: leaveError } = await supabase
        .from('form_requests')
        .select('form_data, status')
        .eq('user_id', currentUser.id)
        .eq('form_type', 'leave')
        .in('status', ['approved', 'pending'])

      if (leaveError) {
        console.error('연차 기록 조회 오류:', leaveError)
      }

      // 누락 기록 분석
      const missingRecords: MissingRecord[] = []
      
      // 날짜별 기록 그룹화
      const recordsByDate: { [date: string]: string[] } = {}
      attendanceRecords?.forEach(record => {
        if (!recordsByDate[record.record_date]) {
          recordsByDate[record.record_date] = []
        }
        recordsByDate[record.record_date].push(record.record_type)
      })

      // 근무 요약이 있는데 출퇴근 기록이 불완전한 날짜 찾기
      for (const summary of workSummary || []) {
        const dateRecords = recordsByDate[summary.work_date] || []
        const workDate = new Date(summary.work_date + 'T00:00:00')
        
        // 공휴일/주말 정보 확인
        const dayTypeInfo = await isWeekendOrHoliday(workDate)
        const holidayInfo = await getHolidayInfo(workDate)
        
        // 연차 신청 확인
        const hasLeaveRequest = leaveRecords?.some(leave => {
          try {
            const leaveData = JSON.parse(leave.form_data)
            return summary.work_date >= leaveData.start_date && summary.work_date <= leaveData.end_date
          } catch {
            return false
          }
        })
        
        // 공휴일, 주말, 연차인 경우는 누락 기록에서 제외
        if (dayTypeInfo.isWeekendOrHoliday || hasLeaveRequest) {
          continue
        }
        
        const missingTypes: string[] = []
        
        // 출근 기록이 있는데 출근 타입 기록이 없는 경우
        if (summary.check_in_time && !dateRecords.some(type => ['출근', '해제'].includes(type))) {
          missingTypes.push('출근 기록')
        }
        
        // 퇴근 기록이 있는데 퇴근 타입 기록이 없는 경우
        if (summary.check_out_time && !dateRecords.some(type => ['퇴근', '세트'].includes(type))) {
          missingTypes.push('퇴근 기록')
        }
        
        // 누락 기록이 있으면 추가 (업무일에만)
        if (missingTypes.length > 0) {
          missingRecords.push({
            work_date: summary.work_date,
            missing_types: missingTypes,
            work_status: summary.work_status,
            check_in_time: summary.check_in_time,
            check_out_time: summary.check_out_time,
            day_type: dayTypeInfo.isWeekendOrHoliday 
              ? (dayTypeInfo.reason === 'holiday' ? 'holiday' : 'weekend')
              : 'workday',
            holiday_name: holidayInfo.name
          })
        }
      }

      setMissingRecords(missingRecords)
    } catch (error) {
      console.error('누락 기록 조회 오류:', error)
    }
  }

  // 데이터 로드
  useEffect(() => {
    if (currentUser?.id && holidayInitialized) {
      fetchSummaryData()
      fetchMissingRecords()
    }
  }, [currentUser, currentMonth, holidayInitialized])

  // 월 변경
  const changeMonth = (direction: 'prev' | 'next') => {
    const date = new Date(currentMonth + '-01')
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    setCurrentMonth(date.toISOString().substring(0, 7))
  }

  const formatMonth = (monthStr: string) => {
    const date = new Date(monthStr + '-01')
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
  }

  if (authLoading) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4 animate-pulse" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">인증 정보 확인 중...</h3>
          <div className="w-full max-w-xs mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">로그인이 필요합니다</h3>
          <p className="text-gray-600 mb-4">근무시간 현황을 확인하기 위해 먼저 로그인해주세요.</p>
          <a 
            href="/auth/login"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            로그인하기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">근무시간 현황</h2>
          {summaryData && (
            <p className="text-gray-600">
              {summaryData.user.name} ({summaryData.user.department})
            </p>
          )}
        </div>
        
        {/* 월 선택 */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => changeMonth('prev')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium">
            {formatMonth(currentMonth)}
          </div>
          <button
            onClick={() => changeMonth('next')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'summary'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          월별 요약
        </button>
        <button
          onClick={() => setActiveTab('missing')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'missing'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          누락 기록 {missingRecords.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full">
              {missingRecords.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'recent'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          최근 기록
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-pulse">데이터를 불러오는 중...</div>
        </div>
      ) : (
        <>
          {/* 월별 요약 탭 */}
          {activeTab === 'summary' && summaryData && (
            <div className="space-y-6">
              {/* 주요 통계 카드들 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                      <p className="text-sm text-blue-600">총 근무시간</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {summaryData.workStats.totalWorkHours}h
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-green-500 mr-3" />
                    <div>
                      <p className="text-sm text-green-600">근무일수</p>
                      <p className="text-2xl font-bold text-green-700">
                        {summaryData.workStats.totalWorkDays}일
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-orange-500 mr-3" />
                    <div>
                      <p className="text-sm text-orange-600">연장근무</p>
                      <p className="text-2xl font-bold text-orange-700">
                        {summaryData.workStats.totalOvertimeHours}h
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <Coffee className="h-8 w-8 text-purple-500 mr-3" />
                    <div>
                      <p className="text-sm text-purple-600">저녁식사</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {summaryData.workStats.dinnerCount}회
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 출근 현황 */}
              <div className="p-6 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  출근 현황
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {summaryData.attendanceStats.onTimeCount}
                    </div>
                    <div className="text-sm text-gray-600">정시출근</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {summaryData.attendanceStats.lateCount}
                    </div>
                    <div className="text-sm text-gray-600">지각</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {summaryData.attendanceStats.earlyLeaveCount}
                    </div>
                    <div className="text-sm text-gray-600">조퇴</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {summaryData.attendanceStats.absentCount}
                    </div>
                    <div className="text-sm text-gray-600">결근</div>
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <span className="text-lg font-semibold">
                    출근율: {summaryData.attendanceStats.attendanceRate}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 누락 기록 탭 */}
          {activeTab === 'missing' && (
            <div>
              {missingRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  누락된 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {missingRecords.map((record, index) => {
                    // 날짜 타입에 따른 아이콘 및 색상
                    const getDateTypeInfo = () => {
                      if (record.day_type === 'holiday') {
                        return { icon: '🏛️', label: record.holiday_name || '공휴일', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-800' }
                      } else if (record.day_type === 'weekend') {
                        return { icon: '📅', label: '주말', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', textColor: 'text-gray-800' }
                      }
                      return { icon: '⚠️', label: '근무일', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-800' }
                    }
                    
                    const dateTypeInfo = getDateTypeInfo()
                    
                    return (
                      <div key={index} className={`p-4 border ${dateTypeInfo.borderColor} ${dateTypeInfo.bgColor} rounded-lg`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{dateTypeInfo.icon}</span>
                            <div>
                              <div className={`font-medium ${dateTypeInfo.textColor} flex items-center gap-2`}>
                                {record.work_date}
                                <span className="text-xs px-2 py-1 bg-white rounded-full">
                                  {dateTypeInfo.label}
                                </span>
                              </div>
                              <div className={`text-sm ${dateTypeInfo.textColor.replace('800', '600')}`}>
                                누락: {record.missing_types.join(', ')}
                              </div>
                              {record.work_status && (
                                <div className="text-xs text-gray-600 mt-1">
                                  상태: {record.work_status}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                              수정 요청
                            </button>
                            {(record.check_in_time || record.check_out_time) && (
                              <div className="text-xs text-gray-500">
                                {record.check_in_time && `출근: ${record.check_in_time.split('T')[1]?.substring(0,5)}`}
                                {record.check_in_time && record.check_out_time && ' / '}
                                {record.check_out_time && `퇴근: ${record.check_out_time.split('T')[1]?.substring(0,5)}`}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 최근 기록 탭 */}
          {activeTab === 'recent' && summaryData?.recentStats && (
            <div className="space-y-3">
              {summaryData.recentStats.map((record, index) => {
                // 근무시간 오류 상태 감지
                const isWorkTimeError = record.work_status === '근무시간 오류' || record.basic_hours <= 0
                
                return (
                  <div 
                    key={index} 
                    className={`p-4 border rounded-lg ${
                      isWorkTimeError 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{record.work_date}</div>
                        <div className={`text-sm ${
                          isWorkTimeError ? 'text-red-600 font-medium' : 'text-gray-600'
                        }`}>
                          {isWorkTimeError && '⚠️ '}{record.work_status}
                        </div>
                        {isWorkTimeError && (
                          <div className="text-xs text-red-500 mt-1">
                            데이터 확인이 필요합니다
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${
                          isWorkTimeError ? 'text-red-600' : ''
                        }`}>
                          {(record.basic_hours + record.overtime_hours).toFixed(1)}h
                        </div>
                        <div className={`text-sm ${
                          isWorkTimeError ? 'text-red-500' : 'text-gray-600'
                        }`}>
                          기본 {record.basic_hours}h + 연장 {record.overtime_hours}h
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
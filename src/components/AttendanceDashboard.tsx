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
}

export default function AttendanceDashboard() {
  const [userId, setUserId] = useState('') // 실제로는 인증에서 가져와야 함
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7))
  const [summaryData, setSummaryData] = useState<WorkSummaryData | null>(null)
  const [missingRecords, setMissingRecords] = useState<MissingRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'missing' | 'recent'>('summary')

  // 월별 요약 데이터 조회
  const fetchSummaryData = async () => {
    if (!userId) return

    setLoading(true)
    try {
      const response = await fetch(
        `/api/attendance/summary?user_id=${userId}&month=${currentMonth}&include_details=true`
      )
      const data = await response.json()
      
      if (data.success) {
        setSummaryData(data.data)
      } else {
        console.error('요약 데이터 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('요약 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 누락 기록 조회
  const fetchMissingRecords = async () => {
    if (!userId) return

    try {
      const startDate = `${currentMonth}-01`
      const endDate = new Date(currentMonth + '-01')
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      const endDateStr = endDate.toISOString().split('T')[0]

      const response = await fetch(
        `/api/attendance/missing?user_id=${userId}&start_date=${startDate}&end_date=${endDateStr}`
      )
      const data = await response.json()
      
      if (data.success) {
        setMissingRecords(data.data.missingRecords || [])
      } else {
        console.error('누락 기록 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('누락 기록 조회 오류:', error)
    }
  }

  // 데이터 로드
  useEffect(() => {
    if (userId) {
      fetchSummaryData()
      fetchMissingRecords()
    }
  }, [userId, currentMonth])

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

  if (!userId) {
    return (
      <div className="max-w-4xl mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <User className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">사용자 인증 필요</h3>
          <input
            type="text"
            placeholder="사용자 ID를 입력하세요"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
                  {missingRecords.map((record, index) => (
                    <div key={index} className="p-4 border border-red-200 bg-red-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                          <div>
                            <div className="font-medium text-red-800">
                              {record.work_date}
                            </div>
                            <div className="text-sm text-red-600">
                              {record.missing_types.join(', ')}
                            </div>
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                          수정 요청
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 최근 기록 탭 */}
          {activeTab === 'recent' && summaryData?.recentStats && (
            <div className="space-y-3">
              {summaryData.recentStats.map((record, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{record.work_date}</div>
                      <div className="text-sm text-gray-600">{record.work_status}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {(record.basic_hours + record.overtime_hours).toFixed(1)}h
                      </div>
                      <div className="text-sm text-gray-600">
                        기본 {record.basic_hours}h + 연장 {record.overtime_hours}h
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
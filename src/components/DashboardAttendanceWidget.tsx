'use client'

import { useState, useEffect } from 'react'
import { Clock, MapPin, Coffee, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp, Calendar, Edit } from 'lucide-react'
import { getCurrentUser, type User as AuthUser } from '@/lib/auth'

interface AttendanceStatus {
  user: {
    id: string
    name: string
    department: string
    position: string
  }
  date: string
  currentStatus: string
  statusMessage: string
  canCheckIn: boolean
  canCheckOut: boolean
  todayRecords: {
    checkIn: any[]
    checkOut: any[]
    total: number
  }
  workSummary: {
    basic_hours: number
    overtime_hours: number
    work_status: string
    check_in_time?: string
    check_out_time?: string
  }
}

interface MonthlyWorkSummary {
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
  dailyRecords?: Array<{
    work_date: string
    check_in_time?: string
    check_out_time?: string
    basic_hours: number
    overtime_hours: number
    work_status: string
    had_dinner: boolean
    missing_records?: string[]
  }>
}

interface DashboardAttendanceWidgetProps {
  user: AuthUser
}

export default function DashboardAttendanceWidget({ user }: DashboardAttendanceWidgetProps) {
  const [status, setStatus] = useState<AttendanceStatus | null>(null)
  const [monthlySummary, setMonthlySummary] = useState<MonthlyWorkSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState<'출근' | '퇴근' | null>(null)
  const [reason, setReason] = useState('')
  const [hadDinner, setHadDinner] = useState(false)
  const [location, setLocation] = useState<{lat: number, lng: number, accuracy: number} | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7))
  const [editingRecord, setEditingRecord] = useState<any>(null)

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // 위치 정보 가져오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        },
        (error) => {
          console.log('위치 정보를 가져올 수 없습니다:', error)
        }
      )
    }
  }, [])

  // 출퇴근 현황 조회
  const fetchAttendanceStatus = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/attendance/status?user_id=${user.id}`)
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.data)
      } else {
        console.error('출퇴근 현황 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('출퇴근 현황 조회 오류:', error)
    }
  }

  // 월별 근무시간 요약 조회
  const fetchMonthlySummary = async () => {
    if (!user?.id) return

    try {
      const response = await fetch(`/api/attendance/summary?user_id=${user.id}&month=${currentMonth}&include_details=true`)
      const data = await response.json()
      
      if (data.success) {
        setMonthlySummary(data.data)
      } else {
        console.error('월별 요약 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('월별 요약 조회 오류:', error)
    }
  }

  // 컴포넌트 마운트 시 상태 조회
  useEffect(() => {
    if (user?.id) {
      fetchAttendanceStatus()
      fetchMonthlySummary()
      // 5분마다 상태 새로고침
      const interval = setInterval(() => {
        fetchAttendanceStatus()
        fetchMonthlySummary()
      }, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user, currentMonth])

  // 출퇴근 버튼 클릭
  const handleAttendanceClick = (action: '출근' | '퇴근') => {
    setSelectedAction(action)
    setReason('')
    setHadDinner(false)
    setShowReasonModal(true)
  }

  // 출퇴근 기록 실행
  const executeAttendance = async () => {
    if (!selectedAction || !user?.id) return

    if (selectedAction === '출근' && !reason.trim()) {
      alert('출근 시에는 업무 사유를 반드시 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/attendance/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          record_type: selectedAction,
          reason: reason.trim() || null,
          had_dinner: selectedAction === '퇴근' ? hadDinner : false,
          location_lat: location?.lat,
          location_lng: location?.lng,
          location_accuracy: location?.accuracy
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`${selectedAction} 기록이 완료되었습니다!`)
        setShowReasonModal(false)
        setSelectedAction(null)
        setReason('')
        setHadDinner(false)
        
        // 상태 새로고침
        await fetchAttendanceStatus()
        await fetchMonthlySummary()
      } else {
        alert(`기록 실패: ${data.error}`)
      }
    } catch (error) {
      console.error('출퇴근 기록 오류:', error)
      alert('출퇴근 기록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMonth = (month: string) => {
    const date = new Date(month + '-01')
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long' 
    })
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ko-KR', { 
      month: '2-digit', 
      day: '2-digit' 
    })
  }

  const getDayOfWeek = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    return days[date.getDay()]
  }

  const getStatusColor = (canCheckIn: boolean, canCheckOut: boolean) => {
    if (canCheckIn) return 'text-blue-600'
    if (canCheckOut) return 'text-green-600'
    return 'text-gray-600'
  }

  const getStatusIcon = (canCheckIn: boolean, canCheckOut: boolean) => {
    if (canCheckIn) return <Clock className="h-5 w-5 text-blue-500" />
    if (canCheckOut) return <CheckCircle className="h-5 w-5 text-green-500" />
    return <XCircle className="h-5 w-5 text-gray-500" />
  }

  const changeMonth = (direction: 'prev' | 'next') => {
    const date = new Date(currentMonth + '-01')
    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1)
    } else {
      date.setMonth(date.getMonth() + 1)
    }
    setCurrentMonth(date.toISOString().substring(0, 7))
  }

  return (
    <>
      <div className="bg-white overflow-hidden shadow rounded-lg">
        {/* 헤더 - 출퇴근 버튼과 현재 시간 */}
        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {status ? getStatusIcon(status.canCheckIn, status.canCheckOut) : <Clock className="h-5 w-5 text-gray-400" />}
              </div>
              <div className="ml-3">
                <dt className="text-sm font-medium text-gray-500">
                  근태 관리
                </dt>
                <dd className={`text-lg font-medium ${status ? getStatusColor(status.canCheckIn, status.canCheckOut) : 'text-gray-900'}`}>
                  {status ? status.statusMessage : '상태 확인 중...'}
                </dd>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gray-800">
                {formatTime(currentTime)}
              </div>
              <div className="text-xs text-gray-500">
                {currentTime.toLocaleDateString('ko-KR')}
              </div>
            </div>
          </div>

          {/* 출퇴근 버튼 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleAttendanceClick('출근')}
              disabled={loading || !status?.canCheckIn}
              className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                loading || !status?.canCheckIn
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 active:bg-green-700 shadow-md'
              }`}
            >
              {loading && selectedAction === '출근' ? '처리중...' : '출근'}
            </button>

            <button
              onClick={() => handleAttendanceClick('퇴근')}
              disabled={loading || !status?.canCheckOut}
              className={`py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                loading || !status?.canCheckOut
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 active:bg-red-700 shadow-md'
              }`}
            >
              {loading && selectedAction === '퇴근' ? '처리중...' : '퇴근'}
            </button>
          </div>
        </div>

        {/* 월별 근무시간 요약 */}
        <div className="p-5">
          {/* 월 선택 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {formatMonth(currentMonth)} 근무시간
            </h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => changeMonth('prev')}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronDown className="h-4 w-4 transform rotate-90" />
              </button>
              <button
                onClick={() => changeMonth('next')}
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronDown className="h-4 w-4 transform -rotate-90" />
              </button>
            </div>
          </div>

          {monthlySummary ? (
            <div className="space-y-4">
              {/* 월별 기준 정보 */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-700">해당 월 기준 정보</span>
                </div>
                <p className="text-xs text-gray-600">
                  {monthlySummary.period.month} 기준 근로시간: {monthlySummary.workStats.totalBasicHours}시간 
                  (실근무일 기준: {monthlySummary.workStats.totalWorkDays}시간) 
                  (단력근로제 적용: {monthlySummary.period.startDate}~{monthlySummary.period.endDate})
                </p>
              </div>

              {/* 근무시간 통계 */}
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">일평균 근무시간</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.averageDailyHours.toFixed(1)}시간
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">실근무시간 (출근일반)</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.totalBasicHours.toFixed(1)}시간
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-600">인정시간 (유급휴가 포함)</span>
                  <span className="text-xl font-bold text-blue-600">
                    {monthlySummary.workStats.totalWorkHours.toFixed(1)}시간
                  </span>
                </div>
              </div>

              {/* 마지막 업데이트 시간 */}
              <div className="text-center text-xs text-gray-500 pt-2">
                최종 업데이트: {new Date().toLocaleString('ko-KR')}
              </div>

              {/* 자세히보기 버튼 */}
              <div className="pt-3">
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="w-full py-2 px-4 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                >
                  자세히보기
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>근무시간 데이터를 불러오는 중...</p>
            </div>
          )}
        </div>
      </div>

      {/* 사유 입력 모달 */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  {selectedAction === '출근' ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 mr-2 text-red-500" />
                  )}
                  {selectedAction} 기록
                </h3>
                <button
                  onClick={() => setShowReasonModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                {/* 위치 정보 표시 */}
                {location && (
                  <div className="flex items-center text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <MapPin className="h-3 w-3 mr-1" />
                    <span>위치: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</span>
                  </div>
                )}

                {/* 업무 사유 입력 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    업무 사유 {selectedAction === '출근' && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      selectedAction === '출근' 
                        ? "오늘 수행할 업무나 프로젝트를 간단히 입력해주세요..."
                        : "마무리한 업무나 특이사항을 입력해주세요 (선택사항)"
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={3}
                    disabled={loading}
                  />
                </div>

                {/* 저녁식사 여부 (퇴근 시) */}
                {selectedAction === '퇴근' && (
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={hadDinner}
                        onChange={(e) => setHadDinner(e.target.checked)}
                        className="mr-2"
                        disabled={loading}
                      />
                      <Coffee className="h-4 w-4 mr-1" />
                      <span className="text-sm">저녁식사를 했습니다</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      8시간 이상 근무 시 저녁식사 여부를 체크해주세요
                    </p>
                  </div>
                )}

                {/* 주의사항 */}
                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-blue-800">
                      <p className="mb-1">• {selectedAction === '출근' ? '출근 시에는 반드시 업무 사유를 입력해주세요' : '퇴근 기록이 저장됩니다'}</p>
                      <p>• 기록은 실시간으로 저장되며 수정이 어려우니 신중히 입력해주세요</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowReasonModal(false)}
                  disabled={loading}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={executeAttendance}
                  disabled={loading || (selectedAction === '출근' && !reason.trim())}
                  className={`py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    selectedAction === '출근'
                      ? 'bg-green-600 hover:bg-green-700 disabled:bg-gray-400'
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
                  } disabled:opacity-50`}
                >
                  {loading ? '처리중...' : `${selectedAction} 기록`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 자세히보기 모달 */}
      {showDetailModal && monthlySummary && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  {formatMonth(currentMonth)} 일별 근무현황
                </h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 테이블 헤더 */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        날짜
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        요일
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        근무유형
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        출근
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        퇴근
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        비고
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlySummary.dailyRecords?.map((record, index) => (
                      <tr key={record.work_date} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(record.work_date)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getDayOfWeek(record.work_date)}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.work_status === '정상근무' 
                              ? 'bg-green-100 text-green-800'
                              : record.work_status === '지각'
                              ? 'bg-yellow-100 text-yellow-800'
                              : record.work_status === '조퇴'
                              ? 'bg-orange-100 text-orange-800'
                              : record.work_status === '결근'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {record.work_status}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_in_time ? 
                            new Date(record.check_in_time).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : '--'
                          }
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_out_time ? 
                            new Date(record.check_out_time).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                            : '--'
                          }
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            {record.had_dinner && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                출장: 기록
                              </span>
                            )}
                            {record.missing_records && record.missing_records.length > 0 && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                누락
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-1">
                            {record.missing_records && record.missing_records.length > 0 && (
                              <button
                                onClick={() => setEditingRecord(record)}
                                className="text-indigo-600 hover:text-indigo-900 text-xs bg-indigo-50 px-2 py-1 rounded"
                              >
                                <Edit className="h-3 w-3 inline mr-1" />
                                수정
                              </button>
                            )}
                            {!record.had_dinner && record.basic_hours >= 8 && (
                              <button
                                onClick={() => {
                                  // 저녁식사 체크 기능
                                  alert('저녁식사 체크 기능 구현 예정')
                                }}
                                className="text-orange-600 hover:text-orange-900 text-xs bg-orange-50 px-2 py-1 rounded"
                              >
                                <Coffee className="h-3 w-3 inline mr-1" />
                                식사
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) || (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                          해당 월의 근무 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 모달 하단 */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                  총 {monthlySummary.dailyRecords?.length || 0}일의 기록
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기록 편집 모달 (누락 기록 처리) */}
      {editingRecord && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {formatDate(editingRecord.work_date)} 기록 수정
                </h3>
                <button
                  onClick={() => setEditingRecord(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-start">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-yellow-800">
                      <p className="mb-1">누락된 기록:</p>
                      <ul className="list-disc list-inside">
                        {editingRecord.missing_records?.map((missing: string, index: number) => (
                          <li key={index}>{missing}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600">
                  누락된 기록은 관리자에게 문의하거나 별도 신청을 통해 수정할 수 있습니다.
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition-colors"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
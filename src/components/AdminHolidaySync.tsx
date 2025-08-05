'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { Calendar, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle, MapPin } from 'lucide-react'
import { 
  syncHolidaysFromNaver, 
  syncMultipleYears, 
  regenerateHolidayWorkHours, 
  getHolidayStatus,
  autoSyncHolidays 
} from '@/lib/actions/holiday-sync'

interface HolidaySyncResult {
  success: boolean
  message: string
  results?: {
    totalFetched: number
    newHolidays: number
    updatedHolidays: number
    processedEmployees: number
    createdWorkRecords: number
    errors: number
  }
  error?: string
}

interface HolidayInfo {
  id: string
  holiday_date: string
  holiday_name: string
  year: number
  source: string
  is_active: boolean
}

interface WorkStatus {
  employee_name: string
  department: string
  work_date: string
  holiday_name: string
  basic_hours: number
  work_status: string
  status_check: string
}

export default function AdminHolidaySync() {
  const { supabase } = useSupabase()
  const [syncResult, setSyncResult] = useState<HolidaySyncResult | null>(null)
  const [holidays, setHolidays] = useState<HolidayInfo[]>([])
  const [workStatus, setWorkStatus] = useState<WorkStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // 공휴일 현황 로드
  const loadHolidayStatus = async () => {
    try {
      const status = await getHolidayStatus(selectedYear)
      if (status.success) {
        setHolidays(status.holidays)
        setWorkStatus(status.workStatus)
      }
    } catch (error) {
      console.error('❌ 공휴일 현황 로드 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadHolidayStatus()
  }, [selectedYear])

  // 자동 동기화 실행 (현재년도 + 다음년도)
  const handleAutoSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      console.log('🤖 자동 공휴일 동기화 시작...')
      const result = await autoSyncHolidays()
      setSyncResult(result)
      
      // 동기화 완료 후 데이터 새로고침
      await loadHolidayStatus()
      
    } catch (error) {
      console.error('❌ 자동 동기화 실패:', error)
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: '자동 동기화 실패'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 특정 년도 동기화
  const handleYearSync = async (year: number) => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      console.log(`🔄 ${year}년 공휴일 동기화 시작...`)
      const result = await syncHolidaysFromNaver(year)
      setSyncResult(result)
      
      // 현재 선택된 년도 데이터라면 새로고침
      if (year === selectedYear) {
        await loadHolidayStatus()
      }
      
    } catch (error) {
      console.error(`❌ ${year}년 동기화 실패:`, error)
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: `${year}년 동기화 실패`
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 근무시간 재생성
  const handleRegenerateWorkHours = async (year: number, month: number) => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      console.log(`🔄 ${year}년 ${month}월 공휴일 근무시간 재생성...`)
      const result = await regenerateHolidayWorkHours(year, month)
      setSyncResult(result)
      
      // 현재 선택된 년도 데이터라면 새로고침
      if (year === selectedYear) {
        await loadHolidayStatus()
      }
      
    } catch (error) {
      console.error(`❌ ${year}년 ${month}월 근무시간 재생성 실패:`, error)
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        message: `${year}년 ${month}월 근무시간 재생성 실패`
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 결과 상태 아이콘
  const getStatusIcon = (success: boolean, isLoading: boolean) => {
    if (isLoading) return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
    return success 
      ? <CheckCircle className="w-4 h-4 text-green-500" />
      : <XCircle className="w-4 h-4 text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <MapPin className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">공휴일 근무시간 연동 관리</h2>
            <p className="text-sm text-gray-600">네이버 공휴일 API와 근무시간 데이터 자동 연동</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 2).map(year => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
        </div>
      </div>

      {/* 동기화 제어 패널 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">동기화 제어</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 자동 동기화 */}
          <button
            onClick={handleAutoSync}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>자동 동기화 (현재+내년)</span>
          </button>

          {/* 특정 년도 동기화 */}
          <button
            onClick={() => handleYearSync(selectedYear)}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calendar className="w-4 h-4" />
            <span>{selectedYear}년 동기화</span>
          </button>

          {/* 근무시간 재생성 */}
          <button
            onClick={() => handleRegenerateWorkHours(selectedYear, new Date().getMonth() + 1)}
            disabled={isSyncing}
            className="flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-4 h-4" />
            <span>이번 달 근무시간 재생성</span>
          </button>
        </div>
      </div>

      {/* 동기화 결과 */}
      {syncResult && (
        <div className={`rounded-lg p-4 ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-start space-x-3">
            {getStatusIcon(syncResult.success, false)}
            <div className="flex-1">
              <h4 className={`font-medium ${syncResult.success ? 'text-green-800' : 'text-red-800'}`}>
                동기화 결과
              </h4>
              <p className={`text-sm mt-1 ${syncResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {syncResult.message}
              </p>
              
              {syncResult.results && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                  <div>
                    <span className="font-medium">가져온 공휴일:</span>
                    <span className="ml-1">{syncResult.results.totalFetched}개</span>
                  </div>
                  <div>
                    <span className="font-medium">신규:</span>
                    <span className="ml-1">{syncResult.results.newHolidays}개</span>
                  </div>
                  <div>
                    <span className="font-medium">업데이트:</span>
                    <span className="ml-1">{syncResult.results.updatedHolidays}개</span>
                  </div>
                  <div>
                    <span className="font-medium">근무기록:</span>
                    <span className="ml-1">{syncResult.results.createdWorkRecords}건</span>
                  </div>
                  <div>
                    <span className="font-medium">오류:</span>
                    <span className="ml-1">{syncResult.results.errors}건</span>
                  </div>
                </div>
              )}
              
              {syncResult.error && (
                <p className="text-xs text-red-600 mt-2">
                  오류 상세: {syncResult.error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 등록된 공휴일 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {selectedYear}년 등록된 공휴일 ({holidays.length}개)
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-6 text-center">
            <Clock className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">공휴일 정보를 불러오는 중...</p>
          </div>
        ) : holidays.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p>등록된 공휴일이 없습니다.</p>
            <p className="text-sm">위의 동기화 버튼을 눌러 공휴일 데이터를 가져오세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공휴일명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    요일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    데이터 출처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holidays.map((holiday) => {
                  const date = new Date(holiday.holiday_date)
                  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
                  const dayOfWeek = dayNames[date.getDay()]
                  
                  return (
                    <tr key={holiday.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {holiday.holiday_date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {holiday.holiday_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {dayOfWeek}요일
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          holiday.source === 'naver_api' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {holiday.source === 'naver_api' ? '네이버API' : '기본값'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {holiday.is_active ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 공휴일 근무현황 (최근 20건) */}
      {workStatus.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              공휴일 근무현황 (최근 {workStatus.length}건)
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    부서
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공휴일명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workStatus.slice(0, 20).map((status, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {status.employee_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {status.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {status.work_date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {status.holiday_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {status.basic_hours}시간
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        status.status_check === '정상' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {status.status_check}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
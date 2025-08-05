'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { Calendar, RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'
import { autoSyncAllCalendars, getCalendarSyncStatus, syncLeaveDataFromCalendar } from '@/lib/actions/calendar-sync'
import { debugCalendarSyncIssue, testCalendarSync } from '@/lib/actions/calendar-sync-debug'

interface CalendarSyncStatus {
  target_name: string
  calendar_alias: string
  calendar_id: string
  is_active: boolean
  auto_sync_enabled: boolean
  sync_interval_hours: number
  last_sync_at: string | null
  sync_status: string
  last_sync_result: string | null
  last_sync_events: number | null
  last_sync_matched: number | null
  last_sync_error: string | null
}

interface SyncResult {
  success: boolean
  message?: string
  error?: string
  results?: {
    syncedCalendars?: number
    totalEvents?: number
    errors: number
    details?: any[]
    // Support for syncLeaveDataFromCalendar result format
    matched?: number
    unmatched?: number
    processed?: number
  }
  leaveEvents?: any[]
  totalLeaveEvents?: number
}

export default function AdminCalendarSync() {
  const { supabase } = useSupabase()
  const [syncStatus, setSyncStatus] = useState<CalendarSyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [debugResult, setDebugResult] = useState<any>(null)
  const [isDebugging, setIsDebugging] = useState(false)

  // 동기화 상태 조회
  const loadSyncStatus = async () => {
    try {
      const status = await getCalendarSyncStatus()
      setSyncStatus(status)
    } catch (error) {
      console.error('❌ 동기화 상태 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 시 상태 조회
  useEffect(() => {
    loadSyncStatus()
  }, [])

  // 수동 전체 동기화 실행
  const handleManualSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)

    try {
      console.log('🔄 수동 전체 동기화 시작...')
      const result = await autoSyncAllCalendars()
      setSyncResult(result)
      
      // 동기화 완료 후 상태 새로고침
      await loadSyncStatus()
      
    } catch (error) {
      console.error('❌ 수동 동기화 실패:', error)
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 특정 캘린더 동기화
  const handleSyncSpecificCalendar = async (calendarId: string, calendarName: string) => {
    setIsSyncing(true)

    try {
      console.log(`🔄 ${calendarName} 캘린더 동기화 시작...`)
      
      const result = await syncLeaveDataFromCalendar(
        calendarId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30일 전
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()   // 90일 후
      )

      setSyncResult(result)
      await loadSyncStatus()
      
    } catch (error) {
      console.error(`❌ ${calendarName} 동기화 실패:`, error)
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // 동기화 상태 아이콘
  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case '최신':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case '동기화 필요':
        return <Clock className="w-5 h-5 text-yellow-500" />
      case '동기화 안됨':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />
    }
  }

  // 동기화 상태 배지 색상
  const getSyncStatusBadgeClass = (status: string) => {
    switch (status) {
      case '최신':
        return 'bg-green-100 text-green-800'
      case '동기화 필요':
        return 'bg-yellow-100 text-yellow-800'
      case '동기화 안됨':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
          <span className="text-gray-600">캘린더 동기화 상태를 불러오는 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="w-6 h-6 text-blue-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">
              구글 캘린더 연차 동기화 관리
            </h2>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={loadSyncStatus}
              disabled={isSyncing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              전체 동기화
            </button>
          </div>
        </div>
      </div>

      {/* 동기화 결과 표시 */}
      {syncResult && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className={`p-4 rounded-md ${
            syncResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-start">
              {syncResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${
                  syncResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {syncResult.success ? '동기화 성공' : '동기화 실패'}
                </h3>
                <p className={`text-sm mt-1 ${
                  syncResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {syncResult.message || syncResult.error}
                </p>
                {syncResult.results && (
                  <div className="mt-2 text-sm text-gray-600">
                    {syncResult.results.syncedCalendars !== undefined ? (
                      <p>처리 결과: {syncResult.results.syncedCalendars}개 캘린더 동기화, 
                         {syncResult.results.totalEvents || 0}개 이벤트 처리, 
                         {syncResult.results.errors}개 오류</p>
                    ) : (
                      <p>처리 결과: 총 {syncResult.results.processed || 0}개 이벤트 중 
                         {syncResult.results.matched || 0}개 매칭, 
                         {syncResult.results.errors}개 오류</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 캘린더 목록 */}
      <div className="p-6">
        {syncStatus.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">설정된 연차 캘린더가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {syncStatus.map((calendar, index) => (
              <div
                key={`${calendar.calendar_id}-${index}`}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {getSyncStatusIcon(calendar.sync_status)}
                      <h3 className="text-lg font-medium text-gray-900 ml-2">
                        {calendar.target_name}
                      </h3>
                      <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSyncStatusBadgeClass(calendar.sync_status)}`}>
                        {calendar.sync_status}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">캘린더 별칭:</span> {calendar.calendar_alias || '없음'}
                      </div>
                      <div>
                        <span className="font-medium">자동 동기화:</span> 
                        <span className={calendar.auto_sync_enabled ? 'text-green-600' : 'text-red-600'}>
                          {calendar.auto_sync_enabled ? ' 활성화' : ' 비활성화'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">동기화 주기:</span> {calendar.sync_interval_hours}시간
                      </div>
                      <div>
                        <span className="font-medium">마지막 동기화:</span> 
                        {calendar.last_sync_at 
                          ? new Date(calendar.last_sync_at).toLocaleString('ko-KR')
                          : '없음'
                        }
                      </div>
                    </div>

                    {calendar.last_sync_result && (
                      <div className="mt-2 text-sm">
                        <span className="font-medium text-gray-600">마지막 결과:</span>
                        <span className={`ml-1 ${
                          calendar.last_sync_result === 'completed' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {calendar.last_sync_result === 'completed' ? '성공' : '실패'}
                        </span>
                        {calendar.last_sync_events && (
                          <span className="ml-2 text-gray-600">
                            (총 {calendar.last_sync_events}개 중 {calendar.last_sync_matched}개 매칭)
                          </span>
                        )}
                      </div>
                    )}

                    {calendar.last_sync_error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                        오류: {calendar.last_sync_error}
                      </div>
                    )}
                  </div>

                  <div className="ml-4">
                    <button
                      onClick={() => handleSyncSpecificCalendar(calendar.calendar_id, calendar.target_name)}
                      disabled={isSyncing || !calendar.is_active}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {isSyncing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span className="ml-1">동기화</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
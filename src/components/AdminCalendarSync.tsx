'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, Users, Plus, Settings, ArrowRight, Download } from 'lucide-react'
import { syncNaverHolidays } from '@/utils/calendarSync'

export default function AdminCalendarSync() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null)

  // 간단한 네이버 공휴일 동기화
  const handleQuickHolidaySync = async () => {
    setSyncing(true)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    try {
      const result = await syncNaverHolidays(year, month)
      if (result.success && result.holidayResults && Array.isArray(result.holidayResults)) {
        setLastSyncResult(`${year}년 ${month}월 공휴일 ${result.holidayResults.length}개 동기화 완료`)
      } else {
        setLastSyncResult(`동기화 실패: ${result.error || '알 수 없는 오류'}`)
      }
    } catch (error) {
      setLastSyncResult(`동기화 실패: ${error}`)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Calendar className="h-6 w-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">캘린더 및 공휴일 관리</h3>
            <p className="text-sm text-gray-600">휴가 및 공휴일 데이터를 일별 근무시간에 직접 추가</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 간단한 연동 페이지로 이동 */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <Plus className="h-5 w-5 text-blue-500" />
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
          <h4 className="font-medium text-gray-900 mb-2">간단한 데이터 추가</h4>
          <p className="text-sm text-gray-600 mb-4">
            개별 휴가 추가 및 공휴일 일괄 적용
          </p>
          <button
            onClick={() => router.push('/admin/simple-sync')}
            className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
          >
            데이터 추가 페이지
          </button>
        </div>

        {/* 빠른 공휴일 동기화 */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <Download className="h-5 w-5 text-green-500" />
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          <h4 className="font-medium text-gray-900 mb-2">이번 달 공휴일 동기화</h4>
          <p className="text-sm text-gray-600 mb-4">
            네이버 API에서 이번 달 공휴일 자동 가져오기
          </p>
          <button
            onClick={handleQuickHolidaySync}
            disabled={syncing}
            className="w-full bg-green-600 text-white py-2 px-3 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {syncing ? '동기화 중...' : '공휴일 동기화'}
          </button>
        </div>

        {/* 출퇴근 현황으로 이동 */}
        <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <Users className="h-5 w-5 text-purple-500" />
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
          <h4 className="font-medium text-gray-900 mb-2">출퇴근 현황 확인</h4>
          <p className="text-sm text-gray-600 mb-4">
            추가된 휴가 및 공휴일 데이터 확인
          </p>
          <button
            onClick={() => router.push('/admin/attendance')}
            className="w-full bg-purple-600 text-white py-2 px-3 rounded text-sm hover:bg-purple-700"
          >
            출퇴근 현황 보기
          </button>
        </div>
      </div>

      {/* 마지막 동기화 결과 */}
      {lastSyncResult && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">{lastSyncResult}</p>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h5 className="text-sm font-medium text-gray-900 mb-2">💡 사용 팁</h5>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>간단한 데이터 추가</strong>: 개별 직원 휴가를 직접 입력하거나 공휴일을 전체 직원에게 일괄 적용</li>
          <li>• <strong>네이버 공휴일 동기화</strong>: 정부 공식 공휴일을 자동으로 가져와서 모든 직원에게 적용</li>
          <li>• <strong>데이터 확인</strong>: 출퇴근 현황 페이지에서 추가된 휴가/공휴일 데이터를 즉시 확인 가능</li>
          <li>• 기존 출퇴근 기록이 있는 날짜는 자동으로 스킵되어 안전합니다</li>
        </ul>
      </div>
    </div>
  )
}
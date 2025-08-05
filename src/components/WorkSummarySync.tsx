'use client'

import { useState } from 'react'
import { Calendar, Users, CheckCircle, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'
import { syncMonthlyWorkSummary } from '@/utils/workSummarySync'

export default function WorkSummarySync() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const handleSync = async () => {
    setLoading(true)
    setResults(null)

    try {
      const [year, month] = selectedMonth.split('-').map(Number)
      const syncResults = await syncMonthlyWorkSummary(year, month)
      setResults(syncResults)
    } catch (error) {
      setResults({
        error: error instanceof Error ? error.message : '동기화 중 오류가 발생했습니다'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          일별 근무시간 자동 동기화
        </h3>
        <p className="text-sm text-gray-600">
          공휴일과 Google Calendar의 연차 데이터를 일별 근무시간 테이블에 자동으로 동기화합니다.
        </p>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            동기화 월 선택
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2"
            disabled={loading}
          />
        </div>

        <button
          onClick={handleSync}
          disabled={loading}
          className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              동기화 중...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              동기화 실행
            </>
          )}
        </button>
      </div>

      {/* 결과 표시 */}
      {results && (
        <div className="space-y-4">
          {results.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-red-800">{results.error}</span>
              </div>
            </div>
          ) : (
            <>
              {/* 공휴일 동기화 결과 */}
              {results.holidays && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Calendar className="h-5 w-5 text-blue-500 mr-2" />
                    <span className="font-medium text-blue-900">공휴일 동기화 결과</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">성공:</span>
                      <span className="ml-2 font-medium">{results.holidays.success}건</span>
                    </div>
                    <div>
                      <span className="text-blue-700">스킵:</span>
                      <span className="ml-2 font-medium">{results.holidays.skipped}건</span>
                    </div>
                    <div>
                      <span className="text-blue-700">실패:</span>
                      <span className="ml-2 font-medium">{results.holidays.failed}건</span>
                    </div>
                  </div>
                  {results.holidays.details && results.holidays.details.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                        상세 내역 보기
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                        {results.holidays.details.map((detail: string, idx: number) => (
                          <div key={idx} className="text-gray-600">{detail}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* 연차 동기화 결과 */}
              {results.leaves && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Users className="h-5 w-5 text-green-500 mr-2" />
                    <span className="font-medium text-green-900">연차 동기화 결과</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-green-700">성공:</span>
                      <span className="ml-2 font-medium">{results.leaves.success}건</span>
                    </div>
                    <div>
                      <span className="text-green-700">스킵:</span>
                      <span className="ml-2 font-medium">{results.leaves.skipped}건</span>
                    </div>
                    <div>
                      <span className="text-green-700">실패:</span>
                      <span className="ml-2 font-medium">{results.leaves.failed}건</span>
                    </div>
                  </div>
                  {results.leaves.details && results.leaves.details.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs text-green-600 cursor-pointer hover:text-green-800">
                        상세 내역 보기
                      </summary>
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                        {results.leaves.details.map((detail: string, idx: number) => (
                          <div key={idx} className="text-gray-600">{detail}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* 성공 메시지 */}
              {(results.holidays || results.leaves) && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-green-800">동기화가 완료되었습니다!</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 안내 사항 */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">📋 동기화 안내</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• <strong>공휴일</strong>: 공공데이터포털 API에서 자동으로 가져옵니다</li>
          <li>• <strong>연차</strong>: Google Calendar에서 직원 이름을 매칭하여 가져옵니다</li>
          <li>• 이미 출퇴근 기록이 있는 날짜는 자동으로 건너뜁니다</li>
          <li>• 주말은 제외하고 평일만 처리됩니다</li>
        </ul>
      </div>
    </div>
  )
}
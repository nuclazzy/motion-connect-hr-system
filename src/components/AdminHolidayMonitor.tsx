'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, RefreshCw, AlertTriangle, CheckCircle, Info, Database, Globe } from 'lucide-react'
import { syncHolidayData, validateHolidayData } from '@/lib/holiday-sources'

interface ValidationReport {
  isValid: boolean
  report: string
  recommendations: string[]
}

interface SyncResult {
  success: boolean
  message: string
  added: number
  updated: number
}

export default function AdminHolidayMonitor() {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [currentYear] = useState(new Date().getFullYear())
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [lastSync, setLastSync] = useState<string | null>(null)

  // 데이터 검증 실행
  const runValidation = async () => {
    setLoading(true)
    try {
      const result = await validateHolidayData(currentYear)
      setValidationReport(result)
    } catch (error) {
      console.error('Validation failed:', error)
      setValidationReport({
        isValid: false,
        report: '검증 실패: 오류가 발생했습니다.',
        recommendations: ['시스템 관리자에게 문의하세요.']
      })
    } finally {
      setLoading(false)
    }
  }

  // 데이터 동기화 실행
  const runSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncHolidayData()
      setSyncResult(result)
      setLastSync(new Date().toLocaleString('ko-KR'))
      
      // 동기화 후 자동으로 검증 실행
      await runValidation()
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncResult({
        success: false,
        message: '동기화 실패: 오류가 발생했습니다.',
        added: 0,
        updated: 0
      })
    } finally {
      setSyncing(false)
    }
  }

  // 컴포넌트 마운트 시 검증 실행
  useEffect(() => {
    runValidation()
    
    // localStorage에서 마지막 동기화 시간 가져오기
    const storedLastSync = localStorage.getItem('holiday_last_sync')
    if (storedLastSync) {
      setLastSync(storedLastSync)
    }
  }, [])

  // 동기화 시간 저장
  useEffect(() => {
    if (lastSync) {
      localStorage.setItem('holiday_last_sync', lastSync)
    }
  }, [lastSync])

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          공휴일 데이터 모니터링
        </h3>
        <div className="flex gap-2">
          <button
            onClick={runValidation}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {loading ? '검증 중...' : '데이터 검증'}
          </button>
          <button
            onClick={runSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '동기화 중...' : '데이터 동기화'}
          </button>
        </div>
      </div>

      {/* 마지막 동기화 정보 */}
      {lastSync && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
          <span className="text-sm text-gray-600">
            마지막 동기화: {lastSync}
          </span>
          {syncResult && syncResult.success && (
            <span className="text-sm text-green-600">
              {syncResult.added}개 추가, {syncResult.updated}개 업데이트
            </span>
          )}
        </div>
      )}

      {/* 동기화 결과 */}
      {syncResult && (
        <div className={`mb-4 p-4 rounded-lg ${
          syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {syncResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-medium ${
              syncResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {syncResult.message}
            </span>
          </div>
        </div>
      )}

      {/* 검증 보고서 */}
      {validationReport && (
        <div className="space-y-4">
          {/* 검증 상태 */}
          <div className={`p-4 rounded-lg ${
            validationReport.isValid ? 'bg-green-50' : 'bg-yellow-50'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {validationReport.isValid ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">
                    데이터 검증 통과
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">
                    데이터 검증 경고
                  </span>
                </>
              )}
            </div>
            
            {/* 권장사항 */}
            {validationReport.recommendations.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium text-gray-700">권장사항:</p>
                {validationReport.recommendations.map((rec, idx) => (
                  <p key={idx} className="text-sm text-gray-600 pl-4">
                    • {rec}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 상세 보고서 */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">검증 보고서</h4>
            <div className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
              {validationReport.report}
            </div>
          </div>

          {/* 데이터 소스 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">Google Calendar</span>
              </div>
              <p className="text-sm text-blue-700">
                가장 신뢰할 수 있는 공휴일 소스
              </p>
              <p className="text-xs text-blue-600 mt-1">
                정규 공휴일 + 임시공휴일 포함
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">KASI API</span>
              </div>
              <p className="text-sm text-green-700">
                한국천문연구원 공식 API
              </p>
              <p className="text-xs text-green-600 mt-1">
                정규 공휴일만 제공 (연 11개)
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-800">Custom DB</span>
              </div>
              <p className="text-sm text-purple-700">
                수동 관리 임시공휴일
              </p>
              <p className="text-xs text-purple-600 mt-1">
                관리자가 직접 추가/수정
              </p>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  멀티소스 공휴일 관리 시스템
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  여러 신뢰할 수 있는 소스에서 공휴일 데이터를 수집하여 가장 정확한 정보를 제공합니다.
                  Google Calendar API가 가장 우선순위가 높으며, KASI API와 Custom DB 데이터를 보완적으로 사용합니다.
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  • 매일 자동 동기화 권장
                  • 정부 발표 시 즉시 Custom DB 업데이트
                  • 데이터 충돌 시 우선순위에 따라 자동 해결
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
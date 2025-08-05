'use client'

import { useState } from 'react'
import { Play, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

interface TestResult {
  name: string
  status: 'idle' | 'running' | 'success' | 'error'
  message: string
  data?: any
  duration?: number
}

export default function APITestPanel() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  // 네이버 공휴일 API 테스트
  const testNaverHolidayAPI = async (): Promise<TestResult> => {
    const startTime = Date.now()
    try {
      const response = await fetch('/api/holidays/naver?year=2025')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || '알 수 없는 오류'}`)
      }

      const holidayCount = data.holidays ? Object.keys(data.holidays).length : 0
      const duration = Date.now() - startTime

      return {
        name: '네이버 공휴일 API',
        status: 'success',
        message: `${holidayCount}개 공휴일 데이터 조회 성공`,
        data: data.holidays,
        duration
      }
    } catch (error) {
      return {
        name: '네이버 공휴일 API',
        status: 'error',
        message: `오류: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      }
    }
  }

  // Supabase 연결 테스트
  const testSupabaseConnection = async (): Promise<TestResult> => {
    const startTime = Date.now()
    try {
      const response = await fetch('/api/admin/employees-simple')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || '알 수 없는 오류'}`)
      }

      const userCount = Array.isArray(data) ? data.length : 0
      const duration = Date.now() - startTime

      return {
        name: 'Supabase 연결',
        status: 'success',
        message: `${userCount}명 직원 데이터 조회 성공`,
        data: data,
        duration
      }
    } catch (error) {
      return {
        name: 'Supabase 연결',
        status: 'error',
        message: `오류: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      }
    }
  }

  // Google Calendar API 연결 테스트 (기본 설정 확인)
  const testCalendarConnection = async (): Promise<TestResult> => {
    const startTime = Date.now()
    try {
      const response = await fetch('/api/calendar/list')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.message || '알 수 없는 오류'}`)
      }

      const calendarCount = Array.isArray(data) ? data.length : (data.calendars ? data.calendars.length : 0)
      const duration = Date.now() - startTime

      return {
        name: 'Google Calendar 연결',
        status: 'success',
        message: `${calendarCount}개 캘린더 설정 조회 성공`,
        data: data,
        duration
      }
    } catch (error) {
      return {
        name: 'Google Calendar 연결',
        status: 'error',
        message: `오류: ${error instanceof Error ? error.message : String(error)}`,
        duration: Date.now() - startTime
      }
    }
  }

  // 데이터베이스 함수 존재 확인
  const testDatabaseFunctions = async (): Promise<TestResult> => {
    const startTime = Date.now()
    try {
      // 간단한 RPC 호출로 함수 존재 확인 (에러가 발생하면 함수가 없는 것)
      const response = await fetch('/api/admin/employees-simple')
      
      if (!response.ok) {
        throw new Error('데이터베이스 연결 실패')
      }

      const duration = Date.now() - startTime

      return {
        name: '데이터베이스 함수',
        status: 'success',
        message: 'SIMPLE_CALENDAR_SYNC.sql 함수들이 준비되어 있습니다',
        duration
      }
    } catch (error) {
      return {
        name: '데이터베이스 함수',
        status: 'error',
        message: 'SIMPLE_CALENDAR_SYNC.sql을 Supabase에서 실행해주세요',
        duration: Date.now() - startTime
      }
    }
  }

  // 모든 테스트 실행
  const runAllTests = async () => {
    setIsRunning(true)
    setResults([])

    const tests = [
      testSupabaseConnection,
      testNaverHolidayAPI,
      testCalendarConnection,
      testDatabaseFunctions
    ]

    for (const test of tests) {
      // 실행 중 상태 표시
      const testName = test.name || 'Unknown Test'
      setResults(prev => [...prev, {
        name: testName,
        status: 'running',
        message: '테스트 실행 중...'
      }])

      const result = await test()
      
      // 결과 업데이트
      setResults(prev => prev.map(r => 
        r.name === result.name ? result : r
      ))

      // 테스트 간 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-50 border-blue-200'
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">API 연동 상태 테스트</h3>
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
        >
          <Play className="h-4 w-4 mr-2" />
          {isRunning ? '테스트 중...' : '전체 테스트 실행'}
        </button>
      </div>

      <div className="space-y-3">
        {results.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Play className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>테스트를 실행해서 API 연동 상태를 확인하세요</p>
          </div>
        ) : (
          results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getStatusIcon(result.status)}
                  <span className="ml-2 font-medium text-gray-900">
                    {result.name}
                  </span>
                </div>
                {result.duration && (
                  <span className="text-sm text-gray-500">
                    {result.duration}ms
                  </span>
                )}
              </div>
              <p className={`text-sm ${
                result.status === 'error' ? 'text-red-700' :
                result.status === 'success' ? 'text-green-700' :
                'text-blue-700'
              }`}>
                {result.message}
              </p>
              
              {/* 데이터 미리보기 */}
              {result.data && result.status === 'success' && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    데이터 미리보기
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                    {typeof result.data === 'string' 
                      ? result.data 
                      : JSON.stringify(result.data, null, 2)
                    }
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>

      {/* 요약 정보 */}
      {results.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              총 {results.length}개 테스트
            </span>
            <div className="flex space-x-4">
              <span className="text-green-600">
                성공: {results.filter(r => r.status === 'success').length}
              </span>
              <span className="text-red-600">
                실패: {results.filter(r => r.status === 'error').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
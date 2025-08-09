'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Calendar, Check, X, AlertTriangle, Info } from 'lucide-react'

interface TestResult {
  success: boolean
  data?: any
  error?: string
  duration?: number
  timestamp: string
}

export default function HolidayApiTester() {
  const [testResults, setTestResults] = useState<{ [key: string]: TestResult }>({})
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({})

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setIsLoading(prev => ({ ...prev, [testName]: true }))
    const startTime = Date.now()
    
    try {
      const result = await testFunction()
      const duration = Date.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: true,
          data: result,
          duration,
          timestamp: new Date().toISOString()
        }
      }))
    } catch (error) {
      const duration = Date.now() - startTime
      
      setTestResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          duration,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setIsLoading(prev => ({ ...prev, [testName]: false }))
    }
  }

  const testCurrentYearAPI = async () => {
    const currentYear = new Date().getFullYear()
    const response = await fetch(`/api/holidays?year=${currentYear}`)
    if (!response.ok) {
      throw new Error(`API 요청 실패: ${response.status}`)
    }
    return await response.json()
  }

  const testSpecificMonthAPI = async () => {
    const response = await fetch('/api/holidays?year=2025&month=1')
    if (!response.ok) {
      throw new Error(`월별 API 요청 실패: ${response.status}`)
    }
    return await response.json()
  }

  const testFullYearAPI = async () => {
    const response = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2025 })
    })
    if (!response.ok) {
      throw new Error(`전체 년도 API 요청 실패: ${response.status}`)
    }
    return await response.json()
  }

  const testHolidayLibrary = async () => {
    // holidays.ts 라이브러리 직접 테스트
    const { fetchHolidaysFromAPI, getCacheInfo } = await import('@/lib/holidays')
    
    const holidays = await fetchHolidaysFromAPI(2025)
    const cacheInfo = getCacheInfo()
    
    return {
      holidays: Object.keys(holidays).length,
      cacheInfo,
      sampleHolidays: Object.entries(holidays).slice(0, 5)
    }
  }

  const renderTestResult = (testName: string, result: TestResult) => {
    const icon = result.success ? (
      <Check className="h-5 w-5 text-green-500" />
    ) : (
      <X className="h-5 w-5 text-red-500" />
    )

    return (
      <div key={testName} className="border rounded-lg p-4 space-y-2">
        <div className="flex items-center space-x-2">
          {icon}
          <h4 className="font-semibold">{testName}</h4>
          {result.duration && (
            <span className="text-sm text-gray-500">({result.duration}ms)</span>
          )}
        </div>
        
        <p className="text-sm text-gray-600">
          {new Date(result.timestamp).toLocaleString('ko-KR')}
        </p>
        
        {result.success ? (
          <div className="bg-green-50 p-3 rounded text-sm">
            <p className="font-medium text-green-700">성공:</p>
            <pre className="mt-1 text-green-600 overflow-x-auto">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="bg-red-50 p-3 rounded text-sm">
            <p className="font-medium text-red-700">오류:</p>
            <p className="text-red-600">{result.error}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-6 w-6" />
          <span>공휴일 API 테스터</span>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Multi-Source 하이브리드 공휴일 API 통합 테스트
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* 테스트 버튼들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => runTest('현재 년도 공휴일 조회', testCurrentYearAPI)}
            disabled={isLoading['현재 년도 공휴일 조회']}
            variant="outline"
          >
            {isLoading['현재 년도 공휴일 조회'] ? '테스트 중...' : '현재 년도 테스트'}
          </Button>
          
          <Button
            onClick={() => runTest('특정 월 공휴일 조회', testSpecificMonthAPI)}
            disabled={isLoading['특정 월 공휴일 조회']}
            variant="outline"
          >
            {isLoading['특정 월 공휴일 조회'] ? '테스트 중...' : '2025년 1월 테스트'}
          </Button>
          
          <Button
            onClick={() => runTest('전체 년도 공휴일 조회', testFullYearAPI)}
            disabled={isLoading['전체 년도 공휴일 조회']}
            variant="outline"
          >
            {isLoading['전체 년도 공휴일 조회'] ? '테스트 중...' : '2025년 전체 테스트'}
          </Button>
          
          <Button
            onClick={() => runTest('라이브러리 함수 테스트', testHolidayLibrary)}
            disabled={isLoading['라이브러리 함수 테스트']}
            variant="outline"
          >
            {isLoading['라이브러리 함수 테스트'] ? '테스트 중...' : 'holidays.ts 테스트'}
          </Button>
        </div>

        {/* API 정보 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-700">Multi-Source 하이브리드 API</h4>
              <ul className="text-sm text-blue-600 mt-1 space-y-1">
                <li>• 엔드포인트: /api/holidays</li>
                <li>• 1순위: distbe/holidays (GitHub 오픈소스 ⚡)</li>
                <li>• 2순위: 한국천문연구원 특일정보 API 🏛️</li>
                <li>• 3순위: 최소 fallback (고정 공휴일만) 📅</li>
                <li>• 캐싱: localStorage 24시간 캐시</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 테스트 결과 */}
        {Object.keys(testResults).length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">테스트 결과</h3>
            {Object.entries(testResults).map(([testName, result]) =>
              renderTestResult(testName, result)
            )}
          </div>
        )}

        {/* 경고 메시지 */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-yellow-700">하이브리드 API 특징</h4>
              <ul className="text-sm text-yellow-600 mt-1 space-y-1">
                <li>• distbe/holidays: 실시간, 빠른 응답, GitHub CDN</li>
                <li>• KASI API: 공공데이터포털 키 필요, 백업용</li>
                <li>• 다단계 fallback: API 실패 시 자동 대체</li>
                <li>• 2025년 1월 27일 임시공휴일 포함</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
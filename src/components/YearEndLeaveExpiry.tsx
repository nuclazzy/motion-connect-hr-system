'use client'

import { useState } from 'react'
import { AlertTriangle, Calendar, CheckCircle, Info } from 'lucide-react'

interface ExpiryPreview {
  name: string
  department: string
  annualExpiring: number
  substituteExpiring: number
  substituteExpiringDays: number
  compensatoryExpiring: number
  compensatoryExpiringDays: number
}

export default function YearEndLeaveExpiry() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<ExpiryPreview[]>([])
  const [mode, setMode] = useState<'preview' | 'execute'>('preview')
  const [executionResult, setExecutionResult] = useState<any>(null)

  // 소멸 예정 미리보기
  const handlePreview = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/year-end-leave-expiry?mode=preview')
      const data = await response.json()
      
      if (data.success) {
        setPreview(data.preview)
      } else {
        alert('미리보기 조회 실패: ' + data.error)
      }
    } catch (error) {
      console.error('미리보기 오류:', error)
      alert('미리보기 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 실제 소멸 처리 실행
  const handleExecute = async () => {
    if (!confirm('정말로 연말 휴가 소멸 처리를 실행하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/year-end-leave-expiry?mode=execute&force=true', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setExecutionResult(data.result)
        alert(`연말 휴가 소멸 처리 완료!\n\n처리된 직원: ${data.result.processed_users}명\n소멸된 연차: ${data.result.annual_expired}일\n소멸된 대체휴가: ${data.result.substitute_expired}시간`)
        setIsOpen(false)
      } else {
        alert('소멸 처리 실패: ' + data.error)
      }
    } catch (error) {
      console.error('소멸 처리 오류:', error)
      alert('소멸 처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const currentDate = new Date()
  const isDecember = currentDate.getMonth() === 11 // 0-indexed
  const isLastDayOfYear = isDecember && currentDate.getDate() === 31

  return (
    <>
      {/* 트리거 버튼 (12월에만 표시) */}
      {isDecember && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-400 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-orange-800">
                  연말 휴가 소멸 처리
                </h3>
                <p className="text-xs text-orange-600 mt-1">
                  {currentDate.getFullYear()}년 12월 31일 미사용 휴가가 소멸됩니다
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(true)
                handlePreview()
              }}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm font-medium"
            >
              소멸 처리 관리
            </button>
          </div>
        </div>
      )}

      {/* 모달 */}
      {isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {currentDate.getFullYear()}년 연말 휴가 소멸 처리
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                12월 31일 기준 미사용 연차, 대체휴가, 보상휴가가 소멸됩니다
              </p>
            </div>

            {/* 경고 메시지 */}
            {!isLastDayOfYear && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex">
                  <Info className="h-5 w-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      현재 12월 31일이 아닙니다. 테스트 모드로 실행됩니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 탭 선택 */}
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setMode('preview')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  mode === 'preview' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                미리보기
              </button>
              <button
                onClick={() => setMode('execute')}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  mode === 'execute' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                실행
              </button>
            </div>

            {/* 미리보기 탭 */}
            {mode === 'preview' && (
              <div>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">소멸 예정 휴가 조회 중...</p>
                  </div>
                ) : preview.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            직원
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            소멸 연차
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            소멸 대체휴가
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            소멸 보상휴가
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {preview.map((emp, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                              <div className="text-xs text-gray-500">{emp.department}</div>
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                              {emp.annualExpiring > 0 ? (
                                <span className="text-red-600 font-semibold">
                                  {emp.annualExpiring}일
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                              {emp.substituteExpiring > 0 ? (
                                <div>
                                  <span className="text-orange-600 font-semibold">
                                    {emp.substituteExpiring}시간
                                  </span>
                                  <div className="text-xs text-gray-500">
                                    ({emp.substituteExpiringDays}일)
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-center">
                              {emp.compensatoryExpiring > 0 ? (
                                <div>
                                  <span className="text-purple-600 font-semibold">
                                    {emp.compensatoryExpiring}시간
                                  </span>
                                  <div className="text-xs text-gray-500">
                                    ({emp.compensatoryExpiringDays}일)
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                    <p className="mt-2 text-sm text-gray-500">소멸 예정 휴가가 없습니다</p>
                  </div>
                )}
              </div>
            )}

            {/* 실행 탭 */}
            {mode === 'execute' && (
              <div className="py-8">
                <div className="text-center">
                  <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
                  <h4 className="mt-2 text-lg font-medium text-gray-900">
                    연말 휴가 소멸 처리를 실행하시겠습니까?
                  </h4>
                  <p className="mt-2 text-sm text-gray-500">
                    이 작업은 되돌릴 수 없으며, 모든 미사용 연차, 대체휴가, 보상휴가가 소멸됩니다.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={handleExecute}
                      disabled={loading}
                      className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium disabled:opacity-50"
                    >
                      {loading ? '처리 중...' : '소멸 처리 실행'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 닫기 버튼 */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
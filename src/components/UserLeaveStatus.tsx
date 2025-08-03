'use client'

import { useState, useEffect } from 'react'
import { type User, authenticatedFetch } from '@/lib/auth'
import { getLeaveStatus, LEAVE_TYPE_NAMES } from '@/lib/hoursToLeaveDay'

interface LeaveData {
  id: string
  user_id: string
  leave_types: {
    annual_days: number
    used_annual_days: number
    sick_days: number
    used_sick_days: number
    special_days?: number
    used_special_days?: number
    maternity_days?: number
    used_maternity_days?: number
    paternity_days?: number
    used_paternity_days?: number
    family_care_days?: number
    used_family_care_days?: number
    substitute_leave_hours?: number
    compensatory_leave_hours?: number
  }
  substitute_leave_hours?: number
  compensatory_leave_hours?: number
  created_at: string
  updated_at: string
  user: {
    name: string
    department: string
    position: string
    hire_date?: string
  }
}

interface UserLeaveStatusProps {
  user: User
  onApply: (formType: string, defaultValues?: Record<string, string>) => void
}

export default function UserLeaveStatus({ user, onApply }: UserLeaveStatusProps) {
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaveData = async () => {
      try {
        setLoading(true)
        console.log('휴가 데이터 조회 시작:', { userId: user.id, userName: user.name })
        
        const response = await authenticatedFetch(`/api/user/leave-data?userId=${user.id}`, {
          method: 'GET'
        })
        
        console.log('API 응답 상태:', response.status)
        
        if (response.ok) {
          const result = await response.json()
          console.log('API 응답 데이터:', result)
          
          if (result.success) {
            setLeaveData(result.data)
          } else {
            console.error('API 오류:', result.error)
            setError(result.error || '휴가 데이터를 불러올 수 없습니다.')
          }
        } else {
          const errorText = await response.text()
          console.error('HTTP 오류:', response.status, errorText)
          setError(`휴가 데이터를 불러오는 중 오류가 발생했습니다. (${response.status})`)
        }
      } catch (err) {
        console.error('휴가 데이터 조회 오류:', err)
        setError('휴가 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaveData()
  }, [user.id, user.name])

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  휴가 현황
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  불러오는 중...
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !leaveData) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-red-500 truncate">
                  휴가 현황
                </dt>
                <dd className="text-sm text-red-700">
                  {error}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const annualRemaining = (leaveData.leave_types.annual_days || 0) - (leaveData.leave_types.used_annual_days || 0)
  const sickRemaining = (leaveData.leave_types.sick_days || 0) - (leaveData.leave_types.used_sick_days || 0)
  
  // 시간 단위 휴가 상태 계산 (새 필드 또는 기존 필드에서 조회)
  const substituteHours = leaveData.substitute_leave_hours || leaveData.leave_types.substitute_leave_hours || 0
  const compensatoryHours = leaveData.compensatory_leave_hours || leaveData.leave_types.compensatory_leave_hours || 0
  const substituteStatus = getLeaveStatus(substituteHours)
  const compensatoryStatus = getLeaveStatus(compensatoryHours)
  

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                나의 휴가 현황
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {user.name}님의 휴가 정보
              </dd>
            </dl>
          </div>
        </div>
        
        <div className="mt-5">
          <div className="grid grid-cols-1 gap-4">
            {/* 연차 현황 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">연차</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-blue-900">
                      {leaveData.leave_types.used_annual_days || 0}/{leaveData.leave_types.annual_days || 0}일 사용
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(annualRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-blue-500">잔여 일수</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-end">
                <button
                  onClick={() => onApply('휴가 신청서', { '휴가형태': '연차' })}
                  className="bg-white text-blue-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-blue-100 transition-colors"
                >
                  연차 신청
                </button>
              </div>
            </div>

            {/* 병가 현황 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">병가</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-yellow-900">
                      {leaveData.leave_types.used_sick_days || 0}/{leaveData.leave_types.sick_days || 0}일 사용
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round(sickRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-yellow-500">잔여 일수</div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-yellow-200 flex justify-end">
                <button
                  onClick={() => onApply('휴가 신청서', { '휴가형태': '병가' })}
                  className="bg-white text-yellow-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-yellow-100 transition-colors"
                >
                  병가 신청
                </button>
              </div>
            </div>

            {/* 대체휴가 현황 - 시간이 있는 경우에만 표시 */}
            {substituteHours > 0 && (
              <div className={`rounded-lg p-4 ${substituteStatus.needsAlert ? 'bg-red-50 border-2 border-red-200' : 'bg-purple-50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className={`text-sm font-medium ${substituteStatus.needsAlert ? 'text-red-900' : 'text-purple-900'}`}>
                      {LEAVE_TYPE_NAMES.substitute}
                      {substituteStatus.needsAlert && (
                        <span className="ml-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full animate-pulse">
                          사용 권고
                        </span>
                      )}
                    </h4>
                    <div className="mt-1">
                      <p className={`text-lg font-semibold ${substituteStatus.needsAlert ? 'text-red-900' : 'text-purple-900'}`}>
                        {substituteStatus.displayText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${substituteStatus.needsAlert ? 'text-red-600' : 'text-purple-600'}`}>
                      {substituteStatus.days}
                    </div>
                    <div className={`text-xs ${substituteStatus.needsAlert ? 'text-red-500' : 'text-purple-500'}`}>잔여 일수</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-purple-200 flex justify-end">
                  <button
                    onClick={() => onApply('휴가 신청서', { '휴가형태': '대체휴가' })}
                    className="bg-white text-purple-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-purple-100 transition-colors"
                  >
                    대체휴가 신청
                  </button>
                </div>
              </div>
            )}

            {/* 보상휴가 현황 - 시간이 있는 경우에만 표시 */}
            {compensatoryHours > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-green-900">{LEAVE_TYPE_NAMES.compensatory}</h4>
                    <div className="mt-1">
                      <p className="text-lg font-semibold text-green-900">
                        {compensatoryStatus.displayText}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      {compensatoryStatus.days}
                    </div>
                    <div className="text-xs text-green-500">잔여 일수</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 flex justify-end">
                  <button
                    onClick={() => onApply('휴가 신청서', { '휴가형태': '보상휴가' })}
                    className="bg-white text-green-600 px-4 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-green-100 transition-colors"
                  >
                    보상휴가 신청
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 추가 휴가 정보 */}
          {(leaveData.leave_types.special_days || leaveData.leave_types.maternity_days || 
            leaveData.leave_types.paternity_days || leaveData.leave_types.family_care_days) && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <h5 className="text-sm font-medium text-gray-700 mb-2">기타 사용 가능한 휴가</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {leaveData.leave_types.special_days && (
                  <div className="text-gray-600">
                    특별휴가: {leaveData.leave_types.used_special_days || 0}/{leaveData.leave_types.special_days}일
                  </div>
                )}
                {leaveData.leave_types.maternity_days && (
                  <div className="text-gray-600">
                    출산휴가: {leaveData.leave_types.used_maternity_days || 0}/{leaveData.leave_types.maternity_days}일
                  </div>
                )}
                {leaveData.leave_types.paternity_days && (
                  <div className="text-gray-600">
                    배우자출산휴가: {leaveData.leave_types.used_paternity_days || 0}/{leaveData.leave_types.paternity_days}일
                  </div>
                )}
                {leaveData.leave_types.family_care_days && (
                  <div className="text-gray-600">
                    가족돌봄휴가: {leaveData.leave_types.used_family_care_days || 0}/{leaveData.leave_types.family_care_days}일
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 기타 휴가 신청 (기존 OtherLeaveWidget 통합) */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-base font-semibold leading-6 text-gray-900 text-center mb-3">기타 휴가/휴직 신청</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '경조사' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >경조사</button>
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '공가' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >공가</button>
              <button
                onClick={() => onApply('출산휴가 및 육아휴직 신청서')}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >육아휴직</button>
              <button
                onClick={() => onApply('휴가 신청서', { '휴가형태': '기타' })}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium text-center"
              >기타 휴가</button>
            </div>
          </div>

          {/* 업데이트 일시 */}
          <div className="mt-3 text-xs text-gray-400 text-right">
            최종 업데이트: {new Date(leaveData.updated_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  )
}
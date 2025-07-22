'use client'

import { useState, useEffect } from 'react'
import { type User } from '@/lib/auth'

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
  }
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
}

export default function UserLeaveStatus({ user }: UserLeaveStatusProps) {
  const [leaveData, setLeaveData] = useState<LeaveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaveData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/user/leave-data?userId=${user.id}`)
        
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setLeaveData(result.data)
          } else {
            setError(result.error || '휴가 데이터를 불러올 수 없습니다.')
          }
        } else {
          setError('휴가 데이터를 불러오는 중 오류가 발생했습니다.')
        }
      } catch (err) {
        console.error('휴가 데이터 조회 오류:', err)
        setError('휴가 데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaveData()
  }, [user.id])

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
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900">연차</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-blue-900">
                      {leaveData.leave_types.used_annual_days || 0}/{leaveData.leave_types.annual_days || 0}일 사용
                    </p>
                    <p className="text-sm text-blue-700">
                      잔여: <span className="font-semibold text-green-600">{annualRemaining}일</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(annualRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-blue-500">남은 일수</div>
                </div>
              </div>
            </div>

            {/* 병가 현황 */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">병가</h4>
                  <div className="mt-1">
                    <p className="text-lg font-semibold text-yellow-900">
                      {leaveData.leave_types.used_sick_days || 0}/{leaveData.leave_types.sick_days || 0}일 사용
                    </p>
                    <p className="text-sm text-yellow-700">
                      잔여: <span className="font-semibold text-green-600">{sickRemaining}일</span>
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-yellow-600">
                    {Math.round(sickRemaining * 10) / 10}
                  </div>
                  <div className="text-xs text-yellow-500">남은 일수</div>
                </div>
              </div>
            </div>
          </div>

          {/* 추가 휴가 정보 */}
          {(leaveData.leave_types.special_days || leaveData.leave_types.maternity_days || 
            leaveData.leave_types.paternity_days || leaveData.leave_types.family_care_days) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h5 className="text-sm font-medium text-gray-700 mb-2">기타 휴가</h5>
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

          {/* 업데이트 일시 */}
          <div className="mt-3 text-xs text-gray-400 text-right">
            최종 업데이트: {new Date(leaveData.updated_at).toLocaleDateString('ko-KR')}
          </div>
        </div>
      </div>
    </div>
  )
}
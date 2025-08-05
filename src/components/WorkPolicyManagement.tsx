'use client'

import { useState, useEffect } from 'react'
import { getAuthHeaders } from '@/lib/auth'
import PolicyCreationModal from './PolicyCreationModal'

interface WorkPolicy {
  id: string
  policy_name: string
  policy_type: string
  is_active: boolean
  effective_start_date: string
  effective_end_date?: string
  flexible_work_settings?: FlexibleWorkSetting[]
  overtime_night_settings?: OvertimeNightSetting[]
  leave_calculation_settings?: LeaveCalculationSetting[]
}

interface FlexibleWorkSetting {
  id: string
  period_name: string
  start_date: string
  end_date: string
  standard_work_hours: number
  core_time_required: boolean
  core_start_time?: string
  core_end_time?: string
  weekly_standard_hours: number
  overtime_threshold: number
  is_active: boolean
}

interface OvertimeNightSetting {
  id: string
  setting_name: string
  night_start_time: string
  night_end_time: string
  night_allowance_rate: number
  overtime_threshold: number
  overtime_allowance_rate: number
  break_minutes_4h: number
  break_minutes_8h: number
  dinner_time_threshold: number
  is_active: boolean
}

interface LeaveCalculationSetting {
  id: string
  setting_name: string
  saturday_substitute_enabled: boolean
  saturday_base_rate: number
  saturday_overtime_rate: number
  sunday_compensatory_enabled: boolean
  sunday_base_rate: number
  sunday_overtime_rate: number
  holiday_base_rate: number
  holiday_overtime_rate: number
  max_substitute_hours: number
  max_compensatory_hours: number
  is_active: boolean
}

export default function WorkPolicyManagement() {
  const [policies, setPolicies] = useState<WorkPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'flexible' | 'overtime' | 'leave'>('flexible')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    fetchPolicies()
  }, [])

  const fetchPolicies = async () => {
    try {
      setLoading(true)
      const headers = getAuthHeaders()
      const response = await fetch('/api/admin/work-policies', { headers })
      const data = await response.json()

      if (data.success) {
        setPolicies(data.data)
      } else {
        setError(data.error || '근무정책 조회에 실패했습니다.')
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      console.error('근무정책 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredPolicies = () => {
    const typeMap = {
      'flexible': 'flexible_work',
      'overtime': 'overtime',
      'leave': 'leave_calculation'
    }
    return policies.filter(p => p.policy_type === typeMap[activeTab])
  }

  const formatRate = (rate: number) => `${(rate * 100).toFixed(0)}%`

  const togglePolicyStatus = async (policyId: string, currentStatus: boolean) => {
    try {
      const headers = getAuthHeaders()
      const response = await fetch(`/api/admin/work-policies/${policyId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })
      
      if (response.ok) {
        fetchPolicies() // 새로고침
      } else {
        setError('정책 상태 변경에 실패했습니다.')
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      console.error('정책 상태 변경 오류:', err)
    }
  }

  const createNewPolicy = async (policyData: any) => {
    try {
      setIsCreating(true)
      const headers = getAuthHeaders()
      const response = await fetch('/api/admin/work-policies', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(policyData)
      })
      
      const data = await response.json()
      if (data.success) {
        fetchPolicies()
        setShowCreateForm(false)
      } else {
        setError(data.error || '정책 생성에 실패했습니다.')
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다.')
      console.error('정책 생성 오류:', err)
    } finally {
      setIsCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">근무정책 관리</h3>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
            >
              새 정책 추가
            </button>
          </div>
          
          {/* 탭 메뉴 */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('flexible')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'flexible'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                탄력근무제
              </button>
              <button
                onClick={() => setActiveTab('overtime')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overtime'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                야간/초과근무
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'leave'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                대체/보상휴가
              </button>
            </nav>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* 탄력근무제 탭 */}
          {activeTab === 'flexible' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-blue-900 mb-2">💡 탄력근무제란?</h4>
                <p className="text-sm text-blue-800">
                  일정 기간(보통 1개월~3개월) 동안 주당 평균 근무시간을 40시간으로 맞추면서, 
                  일별 근무시간을 탄력적으로 조정하는 제도입니다.
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc">
                  <li>핵심시간(코어타임)을 설정하여 필수 근무시간 지정 가능</li>
                  <li>최소/최대 일일 근무시간 제한으로 과로 방지</li>
                  <li>정산 주기 종료 시 총 근무시간으로 초과근무 계산</li>
                </ul>
              </div>
              <h4 className="text-md font-medium text-gray-900">탄력근무제 설정</h4>
              {getFilteredPolicies().map(policy => (
                <div key={policy.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-medium text-gray-900">{policy.policy_name}</h5>
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={policy.is_active}
                            onChange={() => togglePolicyStatus(policy.id, policy.is_active)}
                            className="sr-only"
                          />
                          <div className={`block w-10 h-6 rounded-full transition-colors ${
                            policy.is_active ? 'bg-green-500' : 'bg-gray-300'
                          }`}></div>
                          <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${
                            policy.is_active ? 'transform translate-x-4' : ''
                          }`}></div>
                        </div>
                        <span className="ml-2 text-sm text-gray-600">
                          {policy.is_active ? '활성' : '비활성'}
                        </span>
                      </label>
                    </div>
                  </div>
                  {policy.flexible_work_settings?.map(setting => (
                    <div key={setting.id} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-gray-600">기준 근무시간:</span>
                          <span className="ml-1 font-medium">{setting.standard_work_hours}시간</span>
                        </div>
                        <div>
                          <span className="text-gray-600">주당 기준시간:</span>
                          <span className="ml-1 font-medium">{setting.weekly_standard_hours}시간</span>
                        </div>
                        <div>
                          <span className="text-gray-600">초과근무 기준:</span>
                          <span className="ml-1 font-medium">{setting.overtime_threshold}시간</span>
                        </div>
                        <div>
                          <span className="text-gray-600">핵심시간:</span>
                          <span className="ml-1 font-medium">
                            {setting.core_time_required 
                              ? `${setting.core_start_time}-${setting.core_end_time}` 
                              : '없음'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 야간/초과근무 탭 */}
          {activeTab === 'overtime' && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-orange-900 mb-2">🌙 야간근무 & ⏰ 초과근무 계산</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-orange-800 mb-1">야간근무 계산</h5>
                    <ul className="text-orange-700 ml-4 list-disc">
                      <li>22:00~06:00 시간대 근무 시</li>
                      <li>기본 시급 + 50% 가산 지급</li>
                      <li>예: 10,000원/시 → 15,000원/시</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-orange-800 mb-1">초과근무 계산</h5>
                    <ul className="text-orange-700 ml-4 list-disc">
                      <li>8시간 초과 근무 시</li>
                      <li>기본 시급 × 150% 지급</li>
                      <li>예: 10,000원/시 → 15,000원/시</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-orange-100 rounded">
                  <p className="text-sm text-orange-800">
                    <strong>휴게시간 차감 규칙:</strong> 4시간 근무(30분), 8시간 근무(1시간) 자동 차감 + 퇴근 시 저녁식사 여부 선택 시 추가 1시간 차감
                  </p>
                </div>
              </div>
              <h4 className="text-md font-medium text-gray-900">야간/초과근무 설정</h4>
              {getFilteredPolicies().map(policy => (
                <div key={policy.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-medium text-gray-900">{policy.policy_name}</h5>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      policy.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {policy.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  {policy.overtime_night_settings?.map(setting => (
                    <div key={setting.id} className="bg-gray-50 rounded p-3 text-sm">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-600">야간근무:</span>
                          <span className="ml-1 font-medium">
                            {setting.night_start_time}-{setting.night_end_time}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">야간수당:</span>
                          <span className="ml-1 font-medium">{formatRate(setting.night_allowance_rate)} 가산</span>
                        </div>
                        <div>
                          <span className="text-gray-600">초과근무수당:</span>
                          <span className="ml-1 font-medium">{formatRate(setting.overtime_allowance_rate)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">초과근무 기준:</span>
                          <span className="ml-1 font-medium">{setting.overtime_threshold}시간</span>
                        </div>
                        <div>
                          <span className="text-gray-600">휴게시간:</span>
                          <span className="ml-1 font-medium">
                            4h({setting.break_minutes_4h}분), 8h({setting.break_minutes_8h}분)
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">저녁식사:</span>
                          <span className="ml-1 font-medium">{setting.dinner_time_threshold}시간 이상</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* 대체/보상휴가 탭 */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-md font-medium text-green-900 mb-3">📅 대체/보상휴가 계산 방식</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="border border-green-300 rounded p-3">
                    <h5 className="font-medium text-green-800 mb-2">🗓️ 토요일 대체휴가</h5>
                    <ul className="text-green-700 space-y-1">
                      <li>• 8시간 이하: <strong>1:1 비율</strong></li>
                      <li>• 8시간 초과: <strong>8시간 + 초과분×1.5배</strong></li>
                      <li>• 야간근무: <strong>+0.5배 추가</strong></li>
                      <li className="text-xs text-green-600 bg-green-100 p-1 rounded">
                        예: 10시간 근무 = 8 + (2×1.5) = 11시간 대체휴가
                      </li>
                    </ul>
                  </div>
                  <div className="border border-green-300 rounded p-3">
                    <h5 className="font-medium text-green-800 mb-2">🎊 일요일/공휴일 보상휴가</h5>
                    <ul className="text-green-700 space-y-1">
                      <li>• 8시간 이하: <strong>1.5배 비율</strong></li>
                      <li>• 8시간 초과: <strong>(8×1.5) + 초과분×2.0배</strong></li>
                      <li>• 야간근무: <strong>+0.5배 추가</strong></li>
                      <li className="text-xs text-green-600 bg-green-100 p-1 rounded">
                        예: 10시간 근무 = (8×1.5) + (2×2.0) = 16시간 보상휴가
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-green-100 rounded">
                  <p className="text-sm text-green-800">
                    <strong>⚠️ 주의:</strong> 최대 적립 시간 제한(기본 240시간) 및 소멸 시효(12개월) 적용
                  </p>
                </div>
              </div>
              <h4 className="text-md font-medium text-gray-900">대체/보상휴가 계산 설정</h4>
              {getFilteredPolicies().map(policy => (
                <div key={policy.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h5 className="font-medium text-gray-900">{policy.policy_name}</h5>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      policy.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {policy.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  {policy.leave_calculation_settings?.map(setting => (
                    <div key={setting.id} className="bg-gray-50 rounded p-3 text-sm space-y-3">
                      {/* 토요일 대체휴가 */}
                      <div className="border-b border-gray-200 pb-3">
                        <h6 className="font-medium text-gray-800 mb-2">🗓️ 토요일 대체휴가</h6>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <span className="text-gray-600">활성화:</span>
                            <span className="ml-1 font-medium">
                              {setting.saturday_substitute_enabled ? '✅ 예' : '❌ 아니오'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">기본 비율:</span>
                            <span className="ml-1 font-medium">{formatRate(setting.saturday_base_rate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">초과 비율:</span>
                            <span className="ml-1 font-medium">{formatRate(setting.saturday_overtime_rate)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* 일요일/공휴일 보상휴가 */}
                      <div>
                        <h6 className="font-medium text-gray-800 mb-2">🎊 일요일/공휴일 보상휴가</h6>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <span className="text-gray-600">일요일 활성화:</span>
                            <span className="ml-1 font-medium">
                              {setting.sunday_compensatory_enabled ? '✅ 예' : '❌ 아니오'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">일요일 기본:</span>
                            <span className="ml-1 font-medium">{formatRate(setting.sunday_base_rate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">일요일 초과:</span>
                            <span className="ml-1 font-medium">{formatRate(setting.sunday_overtime_rate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">공휴일 기본:</span>
                            <span className="ml-1 font-medium">{formatRate(setting.holiday_base_rate)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">최대 대체휴가:</span>
                            <span className="ml-1 font-medium">{setting.max_substitute_hours}시간</span>
                          </div>
                          <div>
                            <span className="text-gray-600">최대 보상휴가:</span>
                            <span className="ml-1 font-medium">{setting.max_compensatory_hours}시간</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {getFilteredPolicies().length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>설정된 정책이 없습니다.</p>
              <p className="text-sm mt-1">새 정책을 추가해보세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 정책 생성 모달 */}
      <PolicyCreationModal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={createNewPolicy}
        isCreating={isCreating}
      />
    </>
  )
}
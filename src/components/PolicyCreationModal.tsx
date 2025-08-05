'use client'

import { useState } from 'react'

interface PolicyCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (policyData: any) => void
  isCreating: boolean
}

export default function PolicyCreationModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isCreating 
}: PolicyCreationModalProps) {
  const [activeTab, setActiveTab] = useState<'flexible' | 'overtime' | 'leave'>('flexible')
  const [policyName, setPolicyName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // 탄력근무제 설정
  const [flexibleSettings, setFlexibleSettings] = useState({
    periodName: '',
    standardWorkHours: 8.0,
    coreTimeRequired: false,
    coreStartTime: '09:00',
    coreEndTime: '15:00',
    weeklyStandardHours: 40.0,
    overtimeThreshold: 8.0
  })

  // 야간/초과근무 설정
  const [overtimeSettings, setOvertimeSettings] = useState({
    settingName: '',
    nightStartTime: '22:00',
    nightEndTime: '06:00',
    nightAllowanceRate: 0.5,
    overtimeThreshold: 8.0,
    overtimeAllowanceRate: 1.5,
    breakMinutes4h: 30,
    breakMinutes8h: 60,
    dinnerTimeThreshold: 6.0
  })

  // 대체/보상휴가 설정
  const [leaveSettings, setLeaveSettings] = useState({
    settingName: '',
    saturdaySubstituteEnabled: true,
    saturdayBaseRate: 1.0,
    saturdayOvertimeRate: 1.5,
    sundayCompensatoryEnabled: true,
    sundayBaseRate: 1.5,
    sundayOvertimeRate: 2.0,
    holidayBaseRate: 1.5,
    holidayOvertimeRate: 2.0,
    maxSubstituteHours: 240.0,
    maxCompensatoryHours: 240.0
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const policyTypeMap = {
      'flexible': 'flexible_work',
      'overtime': 'overtime', 
      'leave': 'leave_calculation'
    }

    const settingsMap = {
      'flexible': { flexibleWork: flexibleSettings },
      'overtime': { overtime: overtimeSettings },
      'leave': { leaveCalculation: leaveSettings }
    }

    const policyData = {
      policyName,
      policyType: policyTypeMap[activeTab],
      effectiveStartDate: startDate,
      effectiveEndDate: endDate || null,
      settings: settingsMap[activeTab]
    }

    onSubmit(policyData)
  }

  const resetForm = () => {
    setPolicyName('')
    setStartDate('')
    setEndDate('')
    setActiveTab('flexible')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">새 근무정책 추가</h3>
            <button
              onClick={() => {
                onClose()
                resetForm()
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
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
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                탄력근무제
              </button>
              <button
                onClick={() => setActiveTab('overtime')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overtime'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                야간/초과근무
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'leave'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                대체/보상휴가
              </button>
            </nav>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* 기본 정보 */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                정책명 *
              </label>
              <input
                type="text"
                required
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="예: 2025년 1분기 탄력근무제"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                적용 시작일 *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 탄력근무제 설정 */}
          {activeTab === 'flexible' && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b pb-2">탄력근무제 세부 설정</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    기준 근무시간 (시간)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={flexibleSettings.standardWorkHours}
                    onChange={(e) => setFlexibleSettings({
                      ...flexibleSettings,
                      standardWorkHours: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주당 기준시간 (시간)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={flexibleSettings.weeklyStandardHours}
                    onChange={(e) => setFlexibleSettings({
                      ...flexibleSettings,
                      weeklyStandardHours: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="coreTimeRequired"
                  checked={flexibleSettings.coreTimeRequired}
                  onChange={(e) => setFlexibleSettings({
                    ...flexibleSettings,
                    coreTimeRequired: e.target.checked
                  })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="coreTimeRequired" className="ml-2 text-sm text-gray-700">
                  핵심시간(코어타임) 설정
                </label>
              </div>

              {flexibleSettings.coreTimeRequired && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      핵심시간 시작
                    </label>
                    <input
                      type="time"
                      value={flexibleSettings.coreStartTime}
                      onChange={(e) => setFlexibleSettings({
                        ...flexibleSettings,
                        coreStartTime: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      핵심시간 종료
                    </label>
                    <input
                      type="time"
                      value={flexibleSettings.coreEndTime}
                      onChange={(e) => setFlexibleSettings({
                        ...flexibleSettings,
                        coreEndTime: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 야간/초과근무 설정 */}
          {activeTab === 'overtime' && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b pb-2">야간/초과근무 세부 설정</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    야간근무 시작시간
                  </label>
                  <input
                    type="time"
                    value={overtimeSettings.nightStartTime}
                    onChange={(e) => setOvertimeSettings({
                      ...overtimeSettings,
                      nightStartTime: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    야간근무 종료시간
                  </label>
                  <input
                    type="time"
                    value={overtimeSettings.nightEndTime}
                    onChange={(e) => setOvertimeSettings({
                      ...overtimeSettings,
                      nightEndTime: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    야간수당 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={overtimeSettings.nightAllowanceRate}
                    onChange={(e) => setOvertimeSettings({
                      ...overtimeSettings,
                      nightAllowanceRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    초과근무수당 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={overtimeSettings.overtimeAllowanceRate}
                    onChange={(e) => setOvertimeSettings({
                      ...overtimeSettings,
                      overtimeAllowanceRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 대체/보상휴가 설정 */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 border-b pb-2">대체/보상휴가 세부 설정</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    토요일 기본 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leaveSettings.saturdayBaseRate}
                    onChange={(e) => setLeaveSettings({
                      ...leaveSettings,
                      saturdayBaseRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    토요일 초과 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leaveSettings.saturdayOvertimeRate}
                    onChange={(e) => setLeaveSettings({
                      ...leaveSettings,
                      saturdayOvertimeRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    일요일 기본 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leaveSettings.sundayBaseRate}
                    onChange={(e) => setLeaveSettings({
                      ...leaveSettings,
                      sundayBaseRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    일요일 초과 비율 (배수)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leaveSettings.sundayOvertimeRate}
                    onChange={(e) => setLeaveSettings({
                      ...leaveSettings,
                      sundayOvertimeRate: parseFloat(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                onClose()
                resetForm()
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isCreating ? '생성 중...' : '정책 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
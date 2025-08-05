'use client'

import { useState, useEffect } from 'react'
import { Clock, Info, X, HelpCircle } from 'lucide-react'
import WorkPolicyExplanationModal from './WorkPolicyExplanationModal'

interface FlexibleWorkPolicy {
  id: string
  policy_name: string
  flexible_work_settings: {
    period_name: string
    start_date: string
    end_date: string
    standard_work_hours: number
    core_time_required: boolean
    core_start_time?: string
    core_end_time?: string
    weekly_standard_hours: number
    overtime_threshold: number
  }[]
}

interface WorkPolicyStatus {
  flexibleWorkActive: boolean
  activeFlexibleWorkPolicy: FlexibleWorkPolicy | null
}

export default function FlexibleWorkNotification() {
  const [policyStatus, setPolicyStatus] = useState<WorkPolicyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)

  useEffect(() => {
    fetchWorkPolicyStatus()
  }, [])

  const fetchWorkPolicyStatus = async () => {
    try {
      const response = await fetch('/api/user/work-policy-status')
      const result = await response.json()
      
      if (result.success) {
        setPolicyStatus(result.data)
      }
    } catch (error) {
      console.error('근무정책 상태 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  if (loading || !policyStatus || !policyStatus.flexibleWorkActive || dismissed) {
    return null
  }

  const policy = policyStatus.activeFlexibleWorkPolicy
  const settings = policy?.flexible_work_settings?.[0]

  if (!policy || !settings) {
    return null
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className="text-sm font-semibold text-blue-900">
                  🕐 탄력근무제 적용 중
                </h4>
                <button
                  onClick={() => setShowPolicyModal(true)}
                  className="text-blue-600 hover:text-blue-800"
                  title="탄력근무제 설명 보기"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-blue-800 mb-2">
                <strong>{policy.policy_name}</strong> - {settings.period_name}
              </p>
              <div className="text-sm text-blue-700 space-y-1">
                <p>
                  📅 <strong>기간:</strong> {formatDate(settings.start_date)} ~ {formatDate(settings.end_date)}
                </p>
                <p>
                  ⏰ <strong>주당 기준시간:</strong> {settings.weekly_standard_hours}시간
                  {settings.core_time_required && (
                    <span className="ml-2">
                      | <strong>핵심시간:</strong> {settings.core_start_time}~{settings.core_end_time}
                    </span>
                  )}
                </p>
                <p className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded mt-2">
                  💡 탄력근무제 기간 중에는 일별 근무시간을 유연하게 조정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-blue-400 hover:text-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 탄력근무제 설명 모달 */}
      <WorkPolicyExplanationModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        policyType="flexible"
      />
    </>
  )
}
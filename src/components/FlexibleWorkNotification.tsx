'use client'

import { useState, useEffect } from 'react'
import { Clock, Info, X, HelpCircle } from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import WorkPolicyExplanationModal from './WorkPolicyExplanationModal'

interface FlexWorkSettings {
  id: string
  start_date: string
  end_date: string
  standard_work_hours?: number
  weekly_standard_hours: number
  overtime_threshold: number
  period_name?: string
  is_active: boolean
  created_at: string
}

interface WorkPolicyStatus {
  flexibleWorkActive: boolean
  activeFlexibleWorkPolicy: FlexWorkSettings | null
}

export default function FlexibleWorkNotification() {
  const { supabase } = useSupabase()
  const [policyStatus, setPolicyStatus] = useState<WorkPolicyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)

  useEffect(() => {
    fetchWorkPolicyStatus()
  }, [])

  const fetchWorkPolicyStatus = async () => {
    try {
      // 현재 사용자 인증 확인
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        console.error('사용자 인증 실패')
        setLoading(false)
        return
      }

      // 현재 활성화된 탄력근무제 설정 조회
      const today = new Date().toISOString().split('T')[0]
      const { data: flexSettings, error } = await supabase
        .from('flexible_work_settings')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error('탄력근무제 설정 조회 오류:', error)
        setPolicyStatus({
          flexibleWorkActive: false,
          activeFlexibleWorkPolicy: null
        })
      } else {
        const activePolicy = flexSettings?.[0] || null
        setPolicyStatus({
          flexibleWorkActive: !!activePolicy,
          activeFlexibleWorkPolicy: activePolicy
        })
        
        console.log('탄력근무제 상태 조회 성공:', { 
          active: !!activePolicy, 
          policy: activePolicy?.description || 'N/A' 
        })
      }
    } catch (error) {
      console.error('탄력근무제 상태 조회 예외:', error)
      setPolicyStatus({
        flexibleWorkActive: false,
        activeFlexibleWorkPolicy: null
      })
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

  if (!policy) {
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
                <strong>탄력근무제</strong> - {policy.period_name || '3개월 탄력근무제'}
              </p>
              <div className="text-sm text-blue-700 space-y-1">
                <p>
                  📅 <strong>기간:</strong> {formatDate(policy.start_date)} ~ {formatDate(policy.end_date)}
                </p>
                <p>
                  ⏰ <strong>정산 주기:</strong> {Math.round((new Date(policy.end_date).getTime() - new Date(policy.start_date).getTime()) / (1000 * 60 * 60 * 24 * 7))}주간
                  | <strong>주당 기준:</strong> {policy.weekly_standard_hours}시간
                </p>
                <div className="text-xs space-y-2 mt-3">
                  <p className="text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    💡 정산기간 평균 주 {policy.weekly_standard_hours}시간 이하 유지하며, 특정 주/일은 기준 초과 가능 (주 52시간, 일 12시간 한도)
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 px-2 py-2 rounded">
                    <p className="text-yellow-800 font-medium mb-1">⚠️ 수당 지급 기준</p>
                    <div className="text-yellow-700 space-y-1">
                      <p>• <strong>초과근무:</strong> 계획 시간 내 + 평균 {policy.weekly_standard_hours}h 이하일 때 미지급</p>
                      <p>• <strong>야간근무:</strong> 항상 지급 (22:00~06:00, +50%)</p>
                      <p>• <strong>일 기준:</strong> {policy.standard_work_hours || 8}시간, 초과분은 {policy.overtime_threshold || 12}시간부터 연장근무</p>
                    </div>
                  </div>
                </div>
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
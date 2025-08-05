'use client'

import { useState, useEffect } from 'react'
import { 
  Clock, 
  Settings,
  Calendar,
  Info
} from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'

interface FlexibleWorkSettings {
  enabled: boolean
  start_date: string
  end_date: string
  period_name: string
}

export default function SimpleFlexibleWorkSettings() {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<FlexibleWorkSettings>({
    enabled: true,
    start_date: '2025-06-01',
    end_date: '2025-08-31',
    period_name: '2025년 하반기 탄력근무제 (6-7-8월)'
  })
  const [currentUser, setCurrentUser] = useState<any>(null)

  // 현재 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const user = await getCurrentUser()
        if (!user || user.role !== 'admin') {
          console.error('관리자 권한이 필요합니다.')
          return
        }
        setCurrentUser(user)

        // 시스템 설정에서 탄력근무제 활성화 상태 조회
        const { data: flexSettings, error } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'flexible_work_enabled')
          .single()

        if (!error && flexSettings) {
          setSettings(prev => ({
            ...prev,
            enabled: flexSettings.setting_value === 'true'
          }))
        }
      } catch (error) {
        console.error('설정 로드 오류:', error)
      }
    }

    loadSettings()
  }, [supabase])

  // 탄력근무제 활성화/비활성화 토글
  const toggleFlexibleWork = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      return
    }

    try {
      setLoading(true)
      const newEnabled = !settings.enabled

      // 시스템 설정 업데이트
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'flexible_work_enabled',
          setting_value: newEnabled.toString(),
          setting_type: 'boolean',
          description: '탄력근무제 활성화 여부',
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('설정 업데이트 오류:', error)
        alert('설정 업데이트 중 오류가 발생했습니다.')
        return
      }

      setSettings(prev => ({ ...prev, enabled: newEnabled }))
      alert(`탄력근무제가 ${newEnabled ? '활성화' : '비활성화'}되었습니다.`)

    } catch (error) {
      console.error('토글 오류:', error)
      alert('설정 변경 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 기간 설정 업데이트
  const updatePeriod = async () => {
    if (!currentUser || currentUser.role !== 'admin') {
      alert('관리자 권한이 필요합니다.')
      return
    }

    try {
      setLoading(true)

      // 시스템 설정에 기간 정보 저장
      const updates = [
        {
          setting_key: 'flexible_work_start_date',
          setting_value: settings.start_date,
          setting_type: 'date',
          description: '탄력근무제 시작일'
        },
        {
          setting_key: 'flexible_work_end_date',
          setting_value: settings.end_date,
          setting_type: 'date',
          description: '탄력근무제 종료일'
        },
        {
          setting_key: 'flexible_work_period_name',
          setting_value: settings.period_name,
          setting_type: 'string',
          description: '탄력근무제 기간명'
        }
      ]

      for (const update of updates) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            ...update,
            updated_at: new Date().toISOString()
          })

        if (error) {
          console.error('기간 설정 업데이트 오류:', error)
          alert('기간 설정 업데이트 중 오류가 발생했습니다.')
          return
        }
      }

      alert('탄력근무제 기간이 업데이트되었습니다.')

    } catch (error) {
      console.error('기간 업데이트 오류:', error)
      alert('기간 설정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <Settings className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">관리자 권한이 필요합니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          근무제 관리
        </h2>
        <p className="text-gray-600">
          탄력근무제 설정을 관리합니다
        </p>
      </div>

      {/* 탄력근무제 정보 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">💡 탄력근무제란?</h4>
            <div className="mt-2 text-sm text-blue-700">
              <p>일정 기간(보통 1개월~3개월) 동안 주당 평균 근무시간을 40시간으로 맞추면서, 일별 근무시간을 탄력적으로 조정하는 제도입니다.</p>
              <ul className="mt-2 ml-4 space-y-1">
                <li>• 핵심시간(코어타임)을 설정하여 필수 근무시간 지정 가능</li>
                <li>• 최소/최대 일일 근무시간 제한으로 과로 방지</li>
                <li>• 정산 주기 종료 시 총 근무시간으로 초과근무 계산</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 탄력근무제 설정 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">탄력근무제 설정</h3>
        
        {/* 활성화 토글 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
          <div className="flex items-center">
            <Clock className="h-5 w-5 text-gray-600 mr-3" />
            <div>
              <div className="text-sm font-medium text-gray-900">표준 탄력근무제</div>
              <div className="text-sm text-gray-600">활성화 시 12시간 초과근무 임계값 적용</div>
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={toggleFlexibleWork}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                settings.enabled 
                  ? 'bg-green-600' 
                  : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`ml-3 text-sm font-medium ${
              settings.enabled ? 'text-green-600' : 'text-gray-500'
            }`}>
              {settings.enabled ? '활성' : '비활성'}
            </span>
          </div>
        </div>

        {/* 기간 설정 */}
        {settings.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                기간명
              </label>
              <input
                type="text"
                value={settings.period_name}
                onChange={(e) => setSettings(prev => ({ ...prev, period_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예: 2025년 하반기 탄력근무제"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작일
                </label>
                <input
                  type="date"
                  value={settings.start_date}
                  onChange={(e) => setSettings(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료일
                </label>
                <input
                  type="date"
                  value={settings.end_date}
                  onChange={(e) => setSettings(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-yellow-500 mr-2" />
                <h4 className="text-sm font-medium text-yellow-800">현재 설정된 기간</h4>
              </div>
              <div className="mt-2 text-sm text-yellow-700">
                <p><strong>{settings.period_name}</strong></p>
                <p>{settings.start_date} ~ {settings.end_date}</p>
                <p className="mt-1 text-xs">
                  * 이 기간 동안 일일 최대 12시간까지 근무 가능하며, 기간 종료 후 총 근무시간을 기준으로 초과근무를 정산합니다.
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={updatePeriod}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '저장 중...' : '기간 설정 저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 비활성화 상태 안내 */}
      {!settings.enabled && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">표준 근무제 적용 중</h3>
          <p className="text-gray-600 mb-4">
            현재 일일 8시간 기준 근무제가 적용되고 있습니다.<br />
            탄력근무제를 활성화하면 일일 최대 12시간까지 근무 가능합니다.
          </p>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-left">
            <h4 className="text-sm font-medium text-gray-900 mb-2">표준 근무제 특징:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 일일 8시간 초과 시 즉시 초과근무 수당 적용</li>
              <li>• 야간근무(22:00-06:00) 시 1.5배 수당</li>
              <li>• 휴일근무 시 2.0배 수당</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
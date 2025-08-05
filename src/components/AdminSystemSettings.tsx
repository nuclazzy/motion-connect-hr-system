'use client'

import { useState, useEffect } from 'react'
import { Settings, Save, History, AlertCircle, Check } from 'lucide-react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'
import { 
  getSystemSettings, 
  updateSystemSetting, 
  getSettingsHistory,
  type SystemSettings 
} from '@/lib/settings'

export default function AdminSystemSettings() {
  const { supabase } = useSupabase()
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [editedSettings, setEditedSettings] = useState<SystemSettings | null>(null)
  const [savedMessage, setSavedMessage] = useState('')

  // 설정 로드
  const loadSettings = async () => {
    try {
      const user = await getCurrentUser()
      if (!user || user.role !== 'admin') {
        alert('관리자 권한이 필요합니다.')
        return
      }
      setCurrentUser(user)

      const data = await getSystemSettings()
      setSettings(data)
      setEditedSettings(data)
    } catch (error) {
      console.error('설정 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 설정 변경 이력 로드
  const loadHistory = async () => {
    try {
      const data = await getSettingsHistory(undefined, 20)
      setHistory(data)
    } catch (error) {
      console.error('이력 로드 오류:', error)
    }
  }

  // 설정 저장
  const saveSettings = async () => {
    if (!editedSettings || !currentUser) return

    setSaving(true)
    setSavedMessage('')

    try {
      let hasError = false

      // 각 설정 항목 저장
      for (const [key, value] of Object.entries(editedSettings)) {
        const success = await updateSystemSetting(
          key as keyof SystemSettings,
          value,
          currentUser.id
        )
        
        if (!success) {
          hasError = true
          console.error(`설정 저장 실패: ${key}`)
        }
      }

      if (!hasError) {
        setSavedMessage('설정이 저장되었습니다.')
        setSettings(editedSettings)
        await loadHistory() // 이력 새로고침
        
        // 3초 후 메시지 제거
        setTimeout(() => setSavedMessage(''), 3000)
      } else {
        alert('일부 설정 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('설정 저장 오류:', error)
      alert('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 설정 값 변경
  const handleSettingChange = (key: keyof SystemSettings, value: string) => {
    if (!editedSettings) return

    let parsedValue: any = value
    
    // 숫자 타입 변환
    if (['monthly_standard_hours', 'lunch_break_minutes', 'overtime_threshold_minutes', 
         'overtime_rate', 'night_rate', 'holiday_rate', 'dinner_allowance'].includes(key)) {
      parsedValue = parseFloat(value) || 0
    }

    setEditedSettings({
      ...editedSettings,
      [key]: parsedValue
    })
  }

  useEffect(() => {
    loadSettings()
    loadHistory()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!settings || !editedSettings) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">설정을 불러올 수 없습니다.</p>
      </div>
    )
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(editedSettings)

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Settings className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800">시스템 설정 관리</h2>
          </div>
          <div className="flex items-center space-x-2">
            {savedMessage && (
              <div className="flex items-center text-green-600">
                <Check className="h-4 w-4 mr-1" />
                <span className="text-sm">{savedMessage}</span>
              </div>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              <History className="h-4 w-4 inline mr-1" />
              변경 이력
            </button>
            <button
              onClick={saveSettings}
              disabled={!hasChanges || saving}
              className={`px-4 py-2 rounded flex items-center ${
                hasChanges && !saving
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4 mr-1" />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          근무시간, 수당 비율 등 시스템 전반의 계산 기준을 설정합니다.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* 근무시간 설정 */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">근무시간 설정</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                월 기준 근무시간
              </label>
              <input
                type="number"
                value={editedSettings.monthly_standard_hours}
                onChange={(e) => handleSettingChange('monthly_standard_hours', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">통상임금 계산의 기준이 되는 시간</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                점심시간 (분)
              </label>
              <input
                type="number"
                value={editedSettings.lunch_break_minutes}
                onChange={(e) => handleSettingChange('lunch_break_minutes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">근무시간에서 차감되는 휴게시간</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                야간근무 시작 시간
              </label>
              <input
                type="time"
                value={editedSettings.night_work_start}
                onChange={(e) => handleSettingChange('night_work_start', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                야간근무 종료 시간
              </label>
              <input
                type="time"
                value={editedSettings.night_work_end}
                onChange={(e) => handleSettingChange('night_work_end', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초과근무 인정 최소 시간 (분)
              </label>
              <input
                type="number"
                value={editedSettings.overtime_threshold_minutes}
                onChange={(e) => handleSettingChange('overtime_threshold_minutes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">이 시간 이상 초과근무 시 인정</p>
            </div>
          </div>
        </div>

        {/* 수당 설정 */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">수당 비율 설정</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초과근무 수당 배율
              </label>
              <input
                type="number"
                step="0.1"
                value={editedSettings.overtime_rate}
                onChange={(e) => handleSettingChange('overtime_rate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">통상시급 × 배율</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                야간근무 수당 배율
              </label>
              <input
                type="number"
                step="0.1"
                value={editedSettings.night_rate}
                onChange={(e) => handleSettingChange('night_rate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">통상시급 × 배율</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                휴일근무 수당 배율
              </label>
              <input
                type="number"
                step="0.1"
                value={editedSettings.holiday_rate}
                onChange={(e) => handleSettingChange('holiday_rate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">통상시급 × 배율</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                야식대 금액 (원)
              </label>
              <input
                type="number"
                value={editedSettings.dinner_allowance}
                onChange={(e) => handleSettingChange('dinner_allowance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">8시간 이상 근무 시 지급</p>
            </div>
          </div>
        </div>

        {/* 법적 기준 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">근로기준법 기준</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>초과근무수당: 통상임금의 50% 이상 가산 (최소 1.5배)</li>
                <li>야간근무수당: 통상임금의 50% 이상 가산 (22:00~06:00)</li>
                <li>휴일근무수당: 통상임금의 50% 이상 가산</li>
                <li>연차휴가: 입사일 기준 자동 계산 (기존 로직 유지)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 변경 이력 */}
      {showHistory && (
        <div className="border-t border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">변경 이력</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">설정 항목</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">이전 값</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">변경 값</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">변경자</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">변경 시간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.setting_key}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{item.old_value}</td>
                    <td className="px-4 py-2 text-sm text-gray-900 font-medium">{item.new_value}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{item.users?.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(item.changed_at).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <p className="text-center py-4 text-gray-500">변경 이력이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
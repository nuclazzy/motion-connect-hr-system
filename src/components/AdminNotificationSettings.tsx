'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { Mail, Plus, Trash2, Save, Bell, AlertCircle } from 'lucide-react'

interface NotificationSettings {
  id?: string
  email: string
  notification_types: string[]
  is_active: boolean
  created_at?: string
}

export default function AdminNotificationSettings() {
  const { supabase } = useSupabase()
  const [settings, setSettings] = useState<NotificationSettings[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const notificationTypes = [
    { id: 'leave_application', label: '휴가 신청' },
    { id: 'form_submission', label: '서식 제출' },
    { id: 'urgent_request', label: '긴급 요청' },
    { id: 'system_alert', label: '시스템 알림' }
  ]

  // 알림 설정 로드
  useEffect(() => {
    loadNotificationSettings()
  }, [])

  const loadNotificationSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_notification_settings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('알림 설정 로드 오류:', error)
        setError('알림 설정을 불러올 수 없습니다.')
        return
      }

      setSettings(data || [])
    } catch (err) {
      console.error('알림 설정 로드 실패:', err)
      setError('알림 설정 로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const addEmailSetting = async () => {
    if (!newEmail.trim()) {
      setError('이메일 주소를 입력해주세요.')
      return
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      setError('올바른 이메일 형식을 입력해주세요.')
      return
    }

    try {
      setSaving(true)
      const { error } = await supabase
        .from('admin_notification_settings')
        .insert({
          email: newEmail.trim(),
          notification_types: ['leave_application', 'form_submission'],
          is_active: true
        })

      if (error) {
        console.error('이메일 추가 오류:', error)
        setError('이메일 추가에 실패했습니다.')
        return
      }

      setNewEmail('')
      setSuccess('이메일이 성공적으로 추가되었습니다.')
      await loadNotificationSettings()
    } catch (err) {
      console.error('이메일 추가 실패:', err)
      setError('이메일 추가 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const removeEmailSetting = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_notification_settings')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('이메일 삭제 오류:', error)
        setError('이메일 삭제에 실패했습니다.')
        return
      }

      setSuccess('이메일이 삭제되었습니다.')
      await loadNotificationSettings()
    } catch (err) {
      console.error('이메일 삭제 실패:', err)
      setError('이메일 삭제 중 오류가 발생했습니다.')
    }
  }

  const updateNotificationTypes = async (id: string, types: string[]) => {
    try {
      const { error } = await supabase
        .from('admin_notification_settings')
        .update({ notification_types: types })
        .eq('id', id)

      if (error) {
        console.error('알림 설정 업데이트 오류:', error)
        setError('알림 설정 업데이트에 실패했습니다.')
        return
      }

      await loadNotificationSettings()
    } catch (err) {
      console.error('알림 설정 업데이트 실패:', err)
      setError('알림 설정 업데이트 중 오류가 발생했습니다.')
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('admin_notification_settings')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) {
        console.error('활성화 상태 변경 오류:', error)
        setError('활성화 상태 변경에 실패했습니다.')
        return
      }

      await loadNotificationSettings()
    } catch (err) {
      console.error('활성화 상태 변경 실패:', err)
      setError('활성화 상태 변경 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-500" />
            알림 설정
          </h3>
          <p className="text-sm text-gray-600 mt-1">휴가 신청 및 서식 제출 시 알림을 받을 이메일을 관리합니다.</p>
        </div>
      </div>

      {/* 에러/성공 메시지 */}
      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* 새 이메일 추가 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-3">새 알림 이메일 추가</h4>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="admin@company.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addEmailSetting}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <Plus className="h-4 w-4 mr-1" />
            {saving ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>

      {/* 현재 설정 목록 */}
      <div className="space-y-4">
        <h4 className="text-md font-medium text-gray-900">현재 알림 설정</h4>
        
        {settings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Mail className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>설정된 알림 이메일이 없습니다.</p>
            <p className="text-sm">위에서 새 이메일을 추가해주세요.</p>
          </div>
        ) : (
          settings.map((setting) => (
            <div key={setting.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  <span className="font-medium text-gray-900">{setting.email}</span>
                  <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                    setting.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {setting.is_active ? '활성' : '비활성'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleActive(setting.id!, setting.is_active)}
                    className={`px-3 py-1 text-xs rounded ${
                      setting.is_active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {setting.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button
                    onClick={() => removeEmailSetting(setting.id!)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 알림 유형 설정 */}
              <div>
                <p className="text-sm text-gray-600 mb-2">알림 받을 유형:</p>
                <div className="grid grid-cols-2 gap-2">
                  {notificationTypes.map((type) => (
                    <label key={type.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={setting.notification_types.includes(type.id)}
                        onChange={(e) => {
                          const newTypes = e.target.checked
                            ? [...setting.notification_types, type.id]
                            : setting.notification_types.filter(t => t !== type.id)
                          updateNotificationTypes(setting.id!, newTypes)
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">알림 설정 안내</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>활성화된 이메일로만 알림이 발송됩니다.</li>
                <li>여러 이메일 설정 시 모든 활성 이메일로 동시 발송됩니다.</li>
                <li>알림 유형별로 세부 설정이 가능합니다.</li>
                <li>이메일 발송 기능 활성화 시에만 실제 알림이 전송됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import GoogleCalendarAuth from '@/components/GoogleCalendarAuth'

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  description: string | null
  color: string | null
  is_active: boolean
}

export default function CalendarSettings() {
  const [configs, setConfigs] = useState<CalendarConfig[]>([])
  const [availableCalendars, setAvailableCalendars] = useState<{id: string, summary: string, description?: string, backgroundColor?: string, foregroundColor?: string, accessRole?: string}[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showBrowser, setShowBrowser] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [showCalendarsList, setShowCalendarsList] = useState(false)
  const [formData, setFormData] = useState({
    config_type: 'team' as 'team' | 'function',
    target_name: '',
    calendar_id: '',
    calendar_alias: '',
    description: '',
    color: '#3B82F6'
  })
  
  const handleAuthSuccess = (calendars: Record<string, unknown>[]) => {
    setAvailableCalendars(calendars as {id: string, summary: string, description?: string, backgroundColor?: string, foregroundColor?: string, accessRole?: string}[])
    setIsAuthenticated(true)
    setShowBrowser(false)
    console.log('사용 가능한 캘린더:', calendars)
  }
  
  const handleSelectCalendar = (calendar: {id: string, summary: string, description?: string, backgroundColor?: string, foregroundColor?: string, accessRole?: string}) => {
    setFormData({
      ...formData,
      calendar_id: calendar.id,
      calendar_alias: calendar.summary || calendar.id,
      description: calendar.description || ''
    })
    setShowAddForm(true)
  }

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_configs')
        .select('*')
        .order('config_type', { ascending: true })

      if (error) {
        console.error('캘린더 설정 조회 실패:', error)
      } else {
        setConfigs(data || [])
      }
    } catch (error) {
      console.error('캘린더 설정 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const { error } = await supabase
        .from('calendar_configs')
        .insert([{
          config_type: formData.config_type,
          target_name: formData.target_name,
          calendar_id: formData.calendar_id,
          calendar_alias: formData.calendar_alias || null,
          description: formData.description || null,
          color: formData.color,
          is_active: true
        }])

      if (error) {
        console.error('캘린더 설정 추가 실패:', error)
        alert('캘린더 설정 추가에 실패했습니다.')
      } else {
        alert('캘린더 설정이 추가되었습니다.')
        setFormData({
          config_type: 'team',
          target_name: '',
          calendar_id: '',
          calendar_alias: '',
          description: '',
          color: '#3B82F6'
        })
        setShowAddForm(false)
        fetchConfigs()
      }
    } catch (error) {
      console.error('캘린더 설정 추가 오류:', error)
      alert('오류가 발생했습니다.')
    } finally {
      setFormLoading(false)
    }
  }

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('calendar_configs')
        .update({ is_active: !currentStatus })
        .eq('id', id)

      if (error) {
        console.error('캘린더 설정 업데이트 실패:', error)
        alert('설정 변경에 실패했습니다.')
      } else {
        fetchConfigs()
      }
    } catch (error) {
      console.error('캘린더 설정 업데이트 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }

  const handleDeleteConfig = async (id: string, name: string) => {
    if (!confirm(`"${name}" 캘린더 설정을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('calendar_configs')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('캘린더 설정 삭제 실패:', error)
        alert('캘린더 설정 삭제에 실패했습니다.')
      } else {
        alert('캘린더 설정이 삭제되었습니다.')
        fetchConfigs()
      }
    } catch (error) {
      console.error('캘린더 설정 삭제 오류:', error)
      alert('오류가 발생했습니다.')
    }
  }

  const testCalendarAccess = async (calendarId: string, name: string) => {
    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ calendarId })
      })

      const data = await response.json()
      
      if (data.success) {
        alert(`✅ "${name}" 캘린더 연결 성공!\n샘플 이벤트 ${data.eventsCount}개를 찾았습니다.`)
      } else {
        alert(`❌ "${name}" 캘린더 연결 실패\n${data.message}`)
      }
    } catch (error) {
      console.error('캘린더 테스트 오류:', error)
      alert('캘린더 테스트 중 오류가 발생했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      {/* 요약 위젯 */}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="ml-5 flex-1">
              <div>
                <div className="text-sm font-medium text-gray-500">
                  캘린더 설정
                </div>
                <div className="text-lg font-medium text-gray-900">
                  구글 캘린더 연동 ({configs.filter(c => c.is_active).length}개 활성)
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCalendarsList(!showCalendarsList)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg 
              className={`h-5 w-5 transform transition-transform ${showCalendarsList ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="bg-gray-50 px-5 py-3">
        <div className="flex space-x-4 text-sm">
          <button 
            onClick={() => setShowBrowser(true)}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            구글에서 캘린더 선택
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="font-medium text-green-600 hover:text-green-500"
          >
            직접 추가
          </button>
        </div>
      </div>

      {/* 캘린더 설정 목록 - 펼침/접힘 */}
      {showCalendarsList && (
        <div className="border-t border-gray-200">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">캘린더 설정 목록</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            팀별, 기능별 구글 캘린더 연동 설정
          </p>
        </div>
        <ul className="border-t border-gray-200 divide-y divide-gray-200">
          {configs.map((config) => (
            <li key={config.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div 
                      className="h-4 w-4 rounded-full"
                      style={{ backgroundColor: config.color || '#3B82F6' }}
                    ></div>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {config.calendar_alias || config.target_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {config.config_type === 'team' ? '팀' : '기능'} • {config.target_name}
                    </div>
                    {config.description && (
                      <div className="text-xs text-gray-400">{config.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => testCalendarAccess(config.calendar_id, config.target_name)}
                    className="text-purple-600 hover:text-purple-900 text-xs font-medium"
                  >
                    테스트
                  </button>
                  <button
                    onClick={() => toggleActive(config.id, config.is_active)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      config.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {config.is_active ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => handleDeleteConfig(config.id, config.target_name)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
          {configs.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">
              등록된 캘린더 설정이 없습니다.
            </li>
          )}
        </ul>
        </div>
      )}

      {/* 구글 캘린더 브라우저 */}
      {showBrowser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-4/5 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">구글 캘린더 선택</h3>
              <button
                onClick={() => setShowBrowser(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <GoogleCalendarAuth 
              onAuthChange={(isAuth) => setIsAuthenticated(isAuth)} 
              onCalendarsLoad={handleAuthSuccess} 
            />
            
            {/* 캘린더 리스트 */}
            {isAuthenticated && availableCalendars.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">사용 가능한 캘린더</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {availableCalendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => handleSelectCalendar(calendar)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="text-sm font-medium text-gray-900 truncate">
                            {calendar.summary || calendar.id}
                          </h5>
                          <p className="text-xs text-gray-500 mt-1">
                            {calendar.id}
                          </p>
                          {calendar.description && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {calendar.description}
                            </p>
                          )}
                        </div>
                        <div className="ml-2">
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{
                              backgroundColor: calendar.backgroundColor || '#3B82F6',
                              borderColor: calendar.foregroundColor || '#1F2937'
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          calendar.accessRole === 'owner' 
                            ? 'bg-green-100 text-green-800'
                            : calendar.accessRole === 'writer'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {calendar.accessRole === 'owner' ? '소유자' : 
                           calendar.accessRole === 'writer' ? '편집자' : '읽기 전용'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectCalendar(calendar)
                          }}
                          className="text-indigo-600 hover:text-indigo-900 text-xs font-medium"
                        >
                          선택
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 캘린더 추가 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">새 캘린더 추가</h3>
              
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">유형</label>
                  <select
                    value={formData.config_type}
                    onChange={(e) => setFormData({...formData, config_type: e.target.value as 'team' | 'function'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="team">팀</option>
                    <option value="function">기능</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">이름</label>
                  <input
                    type="text"
                    value={formData.target_name}
                    onChange={(e) => setFormData({...formData, target_name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="팀명 또는 기능명"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">캘린더 ID</label>
                  <input
                    type="text"
                    value={formData.calendar_id}
                    onChange={(e) => setFormData({...formData, calendar_id: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Google 캘린더 ID"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">별칭 (선택)</label>
                  <input
                    type="text"
                    value={formData.calendar_alias}
                    onChange={(e) => setFormData({...formData, calendar_alias: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="표시될 이름"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">색상</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="mt-1 block w-full h-10 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명 (선택)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={2}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="캘린더 설명"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setFormData({
                        config_type: 'team',
                        target_name: '',
                        calendar_id: '',
                        calendar_alias: '',
                        description: '',
                        color: '#3B82F6'
                      })
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading ? '추가 중...' : '추가'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
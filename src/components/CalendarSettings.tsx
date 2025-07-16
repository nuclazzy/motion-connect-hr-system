'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'

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

interface GoogleCalendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  accessRole: string
  backgroundColor?: string
  foregroundColor?: string
}

interface CalendarSettingsProps {
  user: User
}

export default function CalendarSettings({ user }: CalendarSettingsProps) {
  const [configs, setConfigs] = useState<CalendarConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingConfig, setEditingConfig] = useState<CalendarConfig | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<CalendarConfig | null>(null)
  const [connectedFeatures, setConnectedFeatures] = useState<Record<string, string[]>>({})
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([])
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([])
  const [showGoogleCalendars, setShowGoogleCalendars] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 연결 가능한 기능 목록 (팀별 연결 지원)
  const availableFeatures = [
    { 
      id: 'team-schedule', 
      name: '팀 일정 관리', 
      description: '팀별 미팅 및 일정 표시', 
      supportsTeams: true,
      teams: availableDepartments // 실제 데이터베이스에서 가져온 부서 목록
    },
    { 
      id: 'admin-schedule', 
      name: '관리자 팀 일정', 
      description: '전체 팀 일정 관리', 
      supportsTeams: false 
    },
    { 
      id: 'leave-management', 
      name: '휴가 관리', 
      description: '직원 휴가 및 연차 관리 (이름 기반 검색)', 
      supportsTeams: false 
    },
    { 
      id: 'internal-meeting', 
      name: '내부 회의', 
      description: '사내 회의 및 미팅 일정', 
      supportsTeams: false 
    },
    { 
      id: 'field-trip', 
      name: '외부 답사', 
      description: '외부 출장 및 답사 일정', 
      supportsTeams: false 
    },
  ]
  const [formData, setFormData] = useState({
    config_type: 'team' as 'team' | 'function',
    target_name: '',
    calendar_id: '',
    calendar_alias: '',
    description: '',
    color: '#3B82F6'
  })
  const [formConnectedFeatures, setFormConnectedFeatures] = useState<string[]>([])

  useEffect(() => {
    fetchConfigs()
    fetchFeatureMappings()
    fetchDepartments()
  }, [])

  const fetchGoogleCalendars = async (query: string = '') => {
    setGoogleLoading(true)
    try {
      const url = query 
        ? `/api/calendar/search?q=${encodeURIComponent(query)}`
        : '/api/calendar/list'
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.success) {
        setGoogleCalendars(data.calendars)
        setShowGoogleCalendars(true)
      } else {
        alert('캘린더 목록을 가져오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('Google 캘린더 목록 조회 실패:', error)
      alert('캘린더 목록 조회에 실패했습니다.')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleSearchCalendars = async () => {
    await fetchGoogleCalendars(searchQuery)
  }

  const handleSelectGoogleCalendar = (calendar: GoogleCalendar) => {
    setFormData({
      ...formData,
      calendar_id: calendar.id,
      calendar_alias: calendar.summary,
      description: calendar.description || ''
    })
    setShowGoogleCalendars(false)
  }

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('department')
        .not('department', 'is', null)
        .not('department', 'eq', '')

      if (error) {
        console.error('부서 목록 조회 실패:', error)
        // 기본값 사용
        setAvailableDepartments(['개발팀', '마케팅팀', '영업팀', '인사팀', '재무팀'])
      } else {
        // 중복 제거 및 정렬
        const uniqueDepartments = [...new Set(data.map(user => user.department))].sort()
        setAvailableDepartments(uniqueDepartments)
      }
    } catch (error) {
      console.error('부서 목록 조회 오류:', error)
      // 기본값 사용
      setAvailableDepartments(['개발팀', '마케팅팀', '영업팀', '인사팀', '재무팀'])
    }
  }

  const fetchFeatureMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_feature_mappings')
        .select('*')
        .eq('is_active', true)

      if (error) {
        // 테이블이 없으면 무시 (나중에 생성됨)
        if (error.code === '42P01') {
          console.log('캘린더 매핑 테이블이 아직 생성되지 않았습니다.')
          return
        }
        console.error('기능 매핑 조회 실패:', error)
      } else {
        // 데이터를 connectedFeatures 형태로 변환
        const mappings: Record<string, string[]> = {}
        data?.forEach(mapping => {
          if (!mappings[mapping.calendar_config_id]) {
            mappings[mapping.calendar_config_id] = []
          }
          // feature_id에 팀 정보가 포함되어 있으므로 그대로 사용
          const connectionKey = mapping.feature_id
          mappings[mapping.calendar_config_id].push(connectionKey)
        })
        setConnectedFeatures(mappings)
      }
    } catch (error) {
      console.error('기능 매핑 조회 오류:', error)
    }
  }

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

  const handleAddNew = () => {
    setFormData({
      config_type: 'team',
      target_name: '',
      calendar_id: '',
      calendar_alias: '',
      description: '',
      color: '#3B82F6'
    })
    setEditingConfig(null)
    setShowAddForm(true)
  }

  const handleEdit = (config: CalendarConfig) => {
    setFormData({
      config_type: config.config_type,
      target_name: config.target_name,
      calendar_id: config.calendar_id,
      calendar_alias: config.calendar_alias || '',
      description: config.description || '',
      color: config.color || '#3B82F6'
    })
    
    // 기존 연결된 기능들 로드
    const existingConnections = connectedFeatures[config.id] || []
    setFormConnectedFeatures(existingConnections)
    
    setEditingConfig(config)
    setShowAddForm(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      if (editingConfig) {
        // 수정
        const { error } = await supabase
          .from('calendar_configs')
          .update({
            config_type: formData.config_type,
            target_name: formData.target_name,
            calendar_id: formData.calendar_id,
            calendar_alias: formData.calendar_alias || null,
            description: formData.description || null,
            color: formData.color
          })
          .eq('id', editingConfig.id)

        if (error) {
          console.error('캘린더 설정 수정 실패:', error)
          alert('캘린더 설정 수정에 실패했습니다.')
        } else {
          alert('캘린더 설정이 수정되었습니다.')
          // 기능 연결 저장
          await saveFormConnections(editingConfig.id)
          resetForm()
          fetchConfigs()
        }
      } else {
        // 추가
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
          // 새로 생성된 캘린더의 ID를 가져와서 기능 연결 저장
          const { data: newConfig } = await supabase
            .from('calendar_configs')
            .select('id')
            .eq('calendar_id', formData.calendar_id)
            .eq('target_name', formData.target_name)
            .single()
          
          if (newConfig) {
            await saveFormConnections(newConfig.id)
          }
          
          resetForm()
          fetchConfigs()
        }
      }
    } catch (error) {
      console.error('캘린더 설정 처리 오류:', error)
      alert('오류가 발생했습니다.')
    } finally {
      setFormLoading(false)
    }
  }

  const saveFormConnections = async (calendarConfigId: string) => {
    if (user.role !== 'admin') return
    if (formConnectedFeatures.length === 0) return

    try {
      // 기존 매핑들을 모두 비활성화
      await supabase
        .from('calendar_feature_mappings')
        .update({ is_active: false })
        .eq('calendar_config_id', calendarConfigId)

      // 새로운 매핑들을 생성
      const mappingsToInsert = formConnectedFeatures.map(connectionKey => {
        const [featureId, teamName] = connectionKey.includes(':') ? connectionKey.split(':') : [connectionKey, undefined]
        const feature = availableFeatures.find(f => f.id === featureId)
        
        return {
          calendar_config_id: calendarConfigId,
          feature_id: teamName ? `${featureId}:${teamName}` : featureId,
          feature_name: teamName ? `${feature?.name} (${teamName})` : (feature?.name || featureId),
          is_active: true
        }
      })

      const { error } = await supabase
        .from('calendar_feature_mappings')
        .upsert(mappingsToInsert, {
          onConflict: 'calendar_config_id,feature_id'
        })

      if (error) {
        console.error('기능 매핑 저장 실패:', error)
      } else {
        console.log('기능 연결이 저장되었습니다.')
        await fetchFeatureMappings()
      }
    } catch (error) {
      console.error('기능 연결 저장 오류:', error)
    }
  }

  const handleFormFeatureToggle = (featureId: string, connected: boolean, teamName?: string) => {
    const connectionKey = teamName ? `${featureId}:${teamName}` : featureId
    
    if (connected) {
      // 기능 연결 - 팀별 기능의 경우 기존 연결 제거 후 새로 추가
      setFormConnectedFeatures(prev => [
        ...prev.filter(id => !id.startsWith(`${featureId}:`)),
        connectionKey
      ])
    } else {
      // 기능 연결 해제
      const connectionsToRemove = teamName 
        ? [connectionKey]
        : formConnectedFeatures.filter(id => id === featureId || id.startsWith(`${featureId}:`))
      
      setFormConnectedFeatures(prev => 
        prev.filter(id => !connectionsToRemove.includes(id))
      )
    }
  }

  const resetForm = () => {
    setFormData({
      config_type: 'team',
      target_name: '',
      calendar_id: '',
      calendar_alias: '',
      description: '',
      color: '#3B82F6'
    })
    setFormConnectedFeatures([])
    setEditingConfig(null)
    setShowAddForm(false)
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

  const handleConnect = (config: CalendarConfig) => {
    setSelectedConfig(config)
    setShowConnectModal(true)
  }

  const handleFeatureToggle = (featureId: string, connected: boolean, teamName?: string) => {
    if (!selectedConfig) return

    setConnectedFeatures(prev => {
      const configConnections = prev[selectedConfig.id] || []
      
      if (connected) {
        // 기능 연결 - 팀별 기능의 경우 팀 정보도 저장
        const connectionKey = teamName ? `${featureId}:${teamName}` : featureId
        
        
        return {
          ...prev,
          [selectedConfig.id]: [...configConnections.filter(id => !id.startsWith(`${featureId}:`)), connectionKey]
        }
      } else {
        // 기능 연결 해제
        const connectionsToRemove = teamName 
          ? [`${featureId}:${teamName}`]
          : configConnections.filter(id => id === featureId || id.startsWith(`${featureId}:`))
        
        
        return {
          ...prev,
          [selectedConfig.id]: configConnections.filter(id => !connectionsToRemove.includes(id))
        }
      }
    })
  }

  const saveConnections = async () => {
    if (!selectedConfig) return

    try {
      // 관리자 권한 확인
      if (user.role !== 'admin') {
        alert('캘린더 연결 설정은 관리자만 가능합니다.')
        return
      }

      console.log('현재 사용자:', user.name, '역할:', user.role)

      const connections = connectedFeatures[selectedConfig.id] || []
      
      // 테이블이 존재하는지 확인
      const { error: testError } = await supabase
        .from('calendar_feature_mappings')
        .select('id')
        .limit(1)

      if (testError && testError.code === '42P01') {
        // 테이블이 없으면 알림만 표시하고 로컬 상태만 업데이트
        alert(`캘린더 매핑 테이블이 생성되지 않았습니다. 데이터베이스에 SQL 스키마를 실행해주세요.\n\n현재는 로컬 설정만 저장됩니다.`)
        setShowConnectModal(false)
        setSelectedConfig(null)
        return
      }

      // 기존 매핑들을 모두 비활성화
      await supabase
        .from('calendar_feature_mappings')
        .update({ is_active: false })
        .eq('calendar_config_id', selectedConfig.id)

      // 새로운 매핑들을 생성하거나 활성화
      if (connections.length > 0) {
        const mappingsToInsert = connections.map(connectionKey => {
          // 팀별 연결인지 확인 (format: featureId:teamName)
          const [featureId, teamName] = connectionKey.includes(':') ? connectionKey.split(':') : [connectionKey, undefined]
          const feature = availableFeatures.find(f => f.id === featureId)
          
          return {
            calendar_config_id: selectedConfig.id,
            feature_id: teamName ? `${featureId}:${teamName}` : featureId, // 팀 정보를 feature_id에 포함
            feature_name: teamName ? `${feature?.name} (${teamName})` : (feature?.name || featureId),
            is_active: true
          }
        })

        // upsert 방식으로 저장 (있으면 업데이트, 없으면 생성)
        const { error } = await supabase
          .from('calendar_feature_mappings')
          .upsert(mappingsToInsert, {
            onConflict: 'calendar_config_id,feature_id'
          })

        if (error) {
          console.error('기능 매핑 저장 실패:', error)
          alert('기능 연결 저장에 실패했습니다.')
          return
        }
      }

      // 데이터 새로고침
      await fetchFeatureMappings()
      
      alert(`${selectedConfig.calendar_alias || selectedConfig.target_name} 캘린더의 기능 연결이 저장되었습니다.`)
      setShowConnectModal(false)
      setSelectedConfig(null)
    } catch (error) {
      console.error('연결 설정 저장 오류:', error)
      alert('연결 설정 저장에 실패했습니다.')
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
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">캘린더 설정</h3>
              <p className="text-sm text-gray-500">
                Service Account로 접근 가능한 캘린더를 검색하거나 직접 ID를 입력하세요
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => fetchGoogleCalendars()}
              disabled={googleLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 002 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
              <span>{googleLoading ? '로딩...' : '캘린더 목록'}</span>
            </button>
            <button
              onClick={handleAddNew}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              수동 추가
            </button>
          </div>
        </div>

        {/* 설정된 캘린더 목록 */}
        <div className="mt-6">
          {configs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">설정된 캘린더가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">Google Calendar ID를 입력하여 캘린더를 추가해보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div key={config.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: config.color || '#3B82F6' }}
                        ></div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {config.calendar_alias || config.target_name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {config.config_type === 'team' ? '팀' : '기능'} • {config.target_name}
                          </p>
                          <p className="text-xs text-gray-400 font-mono">
                            ID: {config.calendar_id}
                          </p>
                          {config.description && (
                            <p className="text-xs text-gray-600 mt-1">{config.description}</p>
                          )}
                          
                          {/* 연결된 기능들 표시 */}
                          {connectedFeatures[config.id] && connectedFeatures[config.id].length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">연결된 기능:</p>
                              <div className="flex flex-wrap gap-1">
                                {connectedFeatures[config.id].map(connectionKey => {
                                  // 팀별 연결인지 확인 (format: featureId:teamName)
                                  const [featureId, teamName] = connectionKey.includes(':') ? connectionKey.split(':') : [connectionKey, undefined]
                                  const feature = availableFeatures.find(f => f.id === featureId)
                                  const displayName = teamName ? `${feature?.name} (${teamName})` : feature?.name
                                  
                                  return feature ? (
                                    <span 
                                      key={connectionKey}
                                      className="inline-block bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full"
                                      title={teamName ? `${feature.name} - ${teamName} 팀` : feature.name}
                                    >
                                      {displayName}
                                    </span>
                                  ) : null
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleActive(config.id, config.is_active)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          config.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {config.is_active ? '활성' : '비활성'}
                      </button>
                      <button
                        onClick={() => handleConnect(config)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      >
                        연결하기
                      </button>
                      <button
                        onClick={() => handleEdit(config)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteConfig(config.id, config.calendar_alias || config.target_name)}
                        className="text-red-600 hover:text-red-900 text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 캘린더 추가/수정 폼 */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingConfig ? '캘린더 수정' : '캘린더 추가'}
                </h3>
                
                <form onSubmit={handleSubmitForm} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">유형</label>
                    <select
                      value={formData.config_type}
                      onChange={(e) => setFormData({...formData, config_type: e.target.value as 'team' | 'function'})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="team">팀</option>
                      <option value="function">기능</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {formData.config_type === 'team' ? '팀 이름' : '기능 이름'}
                    </label>
                    <input
                      type="text"
                      value={formData.target_name}
                      onChange={(e) => setFormData({...formData, target_name: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder={formData.config_type === 'team' ? '예: 마케팅팀' : '예: 회의실 예약'}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Google Calendar ID</label>
                    <div className="mt-1 flex space-x-2">
                      <input
                        type="text"
                        value={formData.calendar_id}
                        onChange={(e) => setFormData({...formData, calendar_id: e.target.value})}
                        className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono text-xs"
                        placeholder="example@group.calendar.google.com"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => fetchGoogleCalendars()}
                        disabled={googleLoading}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-xs font-medium"
                      >
                        {googleLoading ? '로딩...' : '목록에서 선택'}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      목록에서 선택하거나 직접 캘린더 ID를 입력하세요
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">표시 이름 (선택사항)</label>
                    <input
                      type="text"
                      value={formData.calendar_alias}
                      onChange={(e) => setFormData({...formData, calendar_alias: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="캘린더에 표시될 이름"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">설명 (선택사항)</label>
                    <textarea
                      rows={2}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="캘린더에 대한 설명"
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

                  {/* 기능 연결 섹션 */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">연결할 기능 선택</label>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {availableFeatures.map((feature) => {
                        const baseFeatureConnected = formConnectedFeatures.some(conn => 
                          conn === feature.id || conn.startsWith(`${feature.id}:`)
                        )
                        
                        return (
                          <div key={feature.id} className="p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                id={`form-${feature.id}`}
                                checked={baseFeatureConnected}
                                onChange={(e) => handleFormFeatureToggle(feature.id, e.target.checked)}
                                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <div className="flex-1">
                                <label htmlFor={`form-${feature.id}`} className="text-sm font-medium text-gray-900 cursor-pointer">
                                  {feature.name}
                                </label>
                                <p className="text-xs text-gray-500 mt-1">
                                  {feature.description}
                                </p>
                                
                                {/* 팀별 연결 지원하는 기능인 경우 팀 선택 옵션 표시 */}
                                {feature.supportsTeams && baseFeatureConnected && (
                                  <div className="mt-3 ml-6 space-y-2">
                                    <p className="text-xs font-medium text-gray-700">팀별 연결:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {feature.teams?.map(team => {
                                        const teamConnectionKey = `${feature.id}:${team}`
                                        const isTeamConnected = formConnectedFeatures.includes(teamConnectionKey)
                                        
                                        return (
                                          <label key={team} className="flex items-center space-x-2 text-xs">
                                            <input
                                              type="checkbox"
                                              checked={isTeamConnected}
                                              onChange={(e) => handleFormFeatureToggle(feature.id, e.target.checked, team)}
                                              className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                            />
                                            <span className="text-gray-600">{team}</span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={formLoading}
                      className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {formLoading ? '처리 중...' : editingConfig ? '수정' : '추가'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* 기능 연결 모달 */}
        {showConnectModal && selectedConfig && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  기능 연결 설정 - {selectedConfig.calendar_alias || selectedConfig.target_name}
                </h3>
                
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    이 캘린더를 사용할 기능들을 선택하세요:
                  </p>
                  
                  {availableFeatures.map((feature) => {
                    const configConnections = connectedFeatures[selectedConfig.id] || []
                    const baseFeatureConnected = configConnections.some(conn => 
                      conn === feature.id || conn.startsWith(`${feature.id}:`)
                    )
                    
                    return (
                      <div key={feature.id} className="p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            id={feature.id}
                            checked={baseFeatureConnected}
                            onChange={(e) => handleFeatureToggle(feature.id, e.target.checked)}
                            className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <label htmlFor={feature.id} className="text-sm font-medium text-gray-900 cursor-pointer">
                              {feature.name}
                            </label>
                            <p className="text-xs text-gray-500 mt-1">
                              {feature.description}
                            </p>
                            
                            {/* 팀별 연결 지원하는 기능인 경우 팀 선택 옵션 표시 */}
                            {feature.supportsTeams && baseFeatureConnected && (
                              <div className="mt-3 ml-6 space-y-2">
                                <p className="text-xs font-medium text-gray-700">팀별 연결:</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {feature.teams?.map(team => {
                                    const teamConnectionKey = `${feature.id}:${team}`
                                    const isTeamConnected = configConnections.includes(teamConnectionKey)
                                    
                                    return (
                                      <label key={team} className="flex items-center space-x-2 text-xs">
                                        <input
                                          type="checkbox"
                                          checked={isTeamConnected}
                                          onChange={(e) => handleFeatureToggle(feature.id, e.target.checked, team)}
                                          className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                        />
                                        <span className="text-gray-600">{team}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex justify-end space-x-3 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConnectModal(false)
                      setSelectedConfig(null)
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveConnections}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    연결 저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Google 캘린더 선택 모달 */}
        {showGoogleCalendars && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-2/3 max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Google 캘린더 선택
                </h3>
                
                {/* 검색 기능 */}
                <div className="mb-4">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="캘린더 검색..."
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchCalendars()
                        }
                      }}
                    />
                    <button
                      onClick={handleSearchCalendars}
                      disabled={googleLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                    >
                      {googleLoading ? '검색 중...' : '검색'}
                    </button>
                    <button
                      onClick={() => fetchGoogleCalendars()}
                      disabled={googleLoading}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
                    >
                      전체 목록
                    </button>
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {googleCalendars.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      접근 가능한 캘린더가 없습니다.
                    </p>
                  ) : (
                    googleCalendars.map((calendar) => (
                      <div 
                        key={calendar.id} 
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleSelectGoogleCalendar(calendar)}
                      >
                        <div className="flex items-start space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: calendar.backgroundColor || '#3B82F6' }}
                          ></div>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">
                              {calendar.summary}
                              {calendar.primary && (
                                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  기본
                                </span>
                              )}
                            </h4>
                            {calendar.description && (
                              <p className="text-xs text-gray-600 mt-1">{calendar.description}</p>
                            )}
                            <p className="text-xs text-gray-400 font-mono mt-1">
                              ID: {calendar.id}
                            </p>
                            <p className="text-xs text-gray-500">
                              권한: {calendar.accessRole === 'owner' ? '소유자' : 
                                    calendar.accessRole === 'writer' ? '편집자' : 
                                    calendar.accessRole === 'reader' ? '읽기전용' : calendar.accessRole}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowGoogleCalendars(false)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Google Calendar ID 찾는 방법
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Google Calendar 웹사이트에 접속</li>
                  <li>연동하고 싶은 캘린더를 선택</li>
                  <li>캘린더 설정 (⚙️) → &quot;캘린더 통합&quot;</li>
                  <li>&quot;캘린더 ID&quot; 복사해서 위에 입력</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
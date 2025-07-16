'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_alias: string | null
}

interface UserPermission {
  id: string
  user_id: string
  permission_type: 'read' | 'write' | 'admin'
  granted_at: string
  users: {
    name: string
    email: string
    department: string
  }
  granted_by_user: {
    name: string
    email: string
  }
}

interface CalendarPermissionManagerProps {
  user: User
}

export default function CalendarPermissionManager({ user }: CalendarPermissionManagerProps) {
  const [calendars, setCalendars] = useState<CalendarConfig[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<CalendarConfig | null>(null)
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddPermissionModal, setShowAddPermissionModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [selectedPermissionType, setSelectedPermissionType] = useState<'read' | 'write' | 'admin'>('read')

  useEffect(() => {
    if (user.role === 'admin') {
      fetchCalendars()
      fetchUsers()
    }
  }, [user.role])

  useEffect(() => {
    if (selectedCalendar && user.role === 'admin') {
      fetchPermissions()
    }
  }, [selectedCalendar, user.role]) // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자만 접근 가능
  if (user.role !== 'admin') {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <p className="text-red-600">캘린더 권한 관리는 관리자만 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  const fetchCalendars = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_configs')
        .select('id, config_type, target_name, calendar_alias')
        .eq('is_active', true)
        .order('config_type', { ascending: true })

      if (error) {
        console.error('캘린더 목록 조회 실패:', error)
      } else {
        setCalendars(data || [])
        if (data && data.length > 0) {
          setSelectedCalendar(data[0])
        }
      }
    } catch (error) {
      console.error('캘린더 목록 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, department, role, employee_id, position, hire_date')
        .order('name')

      if (error) {
        console.error('사용자 목록 조회 실패:', error)
      } else {
        setUsers(data || [])
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
    }
  }

  const fetchPermissions = async () => {
    if (!selectedCalendar) return

    try {
      const response = await fetch(`/api/calendar/permissions?calendarConfigId=${selectedCalendar.id}`)
      const data = await response.json()

      if (data.success) {
        setPermissions(data.permissions)
      } else {
        console.error('권한 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('권한 조회 오류:', error)
    }
  }

  const handleGrantPermission = async () => {
    if (!selectedCalendar || !selectedUser) return

    try {
      const response = await fetch('/api/calendar/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser,
          calendarConfigId: selectedCalendar.id,
          permissionType: selectedPermissionType,
          action: 'grant'
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('권한이 성공적으로 부여되었습니다.')
        setShowAddPermissionModal(false)
        setSelectedUser('')
        setSelectedPermissionType('read')
        fetchPermissions()
      } else {
        alert(data.message || '권한 부여에 실패했습니다.')
      }
    } catch (error) {
      console.error('권한 부여 오류:', error)
      alert('권한 부여 중 오류가 발생했습니다.')
    }
  }

  const handleRevokePermission = async (userId: string, permissionType: 'read' | 'write' | 'admin') => {
    if (!selectedCalendar) return

    if (!confirm('이 권한을 취소하시겠습니까?')) return

    try {
      const response = await fetch('/api/calendar/permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          calendarConfigId: selectedCalendar.id,
          permissionType,
          action: 'revoke'
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('권한이 성공적으로 취소되었습니다.')
        fetchPermissions()
      } else {
        alert(data.message || '권한 취소에 실패했습니다.')
      }
    } catch (error) {
      console.error('권한 취소 오류:', error)
      alert('권한 취소 중 오류가 발생했습니다.')
    }
  }

  const getPermissionColor = (permissionType: string) => {
    switch (permissionType) {
      case 'read':
        return 'bg-green-100 text-green-800'
      case 'write':
        return 'bg-blue-100 text-blue-800'
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPermissionText = (permissionType: string) => {
    switch (permissionType) {
      case 'read':
        return '읽기'
      case 'write':
        return '쓰기'
      case 'admin':
        return '관리'
      default:
        return permissionType
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">캘린더 권한 관리</h3>
              <p className="text-sm text-gray-500">팀 캘린더에 대한 사용자 권한을 관리합니다</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddPermissionModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            disabled={!selectedCalendar}
          >
            권한 추가
          </button>
        </div>

        {/* 캘린더 선택 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">캘린더 선택</label>
          <select
            value={selectedCalendar?.id || ''}
            onChange={(e) => {
              const calendar = calendars.find(c => c.id === e.target.value)
              setSelectedCalendar(calendar || null)
            }}
            className="block w-full max-w-md border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {calendars.map(calendar => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.calendar_alias || calendar.target_name} ({calendar.config_type === 'team' ? '팀' : '기능'})
              </option>
            ))}
          </select>
        </div>

        {/* 권한 목록 */}
        {selectedCalendar && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-4">
              &quot;{selectedCalendar.calendar_alias || selectedCalendar.target_name}&quot; 캘린더 권한
            </h4>
            
            {permissions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">설정된 권한이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {permissions.map((permission) => (
                  <div key={permission.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <h5 className="text-sm font-medium text-gray-900">
                              {permission.users.name}
                            </h5>
                            <p className="text-xs text-gray-500">
                              {permission.users.email} • {permission.users.department}
                            </p>
                            <p className="text-xs text-gray-400">
                              부여자: {permission.granted_by_user.name} • {new Date(permission.granted_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPermissionColor(permission.permission_type)}`}>
                          {getPermissionText(permission.permission_type)}
                        </span>
                        <button
                          onClick={() => handleRevokePermission(permission.user_id, permission.permission_type)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 권한 추가 모달 */}
        {showAddPermissionModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">권한 추가</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">사용자</label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    >
                      <option value="">사용자 선택</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email}) - {user.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">권한 유형</label>
                    <select
                      value={selectedPermissionType}
                      onChange={(e) => setSelectedPermissionType(e.target.value as 'read' | 'write' | 'admin')}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option value="read">읽기</option>
                      <option value="write">쓰기</option>
                      <option value="admin">관리</option>
                    </select>
                  </div>

                  <div className="text-xs text-gray-500">
                    <p>• 읽기: 캘린더 이벤트 조회 가능</p>
                    <p>• 쓰기: 캘린더 이벤트 생성/수정 가능</p>
                    <p>• 관리: 캘린더 설정 및 다른 사용자 권한 관리 가능</p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPermissionModal(false)
                      setSelectedUser('')
                      setSelectedPermissionType('read')
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleGrantPermission}
                    disabled={!selectedUser}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    권한 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
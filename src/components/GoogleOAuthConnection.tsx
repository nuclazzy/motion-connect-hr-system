'use client'

import { useState, useEffect } from 'react'
import { type User } from '@/lib/auth'

interface GoogleOAuthConnectionProps {
  user: User
}

export default function GoogleOAuthConnection({ user }: GoogleOAuthConnectionProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isConnected, setIsConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [calendars, setCalendars] = useState<any[]>([]) // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showCalendars, setShowCalendars] = useState(false)

  useEffect(() => {
    checkGoogleConnection()
  }, [])

  const checkGoogleConnection = async () => {
    try {
      const response = await fetch('/api/calendar/oauth-list')
      const data = await response.json()

      if (data.success) {
        setIsConnected(true)
        setCalendars(data.calendars || [])
      } else if (data.needsAuth) {
        setIsConnected(false)
      }
    } catch (error) {
      console.error('Google 연결 상태 확인 실패:', error)
      setIsConnected(false)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGoogle = () => {
    console.log('Redirecting to Google OAuth...')
    window.location.href = '/api/auth/google'
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Google 계정 연결을 해제하시겠습니까?')) return

    try {
      // 사용자 메타데이터에서 Google 토큰 제거
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          google_tokens: null,
          google_auth_connected: false
        }),
      })

      if (response.ok) {
        setIsConnected(false)
        setCalendars([])
        setShowCalendars(false)
        alert('Google 계정 연결이 해제되었습니다.')
      }
    } catch (error) {
      console.error('Google 연결 해제 실패:', error)
      alert('연결 해제 중 오류가 발생했습니다.')
    }
  }

  const refreshCalendars = async () => {
    try {
      const response = await fetch('/api/calendar/oauth-list')
      const data = await response.json()

      if (data.success) {
        setCalendars(data.calendars || [])
      } else if (data.needsAuth) {
        setIsConnected(false)
        alert('Google 인증이 만료되었습니다. 다시 연결해주세요.')
      }
    } catch (error) {
      console.error('캘린더 목록 새로고침 실패:', error)
      alert('캘린더 목록을 불러오는데 실패했습니다.')
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">Google 계정 연결</h3>
              <p className="text-sm text-gray-500">
                {isConnected ? 'Google 캘린더에 연결됨' : 'Google 캘린더 연결 필요'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  연결됨
                </span>
                <button
                  onClick={handleDisconnectGoogle}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                >
                  연결 해제
                </button>
              </>
            ) : (
              <>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  연결 안됨
                </span>
                <button
                  onClick={handleConnectGoogle}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                >
                  Google 연결
                </button>
              </>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-medium text-gray-900">연결된 캘린더 ({calendars.length}개)</h4>
              <div className="flex space-x-2">
                <button
                  onClick={refreshCalendars}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm font-medium"
                >
                  새로고침
                </button>
                <button
                  onClick={() => setShowCalendars(!showCalendars)}
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-md text-sm font-medium"
                >
                  {showCalendars ? '숨기기' : '보기'}
                </button>
              </div>
            </div>

            {showCalendars && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {calendars.map((calendar) => (
                  <div key={calendar.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="text-sm font-medium text-gray-900">
                          {calendar.summary}
                          {calendar.primary && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              기본
                            </span>
                          )}
                        </h5>
                        <p className="text-xs text-gray-500">
                          {calendar.description || '설명 없음'}
                        </p>
                        <p className="text-xs text-gray-400">
                          권한: {calendar.accessRole} • ID: {calendar.id}
                        </p>
                      </div>
                      <div 
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: calendar.backgroundColor || '#4285f4' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isConnected && (
          <div className="mt-4 p-3 bg-green-50 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Google 캘린더 연결 완료</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>이제 Google 캘린더의 데이터를 사용할 수 있습니다:</p>
                  <ul className="list-disc pl-5 mt-1">
                    <li>실시간 캘린더 목록 조회</li>
                    <li>캘린더 이벤트 생성 및 수정</li>
                    <li>사용자 인증 기반 안전한 접근</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
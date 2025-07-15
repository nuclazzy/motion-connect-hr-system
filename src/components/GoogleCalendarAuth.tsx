'use client'

import { useState, useEffect } from 'react'
import { getGoogleCalendarOAuth } from '@/lib/googleCalendarOAuth'

interface GoogleCalendarAuthProps {
  onAuthChange: (isAuthenticated: boolean, user?: Record<string, unknown>) => void
  onCalendarsLoad?: (calendars: Record<string, unknown>[]) => void
}

export default function GoogleCalendarAuth({ onAuthChange, onCalendarsLoad }: GoogleCalendarAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const googleCalendar = getGoogleCalendarOAuth()

  useEffect(() => {
    initializeGoogleAPI()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initializeGoogleAPI = async () => {
    try {
      setIsLoading(true)
      setError(null)

      await googleCalendar.loadGoogleAPI()
      await googleCalendar.initializeGoogleAPI()

      const authenticated = googleCalendar.isAuthenticated()
      setIsAuthenticated(authenticated)

      if (authenticated) {
        const currentUser = googleCalendar.getCurrentUser()
        setUser(currentUser)
        onAuthChange(true, currentUser || undefined)
        
        // 캘린더 목록 로드
        if (onCalendarsLoad) {
          try {
            const calendars = await googleCalendar.getCalendarList()
            onCalendarsLoad(calendars)
          } catch (error) {
            console.error('캘린더 목록 로드 실패:', error)
          }
        }
      } else {
        onAuthChange(false)
      }
    } catch (error) {
      console.error('Google API 초기화 실패:', error)
      setError('Google Calendar 연동 초기화에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignIn = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const success = await googleCalendar.signIn()
      
      if (success) {
        const currentUser = googleCalendar.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(true)
        onAuthChange(true, currentUser || undefined)

        // 캘린더 목록 로드
        if (onCalendarsLoad) {
          try {
            const calendars = await googleCalendar.getCalendarList()
            onCalendarsLoad(calendars)
          } catch (error) {
            console.error('캘린더 목록 로드 실패:', error)
          }
        }
      } else {
        setError('Google 로그인에 실패했습니다.')
      }
    } catch (error) {
      console.error('로그인 오류:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setIsLoading(true)
      await googleCalendar.signOut()
      setUser(null)
      setIsAuthenticated(false)
      onAuthChange(false)
    } catch (error) {
      console.error('로그아웃 오류:', error)
      setError('로그아웃 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-blue-700">Google Calendar 연동 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-700">{error}</span>
        </div>
        <button
          onClick={initializeGoogleAPI}
          className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
        >
          다시 시도
        </button>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="p-3 bg-green-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src={user.imageUrl as string} 
              alt={user.name as string}
              className="h-8 w-8 rounded-full"
            />
            <div>
              <div className="text-sm font-medium text-green-900">{user.name as string}</div>
              <div className="text-xs text-green-700">{user.email as string}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
          >
            로그아웃
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-600 mb-3">
          Google Calendar 연동을 위해 로그인이 필요합니다.
        </p>
        <button
          onClick={handleSignIn}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Google 계정으로 로그인
        </button>
      </div>
    </div>
  )
}
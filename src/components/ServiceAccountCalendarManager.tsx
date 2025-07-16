'use client'

import { useState, useEffect } from 'react'

interface Calendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  accessRole: string
  backgroundColor?: string
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  calendarId: string
  calendarName: string
}

export default function ServiceAccountCalendarManager() {
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCalendar, setSelectedCalendar] = useState<string>('')
  const [showEvents, setShowEvents] = useState(false)

  useEffect(() => {
    loadCalendars()
  }, [])

  // Service Account로 캘린더 목록 가져오기
  const loadCalendars = async () => {
    try {
      const response = await fetch('/api/calendar/list')
      const data = await response.json()

      if (data.success) {
        setCalendars(data.calendars || [])
      } else {
        console.error('캘린더 목록 로드 실패:', data.error)
      }
    } catch (error) {
      console.error('캘린더 목록 로드 중 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 특정 캘린더의 이벤트 가져오기
  const loadEvents = async (calendarId: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          timeMin: new Date().toISOString(),
          timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30일 후
        })
      })
      
      const data = await response.json()
      if (data.events) {
        setEvents(data.events)
        setShowEvents(true)
      }
    } catch (error) {
      console.error('이벤트 로드 중 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 새 이벤트 생성
  const createTestEvent = async (calendarId: string) => {
    try {
      const now = new Date()
      const eventStart = new Date(now.getTime() + 60 * 60 * 1000) // 1시간 후
      const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000) // 2시간 후

      const eventData = {
        summary: '테스트 이벤트 - HR 시스템',
        description: 'Service Account로 생성된 테스트 이벤트입니다.',
        start: {
          dateTime: eventStart.toISOString(),
          timeZone: 'Asia/Seoul'
        },
        end: {
          dateTime: eventEnd.toISOString(),
          timeZone: 'Asia/Seoul'
        },
        location: '서울, 대한민국'
      }

      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId,
          eventData
        })
      })

      const result = await response.json()
      if (result.success) {
        alert('테스트 이벤트가 생성되었습니다!')
        loadEvents(calendarId) // 이벤트 목록 새로고침
      } else {
        alert('이벤트 생성 실패: ' + result.error)
      }
    } catch (error) {
      console.error('이벤트 생성 중 오류:', error)
      alert('이벤트 생성 중 오류가 발생했습니다.')
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
              <svg className="h-6 w-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">Service Account 캘린더 관리</h3>
              <p className="text-sm text-gray-500">
                {calendars.length > 0 
                  ? `${calendars.length}개의 캘린더에 연결됨` 
                  : '연결된 캘린더가 없습니다'
                }
              </p>
            </div>
          </div>
          <button
            onClick={loadCalendars}
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md text-sm font-medium"
          >
            새로고침
          </button>
        </div>

        {calendars.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">캘린더가 연결되지 않았습니다</h3>
            <p className="text-sm text-gray-500 mb-4">
              Google Calendar에서 다음 Service Account에게 캘린더를 공유하세요:
            </p>
            <div className="bg-gray-50 p-3 rounded-md">
              <code className="text-sm text-gray-800">
                hr-calendar-service@ecstatic-device-288303.iam.gserviceaccount.com
              </code>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              권한: "이벤트 세부정보 보기 및 수정" 또는 "변경 및 공유 관리"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3">
              {calendars.map((calendar) => (
                <div key={calendar.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">
                        {calendar.summary}
                        {calendar.primary && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            기본
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {calendar.description || '설명 없음'}
                      </p>
                      <p className="text-xs text-gray-400">
                        권한: {calendar.accessRole} • ID: {calendar.id}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => loadEvents(calendar.id)}
                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-md text-sm font-medium"
                      >
                        이벤트 보기
                      </button>
                      <button
                        onClick={() => createTestEvent(calendar.id)}
                        className="bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1 rounded-md text-sm font-medium"
                      >
                        테스트 이벤트 생성
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {showEvents && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">
                  최근 이벤트 ({events.length}개)
                </h4>
                {events.length === 0 ? (
                  <p className="text-sm text-gray-500">이벤트가 없습니다.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {events.map((event) => (
                      <div key={event.id} className="border border-gray-100 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-gray-900">{event.title}</h5>
                        <p className="text-xs text-gray-500">
                          {new Date(event.start).toLocaleString('ko-KR')} - {new Date(event.end).toLocaleString('ko-KR')}
                        </p>
                        {event.location && (
                          <p className="text-xs text-gray-400">📍 {event.location}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-green-50 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Service Account 방식 장점</h3>
              <div className="mt-2 text-sm text-green-700">
                <ul className="list-disc pl-5">
                  <li>사용자 인증 불필요</li>
                  <li>토큰 만료 걱정 없음</li>
                  <li>24/7 안정적 접근</li>
                  <li>도메인 변경에 영향 없음</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
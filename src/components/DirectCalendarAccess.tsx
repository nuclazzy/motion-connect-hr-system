'use client'

import { useState } from 'react'

interface CalendarInfo {
  id: string
  summary: string
  description?: string
  timeZone: string
}

interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  description?: string
  location?: string
}

interface AccessTestResult {
  success: boolean
  calendarId: string
  calendarInfo?: CalendarInfo
  eventsAccess: boolean
  eventCount: number
  events: CalendarEvent[]
  accessTest: string
  error?: string
}

export default function DirectCalendarAccess() {
  const [calendarId, setCalendarId] = useState('c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AccessTestResult | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])

  const testCalendarAccess = async () => {
    if (!calendarId.trim()) {
      alert('캘린더 ID를 입력하세요')
      return
    }

    setLoading(true)
    setResult(null)
    setEvents([])

    try {
      const response = await fetch('/api/calendar/test-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarId: calendarId.trim() })
      })

      const data = await response.json()
      setResult(data)
      
      if (data.success && data.events) {
        setEvents(data.events)
      }
    } catch (error) {
      console.error('캘린더 접근 테스트 오류:', error)
      setResult({
        success: false,
        error: '테스트 중 오류가 발생했습니다.',
        calendarId,
        eventsAccess: false,
        eventCount: 0,
        events: [],
        accessTest: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const createTestEvent = async () => {
    if (!calendarId.trim()) {
      alert('캘린더 ID를 입력하세요')
      return
    }

    try {
      const now = new Date()
      const eventStart = new Date(now.getTime() + 60 * 60 * 1000) // 1시간 후
      const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000) // 2시간 후

      const eventData = {
        summary: '테스트 이벤트 - HR 시스템',
        description: '특정 캘린더 ID로 생성된 테스트 이벤트입니다.',
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

      const response = await fetch('/api/calendar/create-event-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: calendarId.trim(),
          eventData
        })
      })

      const result = await response.json()
      if (result.success) {
        alert('테스트 이벤트가 생성되었습니다!')
        // 이벤트 목록 새로고침
        testCalendarAccess()
      } else {
        alert('이벤트 생성 실패: ' + result.error)
      }
    } catch (error) {
      console.error('이벤트 생성 중 오류:', error)
      alert('이벤트 생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-gray-900">특정 캘린더 ID 접근 테스트</h3>
              <p className="text-sm text-gray-500">
                캘린더 ID로 직접 접근하여 정보를 확인합니다
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              캘린더 ID
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                placeholder="c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com"
              />
              <button
                onClick={testCalendarAccess}
                disabled={loading}
                className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? '테스트 중...' : '접근 테스트'}
              </button>
            </div>
          </div>

          {result && (
            <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {result.success ? (
                    <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? '캘린더 접근 성공' : '캘린더 접근 실패'}
                  </h3>
                  <div className={`mt-2 text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                    {result.success ? (
                      <div className="space-y-1">
                        <p><strong>캘린더 ID:</strong> {result.calendarId}</p>
                        {result.calendarInfo && (
                          <>
                            <p><strong>캘린더 이름:</strong> {result.calendarInfo.summary}</p>
                            <p><strong>시간대:</strong> {result.calendarInfo.timeZone}</p>
                            {result.calendarInfo.description && (
                              <p><strong>설명:</strong> {result.calendarInfo.description}</p>
                            )}
                          </>
                        )}
                        <p><strong>이벤트 접근:</strong> {result.eventsAccess ? '성공' : '실패'}</p>
                        <p><strong>이벤트 수:</strong> {result.eventCount}개</p>
                      </div>
                    ) : (
                      <div>
                        <p><strong>오류:</strong> {result.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {result?.success && (
            <div className="flex space-x-2">
              <button
                onClick={createTestEvent}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
              >
                테스트 이벤트 생성
              </button>
              <button
                onClick={testCalendarAccess}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                이벤트 목록 새로고침
              </button>
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-medium text-gray-900 mb-3">
                최근 이벤트 ({events.length}개)
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {events.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-gray-900">{event.summary}</h5>
                    <p className="text-xs text-gray-500">
                      {event.start?.dateTime ? new Date(event.start.dateTime).toLocaleString('ko-KR') : '시간 미정'} - {event.end?.dateTime ? new Date(event.end.dateTime).toLocaleString('ko-KR') : '시간 미정'}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-400">📍 {event.location}</p>
                    )}
                    {event.description && (
                      <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">캘린더 ID 접근 방법</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>캘린더 ID를 사용하여 특정 캘린더에 직접 접근</li>
                  <li>Service Account가 해당 캘린더에 공유 권한이 있어야 함</li>
                  <li>이벤트 읽기, 쓰기, 수정, 삭제 권한 필요</li>
                  <li>공유 권한: &quot;변경 및 공유 관리&quot; 또는 &quot;이벤트 세부정보 보기 및 수정&quot;</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { getCalendarsForFeature } from '@/lib/calendarMappings'

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

interface EventData {
  title: string
  description: string
  start: {
    date?: string
    dateTime?: string
    timeZone: string
  }
  end: {
    date?: string
    dateTime?: string
    timeZone: string
  }
  location: string
  attendees: { email: string }[]
}

interface CalendarEventCreatorProps {
  user?: User
  feature?: string
  onEventCreated?: (event: unknown) => void
}

export default function CalendarEventCreator({ 
  feature,
  onEventCreated 
}: CalendarEventCreatorProps) {
  const [calendars, setCalendars] = useState<CalendarConfig[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string>('')
  const [eventData, setEventData] = useState<EventData>({
    title: '',
    description: '',
    start: {
      dateTime: '',
      timeZone: 'Asia/Seoul'
    },
    end: {
      dateTime: '',
      timeZone: 'Asia/Seoul'
    },
    location: '',
    attendees: []
  })
  const [isAllDay, setIsAllDay] = useState(false)
  const [attendeeEmail, setAttendeeEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchCalendars()
  }, [feature]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCalendars = async () => {
    try {
      if (feature) {
        // 특정 기능에 연결된 캘린더만 가져오기
        const mappings = await getCalendarsForFeature(feature)
        const configs = mappings.map(mapping => 
          'calendar_config' in mapping ? mapping.calendar_config : mapping
        )
        setCalendars(configs)
        if (configs.length > 0) {
          setSelectedCalendar(configs[0].calendar_id)
        }
      } else {
        // 모든 활성 캘린더 가져오기
        const { data, error } = await supabase
          .from('calendar_configs')
          .select('*')
          .eq('is_active', true)
          .order('config_type', { ascending: true })

        if (error) {
          console.error('캘린더 목록 조회 실패:', error)
        } else {
          setCalendars(data || [])
          if (data && data.length > 0) {
            setSelectedCalendar(data[0].calendar_id)
          }
        }
      }
    } catch (error) {
      console.error('캘린더 목록 조회 오류:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const eventPayload = {
        ...eventData,
        start: isAllDay ? {
          date: eventData.start.dateTime?.split('T')[0],
          timeZone: eventData.start.timeZone
        } : eventData.start,
        end: isAllDay ? {
          date: eventData.end.dateTime?.split('T')[0],
          timeZone: eventData.end.timeZone
        } : eventData.end
      }

      const response = await fetch('/api/calendar/create-eventv2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calendarId: selectedCalendar,
          eventData: eventPayload
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('이벤트가 성공적으로 생성되었습니다!')
        resetForm()
        setShowForm(false)
        if (onEventCreated) {
          onEventCreated(data.event)
        }
      } else {
        alert(data.error || '이벤트 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('이벤트 생성 오류:', error)
      alert('이벤트 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEventData({
      title: '',
      description: '',
      start: {
        dateTime: '',
        timeZone: 'Asia/Seoul'
      },
      end: {
        dateTime: '',
        timeZone: 'Asia/Seoul'
      },
      location: '',
      attendees: []
    })
    setAttendeeEmail('')
    setIsAllDay(false)
  }

  const addAttendee = () => {
    if (attendeeEmail && !eventData.attendees.some(a => a.email === attendeeEmail)) {
      setEventData({
        ...eventData,
        attendees: [...eventData.attendees, { email: attendeeEmail }]
      })
      setAttendeeEmail('')
    }
  }

  const removeAttendee = (email: string) => {
    setEventData({
      ...eventData,
      attendees: eventData.attendees.filter(a => a.email !== email)
    })
  }

  const handleDateTimeChange = (field: 'start' | 'end', value: string) => {
    setEventData({
      ...eventData,
      [field]: {
        ...eventData[field],
        dateTime: value
      }
    })
  }

  if (calendars.length === 0) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <p className="text-gray-500">사용 가능한 캘린더가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">캘린더 이벤트 생성</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            {showForm ? '취소' : '이벤트 생성'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">캘린더</label>
              <select
                value={selectedCalendar}
                onChange={(e) => setSelectedCalendar(e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              >
                {calendars.map(calendar => (
                  <option key={calendar.id} value={calendar.calendar_id}>
                    {calendar.calendar_alias || calendar.target_name} ({calendar.config_type === 'team' ? '팀' : '기능'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">제목</label>
              <input
                type="text"
                value={eventData.title}
                onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">설명</label>
              <textarea
                rows={3}
                value={eventData.description}
                onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700">종일 이벤트</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">시작</label>
                <input
                  type={isAllDay ? 'date' : 'datetime-local'}
                  value={isAllDay ? eventData.start.dateTime?.split('T')[0] : eventData.start.dateTime}
                  onChange={(e) => handleDateTimeChange('start', isAllDay ? `${e.target.value}T00:00` : e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">종료</label>
                <input
                  type={isAllDay ? 'date' : 'datetime-local'}
                  value={isAllDay ? eventData.end.dateTime?.split('T')[0] : eventData.end.dateTime}
                  onChange={(e) => handleDateTimeChange('end', isAllDay ? `${e.target.value}T23:59` : e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">위치</label>
              <input
                type="text"
                value={eventData.location}
                onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">참석자</label>
              <div className="mt-1 flex space-x-2">
                <input
                  type="email"
                  value={attendeeEmail}
                  onChange={(e) => setAttendeeEmail(e.target.value)}
                  placeholder="이메일 주소"
                  className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={addAttendee}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  추가
                </button>
              </div>
              {eventData.attendees.length > 0 && (
                <div className="mt-2 space-y-1">
                  {eventData.attendees.map((attendee, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                      <span className="text-sm text-gray-700">{attendee.email}</span>
                      <button
                        type="button"
                        onClick={() => removeAttendee(attendee.email)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  resetForm()
                }}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? '생성 중...' : '이벤트 생성'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
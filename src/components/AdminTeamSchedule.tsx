'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { ADMIN_TEAM_CALENDARS, getCurrentYearRange } from '@/lib/calendarMapping'

interface Meeting {
  id: string
  created_by: string
  title: string
  meeting_type: 'external' | 'internal'
  date: string
  location?: string
  description?: string
  user?: {
    name: string
    department: string
  }
}

interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  location?: string
  calendarId?: string
  calendarName: string
  color?: string
}

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

interface AdminTeamScheduleProps {
  user: User
}

export default function AdminTeamSchedule({ user }: AdminTeamScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedMeetingType, setSelectedMeetingType] = useState<'external' | 'internal'>('external')
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [showCalendarEvents, setShowCalendarEvents] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    created_by: user.id, // 기본값은 관리자 자신
    targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || '' as string // 기본 캘린더 설정
  })

  const fetchCalendarConfigs = useCallback(async () => {
    try {
      // 직접 캘린더 매핑 설정 사용
      const configs = ADMIN_TEAM_CALENDARS.map(cal => ({
        id: cal.id,
        config_type: 'team' as const,
        target_name: 'admin-schedule',
        calendar_id: cal.id,
        calendar_alias: cal.name,
        is_active: true
      }))
      
      setCalendarConfigs(configs)
    } catch (error) {
      console.error('관리자 팀 일정 캘린더 설정 조회 오류:', error)
    }
  }, [])

  const fetchCalendarEvents = useCallback(async () => {
    if (!showCalendarEvents || calendarConfigs.length === 0) {
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      
      // 각 팀 캘린더에서 이벤트 가져오기
      for (const config of calendarConfigs) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarId: config.calendar_id,
              timeMin,
              timeMax,
              maxResults: 250
            }),
          })

          if (response.ok) {
            const data = await response.json()
            if (data.events) {
              const eventsWithCalendarInfo = data.events.map((event: CalendarEvent) => ({
                ...event,
                calendarName: config.calendar_alias,
                calendarId: config.calendar_id
              }))
              allEvents.push(...eventsWithCalendarInfo)
            }
          }
        } catch (error) {
          console.error(`캘린더 ${config.calendar_alias} 이벤트 조회 오류:`, error)
        }
      }

      // 현재 주의 이벤트만 필터링
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const weeklyEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start || '')
        return eventDate >= startOfWeek && eventDate <= endOfWeek
      })
      
      setCalendarEvents(weeklyEvents)
    } catch (error) {
      console.error('캘린더 이벤트 조회 오류:', error)
      setCalendarEvents([])
    } finally {
      setCalendarLoading(false)
    }
  }, [currentDate, showCalendarEvents, calendarConfigs])

  const fetchMeetings = useCallback(async () => {
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('meetings')
        .select(`
          *,
          user:users(name, department)
        `)
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (error) {
        console.error('Error fetching meetings:', error)
      } else {
        setMeetings(data || [])
      }
    } catch (error) {
      console.error('Error in fetchMeetings:', error)
    }
  }, [currentDate])

  useEffect(() => {
    fetchMeetings()
    fetchAllUsers()
    fetchCalendarConfigs()
  }, [fetchMeetings, fetchCalendarConfigs])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  const fetchAllUsers = async () => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, department, email, role, employee_id, position')
            .order('name', { ascending: true });
        if (error) throw error;
        setAllUsers((data as User[]) || []);
    } catch (error) {
        console.error('Failed to fetch users:', error);
    }
  }

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()) // 일요일부터 시작

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      days.push(day)
    }
    return days
  }

  const getMeetingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return meetings.filter(meeting => meeting.date === dateStr)
  }

  const getCalendarEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0]
      return eventDate === dateStr
    })
  }

  const getAllEventsForDate = (date: Date) => {
    const meetingsForDate = getMeetingsForDate(date)
    const events = getCalendarEventsForDate(date)
    
    return {
      meetings: meetingsForDate,
      calendarEvents: events,
      totalCount: meetingsForDate.length + events.length
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

  const goToThisWeek = () => {
    setCurrentDate(new Date())
  }

  const handleSubmitMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .insert([{
          meeting_type: selectedMeetingType,
          title: formData.title,
          date: formData.date,
          time: formData.time || '00:00',
          location: formData.location,
          description: formData.description,
          created_by: formData.created_by
        }])
        .select()
        .single()

      if (error) {
        console.error('미팅 등록 실패:', error)
        alert('미팅 등록에 실패했습니다.')
        return
      }

      // 선택된 캘린더에 이벤트 생성
      if (formData.targetCalendar) {
        try {
          const eventData = {
            summary: formData.title,
            description: formData.description,
            location: formData.location,
            start: {
              dateTime: `${formData.date}T${formData.time}:00`,
              timeZone: 'Asia/Seoul'
            },
            end: {
              dateTime: `${formData.date}T${formData.time}:00`,
              timeZone: 'Asia/Seoul'
            }
          }
          
          const response = await fetch('/api/calendar/create-event-direct', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarId: formData.targetCalendar,
              eventData
            })
          })

          const result = await response.json()
          if (result.success) {
            console.log('캘린더 이벤트 생성 성공:', result.event)
            
            // 미팅 레코드에 Google 이벤트 ID 저장
            await supabase
              .from('meetings')
              .update({ google_event_id: result.event.id })
              .eq('id', meetingData.id)
              
          } else {
            console.error('캘린더 이벤트 생성 실패:', result.error)
          }
        } catch (calendarError) {
          console.error('캘린더 이벤트 생성 오류:', calendarError)
        }
      }

      alert('일정이 성공적으로 등록되었습니다!')
      setShowAddForm(false)
      setFormData({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        created_by: user.id,
        targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || '' as string
      })
      fetchMeetings()
      fetchCalendarEvents()
    } catch (error) {
      console.error('일정 등록 오류:', error)
      alert('일정 등록 중 오류가 발생했습니다.')
    }
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const formatWeekRange = () => {
    const weekDays = getWeekDays()
    const startDate = weekDays[0]
    const endDate = weekDays[6]
    
    if (startDate.getMonth() === endDate.getMonth()) {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getDate()}일`
    } else {
      return `${startDate.getFullYear()}년 ${startDate.getMonth() + 1}월 ${startDate.getDate()}일 - ${endDate.getMonth() + 1}월 ${endDate.getDate()}일`
    }
  }

  const weekDays = getWeekDays()

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg col-span-full">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.196-2.121L16.5 14l-2.5-4.5L12 14l-2-4.5L8.5 14l-.304 1.879A3 3 0 003 18v2h5M9 10a3 3 0 11-6 0 3 3 0 016 0zm11 0a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">전체 팀 일정 관리</h3>
              <p className="text-sm text-gray-500">모든 팀의 일정을 확인하고 등록합니다.</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {calendarConfigs.length > 0 && (
              <button
                onClick={() => setShowCalendarEvents(!showCalendarEvents)}
                className={`px-3 py-1 text-sm rounded-md flex items-center space-x-1 ${
                  showCalendarEvents 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}
                disabled={calendarLoading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Google 캘린더</span>
                {calendarLoading && (
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>
            )}
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
            >
              일정 등록
            </button>
          </div>
        </div>

        
        <div className="mt-6 space-y-6 p-4">
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">전체 팀 일정 - {formatWeekRange()}</h4>
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigateWeek('prev')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={goToThisWeek}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                >
                  이번 주
                </button>
                <button 
                  onClick={() => navigateWeek('next')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                const day = weekDays[index]
                const dayMeetings = getMeetingsForDate(day)
                const dayEvents = getAllEventsForDate(day)
                const isTodayDay = isToday(day)
                const isWeekend = index === 0 || index === 6
                
                return (
                  <div key={index} className="flex flex-col">
                    <div className={`text-center py-2 text-sm font-medium ${
                      isTodayDay ? 'text-indigo-600' : isWeekend ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      <div>{dayName}</div>
                      <div className="h-8 flex items-center justify-center">
                        <div className={`text-lg ${isTodayDay ? 'bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                          {day.getDate()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                      {/* 팀 미팅 표시 */}
                      {dayMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-${idx}`}
                          className={`text-xs p-1 rounded truncate ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                              : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                          }`}
                          title={`${meeting.title} (${meeting.user?.department})`}
                        >
                          [{meeting.user?.department}] {meeting.title}
                        </div>
                      ))}
                      
                      {/* Google Calendar 이벤트 표시 */}
                      {showCalendarEvents && dayEvents.calendarEvents.map((event, idx) => (
                        <div 
                          key={`cal-${event.id}-${idx}`}
                          className="text-xs p-1 rounded truncate bg-green-100 text-green-800 border-l-2 border-green-500"
                          title={`${event.title} (${event.calendarName})`}
                        >
                          [{event.calendarName}] {event.title}
                        </div>
                      ))}
                      
                      {dayMeetings.length === 0 && (!showCalendarEvents || dayEvents.calendarEvents.length === 0) && (
                        <div className="text-xs text-gray-400 text-center pt-8">
                          일정 없음
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 미팅 추가 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">전체 팀 일정 등록</h3>
              
              <form onSubmit={handleSubmitMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">담당자 (팀)</label>
                  <select
                    value={formData.created_by}
                    onChange={(e) => setFormData({...formData, created_by: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">담당자를 선택하세요</option>
                    {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.department})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">일정 유형</label>
                  <select
                    value={selectedMeetingType}
                    onChange={(e) => setSelectedMeetingType(e.target.value as 'external' | 'internal')}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="external">외부 미팅/답사</option>
                    <option value="internal">내부 회의/면담</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">등록할 캘린더</label>
                  <select
                    value={formData.targetCalendar}
                    onChange={(e) => setFormData({...formData, targetCalendar: e.target.value as string})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">캘린더를 선택하세요</option>
                    {ADMIN_TEAM_CALENDARS.map(cal => (
                      <option key={cal.id} value={cal.id}>{cal.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="일정 제목을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">날짜</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">시간</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    장소 {selectedMeetingType === 'internal' && <span className="text-gray-500">(선택사항)</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder={selectedMeetingType === 'external' ? '미팅 장소를 입력하세요' : '회의실 또는 장소 (선택사항)'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅 내용을 입력하세요"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    등록
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

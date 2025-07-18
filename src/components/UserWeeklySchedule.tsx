'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { ADMIN_WEEKLY_CALENDARS, getCurrentYearRange } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'

interface Meeting {
  id: string
  created_by: string
  title: string
  meeting_type: 'external' | 'internal'
  date: string
  time?: string
  location?: string
  description?: string
  google_event_id?: string
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

interface UserWeeklyScheduleProps {
  user: User
}

export default function UserWeeklySchedule({ user }: UserWeeklyScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [selectedMeetingType, setSelectedMeetingType] = useState<'external' | 'internal'>('external')
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [showCalendarEvents, setShowCalendarEvents] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    created_by: user.id
  })

  const fetchCalendarEvents = useCallback(async () => {
    if (!showCalendarEvents) {
      setCalendarEvents([])
      return
    }

    setCalendarLoading(true)
    try {
      const allEvents: CalendarEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      
      // 외부 및 내부 미팅 캘린더에서 이벤트 가져오기
      for (const calendarConfig of ADMIN_WEEKLY_CALENDARS) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              calendarId: calendarConfig.id,
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
                calendarName: calendarConfig.name,
                calendarId: calendarConfig.id
              }))
              allEvents.push(...eventsWithCalendarInfo)
            }
          }
        } catch (error) {
          console.error(`캘린더 ${calendarConfig.name} 이벤트 조회 오류:`, error)
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
  }, [currentDate, showCalendarEvents])

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
  }, [fetchMeetings])

  useEffect(() => {
    fetchCalendarEvents()
  }, [fetchCalendarEvents])

  useEffect(() => {
    // 공휴일 캐시 초기화
    initializeHolidayCache()
  }, [])

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
      let meetingData
      let error
      
      if (editingMeeting) {
        // 수정 모드
        const { data, error: updateError } = await supabase
          .from('meetings')
          .update({
            meeting_type: selectedMeetingType,
            title: formData.title,
            date: formData.date,
            time: formData.time || '00:00',
            location: formData.location,
            description: formData.description
          })
          .eq('id', editingMeeting.id)
          .select()
          .single()
        
        meetingData = data
        error = updateError
      } else {
        // 새 등록 모드
        const { data, error: insertError } = await supabase
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
        
        meetingData = data
        error = insertError
      }

      if (error) {
        console.error(editingMeeting ? '미팅 수정 실패:' : '미팅 등록 실패:', error)
        alert(editingMeeting ? '미팅 수정에 실패했습니다.' : '미팅 등록에 실패했습니다.')
        return
      }

      // Google Calendar 동기화
      const targetCalendar = ADMIN_WEEKLY_CALENDARS.find(cal => cal.type === selectedMeetingType)
      
      if (targetCalendar) {
        try {
          if (editingMeeting && editingMeeting.google_event_id) {
            // 기존 Google 이벤트 업데이트 - 종료 시간 올바르게 설정
            let eventData;
            if (formData.time) {
              const startDateTime = new Date(`${formData.date}T${formData.time}:00`);
              const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
              eventData = {
                summary: formData.title,
                description: formData.description,
                location: formData.location,
                start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Seoul' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' }
              };
            } else {
              const endDate = new Date(new Date(formData.date).getTime() + 24 * 60 * 60 * 1000);
              eventData = {
                summary: formData.title,
                description: formData.description,
                location: formData.location,
                start: { date: formData.date, timeZone: 'Asia/Seoul' },
                end: { date: endDate.toISOString().split('T')[0], timeZone: 'Asia/Seoul' }
              };
            }
            
            const updateResponse = await fetch('/api/calendar/update-event', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendarId: targetCalendar.id,
                eventId: editingMeeting.google_event_id,
                eventData
              })
            })
            
            const updateResult = await updateResponse.json()
            if (!updateResult.success) {
              console.error('캘린더 이벤트 업데이트 실패:', updateResult.error)
            }
          } else {
            // 새 Google 이벤트 생성 - 종료 시간 올바르게 설정
            let eventData;
            if (formData.time) {
              const startDateTime = new Date(`${formData.date}T${formData.time}:00`);
              const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
              eventData = {
                summary: formData.title,
                description: formData.description,
                location: formData.location,
                start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Seoul' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' }
              };
            } else {
              const endDate = new Date(new Date(formData.date).getTime() + 24 * 60 * 60 * 1000);
              eventData = {
                summary: formData.title,
                description: formData.description,
                location: formData.location,
                start: { date: formData.date, timeZone: 'Asia/Seoul' },
                end: { date: endDate.toISOString().split('T')[0], timeZone: 'Asia/Seoul' }
              };
            }
            
            const response = await fetch('/api/calendar/create-event-direct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendarId: targetCalendar.id,
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
          }
        } catch (calendarError) {
          console.error('캘린더 동기화 오류:', calendarError)
        }
      }

      alert(editingMeeting ? '일정이 성공적으로 수정되었습니다!' : '일정이 성공적으로 등록되었습니다!')
      setShowAddForm(false)
      setShowEditForm(false)
      setEditingMeeting(null)
      setFormData({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        created_by: user.id
      })
      fetchMeetings()
      fetchCalendarEvents()
    } catch (error) {
      console.error(editingMeeting ? '일정 수정 오류:' : '일정 등록 오류:', error)
      alert(editingMeeting ? '일정 수정 중 오류가 발생했습니다.' : '일정 등록 중 오류가 발생했습니다.')
    }
  }

  const handleMeetingClick = (meeting: Meeting) => {
    const action = confirm(`"${meeting.title}" 일정을 어떻게 하시겠습니까?\n\n확인: 수정하기\n취소: 삭제하기`)
    
    if (action) {
      // 수정하기
      setEditingMeeting(meeting)
      setSelectedMeetingType(meeting.meeting_type)
      setFormData({
        title: meeting.title,
        date: meeting.date,
        time: meeting.time || '',
        location: meeting.location || '',
        description: meeting.description || '',
        created_by: meeting.created_by
      })
      setShowEditForm(true)
    } else {
      // 삭제하기
      handleDeleteMeeting(meeting)
    }
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!confirm(`"${meeting.title}" 일정을 정말 삭제하시겠습니까?`)) {
      return
    }

    try {
      // Google Calendar에서 이벤트 삭제
      if (meeting.google_event_id) {
        const targetCalendar = ADMIN_WEEKLY_CALENDARS.find(cal => cal.type === meeting.meeting_type)
        if (targetCalendar) {
          try {
            await fetch('/api/calendar/delete-event', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendarId: targetCalendar.id,
                eventId: meeting.google_event_id
              })
            })
          } catch (calendarError) {
            console.error('Google Calendar 이벤트 삭제 오류:', calendarError)
          }
        }
      }

      // DB에서 미팅 삭제
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id)

      if (error) {
        console.error('미팅 삭제 실패:', error)
        alert('일정 삭제에 실패했습니다.')
        return
      }

      alert('일정이 성공적으로 삭제되었습니다!')
      fetchMeetings()
      fetchCalendarEvents()
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
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
    <>
      <div className="mt-6 space-y-6 p-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">이번 주 일정 - {formatWeekRange()}</h4>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowCalendarEvents(!showCalendarEvents)}
                className={`px-2 py-1 text-xs rounded-md flex items-center space-x-1 ${
                  showCalendarEvents 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}
                disabled={calendarLoading}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Google</span>
                {calendarLoading && (
                  <div className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin"></div>
                )}
              </button>
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded text-xs"
              >
                일정 등록
              </button>
              <button 
                onClick={() => navigateWeek('prev')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        
        {/* 데스크탑 그리드뷰 */}
        <div className="hidden md:block">
          <div className="grid grid-cols-7 gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
              const day = weekDays[index]
              const dayMeetings = getMeetingsForDate(day)
              const dayEvents = getAllEventsForDate(day)
              const isTodayDay = isToday(day)
              const isWeekendDay = isWeekend(day)
              const holidayInfo = getHolidayInfoSync(day)
              
              return (
                <div key={index} className="flex flex-col">
                  <div className={`text-center py-2 text-sm font-medium ${
                    isTodayDay ? 'text-indigo-600' : (holidayInfo.isHoliday || isWeekendDay) ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    <div>{dayName}</div>
                    <div className="h-8 flex items-center justify-center">
                      <div className={`text-lg ${isTodayDay ? 'bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                    {/* 공휴일 표시 */}
                    {holidayInfo.isHoliday && (
                      <div className="text-xs text-red-600 mb-1 p-1 bg-red-50 rounded truncate text-center" title={holidayInfo.name}>
                        🎌 {holidayInfo.name}
                      </div>
                    )}
                    {/* 미팅 표시 */}
                    {dayMeetings.map((meeting, idx) => (
                      <div 
                        key={`meeting-${idx}`}
                        className={`text-xs p-1 rounded break-words cursor-pointer transition-colors hover:opacity-80 ${
                          meeting.meeting_type === 'external' 
                            ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                            : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                        }`}
                        title={`${meeting.title} (${meeting.user?.department}) - 클릭하여 수정/삭제`}
                        onClick={() => handleMeetingClick(meeting)}
                      >
                        <div className="font-medium">[{meeting.user?.department}]</div>
                        <div>{meeting.title}</div>
                        <div className="text-xs opacity-70 mt-1">✏️ 편집 가능</div>
                      </div>
                    ))}
                    
                    {/* Google Calendar 이벤트 표시 */}
                    {showCalendarEvents && dayEvents.calendarEvents.map((event, idx) => (
                      <div 
                        key={`cal-${event.id}-${idx}`}
                        className={`text-xs p-1 rounded break-words ${
                          event.calendarName.includes('외부') 
                            ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500'
                            : 'bg-purple-100 text-purple-800 border-l-2 border-purple-500'
                        }`}
                        title={`${event.title} (${event.calendarName})`}
                      >
                        <div className="font-medium">[{event.calendarName}]</div>
                        <div>{event.title}</div>
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

        {/* 모바일 리스트뷰 */}
        <div className="md:hidden space-y-2">
          {weekDays.map((day, index) => {
            const dayMeetings = getMeetingsForDate(day)
            const dayEvents = getAllEventsForDate(day)
            const isTodayDay = isToday(day)
            const isWeekendDay = isWeekend(day)
            const holidayInfo = getHolidayInfoSync(day)
            const dayName = ['일', '월', '화', '수', '목', '금', '토'][index]
            const totalEvents = dayMeetings.length + (showCalendarEvents ? dayEvents.calendarEvents.length : 0)
            
            if (totalEvents === 0) return null
            
            return (
              <div key={index} className="bg-white rounded-lg border p-3">
                <div className={`flex items-center justify-between mb-2 ${
                  isTodayDay ? 'text-indigo-600' : (holidayInfo.isHoliday || isWeekendDay) ? 'text-red-600' : 'text-gray-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    <div className={`text-sm font-medium ${isTodayDay ? 'bg-indigo-600 text-white px-2 py-1 rounded-full' : ''}`}>
                      {dayName}
                    </div>
                    <div className="text-lg font-medium">
                      {day.getDate()}일
                    </div>
                    {holidayInfo.isHoliday && (
                      <div className="text-xs text-red-600 bg-red-50 px-1 py-0.5 rounded" title={holidayInfo.name}>
                        {holidayInfo.name}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {totalEvents}개 일정
                  </div>
                </div>
                
                <div className="space-y-2">
                  {/* 미팅 표시 */}
                  {dayMeetings.map((meeting, idx) => (
                    <div 
                      key={`meeting-${idx}`}
                      className={`text-sm p-2 rounded break-words cursor-pointer transition-colors hover:opacity-80 ${
                        meeting.meeting_type === 'external' 
                          ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                          : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                      }`}
                      title={`${meeting.title} - 클릭하여 수정/삭제`}
                      onClick={() => handleMeetingClick(meeting)}
                    >
                      <div className="font-medium text-xs text-gray-600 mb-1">[{meeting.user?.department}]</div>
                      <div className="font-medium">{meeting.title}</div>
                      {meeting.location && (
                        <div className="text-xs text-gray-600 mt-1">📍 {meeting.location}</div>
                      )}
                      <div className="text-xs opacity-70 mt-1">✏️ 편집 가능</div>
                    </div>
                  ))}
                  
                  {/* Google Calendar 이벤트 표시 */}
                  {showCalendarEvents && dayEvents.calendarEvents.map((event, idx) => (
                    <div 
                      key={`cal-${event.id}-${idx}`}
                      className={`text-sm p-2 rounded break-words ${
                        event.calendarName.includes('외부') 
                          ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500'
                          : 'bg-purple-100 text-purple-800 border-l-2 border-purple-500'
                      }`}
                    >
                      <div className="font-medium text-xs text-gray-600 mb-1">[{event.calendarName}]</div>
                      <div className="font-medium">{event.title}</div>
                      {event.location && (
                        <div className="text-xs text-gray-600 mt-1">📍 {event.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          
          {weekDays.every(day => {
            const dayMeetings = getMeetingsForDate(day)
            const dayEvents = getAllEventsForDate(day)
            return dayMeetings.length === 0 && (!showCalendarEvents || dayEvents.calendarEvents.length === 0)
          }) && (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <div>이번 주에 등록된 일정이 없습니다</div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 미팅 추가/수정 모달 */}
    {(showAddForm || showEditForm) && (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium text-gray-900 mb-4">이번 주 일정 등록</h3>
            
            <form onSubmit={handleSubmitMeeting} className="space-y-4">
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
                  onClick={() => {
                    setShowAddForm(false)
                    setShowEditForm(false)
                    setEditingMeeting(null)
                    setFormData({
                      title: '',
                      date: '',
                      time: '',
                      location: '',
                      description: '',
                      created_by: user.id
                    })
                  }}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {editingMeeting ? '수정' : '등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
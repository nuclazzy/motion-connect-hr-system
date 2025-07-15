'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
// import { getGoogleCalendarOAuth } from '@/lib/googleCalendarOAuth'

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

// interface CalendarEvent {
//   id: string
//   title: string
//   start: string
//   end: string
//   description?: string
//   location?: string
//   calendarName: string
//   color?: string
// }

interface TeamScheduleProps {
  user: User
}

export default function TeamSchedule({ user }: TeamScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  // const [calendarEvents] = useState<CalendarEvent[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedMeetingType, setSelectedMeetingType] = useState<'external' | 'internal'>('external')
  // const [calendarLoading, setCalendarLoading] = useState(false)
  // const [showCalendarEvents, setShowCalendarEvents] = useState(true)
  // const [isGoogleAuthenticated] = useState(false)
  // const [availableCalendars] = useState<Record<string, unknown>[]>([])
  // const [selectedCalendarIds] = useState<string[]>([])
  // const [showCalendarSelector, setShowCalendarSelector] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: ''
  })

  // const googleCalendar = getGoogleCalendarOAuth()

  const fetchMeetings = async () => {
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
    } finally {
      // setLoading(false) - 로딩 상태 제거
    }
  }

  // Google Calendar 이벤트 가져오기 (OAuth 방식)
  // const fetchCalendarEvents = async () => {
  //   if (!showCalendarEvents || !isGoogleAuthenticated || selectedCalendarIds.length === 0) {
  //     setCalendarEvents([])
  //     return
  //   }
  //   
  //   setCalendarLoading(true)
  //   try {
  //     const events = await googleCalendar.getThisWeekEvents(selectedCalendarIds)
  //     
  //     // 캘린더 이름 설정
  //     const eventsWithNames = events.map(event => ({
  //       ...event,
  //       calendarName: (availableCalendars.find(cal => cal.id === event.calendarId)?.summary as string) || 'Unknown Calendar'
  //     }))
  //     
  //     setCalendarEvents(eventsWithNames)
  //   } catch (error) {
  //     console.error('캘린더 이벤트 조회 오류:', error)
  //     setCalendarEvents([])
  //   } finally {
  //     setCalendarLoading(false)
  //   }
  // }

  // Google 인증 상태 변경 핸들러
  // const handleGoogleAuthChange = (isAuthenticated: boolean) => {
  //   setIsGoogleAuthenticated(isAuthenticated)
  //   
  //   if (!isAuthenticated) {
  //     setCalendarEvents([])
  //     setAvailableCalendars([])
  //     setSelectedCalendarIds([])
  //   }
  // }

  // 캘린더 목록 로드 핸들러
  // const handleCalendarsLoad = (calendars: Record<string, unknown>[]) => {
  //   setAvailableCalendars(calendars)
    
    // 기본적으로 primary 캘린더 선택
  //   const primaryCalendar = calendars.find(cal => cal.primary)
  //   if (primaryCalendar && primaryCalendar.id) {
  //     setSelectedCalendarIds([primaryCalendar.id as string])
  //   }
  // }

  // 캘린더 선택 변경
  // const handleCalendarSelection = (calendarId: string, checked: boolean) => {
  //   if (checked) {
  //     setSelectedCalendarIds(prev => [...prev, calendarId])
  //   } else {
  //     setSelectedCalendarIds(prev => prev.filter(id => id !== calendarId))
  //   }
  // }

  useEffect(() => {
    fetchMeetings()
  }, [currentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // useEffect(() => {
  //   fetchCalendarEvents()
  // }, [currentDate, showCalendarEvents, isGoogleAuthenticated, selectedCalendarIds]) // eslint-disable-line react-hooks/exhaustive-deps

  const getWeekDays = () => {
    const today = new Date()
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay()) // 일요일부터 시작

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

  // const getCalendarEventsForDate = (date: Date) => {
  //   const dateStr = date.toISOString().split('T')[0]
  //   return calendarEvents.filter(event => {
  //     const eventDate = new Date(event.start).toISOString().split('T')[0]
  //     return eventDate === dateStr
  //   })
  // }

  // const getAllEventsForDate = (date: Date) => {
  //   const meetings = getMeetingsForDate(date)
  //   const events = getCalendarEventsForDate(date)
  //   
  //   return {
  //     meetings,
  //     calendarEvents: events,
  //     totalCount: meetings.length + events.length
  //   }
  // }

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
      const { error } = await supabase
        .from('meetings')
        .insert([{
          meeting_type: selectedMeetingType,
          title: formData.title,
          date: formData.date,
          time: formData.time || '00:00',
          location: formData.location,
          description: formData.description,
          created_by: user.id
        }])
        .select()

      if (error) {
        console.error('미팅 등록 실패:', error)
        alert('미팅 등록에 실패했습니다.')
      } else {
        alert('미팅이 성공적으로 등록되었습니다!')
        setShowAddForm(false)
        setFormData({
          title: '',
          date: '',
          time: '',
          location: '',
          description: ''
        })
        fetchMeetings() // 목록 새로고침
      }
    } catch (error) {
      console.error('미팅 등록 오류:', error)
      alert('미팅 등록 중 오류가 발생했습니다.')
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

  // const getThisWeekMeetings = () => {
  //   const today = new Date()
  //   const startOfWeek = new Date(today)
  //   startOfWeek.setDate(today.getDate() - today.getDay())
  //   const endOfWeek = new Date(startOfWeek)
  //   endOfWeek.setDate(startOfWeek.getDate() + 6)
  //
  //   return meetings.filter(meeting => {
  //     const meetingDate = new Date(meeting.date)
  //     return meetingDate >= startOfWeek && meetingDate <= endOfWeek
  //   })
  // }

  // const groupMeetingsByDepartment = (meetings: Meeting[]) => {
  //   return meetings.reduce((acc, meeting) => {
  //     const dept = meeting.user?.department || '미분류'
  //     if (!acc[dept]) acc[dept] = []
  //     acc[dept].push(meeting)
  //     return acc
  //   }, {} as Record<string, Meeting[]>)
  // }

  const weekDays = getWeekDays()
  // const thisWeekMeetings = getThisWeekMeetings()
  // const groupedMeetings = groupMeetingsByDepartment(thisWeekMeetings)

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
              <h3 className="text-lg font-medium text-gray-900">팀 일정</h3>
              <p className="text-sm text-gray-500">{user.department} 및 다른 팀 일정</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
            >
              팀 일정 추가
            </button>
          </div>
        </div>

        
        <div className="mt-6 space-y-6">
          {/* 내 팀 일정 */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-blue-900">내 팀 일정 ({user.department}) - {formatWeekRange()}</h4>
              <div className="flex space-x-2">
                <button 
                  onClick={() => navigateWeek('prev')}
                  className="text-blue-400 hover:text-blue-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={goToThisWeek}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs"
                >
                  이번 주
                </button>
                <button 
                  onClick={() => navigateWeek('next')}
                  className="text-blue-400 hover:text-blue-600"
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
                const dayMeetings = getMeetingsForDate(day).filter(meeting => meeting.user?.department === user.department)
                const isTodayDay = isToday(day)
                const isWeekend = index === 0 || index === 6
                
                return (
                  <div key={index} className="flex flex-col">
                    <div className={`text-center py-2 text-sm font-medium ${
                      isTodayDay ? 'text-blue-600' : isWeekend ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      <div>{dayName}</div>
                      <div className="h-8 flex items-center justify-center">
                        <div className={`text-lg ${isTodayDay ? 'bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center' : ''}`}>
                          {day.getDate()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="min-h-[120px] bg-white rounded border p-2 space-y-1">
                      {/* 내 팀 미팅 표시 */}
                      {dayMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-${idx}`}
                          className={`text-xs p-1 rounded truncate ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                              : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                          }`}
                          title={meeting.title}
                        >
                          {meeting.title}
                        </div>
                      ))}
                      
                      {dayMeetings.length === 0 && (
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

          {/* 다른 팀 일정 */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-gray-900">다른 팀 일정 - {formatWeekRange()}</h4>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                const day = weekDays[index]
                const otherTeamMeetings = getMeetingsForDate(day).filter(meeting => meeting.user?.department !== user.department)
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
                    
                    <div className="min-h-[120px] bg-white rounded border p-2 space-y-1">
                      {/* 다른 팀 미팅 표시 */}
                      {otherTeamMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-${idx}`}
                          className={`text-xs p-1 rounded truncate ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-orange-100 text-orange-800 border-l-2 border-orange-500' 
                              : 'bg-green-100 text-green-800 border-l-2 border-green-500'
                          }`}
                          title={`${meeting.title} (${meeting.user?.department})`}
                        >
                          {meeting.user?.department}: {meeting.title}
                        </div>
                      ))}
                      
                      {otherTeamMeetings.length === 0 && (
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
              <h3 className="text-lg font-medium text-gray-900 mb-4">팀 일정 추가</h3>
              
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
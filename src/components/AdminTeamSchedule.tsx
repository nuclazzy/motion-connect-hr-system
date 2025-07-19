'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { ADMIN_TEAM_CALENDARS, getCurrentYearRange } from '@/lib/calendarMapping'
import { getHolidayInfoSync, isWeekend, initializeHolidayCache } from '@/lib/holidays'

interface Meeting {
  id: string
  created_by: string
  title: string
  meeting_type: 'external' | 'internal'
  date: string
  location?: string
  description?: string
  google_event_id?: string
  user?: {
    name: string
    department: string
  }
}

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

interface AdminTeamScheduleProps {
  user: User
}

interface FormData {
  title: string
  date: string
  time: string
  location: string
  description: string
  created_by: string
  targetCalendar: string
}

export default function AdminTeamSchedule({ user }: AdminTeamScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    created_by: user.id,
    targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || ''
  })

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

  const syncAndFetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const allGoogleEvents: GoogleEvent[] = []
      const { timeMin, timeMax } = getCurrentYearRange()
      
      // 각 팀 캘린더에서 이벤트 가져오기
      for (const calendarConfig of ADMIN_TEAM_CALENDARS) {
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
            if (data.events && data.events.length > 0) {
              allGoogleEvents.push(...data.events)
            }
          }
        } catch (error) {
          console.error(`캘린더 ${calendarConfig.name} 이벤트 조회 오류:`, error)
        }
      }

      // Google Calendar 이벤트를 우리 DB와 동기화
      if (allGoogleEvents.length > 0) {
        try {
          const syncResponse = await fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              events: allGoogleEvents, 
              userId: user.id 
            })
          })

          const syncResult = await syncResponse.json()
          if (syncResult.success && syncResult.synced > 0) {
            console.log(`${syncResult.synced}개 이벤트가 동기화되었습니다.`)
          }
        } catch (error) {
          console.error('캘린더 동기화 오류:', error)
        }
      }

      // 동기화 완료 후 meetings 테이블에서 모든 일정 조회 (단일 진실 공급원)
      await fetchMeetings()
    } catch (error) {
      console.error('캘린더 동기화 및 미팅 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }, [user.id, fetchMeetings])

  const handleEditMeeting = (meeting: Meeting) => {
    // Meeting 수정 핸들러
    setFormData({
      title: meeting.title,
      date: meeting.date,
      time: '00:00', // 기본 시간 설정
      location: meeting.location || '',
      description: meeting.description || '',
      created_by: meeting.created_by,
      targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || ''
    })
    setShowAddForm(true)
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!confirm(`"${meeting.title}" 일정을 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 시스템 DB에서 삭제
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id)

      if (error) {
        console.error('미팅 삭제 실패:', error)
        alert('일정 삭제에 실패했습니다.')
        return
      }

      alert('일정이 삭제되었습니다.')
      syncAndFetchMeetings() // 미팅 목록 새로고침
    } catch (error) {
      console.error('일정 삭제 오류:', error)
      alert('일정 삭제 중 오류가 발생했습니다.')
    }
  }

  useEffect(() => {
    syncAndFetchMeetings()
    fetchAllUsers()
  }, [syncAndFetchMeetings])

  useEffect(() => {
    // 공휴일 캐시 초기화
    initializeHolidayCache()
  }, [])

  const fetchAllUsers = async () => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, department, email, role, employee_id, position')
            .order('employee_id', { ascending: true });
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
          meeting_type: 'external',
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
          let eventData;
          if (formData.time) {
            // 시간이 있으면, 시간 지정 이벤트 생성 (1시간 지속)
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
            // 시간이 없으면, 종일 이벤트 생성
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
        targetCalendar: ADMIN_TEAM_CALENDARS[0]?.id || ''
      })
      syncAndFetchMeetings()
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
            <button
              onClick={syncAndFetchMeetings}
              className="px-3 py-1 text-sm rounded-md flex items-center space-x-1 bg-blue-100 text-blue-800"
              disabled={loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>동기화</span>
              {loading && (
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
              )}
            </button>
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
            
            {/* 데스크톱 그리드뷰 */}
            <div className="hidden md:grid grid-cols-7 gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((dayName, index) => {
                const day = weekDays[index]
                const dayMeetings = getMeetingsForDate(day)
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
                      {/* 팀 미팅 표시 */}
                      {dayMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-${idx}`}
                          className={`text-xs p-1 rounded break-words cursor-pointer hover:opacity-80 relative group ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                              : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                          }`}
                          title={`${meeting.title} (${meeting.user?.department}) - 클릭하여 수정/삭제`}
                          onClick={() => handleEditMeeting(meeting)}
                        >
                          <div className="font-medium">[{meeting.user?.department}]</div>
                          <div>{meeting.title}</div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteMeeting(meeting)
                            }}
                            className="absolute top-0 right-0 text-red-600 hover:text-red-800 text-xs opacity-0 group-hover:opacity-100 bg-white rounded-full w-4 h-4 flex items-center justify-center"
                            title="삭제"
                          >
                            ×
                          </button>
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

            {/* 모바일 리스트뷰 */}
            <div className="md:hidden space-y-2 mt-4">
              {weekDays.map((day, index) => {
                const dayMeetings = getMeetingsForDate(day)
                const isTodayDay = isToday(day)
                const isWeekendDay = isWeekend(day)
                const holidayInfo = getHolidayInfoSync(day)
                const dayName = ['일', '월', '화', '수', '목', '금', '토'][index]
                const totalEvents = dayMeetings.length
                
                if (totalEvents === 0 && !holidayInfo.isHoliday) return null
                
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
                            🎌 {holidayInfo.name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {totalEvents}개 일정
                      </div>
                    </div>
                    
                    {totalEvents > 0 && (
                      <div className="space-y-2">
                        {/* 팀 미팅 표시 */}
                        {dayMeetings.map((meeting, idx) => (
                          <div 
                            key={`meeting-${idx}`}
                            className={`text-sm p-2 rounded break-words cursor-pointer hover:opacity-80 ${
                              meeting.meeting_type === 'external' 
                                ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                                : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                            }`}
                            title={`${meeting.title} (${meeting.user?.department}) - 클릭하여 수정/삭제`}
                            onClick={() => handleEditMeeting(meeting)}
                          >
                            <div className="font-medium text-xs text-gray-600 mb-1">[{meeting.user?.department}]</div>
                            <div className="font-medium">{meeting.title}</div>
                            {meeting.location && (
                              <div className="text-xs text-gray-600 mt-1">📍 {meeting.location}</div>
                            )}
                            <div className="flex justify-end mt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteMeeting(meeting)
                                }}
                                className="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-white rounded"
                                title="삭제"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        ))}
                        
                      </div>
                    )}
                  </div>
                )
              })}
              
              {weekDays.every(day => {
                const dayMeetings = getMeetingsForDate(day)
                const holidayInfo = getHolidayInfoSync(day)
                return dayMeetings.length === 0 && !holidayInfo.isHoliday
              }) && (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-2">📅</div>
                  <div>이번 주에 등록된 팀 일정이 없습니다</div>
                </div>
              )}
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
                  <label className="block text-sm font-medium text-gray-700">등록할 캘린더</label>
                  <select
                    value={formData.targetCalendar}
                    onChange={(e) => setFormData({...formData, targetCalendar: e.target.value})}
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
                    장소
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅 장소를 입력하세요"
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
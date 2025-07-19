'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'
import { getDepartmentCalendars, CALENDAR_NAMES, getCurrentYearRange } from '@/lib/calendarMapping'

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

interface CalendarConfig {
  id: string
  config_type: 'team' | 'function'
  target_name: string
  calendar_id: string
  calendar_alias: string | null
  is_active: boolean
}

interface TeamScheduleProps {
  user: User
}

export default function TeamSchedule({ user }: TeamScheduleProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [calendarConfigs, setCalendarConfigs] = useState<CalendarConfig[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    targetCalendar: ''
  })

  const fetchCalendarConfigs = async () => {
    try {
      // 부서별 캘린더 매핑 사용
      const departmentCalendars = getDepartmentCalendars(user.department)
      const allCalendars = [...departmentCalendars.own, ...departmentCalendars.others]
      
      const configs = allCalendars.map(calendarId => ({
        id: calendarId,
        config_type: 'team' as const,
        target_name: user.department,
        calendar_id: calendarId,
        calendar_alias: (CALENDAR_NAMES as Record<string, string>)[calendarId] || calendarId,
        is_active: true
      }))
      
      setCalendarConfigs(configs)
    } catch (error) {
      console.error('캘린더 설정 조회 오류:', error)
    }
  }

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
    }
  }

  const syncAndFetchMeetings = async () => {
    if (calendarConfigs.length === 0) {
      await fetchMeetings(); // DB 미팅만 가져오기
      return;
    }

    setCalendarLoading(true);
    try {
      const allGoogleEvents: unknown[] = [];
      const { timeMin, timeMax } = getCurrentYearRange();

      // 1. Google Calendar에서 이벤트 가져오기
      for (const config of calendarConfigs) {
        try {
          const response = await fetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarId: config.calendar_id,
              timeMin,
              timeMax,
              maxResults: 250,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.events) allGoogleEvents.push(...data.events);
          }
        } catch (error) {
          console.error(`캘린더 ${config.calendar_alias} 이벤트 조회 오류:`, error);
        }
      }

      // 2. 가져온 이벤트를 우리 DB와 동기화
      if (allGoogleEvents.length > 0) {
        await fetch('/api/calendar/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: allGoogleEvents, userId: user.id }),
        });
      }

      // 3. 동기화 후, DB에서 모든 미팅을 다시 조회 (이것이 단일 진실 공급원)
      await fetchMeetings();
    } catch (error) {
      console.error('캘린더 동기화 및 조회 오류:', error);
      await fetchMeetings(); // 에러 발생 시에도 DB 데이터는 보여주기
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarConfigs()
  }, [user.department]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    syncAndFetchMeetings()
  }, [currentDate, calendarConfigs, user.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (editingMeeting) {
        // 미팅 수정
        const { error } = await supabase
          .from('meetings')
          .update({
            title: formData.title,
            date: formData.date,
            time: formData.time || '00:00',
            location: formData.location,
            description: formData.description
          })
          .eq('id', editingMeeting.id)

        if (error) {
          console.error('미팅 수정 실패:', error)
          alert('미팅 수정에 실패했습니다.')
          return
        }
        alert('일정이 성공적으로 수정되었습니다!')
      } else {
        // 새 미팅 등록
        const { data: meetingData, error } = await supabase
          .from('meetings')
          .insert([{
            meeting_type: 'external',
            title: formData.title,
            date: formData.date,
            time: formData.time || '00:00',
            location: formData.location,
            description: formData.description,
            created_by: user.id
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
      }

      setShowAddForm(false)
      setShowEditForm(false)
      setEditingMeeting(null)
      setFormData({
        title: '',
        date: '',
        time: '',
        location: '',
        description: '',
        targetCalendar: ''
      })
      syncAndFetchMeetings() // 동기화 및 새로고침
    } catch (error) {
      console.error(editingMeeting ? '미팅 수정 오류:' : '미팅 등록 오류:', error)
      alert(editingMeeting ? '미팅 수정 중 오류가 발생했습니다.' : '미팅 등록 중 오류가 발생했습니다.')
    }
  }

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting)
    setFormData({
      title: meeting.title,
      date: meeting.date,
      time: meeting.time || '',
      location: meeting.location || '',
      description: meeting.description || '',
      targetCalendar: ''
    })
    setShowEditForm(true)
  }

  const handleDeleteMeeting = async (meeting: Meeting) => {
    if (!confirm(`"${meeting.title}" 일정을 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 1. 시스템 DB에서 삭제
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meeting.id)

      if (error) {
        console.error('미팅 삭제 실패:', error)
        alert('일정 삭제에 실패했습니다.')
        return
      }

      // 2. Google Calendar에서도 삭제 (google_event_id가 있는 경우)
      if (meeting.google_event_id) {
        const departmentCalendars = getDepartmentCalendars(user.department)
        const primaryCalendarId = departmentCalendars.own[0] || departmentCalendars.others[0]
        
        if (primaryCalendarId) {
          try {
            await fetch('/api/calendar/delete-event', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                eventId: meeting.google_event_id,
                calendarId: primaryCalendarId
              })
            })
          } catch (calendarError) {
            console.warn('Google Calendar 삭제 오류 (시스템에서는 삭제됨):', calendarError)
          }
        }
      }

      alert('일정이 성공적으로 삭제되었습니다!')
      syncAndFetchMeetings() // 동기화 및 새로고침
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
    <div className="bg-white overflow-hidden shadow rounded-lg col-span-full">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">팀 일정 관리</h3>
              <p className="text-sm text-gray-500">내 팀과 전체 팀의 일정을 확인합니다.</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={syncAndFetchMeetings}
              className="px-3 py-1 text-sm rounded-md flex items-center space-x-1 bg-blue-100 text-blue-800"
              disabled={calendarLoading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>동기화</span>
              {calendarLoading && (
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
                    
                    <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                      {dayMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-${idx}`}
                          className={`text-xs p-1 rounded break-words cursor-pointer hover:opacity-80 ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                              : 'bg-blue-100 text-blue-800 border-l-2 border-blue-500'
                          }`}
                          onClick={() => handleEditMeeting(meeting)}
                          title="클릭하여 수정/삭제"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{meeting.title}</div>
                              {meeting.time && <div className="text-xs">{meeting.time}</div>}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteMeeting(meeting)
                              }}
                              className="text-red-600 hover:text-red-800 ml-1"
                              title="삭제"
                            >
                              ×
                            </button>
                          </div>
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
            <h4 className="text-sm font-medium text-gray-900 mb-4">다른 팀 일정 - {formatWeekRange()}</h4>
            
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
                    
                    <div className="min-h-[140px] bg-white rounded border p-2 space-y-1">
                      {otherTeamMeetings.map((meeting, idx) => (
                        <div 
                          key={`meeting-other-${idx}`}
                          className={`text-xs p-1 rounded break-words ${
                            meeting.meeting_type === 'external' 
                              ? 'bg-red-100 text-red-800 border-l-2 border-red-500' 
                              : 'bg-gray-100 text-gray-800 border-l-2 border-gray-500'
                          }`}
                          title={`${meeting.title} (${meeting.user?.department})`}
                        >
                          <div className="font-medium">[{meeting.user?.department}]</div>
                          <div>{meeting.title}</div>
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
              <h3 className="text-lg font-medium text-gray-900 mb-4">새 일정 등록</h3>
              
              <form onSubmit={handleSubmitMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">등록할 캘린더</label>
                  <select
                    value={formData.targetCalendar}
                    onChange={(e) => setFormData({...formData, targetCalendar: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">캘린더를 선택하세요 (선택사항)</option>
                    {getDepartmentCalendars(user.department).own.map(calendarId => (
                      <option key={calendarId} value={calendarId}>
                        {(CALENDAR_NAMES as Record<string, string>)[calendarId] || calendarId}
                      </option>
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
                  <label className="block text-sm font-medium text-gray-700">장소</label>
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

      {/* 미팅 수정 모달 */}
      {showEditForm && editingMeeting && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">일정 수정</h3>
              
              <form onSubmit={handleSubmitMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">제목</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                  <label className="block text-sm font-medium text-gray-700">장소</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false)
                      setEditingMeeting(null)
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    수정
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
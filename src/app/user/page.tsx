'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, saveUserSession, type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import UserProfile from '@/components/UserProfile'
import LeaveManagement from '@/components/LeaveManagement'
import TeamSchedule from '@/components/TeamSchedule'
import DocumentLibrary from '@/components/DocumentLibrary'
import UserFormManagement from '@/components/UserFormManagement'
import InternalMeeting from '@/components/InternalMeeting'
import FieldTrip from '@/components/FieldTrip'
import { ADMIN_WEEKLY_CALENDARS } from '@/lib/calendarMapping'

interface ReviewLink {
  id: string
  user_id: string
  employee_name: string
  review_url: string
  season: string
  is_active: boolean
}

export default function UserDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPromotionTarget, setIsPromotionTarget] = useState(false)
  const [reviewLink, setReviewLink] = useState<ReviewLink | null>(null)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [meetingFormData, setMeetingFormData] = useState({
    type: 'external',
    title: '',
    date: '',
    time: '',
    location: '',
    description: ''
  })
  const router = useRouter()

  useEffect(() => {
    const checkAuthAndPromotion = async () => {
      const currentUser = await getCurrentUser()
      
      if (!currentUser) {
        router.push('/auth/login')
        return
      }

      setUser(currentUser)
      setLoading(false)

      // 연차 촉진 대상자인지 확인
      try {
        const response = await fetch(`/api/user/leave-promotion-status?userId=${currentUser.id}`)
        if (response.ok) {
          const data = await response.json()
          setIsPromotionTarget(data.isTarget)
        }
      } catch (error) {
        console.error("Failed to check promotion status:", error)
      }

      // 개별 리뷰 링크 가져오기
      try {
        const { data: reviewData } = await supabase
          .from('review_links')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_active', true)
          .single()
        
        if (reviewData) {
          setReviewLink(reviewData)
        }
      } catch (error) {
        console.error("Failed to fetch review link:", error)
      }
    }

    checkAuthAndPromotion()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Motion Connect</h1>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // 현재 월이 1월 또는 7월인지 확인 (반기 리뷰)
  const currentMonth = new Date().getMonth() + 1
  const isReviewSeason = currentMonth === 1 || currentMonth === 7

  // 팀장인지 확인
  const isTeamLeader = user.position.includes('팀장') || user.position.includes('대표')

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser)
    saveUserSession(updatedUser)
  }

  const openFormModal = (formType: string, formUrl: string) => {
    // Google Apps Script 웹앱은 iframe 제한이 있을 수 있으므로 새 창에서 열기
    const popup = window.open(formUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (!popup) {
      alert('팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제해주세요.')
    }
  }

  const handleFormComplete = async (formType: string) => {
    if (confirm(`${formType} 서식을 작성하고 제출하셨나요?\n\n작성 완료 후 서식을 인쇄하여 대표에게 제출해주세요.`)) {
      try {
        const { error } = await supabase
          .from('form_requests')
          .insert([{
            user_id: user.id,
            form_type: formType,
            status: 'pending',
            submitted_at: new Date().toISOString(),
            request_data: {
              form_name: formType,
              submitted_via: 'web_form'
            }
          }])

        if (error) {
          console.error('서식 신청 저장 실패:', error)
          alert('❌ 신청 저장에 실패했습니다. 다시 시도해주세요.')
        } else {
          alert(`✅ 신청이 완료되었습니다!\n\n📄 작성한 서식을 인쇄하여 대표에게 제출해주세요.\n관리자가 확인 후 최종 승인 처리됩니다.`)
        }
      } catch (error) {
        console.error('서식 신청 오류:', error)
        alert('❌ 신청 처리 중 오류가 발생했습니다.')
      }
    }
  }

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // 1. Supabase에 미팅 기록 저장
      const { data: meetingData, error } = await supabase
        .from('meetings')
        .insert([{
          meeting_type: meetingFormData.type,
          title: meetingFormData.title,
          date: meetingFormData.date,
          time: meetingFormData.time || '00:00',
          location: meetingFormData.location,
          description: meetingFormData.description,
          created_by: user.id
        }])
        .select()
        .single()

      if (error) {
        console.error('미팅 등록 실패:', error)
        alert('미팅 등록에 실패했습니다.')
        return
      }

      // 2. Google Calendar 동기화
      if (confirm('Google Calendar에도 이 일정을 추가하시겠습니까?')) {
        try {
          // 미팅 타입에 따라 캘린더 선택
          const targetCalendar = ADMIN_WEEKLY_CALENDARS.find(cal => 
            cal.type === meetingFormData.type
          )
          
          if (targetCalendar) {
            const eventData = {
              summary: meetingFormData.title,
              description: meetingFormData.description || `${user.name}님이 등록한 ${meetingFormData.type === 'external' ? '외부 미팅/답사' : '내부 회의/면담'}`,
              location: meetingFormData.location,
              start: {
                dateTime: `${meetingFormData.date}T${meetingFormData.time || '00:00'}:00`,
                timeZone: 'Asia/Seoul'
              },
              end: {
                dateTime: `${meetingFormData.date}T${meetingFormData.time || '00:00'}:00`,
                timeZone: 'Asia/Seoul'
              }
            }
            
            const response = await fetch('/api/calendar/create-event-direct', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                calendarId: targetCalendar.id,
                eventData
              }),
            })

            const result = await response.json()
            if (result.success) {
              // 미팅 레코드에 Google 이벤트 ID 저장
              await supabase
                .from('meetings')
                .update({ google_event_id: result.event.id })
                .eq('id', meetingData.id)
              
              alert('미팅이 성공적으로 등록되고 Google Calendar에도 추가되었습니다!')
            } else {
              console.error('캘린더 이벤트 생성 실패:', result.error)
              alert('미팅은 등록되었지만 Google Calendar 동기화에 실패했습니다.')
            }
          }
        } catch (calError) {
          console.error('Google Calendar 동기화 오류:', calError)
          alert('미팅은 등록되었지만 Google Calendar 동기화에 실패했습니다.')
        }
      } else {
        alert('미팅이 성공적으로 등록되었습니다!')
      }

      // 폼 초기화 및 모달 닫기
      setMeetingFormData({
        type: 'external',
        title: '',
        date: '',
        time: '',
        location: '',
        description: ''
      })
      setShowMeetingForm(false)
      
    } catch (error) {
      console.error('미팅 등록 오류:', error)
      alert('미팅 등록 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Motion Connect
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.name} ({user.department} {user.position})
              </span>
              <button
                onClick={logoutUser}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* 연차 촉진 알림 배너 */}
          {isPromotionTarget && (
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
              <p className="font-bold">📢 연차 사용 촉진 안내</p>
              <p>잔여 연차가 5일 이상 남았습니다. 연차 소멸 전 모두 사용하시기 바랍니다.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 내 정보 위젯 */}
            <UserProfile user={user} onProfileUpdate={handleProfileUpdate} />

            {/* 근태 관리 위젯 */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        근태 관리
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        출퇴근 기록
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    캡스로 출퇴근 체크를 하지 못한 경우 이용해주세요!
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3 space-y-2">
                <div className="text-sm">
                  <a 
                    href="https://script.google.com/a/macros/motionsense.co.kr/s/AKfycbwBcCpDZZ3J5vxHswCXWgkrDJTcfLVCJPNcMSom7_K-pL9X6uXAvf-kZmE5ea-WyBD5Lw/exec"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-500 block"
                  >
                    출퇴근 기록하기
                  </a>
                </div>
                <div className="text-sm">
                  <a 
                    href="https://script.google.com/a/macros/motionsense.co.kr/s/AKfycbwBcCpDZZ3J5vxHswCXWgkrDJTcfLVCJPNcMSom7_K-pL9X6uXAvf-kZmE5ea-WyBD5Lw/exec?page=worktime"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-500 block"
                  >
                    근무시간 조회하기
                  </a>
                </div>
              </div>
            </div>

            {/* 반기 리뷰 위젯 (시즌별 표시) */}
            {isReviewSeason && reviewLink && (
              <div className="bg-orange-50 overflow-hidden shadow rounded-lg border border-orange-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-orange-600 truncate">
                          반기 리뷰
                        </dt>
                        <dd className="text-lg font-medium text-orange-900">
                          {currentMonth === 1 ? '상반기' : '하반기'} 리뷰 시즌
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-100 px-5 py-3">
                  <div className="text-sm">
                    <a 
                      href={reviewLink.review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-orange-600 hover:text-orange-500"
                    >
                      반기 리뷰 시작하기
                    </a>
                  </div>
                </div>
              </div>
            )}
            
            {/* 반기 리뷰 위젯 (리뷰 링크가 없는 경우) */}
            {isReviewSeason && !reviewLink && (
              <div className="bg-gray-50 overflow-hidden shadow rounded-lg border border-gray-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-600 truncate">
                          반기 리뷰
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {currentMonth === 1 ? '상반기' : '하반기'} 리뷰 시즌
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-100 px-5 py-3">
                  <div className="text-sm text-gray-600">
                    개별 리뷰 링크가 아직 설정되지 않았습니다. 관리자에게 문의해주세요.
                  </div>
                </div>
              </div>
            )}

            {/* 팀장 전용 위젯 */}
            {isTeamLeader && (
              <div className="bg-blue-50 overflow-hidden shadow rounded-lg border border-blue-200">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-blue-600 truncate">
                          견적서 작성
                        </dt>
                        <dd className="text-lg font-medium text-blue-900">
                          팀장 전용 기능
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-100 px-5 py-3">
                  <div className="text-sm">
                    <a 
                      href="https://docs.google.com/spreadsheets/d/1e1zat5fyex_TysI_1cHcFLmRtWeK7DWsYa3AcQ9a2H8/edit"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      견적서 작성하기
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* 이번주 미팅 및 답사일정 */}
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
                      <h3 className="text-lg font-medium text-gray-900">이번주 미팅 및 답사일정</h3>
                      <p className="text-sm text-gray-500">외부 미팅 및 내부 회의 관리</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowMeetingForm(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
                    >
                      일정 등록
                    </button>
                  </div>
                </div>

                <div className="mt-6 space-y-6 p-4">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="space-y-2">
                      <FieldTrip user={user} />
                      <InternalMeeting user={user} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 팀 일정 위젯 */}
            <TeamSchedule user={user} />

            {/* 서식 신청 위젯 */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        서식 신청
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        각종 서식 신청 및 출력
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    웹앱에서 서식을 작성한 후 출력하여 관리자에게 제출하세요
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3 space-y-2">
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => openFormModal('휴직계', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=leave')}
                      className="font-medium text-blue-600 hover:text-blue-500 text-left flex-1"
                    >
                      🏥 휴직계
                    </button>
                    <button 
                      onClick={() => handleFormComplete('휴직계')}
                      className="ml-2 bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-medium"
                    >
                      신청 완료
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => openFormModal('재직증명서', 'http://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=certificate')}
                      className="font-medium text-indigo-600 hover:text-indigo-500 text-left flex-1"
                    >
                      📄 재직증명서
                    </button>
                    <button 
                      onClick={() => handleFormComplete('재직증명서')}
                      className="ml-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 px-2 py-1 rounded text-xs font-medium"
                    >
                      신청 완료
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => openFormModal('경위서', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=report')}
                      className="font-medium text-purple-600 hover:text-purple-500 text-left flex-1"
                    >
                      📋 경위서
                    </button>
                    <button 
                      onClick={() => handleFormComplete('경위서')}
                      className="ml-2 bg-purple-100 hover:bg-purple-200 text-purple-800 px-2 py-1 rounded text-xs font-medium"
                    >
                      신청 완료
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => openFormModal('출산휴가 및 육아휴직 신청서', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=maternity')}
                      className="font-medium text-green-600 hover:text-green-500 text-left flex-1"
                    >
                      👶 출산휴가 및 육아휴직
                    </button>
                    <button 
                      onClick={() => handleFormComplete('출산휴가 및 육아휴직 신청서')}
                      className="ml-2 bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded text-xs font-medium"
                    >
                      신청 완료
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 자료실 위젯 */}
            <DocumentLibrary />

          </div>

          {/* 휴가 관리 - 전체 너비 사용 */}
          <div className="mt-8">
            <LeaveManagement user={user} />
          </div>

          {/* 서식 신청 내역 관리 */}
          <div className="mt-8">
            <UserFormManagement user={user} />
          </div>
        </div>
      </main>

      {/* 미팅 등록 모달 */}
      {showMeetingForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">미팅/답사 일정 등록</h3>
              
              <form onSubmit={handleMeetingSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">일정 유형</label>
                  <select
                    value={meetingFormData.type}
                    onChange={(e) => setMeetingFormData({...meetingFormData, type: e.target.value})}
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
                    value={meetingFormData.title}
                    onChange={(e) => setMeetingFormData({...meetingFormData, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅/답사 제목을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">날짜</label>
                  <input
                    type="date"
                    value={meetingFormData.date}
                    onChange={(e) => setMeetingFormData({...meetingFormData, date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">시간 (선택사항)</label>
                  <input
                    type="time"
                    value={meetingFormData.time}
                    onChange={(e) => setMeetingFormData({...meetingFormData, time: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    장소 {meetingFormData.type === 'internal' && <span className="text-gray-500">(선택사항)</span>}
                  </label>
                  <input
                    type="text"
                    value={meetingFormData.location}
                    onChange={(e) => setMeetingFormData({...meetingFormData, location: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder={meetingFormData.type === 'external' ? '미팅 장소를 입력하세요' : '회의실 또는 장소 (선택사항)'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">설명 (선택사항)</label>
                  <textarea
                    rows={3}
                    value={meetingFormData.description}
                    onChange={(e) => setMeetingFormData({...meetingFormData, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="미팅 내용이나 추가 정보를 입력하세요"
                  />
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-md p-3">
                  <p className="text-sm text-indigo-700">
                    ℹ️ 등록된 일정은 팀 전체가 볼 수 있습니다.
                  </p>
                  <p className="text-xs text-indigo-600 mt-1">
                    Google Calendar 동기화를 선택하면 해당 캘린더에도 일정이 추가됩니다.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeetingForm(false)
                      setMeetingFormData({
                        type: 'external',
                        title: '',
                        date: '',
                        time: '',
                        location: '',
                        description: ''
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
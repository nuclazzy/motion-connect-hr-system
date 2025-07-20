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
import UserWeeklySchedule from '@/components/UserWeeklySchedule'

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
  const [showPromotionDetails, setShowPromotionDetails] = useState(false)
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

      // 개별 리뷰 링크 가져오기 (선택적 기능)
      try {
        const { data: reviewData, error: reviewError } = await supabase
          .from('review_links')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('is_active', true)
          .single()
        
        if (!reviewError && reviewData) {
          setReviewLink(reviewData)
        } else if (reviewError && reviewError.code !== 'PGRST116') {
          // PGRST116은 "no rows returned" 오류로, 정상적인 경우
          // 다른 오류는 테이블이 존재하지 않거나 권한 문제일 수 있음
          console.log("Review links feature not available:", reviewError.message)
        }
      } catch (error) {
        console.log("Review links feature not available:", error)
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

  const handleLeaveApplication = () => {
    // 휴가 신청서 웹앱 URL (예시)
    const leaveFormUrl = 'https://forms.google.com/your-leave-form-url'
    window.open(leaveFormUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-lg font-medium text-red-800">
                    📢 연차 사용 촉진 안내
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p className="font-semibold">잔여 연차가 5일 이상 남았습니다.</p>
                    <p className="mt-1">
                      <span className="font-medium text-red-900">연차 촉진 시즌에 할당된 연차를 모두 사용하지 않으면 자동 소멸됩니다.</span>
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={handleLeaveApplication}
                      className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      지금 연차 신청하기
                    </button>
                    <button
                      onClick={() => setShowPromotionDetails(true)}
                      className="bg-white border border-red-300 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      상세 안내 보기
                    </button>
                  </div>
                </div>
              </div>
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

          {/* 이번주 미팅 및 답사일정 - 전체 너비 사용 */}
          <div className="mt-8">
            <UserWeeklySchedule />
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

      {/* 연차 촉진 상세 안내 모달 */}
      {showPromotionDetails && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 18.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  연차 촉진 관련 법적 안내
                </h3>
                <button
                  onClick={() => setShowPromotionDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <h4 className="font-semibold text-red-800 mb-2">⚠️ 중요 안내</h4>
                  <p className="text-red-700 text-sm">
                    연차 촉진 시즌에 할당된 연차를 모두 사용하지 않으면 <strong>자동 소멸</strong>됩니다.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">📋 법적 근거</h4>
                  <div className="space-y-3 text-sm text-gray-700">
                    <div>
                      <h5 className="font-medium text-gray-800">근로기준법 제61조 (연차유급휴가의 사용촉진)</h5>
                      <p className="mt-1">
                        ① 사용자는 제60조제1항에 따른 연차유급휴가를 근로자가 사용하지 아니하여 소멸될 우려가 있는 경우에는 
                        그 사용을 촉진하여야 한다.
                      </p>
                    </div>
                    
                    <div>
                      <h5 className="font-medium text-gray-800">근로기준법 시행령 제30조 (연차유급휴가 사용촉진)</h5>
                      <p className="mt-1">
                        ① 사용자는 매년 하반기에 해당 연도에 발생한 연차유급휴가 중 사용하지 않은 휴가일수가 
                        11일 이상인 근로자에 대하여 다음 각 호의 사항을 서면으로 통지하여야 한다.
                      </p>
                      <ul className="mt-2 ml-4 list-disc space-y-1">
                        <li>미사용 연차유급휴가 일수</li>
                        <li>연차유급휴가 사용을 촉진한다는 뜻</li>
                        <li>이를 사용하지 않으면 소멸된다는 뜻</li>
                      </ul>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded p-3">
                      <h5 className="font-medium text-blue-800">📅 촉진 기간</h5>
                      <p className="text-blue-700 mt-1">
                        매년 <strong>10월 1일부터 12월 31일</strong>까지가 연차 사용 촉진 기간입니다.
                        이 기간에 사용하지 않은 연차는 다음 해 1월 1일에 자동 소멸됩니다.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <h4 className="font-semibold text-green-800 mb-2">💡 권장사항</h4>
                  <ul className="text-green-700 text-sm space-y-1">
                    <li>• 미사용 연차는 가급적 12월 31일 이전에 모두 사용하시기 바랍니다.</li>
                    <li>• 연차 사용 계획을 미리 세워서 업무에 차질이 없도록 조정하세요.</li>
                    <li>• 연차 신청은 최소 3일 전에 미리 신청해주세요.</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowPromotionDetails(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPromotionDetails(false)
                    handleLeaveApplication()
                  }}
                  className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700"
                >
                  연차 신청하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
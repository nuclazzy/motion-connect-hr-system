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

            {/* 주간 미팅/답사 일정 위젯 */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        주간 미팅/답사 일정
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        이번 주 일정
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">외부 미팅/답사</p>
                    <p className="text-xs text-gray-500">이번 주에는 예정된 외부 미팅/답사 일정이 없습니다.</p>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium">내부 회의/면담</p>
                    <p className="text-xs text-gray-500">이번 주에는 예정된 내부 회의/면담 일정이 없습니다.</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3 space-y-2">
                <div className="text-sm">
                  <a 
                    href="https://script.google.com/a/motionsense.co.kr/s/AKfycbyoQOklsqQnQHSs2TFv5sjhsRtN3QrOV5h1T5gQXnK94j7S26H8qTb1qGCJHqJZlYv5/exec"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-500 block"
                  >
                    외부 미팅/답사 등록
                  </a>
                </div>
                <div className="text-sm">
                  <a 
                    href="https://script.google.com/a/motionsense.co.kr/s/AKfycbzpRJZMSwPqXTdxBuklrsGwSV4dRLKkyCaMLZR6sRZLEq4kSJFSFe1s0aJZD0U9IVLe/exec"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-indigo-600 hover:text-indigo-500 block"
                  >
                    내부 회의/면담 등록
                  </a>
                </div>
              </div>
            </div>

            {/* 팀 일정 위젯 */}
            <TeamSchedule user={user} />

            {/* 휴가 관리 위젯 */}
            <LeaveManagement user={user} />

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

          {/* 서식 신청 내역 관리 */}
          <div className="mt-8">
            <UserFormManagement user={user} />
          </div>
        </div>
        </div>
      </main>

    </div>
  )
}
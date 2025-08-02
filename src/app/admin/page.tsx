'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, checkPermission, type User } from '@/lib/auth'
import AdminEmployeeManagement from '@/components/AdminEmployeeManagement'
import AdminDocumentManagement from '@/components/AdminDocumentManagement'
import AdminFormManagement from '@/components/AdminFormManagement'
import UserFormManagement from '@/components/UserFormManagement'
import UserProfile from '@/components/UserProfile'
import AdminTeamSchedule from '@/components/AdminTeamSchedule'
import UserWeeklySchedule from '@/components/UserWeeklySchedule'
import AdminLeaveManagement from '@/components/AdminLeaveManagement'
import FormApplicationModal from '@/components/FormApplicationModal'
import { useSupabase } from '@/components/SupabaseProvider'

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null)
  const [defaultFormValues, setDefaultFormValues] = useState<Record<string, string> | null>(null)
  const router = useRouter()
  const { supabase } = useSupabase()

  useEffect(() => {    
    // 쿠키 기반 세션에서 사용자 정보 확인
    const fetchUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        console.log('👤 현재 사용자:', currentUser)
        
        if (currentUser) {
          if (checkPermission(currentUser, 'admin')) {
            setUser(currentUser)
            setLoading(false)
            return
          } else {
            console.error('❌ 관리자 권한 없음')
            router.push('/user')
            return
          }
        } else {
          console.log('❌ 사용자 세션 없음')
          router.replace('/auth/login')
        }
      } catch (error) {
        console.error('사용자 정보 확인 오류:', error)
        router.replace('/auth/login')
      }
      setLoading(false)
    }

    fetchUser()
  }, [router, supabase])

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser)
  }

  const handleOpenFormModal = (formType: string | null, defaultValues: Record<string, string> = {}) => {
    setIsFormModalOpen(true)
    setSelectedFormType(formType)
    setDefaultFormValues(defaultValues)
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Motion Connect - 통합 대시보드
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.name} ({user.position})
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
          {/* 섹션 1: 개인 업무 */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">개인 업무</h2>
            <div className="flex flex-col gap-6">
              <UserProfile user={user} onProfileUpdate={handleProfileUpdate} />
              {/* 요청에 따라 '미팅/답사 일정'을 '팀 일정' 위로 배치 */}
              <UserWeeklySchedule />
              <AdminTeamSchedule user={user} />
              
              {/* 서식 신청 컴포넌트 */}
              <UserFormManagement
                user={user}
                onApplyClick={() => handleOpenFormModal(null)}
              />
            </div>
          </div>

          {/* 섹션 2: 관리자 기능 */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">관리자 기능</h2>
            <div className="space-y-6">
                <AdminEmployeeManagement />
                <AdminLeaveManagement />
                <AdminFormManagement />
                <AdminDocumentManagement />
            </div>
          </div>
        </div>
      </main>

      {/* 통합 서식 신청 모달 */}
      {user && (
        <FormApplicationModal
          user={user}
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false)
            setSelectedFormType(null)
            setDefaultFormValues(null)
          }}
          onSuccess={() => {
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          }}
          defaultFormType={selectedFormType}
          defaultValues={defaultFormValues}
        />
      )}
    </div>
  )
}
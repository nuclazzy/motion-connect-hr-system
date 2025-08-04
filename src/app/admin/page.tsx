'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, checkPermission, type User } from '@/lib/auth'
import AdminEmployeeManagement from '@/components/AdminEmployeeManagement'
import AdminDocumentManagement from '@/components/AdminDocumentManagement'
import AdminFormManagement from '@/components/AdminFormManagement'
import AdminSalaryManagement from '@/components/AdminSalaryManagement'
import AdminDetailedSalaryManagement from '@/components/AdminDetailedSalaryManagement'
import UserFormManagement from '@/components/UserFormManagement'
import UserProfile from '@/components/UserProfile'
import AdminTeamSchedule from '@/components/AdminTeamSchedule'
import UserWeeklySchedule from '@/components/UserWeeklySchedule'
import AdminLeaveManagement from '@/components/AdminLeaveManagement'
import FormApplicationModal from '@/components/FormApplicationModal'
import DashboardAttendanceWidget from '@/components/DashboardAttendanceWidget'
import { useSupabase } from '@/components/SupabaseProvider'
import { User as UserIcon, Shield } from 'lucide-react'

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [selectedFormType, setSelectedFormType] = useState<string | null>(null)
  const [defaultFormValues, setDefaultFormValues] = useState<Record<string, string> | null>(null)
  const [viewMode, setViewMode] = useState<'employee' | 'admin'>('employee')
  const router = useRouter()
  const { supabase } = useSupabase()

  // Load saved view mode from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('admin-view-mode') as 'employee' | 'admin'
    if (savedMode) {
      setViewMode(savedMode)
    }
  }, [])

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('admin-view-mode', viewMode)
  }, [viewMode])

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
                Motion Connect - {viewMode === 'employee' ? '직원 대시보드' : '관리자 대시보드'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {/* Role Toggle Switch */}
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-700">모드 전환:</span>
                <div className="relative inline-flex items-center">
                  <button
                    onClick={() => setViewMode(viewMode === 'employee' ? 'admin' : 'employee')}
                    className={`relative inline-flex items-center h-8 rounded-full w-16 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      viewMode === 'admin' ? 'bg-indigo-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform duration-200 ${
                        viewMode === 'admin' ? 'translate-x-9' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div className="ml-3 flex items-center space-x-2">
                    <UserIcon className={`w-4 h-4 ${viewMode === 'employee' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <Shield className={`w-4 h-4 ${viewMode === 'admin' ? 'text-indigo-600' : 'text-gray-400'}`} />
                  </div>
                </div>
                <span className={`text-sm font-medium ${
                  viewMode === 'employee' ? 'text-blue-600' : 'text-indigo-600'
                }`}>
                  {viewMode === 'employee' ? '직원 모드' : '관리자 모드'}
                </span>
              </div>
              
              <div className="border-l border-gray-300 h-6"></div>
              
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
          {viewMode === 'employee' ? (
            /* 직원 모드 */
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-blue-200">
                  개인 업무 관리
                </h2>
                <div className="flex flex-col gap-6">
                  <UserProfile user={user} onProfileUpdate={handleProfileUpdate} />
                  
                  {/* 출퇴근 관리 위젯 */}
                  <DashboardAttendanceWidget user={user} />
                  
                  {/* 일정 관리 */}
                  <UserWeeklySchedule />
                  
                  {/* 팀 일정 관리 */}
                  <AdminTeamSchedule user={user} />
                  
                  {/* 서식 신청 컴포넌트 */}
                  <UserFormManagement
                    user={user}
                    onApplyClick={() => handleOpenFormModal(null)}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* 관리자 모드 */
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-indigo-200">
                  관리자 기능
                </h2>
                <div className="space-y-6">
                  <AdminEmployeeManagement />
                  <AdminFormManagement />
                  <AdminLeaveManagement />
                  <AdminDocumentManagement />
                </div>
              </div>
            </div>
          )}
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
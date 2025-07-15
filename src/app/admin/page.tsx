'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, logoutUser, checkPermission, type User, saveUserSession } from '@/lib/auth'
import AdminEmployeeManagement from '@/components/AdminEmployeeManagement'
import AdminLeaveManagement from '@/components/AdminLeaveManagement'
import AdminDocumentManagement from '@/components/AdminDocumentManagement'
import AdminFormManagement from '@/components/AdminFormManagement'
import CalendarSettings from '@/components/CalendarSettings'
import UserProfile from '@/components/UserProfile'
import LeaveManagement from '@/components/LeaveManagement'
import AdminTeamSchedule from '@/components/AdminTeamSchedule'
import DocumentLibrary from '@/components/DocumentLibrary'

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      
      if (!currentUser) {
        router.push('/auth/login')
        return
      }

      if (!checkPermission(currentUser, 'admin')) {
        router.push('/user') // 관리자 권한이 없으면 사용자 대시보드로
        return
      }

      setUser(currentUser)
      setLoading(false)
    }

    checkAuth()
  }, [router])

  const handleProfileUpdate = (updatedUser: User) => {
    setUser(updatedUser)
    saveUserSession(updatedUser)
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <UserProfile user={user} onProfileUpdate={handleProfileUpdate} />
                <LeaveManagement user={user} />
                <DocumentLibrary />
                <AdminTeamSchedule user={user} />
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
                <CalendarSettings />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
'use client'

import DebugAttendance from '@/components/DebugAttendance'

export default function DebugAttendancePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                출퇴근 데이터 디버그 (개발용)
              </h1>
            </div>
            <div className="flex items-center">
              <a
                href="/admin"
                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                관리자 대시보드로 돌아가기
              </a>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <DebugAttendance />
      </main>
    </div>
  )
}
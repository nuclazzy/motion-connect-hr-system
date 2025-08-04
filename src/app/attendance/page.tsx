'use client'

import { useState } from 'react'
import AttendanceRecorder from '@/components/AttendanceRecorder'
import AttendanceDashboard from '@/components/AttendanceDashboard'
import { Clock, BarChart3 } from 'lucide-react'

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'recorder' | 'dashboard'>('recorder')

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            출퇴근 관리 시스템
          </h1>
          <p className="text-gray-600">
            간편하게 출퇴근을 기록하고 근무시간을 확인하세요
          </p>
        </div>

        {/* 탭 메뉴 */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('recorder')}
              className={`flex items-center px-6 py-3 rounded-md font-medium transition-colors ${
                activeTab === 'recorder'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="h-5 w-5 mr-2" />
              출퇴근 기록
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center px-6 py-3 rounded-md font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="h-5 w-5 mr-2" />
              근무시간 현황
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="flex justify-center">
          {activeTab === 'recorder' ? (
            <AttendanceRecorder />
          ) : (
            <AttendanceDashboard />
          )}
        </div>
      </div>
    </div>
  )
}
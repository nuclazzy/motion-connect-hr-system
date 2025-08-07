'use client'

import { useState } from 'react'
import AttendanceRecorder from '@/components/AttendanceRecorder'
import AttendanceDashboard from '@/components/AttendanceDashboard'
import { Clock, BarChart3 } from 'lucide-react'

export default function AttendancePage() {
  const [activeTab, setActiveTab] = useState<'recorder' | 'dashboard'>('recorder')

  return (
    <div className="min-h-screen bg-gray-50 py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 - 모바일 최적화 */}
        <div className="text-center mb-6 md:mb-8">
          <div className="flex items-center justify-between mb-4">
            <a 
              href="/user" 
              className="flex items-center text-blue-600 hover:text-blue-700 text-sm md:text-base"
            >
              ← 대시보드로 돌아가기
            </a>
            <div className="text-xs text-gray-500 md:hidden">
              Motion Connect HR
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            출퇴근 관리 시스템
          </h1>
          <p className="text-gray-600 text-sm md:text-base">
            간편하게 출퇴근을 기록하고 근무시간을 확인하세요
          </p>
          
          {/* 간단한 사용법 안내 */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
            <h3 className="text-sm font-medium text-blue-800 mb-2">💡 사용 안내</h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• <strong>출근 기록</strong>: 업무 시작 시 출근 버튼을 눌러주세요</li>
              <li>• <strong>퇴근 기록</strong>: 업무 종료 시 퇴근 버튼을 눌러주세요</li>
              <li>• <strong>저녁식사</strong>: 8시간 이상 근무 시 저녁식사 여부를 체크해주세요</li>
              <li>• <strong>근무현황</strong>: 탭을 전환하여 월별 근무시간을 확인할 수 있습니다</li>
            </ul>
          </div>
        </div>

        {/* 탭 메뉴 - 모바일 최적화 */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border w-full max-w-md md:max-w-none md:w-auto">
            <button
              onClick={() => setActiveTab('recorder')}
              className={`flex items-center justify-center px-4 md:px-6 py-3 rounded-md font-medium transition-colors w-1/2 md:w-auto ${
                activeTab === 'recorder'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
              <span className="text-sm md:text-base">출퇴근 기록</span>
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center justify-center px-4 md:px-6 py-3 rounded-md font-medium transition-colors w-1/2 md:w-auto ${
                activeTab === 'dashboard'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="h-4 md:h-5 w-4 md:w-5 mr-1 md:mr-2" />
              <span className="text-sm md:text-base">근무시간 현황</span>
            </button>
          </div>
        </div>

        {/* 컨텐츠 - 모바일 반응형 */}
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            {activeTab === 'recorder' ? (
              <AttendanceRecorder />
            ) : (
              <AttendanceDashboard />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
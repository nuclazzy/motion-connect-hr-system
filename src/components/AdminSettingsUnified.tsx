'use client'

import { useState } from 'react'
import { Settings, Shield, Cog, Info } from 'lucide-react'

// 기존 컴포넌트들 임포트
import AdminSystemSettings from './AdminSystemSettings'
import WorkPolicyManagement from './WorkPolicyManagement'
import AdminNotificationSettings from './AdminNotificationSettings'

interface TabInfo {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  component: React.ReactNode
}

export default function AdminSettingsUnified() {
  const [activeTab, setActiveTab] = useState('basic')

  const tabs: TabInfo[] = [
    {
      id: 'basic',
      name: '기본 설정',
      icon: <Settings className="h-5 w-5" />,
      description: '근무시간, 수당 비율 등 시스템 기본 설정값',
      component: <AdminSystemSettings />
    },
    {
      id: 'policies',
      name: '정책 관리', 
      icon: <Shield className="h-5 w-5" />,
      description: '탄력근무제, 대체휴가 등 복잡한 정책 규칙',
      component: <WorkPolicyManagement />
    },
    {
      id: 'notifications',
      name: '알림 설정',
      icon: <Cog className="h-5 w-5" />,
      description: '이메일 알림 및 관리자 통보 설정',
      component: <AdminNotificationSettings />
    }
  ]

  const currentTab = tabs.find(tab => tab.id === activeTab)

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* 헤더 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
              <Settings className="h-6 w-6 text-blue-600 mr-3" />
              시스템 설정 관리
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              시스템 전반의 설정과 정책을 통합 관리합니다
            </p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center space-x-2 py-4 px-6 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
                cursor-pointer
              `}
            >
              {tab.icon}
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* 현재 탭 설명 */}
      {currentTab && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center text-sm text-gray-600">
            <Info className="h-4 w-4 mr-2" />
            {currentTab.description}
          </div>
        </div>
      )}

      {/* 탭 내용 */}
      <div className="min-h-[600px]">
        {currentTab?.component}
      </div>

      {/* 도움말 섹션 */}
      <div className="p-6 border-t border-gray-200 bg-blue-50">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <h4 className="font-medium text-blue-800 mb-1">설정 구분 안내</h4>
            <div className="text-blue-700 space-y-1">
              <p><strong>기본 설정:</strong> 전체 시스템에 적용되는 기본값 (시간, 배율 등)</p>
              <p><strong>정책 관리:</strong> 특정 기간이나 조건에서 적용되는 정책 규칙</p>
              <p><strong>우선순위:</strong> 정책 관리의 규칙이 기본 설정보다 우선 적용됩니다</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// 고급 설정 플레이스홀더 컴포넌트
function AdvancedSettingsPlaceholder() {
  return (
    <div className="p-12 text-center">
      <Cog className="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-800 mb-2">고급 설정</h3>
      <p className="text-gray-600 mb-6">
        알림 설정, 캘린더 연동, 시스템 통합 등의 고급 기능이<br />
        향후 이곳에 추가될 예정입니다.
      </p>
      <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
        <h4 className="font-medium text-gray-800 mb-2">향후 추가 예정 기능:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 이메일 알림 설정</li>
          <li>• 승인 요청 알림 규칙</li>
          <li>• 연차 촉진 알림 관리</li>
          <li>• Google Calendar 동기화 설정</li>
          <li>• 공휴일 API 연동 관리</li>
          <li>• 시스템 백업 및 복구</li>
        </ul>
      </div>
    </div>
  )
}
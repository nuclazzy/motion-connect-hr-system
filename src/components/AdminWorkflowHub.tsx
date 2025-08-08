'use client'

import { useState } from 'react'
import { 
  Users, 
  Calendar, 
  FileText, 
  Settings,
  Clock,
  DollarSign,
  TrendingUp,
  Bell,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

// 기존 컴포넌트들 임포트
import AdminEmployeeManagement from './AdminEmployeeManagement'
import AdminLeaveOverview from './AdminLeaveOverview'
import AdminFormManagement from './AdminFormManagement'
import AdminPayrollManagement from './AdminPayrollManagement'
import WorkScheduleManagement from './WorkScheduleManagement'

interface WorkflowTab {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  component: React.ReactNode
  category: 'management' | 'approval' | 'analytics' | 'settings'
  priority: number
  notifications?: number
}

export default function AdminWorkflowHub() {
  const [activeTab, setActiveTab] = useState('leave-overview')

  // 통합 탭 구성
  const tabs: WorkflowTab[] = [
    // 핵심 관리 영역 (상단)
    {
      id: 'leave-overview',
      name: '휴가 관리',
      icon: <Calendar className="h-5 w-5" />,
      description: '휴가 신청 승인, 잔여량 관리, 캘린더 연동',
      component: <AdminLeaveOverview />,
      category: 'approval',
      priority: 1,
      notifications: 3 // 대기 중인 휴가 신청
    },
    {
      id: 'forms',
      name: '서식 관리',
      icon: <FileText className="h-5 w-5" />,
      description: '재직증명서, 휴직계, 경위서 등 비휴가 서식 처리',
      component: <AdminFormManagement />,
      category: 'approval',
      priority: 3,
      notifications: 1 // 대기 중인 서식 신청
    },
    
    // 직원 관리 (중단)
    {
      id: 'employees',
      name: '직원 관리',
      icon: <Users className="h-5 w-5" />,
      description: '직원 정보, 입퇴사 처리, 급여 정보 관리',
      component: <AdminEmployeeManagement />,
      category: 'management',
      priority: 4
    },
    {
      id: 'payroll',
      name: '급여 관리',
      icon: <DollarSign className="h-5 w-5" />,
      description: '월별 급여 계산, 초과근무 수당, 급여명세서',
      component: <AdminPayrollManagement />,
      category: 'analytics',
      priority: 5
    },
    
    // 설정 (하단)
    {
      id: 'settings',
      name: '시스템 설정',
      icon: <Settings className="h-5 w-5" />,
      description: '근무 정책, 알림 설정, 시스템 구성 관리',
      component: <WorkScheduleManagement />,
      category: 'settings',
      priority: 6
    }
  ]

  // 카테고리별 그룹핑
  const categorizedTabs = {
    approval: tabs.filter(tab => tab.category === 'approval').sort((a, b) => a.priority - b.priority),
    management: tabs.filter(tab => tab.category === 'management').sort((a, b) => a.priority - b.priority),
    analytics: tabs.filter(tab => tab.category === 'analytics').sort((a, b) => a.priority - b.priority),
    settings: tabs.filter(tab => tab.category === 'settings').sort((a, b) => a.priority - b.priority)
  }

  const currentTab = tabs.find(tab => tab.id === activeTab)
  const totalNotifications = tabs.reduce((sum, tab) => sum + (tab.notifications || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-800 flex items-center">
                <TrendingUp className="h-6 w-6 text-blue-600 mr-3" />
                관리자 대시보드
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                통합 HR 관리 시스템 - 모든 업무를 한 곳에서
              </p>
            </div>
            {totalNotifications > 0 && (
              <div className="flex items-center bg-red-100 text-red-800 px-3 py-2 rounded-full">
                <Bell className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">{totalNotifications}개 대기</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* 사이드바 네비게이션 */}
        <div className="w-80 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            
            {/* 승인 대기 (최우선) */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-3">
                🔴 승인 대기
              </h3>
              <div className="space-y-1">
                {categorizedTabs.approval.map(tab => (
                  <TabButton key={tab.id} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
                ))}
              </div>
            </div>

            {/* 일상 관리 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                📊 일상 관리
              </h3>
              <div className="space-y-1">
                {categorizedTabs.management.map(tab => (
                  <TabButton key={tab.id} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
                ))}
              </div>
            </div>

            {/* 분석 및 리포팅 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                📈 분석 & 리포팅
              </h3>
              <div className="space-y-1">
                {categorizedTabs.analytics.map(tab => (
                  <TabButton key={tab.id} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
                ))}
              </div>
            </div>

            {/* 시스템 설정 */}
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                ⚙️ 시스템 설정
              </h3>
              <div className="space-y-1">
                {categorizedTabs.settings.map(tab => (
                  <TabButton key={tab.id} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} />
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1">
          {/* 현재 탭 헤더 */}
          {currentTab && (
            <div className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    {currentTab.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{currentTab.name}</h2>
                    <p className="text-sm text-gray-600">{currentTab.description}</p>
                  </div>
                </div>
                {currentTab.notifications && (
                  <div className="flex items-center bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {currentTab.notifications}개 대기
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 탭 콘텐츠 */}
          <div className="p-6">
            {currentTab?.component}
          </div>
        </div>
      </div>
    </div>
  )
}

// 탭 버튼 컴포넌트
function TabButton({ 
  tab, 
  activeTab, 
  setActiveTab 
}: { 
  tab: WorkflowTab
  activeTab: string
  setActiveTab: (id: string) => void 
}) {
  const isActive = activeTab === tab.id

  return (
    <button
      onClick={() => setActiveTab(tab.id)}
      className={`
        w-full flex items-center justify-between p-3 rounded-lg text-left transition-all
        ${isActive 
          ? 'bg-blue-100 text-blue-700 shadow-sm' 
          : 'text-gray-700 hover:bg-gray-100'
        }
      `}
    >
      <div className="flex items-center">
        <div className={`mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
          {tab.icon}
        </div>
        <div>
          <div className="font-medium text-sm">{tab.name}</div>
        </div>
      </div>
      
      {tab.notifications && (
        <div className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
          {tab.notifications}
        </div>
      )}
    </button>
  )
}
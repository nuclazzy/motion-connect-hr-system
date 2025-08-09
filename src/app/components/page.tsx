'use client'

import { useState } from 'react'
import { 
  Container, 
  PageContainer,
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Button,
  StatsCard,
  NotificationCard,
  EmployeeCard
} from '@/components/ui'
import { 
  Palette, 
  Layout, 
  Layers, 
  Code, 
  Users, 
  Calendar,
  BarChart3,
  Settings,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Copy
} from 'lucide-react'
import UIComponentsShowcase from '@/components/demo/UIComponentsShowcase'
import LayoutShowcase from '@/components/demo/LayoutShowcase'
import DataPatternsShowcase from '@/components/demo/DataPatternsShowcase'
import FormPatternsShowcase from '@/components/demo/FormPatternsShowcase'
import BusinessComponentsShowcase from '@/components/demo/BusinessComponentsShowcase'

interface ShowcaseSection {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  component: React.ComponentType
  category: 'foundation' | 'patterns' | 'business'
}

const showcaseSections: ShowcaseSection[] = [
  // Foundation Layer
  {
    id: 'ui-components',
    title: 'UI Components',
    description: '기본 UI 컴포넌트 라이브러리 - Button, Card, Modal, Input 등',
    icon: <Palette className="w-5 h-5" />,
    component: UIComponentsShowcase,
    category: 'foundation'
  },
  {
    id: 'layout-system',
    title: 'Layout System',
    description: '레이아웃 컴포넌트 시스템 - Container, Grid, Section 등',
    icon: <Layout className="w-5 h-5" />,
    component: LayoutShowcase,
    category: 'foundation'
  },
  
  // Pattern Layer
  {
    id: 'data-patterns',
    title: 'Data Patterns',
    description: '데이터 표시 패턴 - Table, List, Statistics, Charts 등',
    icon: <BarChart3 className="w-5 h-5" />,
    component: DataPatternsShowcase,
    category: 'patterns'
  },
  {
    id: 'form-patterns',
    title: 'Form Patterns',
    description: '폼 패턴 - CRUD Forms, Validation, Search, Filters 등',
    icon: <Code className="w-5 h-5" />,
    component: FormPatternsShowcase,
    category: 'patterns'
  },
  
  // Business Layer
  {
    id: 'business-components',
    title: 'Business Components',
    description: 'HR 시스템 전용 비즈니스 컴포넌트',
    icon: <Users className="w-5 h-5" />,
    component: BusinessComponentsShowcase,
    category: 'business'
  }
]

const categoryColors = {
  foundation: 'bg-blue-50 border-blue-200 text-blue-800',
  patterns: 'bg-green-50 border-green-200 text-green-800', 
  business: 'bg-purple-50 border-purple-200 text-purple-800'
}

const categoryLabels = {
  foundation: '기반',
  patterns: '패턴',
  business: '비즈니스'
}

export default function ComponentsShowcasePage() {
  const [activeSection, setActiveSection] = useState<string>('ui-components')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredSections = showcaseSections.filter(section => {
    const matchesSearch = section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         section.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || section.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const ActiveComponent = showcaseSections.find(section => section.id === activeSection)?.component

  return (
    <PageContainer 
      title="Motion Connect - 컴포넌트 쇼케이스"
      description="프로젝트 전반에 걸친 일관성과 중앙화를 위한 컴포넌트 라이브러리"
      actions={
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="컴포넌트 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">모든 카테고리</option>
            <option value="foundation">기반 컴포넌트</option>
            <option value="patterns">패턴 컴포넌트</option>
            <option value="business">비즈니스 컴포넌트</option>
          </select>
          <div className="flex bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="grid lg:grid-cols-12 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle level={4}>컴포넌트 카테고리</CardTitle>
            </CardHeader>
            <CardContent>
              <nav className="space-y-2">
                {filteredSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary-50 text-primary-700 border border-primary-200'
                        : 'hover:bg-neutral-50'
                    }`}
                  >
                    <span className={activeSection === section.id ? 'text-primary-600' : 'text-neutral-400'}>
                      {section.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{section.title}</p>
                        <span className={`px-2 py-1 text-xs rounded-full border ${categoryColors[section.category]}`}>
                          {categoryLabels[section.category]}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {section.description}
                      </p>
                    </div>
                  </button>
                ))}
              </nav>
            </CardContent>
          </Card>

          {/* Design System Stats */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle level={5}>시스템 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatsCard
                title="UI 컴포넌트"
                value="47"
                change="+12 this week"
                trend="up"
                icon={<Layers className="w-5 h-5" />}
              />
              <StatsCard
                title="비즈니스 컴포넌트"
                value="23"
                change="+5 this week"
                trend="up"
                icon={<Users className="w-5 h-5" />}
              />
              <StatsCard
                title="재사용률"
                value="85%"
                change="+8% improvement"
                trend="up"
                icon={<Copy className="w-5 h-5" />}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-primary-600">
                    {showcaseSections.find(s => s.id === activeSection)?.icon}
                  </span>
                  <div>
                    <CardTitle level={3}>
                      {showcaseSections.find(s => s.id === activeSection)?.title}
                    </CardTitle>
                    <p className="text-neutral-600 text-sm mt-1">
                      {showcaseSections.find(s => s.id === activeSection)?.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    코드 보기
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ActiveComponent && <ActiveComponent />}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Access Footer */}
      <div className="mt-12 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">
            컴포넌트 시스템 원칙
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Layers className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">일관성</h3>
              <p className="text-sm text-neutral-600">
                모든 컴포넌트는 동일한 디자인 시스템과 패턴을 따릅니다
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Code className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">재사용성</h3>
              <p className="text-sm text-neutral-600">
                한 번 작성하여 여러 곳에서 재사용 가능한 모듈화된 컴포넌트
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-neutral-900 mb-2">확장성</h3>
              <p className="text-sm text-neutral-600">
                비즈니스 요구사항에 맞게 쉽게 확장 및 커스터마이징 가능
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
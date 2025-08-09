'use client'

import { useState } from 'react'
import { 
  Container,
  PageContainer,
  SectionContainer,
  DashboardContainer,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatsCard
} from '@/components/ui'
import { 
  Layout,
  Grid3X3,
  Columns,
  Square,
  Maximize,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff
} from 'lucide-react'

const layoutExamples = {
  containers: `// Container Variants
<Container maxWidth="sm">Small Container</Container>
<Container maxWidth="lg">Large Container</Container>
<Container maxWidth="2xl">Extra Large</Container>

// Page Container with Header
<PageContainer 
  title="페이지 제목"
  description="페이지 설명"
  actions={<Button>액션 버튼</Button>}
>
  페이지 콘텐츠
</PageContainer>

// Dashboard Layout
<DashboardContainer>
  <div className="grid lg:grid-cols-3 gap-6">
    {/* 대시보드 위젯들 */}
  </div>
</DashboardContainer>`,

  grids: `// Responsive Grid System
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map(item => <Card key={item.id}>{item}</Card>)}
</div>

// Dashboard Grid
<div className="grid lg:grid-cols-12 gap-6">
  <div className="lg:col-span-8">메인 콘텐츠</div>
  <div className="lg:col-span-4">사이드바</div>
</div>

// Stats Grid
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <StatsCard />
  <StatsCard />
  <StatsCard />
  <StatsCard />
</div>`,

  responsive: `// Mobile-First Responsive Design
<div className="
  px-4 sm:px-6 lg:px-8
  py-4 sm:py-6 lg:py-8
  text-sm sm:text-base lg:text-lg
">
  반응형 콘텐츠
</div>

// Breakpoint-specific Display
<div className="
  block sm:hidden        /* mobile only */
  hidden sm:block lg:hidden /* tablet only */
  hidden lg:block        /* desktop only */
">
  특정 화면 크기에만 표시
</div>`
}

interface LayoutDemo {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

export default function LayoutShowcase() {
  const [activeDemo, setActiveDemo] = useState('containers')
  const [showCode, setShowCode] = useState(false)
  const [viewportSize, setViewportSize] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  const layoutDemos: LayoutDemo[] = [
    {
      id: 'containers',
      title: 'Container System',
      description: '중앙 정렬된 컨테이너와 최대 너비 제어',
      code: layoutExamples.containers,
      component: (
        <div className="space-y-8">
          {/* Container Sizes */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Container Sizes</h4>
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-1">
                <Container maxWidth="xs" className="bg-blue-100 rounded p-4">
                  <div className="text-center text-sm">
                    Extra Small (475px max) - 모바일 폼
                  </div>
                </Container>
              </div>
              <div className="bg-green-50 rounded-lg p-1">
                <Container maxWidth="md" className="bg-green-100 rounded p-4">
                  <div className="text-center text-sm">
                    Medium (768px max) - 일반 콘텐츠
                  </div>
                </Container>
              </div>
              <div className="bg-purple-50 rounded-lg p-1">
                <Container maxWidth="xl" className="bg-purple-100 rounded p-4">
                  <div className="text-center text-sm">
                    Extra Large (1280px max) - 대시보드
                  </div>
                </Container>
              </div>
            </div>
          </div>

          {/* Page Container Example */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Page Container</h4>
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold">직원 관리</h1>
                    <p className="mt-2 opacity-90">직원 정보를 관리하고 조회할 수 있습니다</p>
                  </div>
                  <Button className="bg-white text-blue-600 hover:bg-blue-50">
                    새 직원 추가
                  </Button>
                </div>
              </div>
              <div className="p-6">
                <p className="text-neutral-600">
                  PageContainer는 페이지 제목, 설명, 액션 버튼을 포함한 완전한 페이지 레이아웃을 제공합니다.
                </p>
              </div>
            </Card>
          </div>

          {/* Dashboard Container */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Dashboard Container</h4>
            <Card className="bg-neutral-50">
              <CardContent>
                <div className="grid lg:grid-cols-3 gap-4">
                  <StatsCard
                    title="총 직원"
                    value="127"
                    trend="up"
                    change="+5"
                  />
                  <StatsCard
                    title="출근율"
                    value="96.8%"
                    trend="neutral"
                    change="stable"
                  />
                  <StatsCard
                    title="평균 근무시간"
                    value="8.2h"
                    trend="down"
                    change="-0.3h"
                  />
                </div>
                <div className="mt-4 text-center text-sm text-neutral-600">
                  DashboardContainer - 최대 너비 2xl, 6px 간격
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'grids',
      title: 'Grid System',
      description: '반응형 그리드 레이아웃 패턴',
      code: layoutExamples.grids,
      component: (
        <div className="space-y-8">
          {/* Basic Grid */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Basic Responsive Grid</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(num => (
                <Card key={num} className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
                  <div className="text-2xl font-bold text-blue-600 mb-2">#{num}</div>
                  <div className="text-sm text-neutral-600">
                    Mobile: 1열<br/>
                    Tablet: 2열<br/>
                    Desktop: 3열
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Dashboard Grid */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Dashboard Layout Grid</h4>
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8">
                <Card className="h-48 bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-center">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-green-700 mb-2">메인 콘텐츠 영역</h3>
                    <p className="text-sm text-green-600">8/12 columns (66.7%)</p>
                  </div>
                </Card>
              </div>
              <div className="lg:col-span-4">
                <Card className="h-48 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-center">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-purple-700 mb-2">사이드바</h3>
                    <p className="text-sm text-purple-600">4/12 columns (33.3%)</p>
                  </div>
                </Card>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Statistics Grid</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="직원 수"
                value="127"
                icon={<Monitor className="w-5 h-5" />}
              />
              <StatsCard
                title="부서 수"
                value="8"
                icon={<Grid3X3 className="w-5 h-5" />}
              />
              <StatsCard
                title="프로젝트"
                value="24"
                icon={<Square className="w-5 h-5" />}
              />
              <StatsCard
                title="완료율"
                value="89%"
                icon={<Maximize className="w-5 h-5" />}
              />
            </div>
            <div className="text-center text-sm text-neutral-600 mt-4">
              Mobile: 2열, Desktop: 4열 반응형 그리드
            </div>
          </div>

          {/* Complex Grid */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Complex Grid Layout</h4>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-8">
                <Card className="h-32 bg-gradient-to-r from-orange-50 to-red-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-orange-700 font-semibold">Header</div>
                    <div className="text-xs text-orange-600">col-span-12 md:col-span-8</div>
                  </div>
                </Card>
              </div>
              <div className="col-span-12 md:col-span-4">
                <Card className="h-32 bg-gradient-to-r from-cyan-50 to-blue-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-cyan-700 font-semibold">Sidebar</div>
                    <div className="text-xs text-cyan-600">col-span-12 md:col-span-4</div>
                  </div>
                </Card>
              </div>
              <div className="col-span-6 md:col-span-4">
                <Card className="h-24 bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-yellow-700 font-semibold text-sm">Widget 1</div>
                    <div className="text-xs text-yellow-600">col-span-6 md:col-span-4</div>
                  </div>
                </Card>
              </div>
              <div className="col-span-6 md:col-span-4">
                <Card className="h-24 bg-gradient-to-r from-green-50 to-emerald-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-green-700 font-semibold text-sm">Widget 2</div>
                    <div className="text-xs text-green-600">col-span-6 md:col-span-4</div>
                  </div>
                </Card>
              </div>
              <div className="col-span-12 md:col-span-4">
                <Card className="h-24 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-purple-700 font-semibold text-sm">Widget 3</div>
                    <div className="text-xs text-purple-600">col-span-12 md:col-span-4</div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'responsive',
      title: 'Responsive Patterns',
      description: '다양한 화면 크기에 대응하는 반응형 패턴',
      code: layoutExamples.responsive,
      component: (
        <div className="space-y-8">
          {/* Viewport Simulator */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold">반응형 시뮬레이터</h4>
              <div className="flex bg-neutral-100 rounded-lg p-1">
                {[
                  { key: 'mobile', label: 'Mobile', icon: Smartphone },
                  { key: 'tablet', label: 'Tablet', icon: Tablet },
                  { key: 'desktop', label: 'Desktop', icon: Monitor }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setViewportSize(key as any)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded ${
                      viewportSize === key 
                        ? 'bg-white text-primary-600 shadow-sm' 
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className={`transition-all duration-300 mx-auto bg-white border-2 border-dashed border-neutral-300 ${
                viewportSize === 'mobile' ? 'max-w-sm' :
                viewportSize === 'tablet' ? 'max-w-2xl' : 'max-w-full'
              }`}>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(num => (
                      <Card key={num} className="text-center p-4 bg-blue-50">
                        <div className="text-blue-600 font-semibold">Card {num}</div>
                      </Card>
                    ))}
                  </div>
                  <div className="mt-4 text-center text-sm text-neutral-500">
                    {viewportSize === 'mobile' && '모바일: 1열 레이아웃'}
                    {viewportSize === 'tablet' && '태블릿: 2열 레이아웃'}
                    {viewportSize === 'desktop' && '데스크톱: 3열 레이아웃'}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Breakpoint Examples */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Breakpoint 기반 표시/숨김</h4>
            <div className="space-y-4">
              <Card className="p-4 bg-red-50 block sm:hidden">
                <div className="text-red-700 font-semibold">📱 모바일에서만 표시</div>
                <div className="text-red-600 text-sm">block sm:hidden</div>
              </Card>
              <Card className="p-4 bg-yellow-50 hidden sm:block lg:hidden">
                <div className="text-yellow-700 font-semibold">📱 태블릿에서만 표시</div>
                <div className="text-yellow-600 text-sm">hidden sm:block lg:hidden</div>
              </Card>
              <Card className="p-4 bg-green-50 hidden lg:block">
                <div className="text-green-700 font-semibold">💻 데스크톱에서만 표시</div>
                <div className="text-green-600 text-sm">hidden lg:block</div>
              </Card>
            </div>
          </div>

          {/* Responsive Typography & Spacing */}
          <div>
            <h4 className="text-lg font-semibold mb-4">반응형 타이포그래피 & 간격</h4>
            <Card className="p-4 sm:p-6 lg:p-8 space-y-4">
              <h1 className="text-lg sm:text-xl lg:text-3xl font-bold text-neutral-900">
                반응형 제목
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-neutral-600">
                이 텍스트는 화면 크기에 따라 글자 크기가 변경됩니다. 
                패딩도 모바일에서는 4px, 태블릿에서는 6px, 데스크톱에서는 8px로 조정됩니다.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
                <div className="bg-blue-100 p-2 sm:p-3 lg:p-4 rounded text-center text-blue-700">
                  반응형 간격
                </div>
                <div className="bg-green-100 p-2 sm:p-3 lg:p-4 rounded text-center text-green-700">
                  반응형 그리드
                </div>
                <div className="bg-purple-100 p-2 sm:p-3 lg:p-4 rounded text-center text-purple-700">
                  반응형 패딩
                </div>
              </div>
            </Card>
          </div>
        </div>
      )
    }
  ]

  const currentDemo = layoutDemos.find(demo => demo.id === activeDemo)

  return (
    <div className="space-y-6">
      {/* Demo Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
        {layoutDemos.map((demo) => (
          <button
            key={demo.id}
            onClick={() => setActiveDemo(demo.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeDemo === demo.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {demo.title}
          </button>
        ))}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{currentDemo?.title}</h3>
          <p className="text-neutral-600 mt-1">{currentDemo?.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCode(!showCode)}
          startIcon={showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        >
          {showCode ? '코드 숨기기' : '코드 보기'}
        </Button>
      </div>

      {/* Code Display */}
      {showCode && (
        <Card className="bg-neutral-900">
          <CardContent>
            <pre className="text-green-400 text-sm overflow-x-auto">
              <code>{currentDemo?.code}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Demo Component */}
      <Card>
        <CardContent>
          {currentDemo?.component}
        </CardContent>
      </Card>

      {/* Layout Guidelines */}
      <Card className="bg-indigo-50 border-indigo-200">
        <CardHeader>
          <CardTitle level={4} className="text-indigo-800">
            📐 레이아웃 가이드라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-indigo-700 space-y-2">
            {activeDemo === 'containers' && (
              <>
                <p>• 읽기 편한 라인 길이를 위해 적절한 최대 너비를 설정하세요</p>
                <p>• PageContainer는 일관된 페이지 헤더 레이아웃을 제공합니다</p>
                <p>• 대시보드는 DashboardContainer를 사용하여 넓은 레이아웃을 확보하세요</p>
              </>
            )}
            {activeDemo === 'grids' && (
              <>
                <p>• 모바일 우선 접근법으로 그리드를 설계하세요</p>
                <p>• 12컬럼 시스템을 활용하여 유연한 레이아웃을 구성하세요</p>
                <p>• 일관된 gap 크기(4px, 6px, 8px)를 사용하세요</p>
              </>
            )}
            {activeDemo === 'responsive' && (
              <>
                <p>• 주요 브레이크포인트: sm(640px), md(768px), lg(1024px), xl(1280px)</p>
                <p>• 터치 친화적인 최소 크기(44px)를 모바일에서 보장하세요</p>
                <p>• 텍스트 크기와 간격도 반응형으로 조정하세요</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
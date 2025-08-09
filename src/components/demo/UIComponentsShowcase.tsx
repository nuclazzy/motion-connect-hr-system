'use client'

import { useState } from 'react'
import { 
  Button, 
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  GhostButton,
  ApproveButton,
  RejectButton,
  DeleteButton,
  SaveButton,
  EditButton,
  LoadingButton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  StatsCard,
  NotificationCard,
  EmployeeCard,
  Input,
  EmailInput,
  PasswordInput,
  NumberInput,
  DateInput,
  SearchInput,
  Container
} from '@/components/ui'
import { 
  Heart, 
  Star, 
  Download, 
  Settings, 
  Mail,
  Phone,
  User,
  Calendar,
  Search,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react'

const codeExamples = {
  buttons: `// Button Variants
<PrimaryButton>Primary</PrimaryButton>
<SecondaryButton>Secondary</SecondaryButton>
<OutlineButton>Outline</OutlineButton>
<GhostButton>Ghost</GhostButton>

// Semantic Buttons
<ApproveButton>승인</ApproveButton>
<RejectButton>거절</RejectButton>
<SaveButton>저장</SaveButton>
<DeleteButton>삭제</DeleteButton>

// With Icons & States
<Button startIcon={<Heart />} loading>
  Loading...
</Button>`,
  
  cards: `// Basic Card
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Card content goes here
  </CardContent>
</Card>

// Stats Card
<StatsCard
  title="총 직원 수"
  value="127"
  change="+12 this month"
  trend="up"
  icon={<Users />}
/>

// Employee Card
<EmployeeCard
  name="김철수"
  position="개발팀장"
  department="IT팀"
  email="kim@example.com"
  status="active"
  onEdit={() => {}}
/>`,

  inputs: `// Input Variants
<EmailInput placeholder="이메일 입력" />
<PasswordInput placeholder="비밀번호 입력" />
<NumberInput placeholder="숫자 입력" />
<DateInput />
<SearchInput placeholder="검색어 입력" />

// With validation
<Input
  label="이름"
  required
  error="이름을 입력해주세요"
  helpText="2글자 이상 입력"
/>`
}

interface ShowcaseSection {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

export default function UIComponentsShowcase() {
  const [activeDemo, setActiveDemo] = useState('buttons')
  const [showCode, setShowCode] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLoadingDemo = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(false)
  }

  const showcaseSections: ShowcaseSection[] = [
    {
      id: 'buttons',
      title: 'Button Components',
      description: '모든 상황에 맞는 버튼 컴포넌트 시스템',
      code: codeExamples.buttons,
      component: (
        <div className="space-y-8">
          {/* Variant Showcase */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Button Variants</h4>
            <div className="flex flex-wrap gap-3">
              <PrimaryButton>Primary</PrimaryButton>
              <SecondaryButton>Secondary</SecondaryButton>
              <OutlineButton>Outline</OutlineButton>
              <GhostButton>Ghost</GhostButton>
              <Button variant="text">Text Button</Button>
            </div>
          </div>

          {/* Sizes */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Button Sizes</h4>
            <div className="flex items-center flex-wrap gap-3">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          {/* HR-Specific Buttons */}
          <div>
            <h4 className="text-lg font-semibold mb-4">HR Semantic Buttons</h4>
            <div className="flex flex-wrap gap-3">
              <ApproveButton>승인</ApproveButton>
              <RejectButton>거절</RejectButton>
              <SaveButton>저장</SaveButton>
              <EditButton>수정</EditButton>
              <DeleteButton>삭제</DeleteButton>
            </div>
          </div>

          {/* Icon & Loading States */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Interactive States</h4>
            <div className="flex flex-wrap gap-3">
              <Button startIcon={<Heart className="w-4 h-4" />}>
                With Start Icon
              </Button>
              <Button endIcon={<Download className="w-4 h-4" />}>
                With End Icon
              </Button>
              <LoadingButton loading={loading} onClick={handleLoadingDemo}>
                {loading ? 'Loading...' : 'Click to Load'}
              </LoadingButton>
              <Button disabled>Disabled</Button>
            </div>
          </div>

          {/* Full Width */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Full Width</h4>
            <Button fullWidth>전체 너비 버튼</Button>
          </div>
        </div>
      )
    },
    {
      id: 'cards',
      title: 'Card Components',
      description: '정보를 구조화하고 표시하는 카드 시스템',
      code: codeExamples.cards,
      component: (
        <div className="space-y-8">
          {/* Basic Cards */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Card Variants</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle level={4}>Elevated Card</CardTitle>
                </CardHeader>
                <CardContent>
                  그림자가 있는 기본 카드입니다.
                </CardContent>
              </Card>
              <Card variant="outlined">
                <CardHeader>
                  <CardTitle level={4}>Outlined Card</CardTitle>
                </CardHeader>
                <CardContent>
                  테두리가 있는 카드입니다.
                </CardContent>
              </Card>
              <Card variant="filled">
                <CardHeader>
                  <CardTitle level={4}>Filled Card</CardTitle>
                </CardHeader>
                <CardContent>
                  배경색이 있는 카드입니다.
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Stats Cards */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Statistics Cards</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <StatsCard
                title="총 직원 수"
                value="127"
                change="+12 this month"
                trend="up"
                icon={<User className="w-6 h-6" />}
              />
              <StatsCard
                title="평균 근무시간"
                value="8.2h"
                change="-0.3h from last month"
                trend="down"
                icon={<Calendar className="w-6 h-6" />}
              />
              <StatsCard
                title="출근율"
                value="96.8%"
                change="stable"
                trend="neutral"
                icon={<Settings className="w-6 h-6" />}
              />
            </div>
          </div>

          {/* Employee Card */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Employee Card</h4>
            <div className="max-w-md">
              <EmployeeCard
                name="김철수"
                position="시니어 개발자"
                department="기술팀"
                email="kimcs@motionconnect.kr"
                status="active"
                onEdit={() => alert('Edit clicked')}
                onView={() => alert('View clicked')}
              />
            </div>
          </div>

          {/* Notification Card */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Notification Card</h4>
            <div className="max-w-md">
              <NotificationCard
                title="휴가 신청 승인"
                message="김철수님의 연차 휴가 신청이 승인되었습니다."
                time="2시간 전"
                isRead={false}
                onMarkAsRead={() => alert('Marked as read')}
              />
            </div>
          </div>

          {/* Interactive Card */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Interactive Card</h4>
            <Card onClick={() => alert('Card clicked')} className="max-w-sm cursor-pointer">
              <CardHeader>
                <CardTitle level={4}>클릭 가능한 카드</CardTitle>
              </CardHeader>
              <CardContent>
                이 카드는 클릭할 수 있습니다. 호버 효과도 있습니다.
              </CardContent>
              <CardFooter>
                <Button variant="ghost">자세히 보기</Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )
    },
    {
      id: 'inputs',
      title: 'Input Components',
      description: '사용자 입력을 위한 폼 컴포넌트 시스템',
      code: codeExamples.inputs,
      component: (
        <div className="space-y-8">
          {/* Basic Inputs */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Basic Input Variants</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="기본 입력"
                placeholder="텍스트를 입력하세요"
                helpText="도움말 텍스트"
              />
              <Input
                label="필수 입력 (에러)"
                placeholder="필수 필드"
                required
                error="이 필드는 필수입니다"
              />
            </div>
          </div>

          {/* Typed Inputs */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Typed Input Variants</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <EmailInput
                label="이메일"
                placeholder="example@company.com"
              />
              <PasswordInput
                label="비밀번호"
                placeholder="비밀번호 입력"
              />
              <NumberInput
                label="급여"
                placeholder="0"
                min={0}
                step={10000}
              />
              <DateInput
                label="입사일"
              />
            </div>
          </div>

          {/* Search Input */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Search Input</h4>
            <div className="max-w-md">
              <SearchInput
                placeholder="직원 검색..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onSearch={(value) => alert(`Searching for: ${value}`)}
              />
            </div>
          </div>

          {/* Input States */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Input States</h4>
            <div className="grid md:grid-cols-3 gap-4">
              <Input
                label="기본 상태"
                placeholder="Normal state"
              />
              <Input
                label="비활성화"
                placeholder="Disabled state"
                disabled
                value="Read-only value"
              />
              <Input
                label="로딩 상태"
                placeholder="Loading..."
                loading
              />
            </div>
          </div>

          {/* Sizes */}
          <div>
            <h4 className="text-lg font-semibold mb-4">Input Sizes</h4>
            <div className="space-y-4">
              <Input
                size="sm"
                label="Small Size"
                placeholder="Small input"
              />
              <Input
                size="md"
                label="Medium Size (Default)"
                placeholder="Medium input"
              />
              <Input
                size="lg"
                label="Large Size"
                placeholder="Large input"
              />
            </div>
          </div>
        </div>
      )
    }
  ]

  const currentSection = showcaseSections.find(section => section.id === activeDemo)

  return (
    <div className="space-y-6">
      {/* Demo Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
        {showcaseSections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveDemo(section.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeDemo === section.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {section.title}
          </button>
        ))}
      </div>

      {/* Code Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{currentSection?.title}</h3>
          <p className="text-neutral-600 mt-1">{currentSection?.description}</p>
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
              <code>{currentSection?.code}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Demo Component */}
      <Card>
        <CardContent>
          {currentSection?.component}
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle level={4} className="text-blue-800">
            🎯 사용 가이드라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-blue-700 space-y-2">
            {activeDemo === 'buttons' && (
              <>
                <p>• Primary 버튼은 페이지당 하나만 사용하세요</p>
                <p>• 파괴적 작업(삭제)에는 DeleteButton을 사용하세요</p>
                <p>• 로딩 상태가 예상되는 작업에는 LoadingButton을 활용하세요</p>
              </>
            )}
            {activeDemo === 'cards' && (
              <>
                <p>• 관련된 정보를 그룹화할 때 카드를 사용하세요</p>
                <p>• StatsCard는 대시보드의 KPI 표시에 적합합니다</p>
                <p>• 인터랙티브한 카드에는 적절한 호버 효과를 제공하세요</p>
              </>
            )}
            {activeDemo === 'inputs' && (
              <>
                <p>• 항상 명확한 라벨을 제공하세요</p>
                <p>• 에러 상태에서는 구체적인 오류 메시지를 표시하세요</p>
                <p>• 필수 필드는 required 속성을 사용하여 명시하세요</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
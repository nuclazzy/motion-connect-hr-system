'use client'

import { useState } from 'react'
import { 
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  PrimaryButton,
  SecondaryButton,
  Input,
  EmailInput,
  PasswordInput,
  NumberInput,
  DateInput,
  SearchInput,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter
} from '@/components/ui'
import { 
  Search,
  Filter,
  Plus,
  Save,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  Upload,
  Download
} from 'lucide-react'

const codeExamples = {
  basicForm: `// Basic CRUD Form
<form onSubmit={handleSubmit}>
  <div className="space-y-4">
    <Input
      label="직원명"
      name="name"
      required
      value={formData.name}
      onChange={handleChange}
      error={errors.name}
    />
    <EmailInput
      label="이메일"
      name="email" 
      required
      value={formData.email}
      onChange={handleChange}
      error={errors.email}
    />
    <div className="flex space-x-3">
      <Button type="submit" loading={isSubmitting}>
        저장
      </Button>
      <Button variant="outline" onClick={onCancel}>
        취소
      </Button>
    </div>
  </div>
</form>`,

  searchFilter: `// Search & Filter Pattern
<div className="flex items-center space-x-4 mb-6">
  <SearchInput
    placeholder="직원 검색..."
    value={searchQuery}
    onChange={setSearchQuery}
    onSearch={handleSearch}
  />
  <select
    value={department}
    onChange={setDepartment}
    className="px-3 py-2 border rounded-lg"
  >
    <option value="">전체 부서</option>
    <option value="dev">개발팀</option>
    <option value="design">디자인팀</option>
  </select>
  <Button variant="outline">
    <Filter className="w-4 h-4 mr-2" />
    상세 필터
  </Button>
</div>`,

  modalForm: `// Modal Form Pattern
<Modal isOpen={isOpen} onClose={onClose}>
  <ModalHeader>
    <ModalTitle>새 직원 추가</ModalTitle>
  </ModalHeader>
  <ModalBody>
    <form className="space-y-4">
      <Input label="이름" required />
      <EmailInput label="이메일" required />
      <DateInput label="입사일" required />
    </form>
  </ModalBody>
  <ModalFooter>
    <Button onClick={onClose} variant="outline">
      취소
    </Button>
    <Button onClick={handleSave}>
      저장
    </Button>
  </ModalFooter>
</Modal>`
}

// Mock validation function
const validateForm = (data: any) => {
  const errors: any = {}
  
  if (!data.name?.trim()) {
    errors.name = '이름을 입력해주세요'
  } else if (data.name.length < 2) {
    errors.name = '이름은 2자 이상 입력해주세요'
  }
  
  if (!data.email?.trim()) {
    errors.email = '이메일을 입력해주세요'
  } else if (!/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = '올바른 이메일 형식이 아닙니다'
  }
  
  if (!data.department?.trim()) {
    errors.department = '부서를 선택해주세요'
  }
  
  if (!data.position?.trim()) {
    errors.position = '직급을 입력해주세요'
  }
  
  if (!data.salary || data.salary <= 0) {
    errors.salary = '급여를 입력해주세요'
  }
  
  if (!data.startDate) {
    errors.startDate = '입사일을 선택해주세요'
  }
  
  return errors
}

function BasicFormExample() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    position: '',
    salary: '',
    startDate: ''
  })
  const [errors, setErrors] = useState<any>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationErrors = validateForm(formData)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    
    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setSubmitted(true)
    
    // Reset after showing success
    setTimeout(() => {
      setSubmitted(false)
      setFormData({
        name: '',
        email: '',
        department: '',
        position: '',
        salary: '',
        startDate: ''
      })
    }, 2000)
  }

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      department: '',
      position: '',
      salary: '',
      startDate: ''
    })
    setErrors({})
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                직원 등록 완료!
              </h3>
              <p className="text-green-600">
                {formData.name}님의 정보가 성공적으로 등록되었습니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Input
          label="직원명"
          name="name"
          placeholder="홍길동"
          required
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          helpText="2글자 이상 입력해주세요"
        />
        <EmailInput
          label="이메일"
          name="email"
          placeholder="hong@company.com"
          required
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">
            부서 <span className="text-red-500">*</span>
          </label>
          <select
            name="department"
            value={formData.department}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
              errors.department ? 'border-red-500' : 'border-neutral-300'
            }`}
            required
          >
            <option value="">부서를 선택하세요</option>
            <option value="dev">개발팀</option>
            <option value="design">디자인팀</option>
            <option value="marketing">마케팅팀</option>
            <option value="hr">인사팀</option>
          </select>
          {errors.department && (
            <p className="text-sm text-red-600 flex items-center mt-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              {errors.department}
            </p>
          )}
        </div>
        <Input
          label="직급"
          name="position"
          placeholder="시니어 개발자"
          required
          value={formData.position}
          onChange={handleChange}
          error={errors.position}
        />
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <NumberInput
          label="급여 (월)"
          name="salary"
          placeholder="0"
          min={0}
          step={100000}
          value={formData.salary}
          onChange={handleChange}
          error={errors.salary}
          helpText="원 단위로 입력"
        />
        <DateInput
          label="입사일"
          name="startDate"
          value={formData.startDate}
          onChange={handleChange}
          error={errors.startDate}
        />
      </div>
      
      <div className="flex items-center space-x-3 pt-4">
        <PrimaryButton type="submit" loading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? '저장 중...' : '직원 등록'}
        </PrimaryButton>
        <SecondaryButton type="button" onClick={handleReset}>
          초기화
        </SecondaryButton>
      </div>
    </form>
  )
}

function SearchFilterExample() {
  const [searchQuery, setSearchQuery] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSearch = (query: string) => {
    console.log('Searching for:', query)
  }

  const handleReset = () => {
    setSearchQuery('')
    setDepartment('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
  }

  const activeFilters = [
    searchQuery && `검색: "${searchQuery}"`,
    department && `부서: ${department}`,
    status && `상태: ${status}`,
    dateFrom && dateTo && `기간: ${dateFrom} ~ ${dateTo}`
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      {/* Basic Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <SearchInput
            placeholder="직원명, 이메일, 부서로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearch}
          />
        </div>
        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
        >
          <option value="">전체 부서</option>
          <option value="dev">개발팀</option>
          <option value="design">디자인팀</option>
          <option value="marketing">마케팅팀</option>
          <option value="hr">인사팀</option>
        </select>
        <Button 
          variant="outline" 
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Filter className="w-4 h-4 mr-2" />
          {showAdvanced ? '간단히' : '상세 필터'}
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <Card className="bg-neutral-50">
          <CardHeader>
            <CardTitle level={5}>상세 필터</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  재직 상태
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">전체</option>
                  <option value="active">재직</option>
                  <option value="on-leave">휴직</option>
                  <option value="inactive">퇴사</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  입사일 (시작)
                </label>
                <DateInput
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  입사일 (종료)
                </label>
                <DateInput
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex items-center space-x-3">
              <Button size="sm">
                필터 적용
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                초기화
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center space-x-2 flex-wrap">
          <span className="text-sm text-neutral-600">활성 필터:</span>
          {activeFilters.map((filter, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-100 text-primary-800"
            >
              {filter}
              <button
                onClick={() => {
                  if (filter.startsWith('검색:')) setSearchQuery('')
                  if (filter.startsWith('부서:')) setDepartment('')
                  if (filter.startsWith('상태:')) setStatus('')
                  if (filter.startsWith('기간:')) {
                    setDateFrom('')
                    setDateTo('')
                  }
                }}
                className="ml-2 hover:bg-primary-200 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={handleReset}>
            모든 필터 제거
          </Button>
        </div>
      )}

      {/* Results Summary */}
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-neutral-500 mb-2">
              {activeFilters.length > 0 ? '필터 결과' : '전체 직원 목록'}
            </div>
            <div className="text-2xl font-bold text-neutral-900">
              {Math.floor(Math.random() * 50) + 10}명
            </div>
            <div className="text-sm text-neutral-600 mt-2">
              검색 조건에 맞는 직원이 표시됩니다
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ModalFormExample() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    startDate: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSave = async () => {
    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSubmitting(false)
    setIsOpen(false)
    setFormData({ name: '', email: '', department: '', startDate: '' })
  }

  const handleClose = () => {
    setIsOpen(false)
    setFormData({ name: '', email: '', department: '', startDate: '' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <div className="text-center py-12">
            <h4 className="text-lg font-semibold mb-4">직원 관리</h4>
            <p className="text-neutral-600 mb-6">
              새 직원을 등록하려면 아래 버튼을 클릭하세요
            </p>
            <Button onClick={() => setIsOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              새 직원 추가
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <ModalHeader>
          <ModalTitle>새 직원 추가</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="직원명"
              placeholder="홍길동"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
            <EmailInput
              label="이메일"
              placeholder="hong@company.com"
              required
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-neutral-700">
                부서 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              >
                <option value="">부서를 선택하세요</option>
                <option value="dev">개발팀</option>
                <option value="design">디자인팀</option>
                <option value="marketing">마케팅팀</option>
                <option value="hr">인사팀</option>
              </select>
            </div>
            <DateInput
              label="입사일"
              required
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <SecondaryButton onClick={handleClose}>
            취소
          </SecondaryButton>
          <PrimaryButton onClick={handleSave} loading={isSubmitting}>
            {isSubmitting ? '저장 중...' : '저장'}
          </PrimaryButton>
        </ModalFooter>
      </Modal>
    </div>
  )
}

interface FormDemo {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

export default function FormPatternsShowcase() {
  const [activeDemo, setActiveDemo] = useState('basic-form')
  const [showCode, setShowCode] = useState(false)

  const formDemos: FormDemo[] = [
    {
      id: 'basic-form',
      title: 'Basic CRUD Form',
      description: '기본 생성/수정 폼 패턴 (검증, 에러 처리 포함)',
      code: codeExamples.basicForm,
      component: <BasicFormExample />
    },
    {
      id: 'search-filter',
      title: 'Search & Filter',
      description: '검색과 필터링 패턴 (기본/고급 필터)',
      code: codeExamples.searchFilter,
      component: <SearchFilterExample />
    },
    {
      id: 'modal-form',
      title: 'Modal Forms',
      description: '모달을 활용한 폼 패턴',
      code: codeExamples.modalForm,
      component: <ModalFormExample />
    }
  ]

  const currentDemo = formDemos.find(demo => demo.id === activeDemo)

  return (
    <div className="space-y-6">
      {/* Demo Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
        {formDemos.map((demo) => (
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
      <div>
        {currentDemo?.component}
      </div>

      {/* Form Guidelines */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle level={4} className="text-amber-800">
            📝 폼 디자인 가이드라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-amber-700 space-y-2">
            {activeDemo === 'basic-form' && (
              <>
                <p>• 필수 필드는 별표(*)로 명확히 표시하세요</p>
                <p>• 실시간 검증보다는 제출 시 검증을 우선 고려하세요</p>
                <p>• 에러 메시지는 구체적이고 해결 방법을 제시하세요</p>
                <p>• 로딩 상태를 명확히 표시하여 사용자 경험을 향상시키세요</p>
              </>
            )}
            {activeDemo === 'search-filter' && (
              <>
                <p>• 검색은 즉시 실행보다는 Enter 키나 검색 버튼을 활용하세요</p>
                <p>• 활성화된 필터를 시각적으로 명확히 표시하세요</p>
                <p>• 복잡한 필터는 접을 수 있도록 하여 UI를 깔끔하게 유지하세요</p>
                <p>• 필터 초기화 기능을 제공하세요</p>
              </>
            )}
            {activeDemo === 'modal-form' && (
              <>
                <p>• 모달은 간단한 작업에만 사용하고 복잡한 폼은 전체 페이지를 활용하세요</p>
                <p>• ESC 키와 배경 클릭으로 닫기 기능을 제공하세요</p>
                <p>• 모달 크기는 콘텐츠에 적합하게 조정하세요</p>
                <p>• 저장/취소 버튼을 일관된 위치에 배치하세요</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
# Motion Connect HR Design System Guide

Motion Connect HR 시스템을 위한 종합적인 디자인 시스템입니다. Material Design 3 원칙을 기반으로 하여 일관성 있고 접근성이 뛰어난 사용자 경험을 제공합니다.

## 📋 목차

1. [개요](#개요)
2. [설치 및 설정](#설치-및-설정)
3. [디자인 토큰](#디자인-토큰)
4. [컴포넌트](#컴포넌트)
5. [레이아웃 시스템](#레이아웃-시스템)
6. [접근성](#접근성)
7. [애니메이션](#애니메이션)
8. [테마](#테마)
9. [사용 예제](#사용-예제)
10. [기여 가이드](#기여-가이드)

## 🎯 개요

### 디자인 원칙

1. **일관성 (Consistency)**: 모든 컴포넌트와 인터페이스에서 일관된 디자인 언어 사용
2. **접근성 (Accessibility)**: WCAG 2.1 AA 준수 및 모든 사용자를 위한 포용적 디자인
3. **사용성 (Usability)**: 직관적이고 효율적인 사용자 경험 제공
4. **확장성 (Scalability)**: 시스템 확장과 유지보수를 고려한 모듈식 구조
5. **성능 (Performance)**: 최적화된 성능과 빠른 로딩 시간

### 기술 스택

- **디자인 시스템**: Material Design 3
- **프레임워크**: React + Next.js
- **스타일링**: Tailwind CSS + CSS Custom Properties
- **타입스크립트**: 완전한 타입 지원
- **접근성**: WCAG 2.1 AA 준수

## 🚀 설치 및 설정

### 1. 의존성 설치

```bash
npm install lucide-react
```

### 2. Tailwind CSS 설정

`tailwind.config.js` 파일이 디자인 토큰과 연동되어 있는지 확인하세요.

### 3. 전역 스타일 가져오기

```tsx
// app/layout.tsx
import './globals.css'
```

### 4. 디자인 시스템 가져오기

```tsx
import { Button, Input, Card } from '@/lib/design-system'
// 또는
import { Button } from '@/components/ui/Button'
```

## 🎨 디자인 토큰

### 색상 체계

#### Primary Colors (주요 색상)
- **용도**: 주요 액션, 브랜딩, 중요한 UI 요소
- **색상**: Blue 계열 (#2196f3)
- **변형**: 50, 100, 200, 300, 400, 500(기본), 600, 700, 800, 900

```tsx
// 사용 예제
<div className="bg-primary-500 text-white">Primary Action</div>
<div className="border-primary-300">Primary Border</div>
```

#### Secondary Colors (보조 색상)
- **용도**: 보조 액션, 성공 상태 표시
- **색상**: Green 계열 (#4caf50)

#### System Colors (시스템 색상)
- **Error**: Red 계열 (#f44336) - 오류, 삭제, 경고
- **Warning**: Amber 계열 (#ffc107) - 주의, 대기 상태
- **Success**: Green 계열 (#4caf50) - 성공, 완료 상태
- **Info**: Light Blue 계열 (#03a9f4) - 정보, 알림

#### Neutral Colors (중성 색상)
- **용도**: 텍스트, 배경, 테두리
- **범위**: 0 (흰색) ~ 950 (검은색)

### 타이포그래피

#### Font Family
- **Primary**: Inter (고가독성, 다국어 지원)
- **Monospace**: JetBrains Mono (코드, 데이터 표시)

#### Type Scale
```tsx
// Display Styles (대형 제목)
<h1 className="text-display-large">Display Large</h1>  // 57px
<h1 className="text-display-medium">Display Medium</h1> // 45px
<h1 className="text-display-small">Display Small</h1>   // 36px

// Headline Styles (제목)
<h2 className="text-headline-large">Headline Large</h2>   // 32px
<h3 className="text-headline-medium">Headline Medium</h3> // 28px
<h4 className="text-headline-small">Headline Small</h4>   // 24px

// Title Styles (부제목)
<h5 className="text-title-large">Title Large</h5>   // 22px
<h6 className="text-title-medium">Title Medium</h6> // 16px
<span className="text-title-small">Title Small</span> // 14px

// Body Styles (본문)
<p className="text-body-large">Body Large</p>   // 16px
<p className="text-body-medium">Body Medium</p> // 14px
<p className="text-body-small">Body Small</p>   // 12px

// Label Styles (라벨)
<label className="text-label-large">Label Large</label>   // 14px
<label className="text-label-medium">Label Medium</label> // 12px
<label className="text-label-small">Label Small</label>   // 11px
```

### 간격 시스템

8px 기반 시스템을 사용합니다:

```tsx
// Spacing Scale
<div className="p-1">4px padding</div>   // 1 = 4px
<div className="p-2">8px padding</div>   // 2 = 8px
<div className="p-4">16px padding</div>  // 4 = 16px
<div className="p-6">24px padding</div>  // 6 = 24px
<div className="p-8">32px padding</div>  // 8 = 32px
```

### 모서리 둥글기

```tsx
<div className="rounded-xs">2px radius</div>
<div className="rounded-sm">4px radius</div>
<div className="rounded-md">8px radius</div>   // 기본값
<div className="rounded-lg">12px radius</div>
<div className="rounded-xl">16px radius</div>
<div className="rounded-full">완전한 원</div>
```

### 그림자 (Elevation)

Material Design의 elevation 시스템:

```tsx
<div className="shadow-elevation-1">Level 1 elevation</div>
<div className="shadow-elevation-2">Level 2 elevation</div>
<div className="shadow-elevation-3">Level 3 elevation</div>
<div className="shadow-elevation-4">Level 4 elevation</div>
<div className="shadow-elevation-5">Level 5 elevation</div>
```

## 🧩 컴포넌트

### Button

다양한 변형과 크기를 지원하는 버튼 컴포넌트입니다.

```tsx
import { Button } from '@/components/ui/Button'

// 기본 사용법
<Button>Primary Button</Button>

// 변형 (Variants)
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="tertiary">Tertiary</Button>
<Button variant="danger">Danger</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// 크기 (Sizes)
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>  // 기본값
<Button size="lg">Large</Button>

// 상태
<Button disabled>Disabled</Button>
<Button loading>Loading</Button>

// 아이콘과 함께
<Button icon={<PlusIcon />}>Add Item</Button>
<Button icon={<SaveIcon />} iconPosition="right">Save</Button>

// 전체 너비
<Button fullWidth>Full Width Button</Button>

// 링크로 사용
<Button href="/dashboard" target="_blank">Go to Dashboard</Button>
```

### Input

접근성과 사용성을 고려한 입력 필드 컴포넌트입니다.

```tsx
import { Input } from '@/components/ui/Input'

// 기본 사용법
<Input placeholder="Enter your name" />

// 라벨과 함께
<Input 
  label="이메일" 
  type="email" 
  placeholder="example@company.com"
  required 
/>

// 오류 상태
<Input 
  label="비밀번호"
  type="password"
  error={true}
  errorMessage="비밀번호는 8자 이상이어야 합니다"
/>

// 도움말 텍스트
<Input 
  label="사원번호"
  helperText="4자리 숫자로 입력해주세요"
/>

// 아이콘과 함께
<Input 
  icon={<SearchIcon />}
  placeholder="검색..."
/>

// 지우기 버튼
<Input 
  placeholder="내용을 입력하세요"
  clearable
  onClear={() => console.log('Cleared')}
/>

// 크기 변형
<Input size="sm" placeholder="Small" />
<Input size="md" placeholder="Medium" />
<Input size="lg" placeholder="Large" />
```

### Card

콘텐츠를 그룹화하고 구조화하는 카드 컴포넌트입니다.

```tsx
import { Card } from '@/components/ui/Card'

// 기본 사용법
<Card>
  <Card.Header>
    <Card.Title>직원 정보</Card.Title>
    <Card.Subtitle>김철수 - 개발팀</Card.Subtitle>
  </Card.Header>
  <Card.Content>
    <p>사원번호: 1234</p>
    <p>입사일: 2023-01-15</p>
  </Card.Content>
  <Card.Footer>
    <Card.Actions>
      <Button variant="secondary">편집</Button>
      <Button>저장</Button>
    </Card.Actions>
  </Card.Footer>
</Card>

// 변형
<Card variant="default">Default Card</Card>
<Card variant="elevated">Elevated Card</Card>
<Card variant="outlined">Outlined Card</Card>
<Card variant="filled">Filled Card</Card>

// 패딩 제어
<Card padding="none">No Padding</Card>
<Card padding="sm">Small Padding</Card>
<Card padding="md">Medium Padding</Card>
<Card padding="lg">Large Padding</Card>

// 인터랙티브 카드
<Card 
  clickable 
  onClick={() => console.log('Card clicked')}
>
  Click me!
</Card>

<Card hoverable>
  Hover effect
</Card>
```

### Modal

접근성을 고려한 모달/다이얼로그 컴포넌트입니다.

```tsx
import { Modal } from '@/components/ui/Modal'

const [isOpen, setIsOpen] = useState(false)

<Modal 
  open={isOpen} 
  onClose={() => setIsOpen(false)}
  title="직원 정보 수정"
>
  <Modal.Body>
    <p>여기에 모달 내용을 작성합니다.</p>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setIsOpen(false)}>
      취소
    </Button>
    <Button onClick={() => setIsOpen(false)}>
      저장
    </Button>
  </Modal.Footer>
</Modal>

// 크기 변형
<Modal size="sm">Small Modal</Modal>
<Modal size="md">Medium Modal</Modal>
<Modal size="lg">Large Modal</Modal>
<Modal size="full">Full Screen Modal</Modal>

// 설정 옵션
<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  centered={true}
  closeOnBackdropClick={false}
  closeOnEsc={true}
  showCloseButton={true}
>
  Content
</Modal>
```

## 📐 레이아웃 시스템

### Container

콘텐츠를 중앙 정렬하고 최대 너비를 제한하는 컨테이너입니다.

```tsx
import { Container } from '@/components/layout/Container'

// 기본 사용법
<Container>
  <h1>페이지 제목</h1>
  <p>페이지 내용</p>
</Container>

// 최대 너비 설정
<Container maxWidth="sm">Small Container</Container>
<Container maxWidth="md">Medium Container</Container>
<Container maxWidth="lg">Large Container</Container>
<Container maxWidth="xl">Extra Large Container</Container>
<Container maxWidth={false}>No Max Width</Container>

// 패딩 제어
<Container padding="none">No Padding</Container>
<Container padding="sm">Small Padding</Container>
<Container padding="md">Medium Padding</Container>
<Container padding="lg">Large Padding</Container>

// 유체 컨테이너
<Container fluid>
  Full width container
</Container>
```

### Grid

반응형 그리드 시스템입니다.

```tsx
import { Grid } from '@/components/layout/Grid'

// 기본 그리드
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4}>
    <Card>Item 1</Card>
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <Card>Item 2</Card>
  </Grid>
  <Grid item xs={12} sm={6} md={4}>
    <Card>Item 3</Card>
  </Grid>
</Grid>

// 정렬 제어
<Grid 
  container 
  justify="center" 
  align="center"
  direction="column"
>
  <Grid item>Centered Content</Grid>
</Grid>
```

### Stack

일차원 레이아웃을 위한 스택 컴포넌트입니다.

```tsx
import { Stack, HStack, VStack } from '@/components/layout/Stack'

// 수직 스택
<VStack spacing={4}>
  <Button>Button 1</Button>
  <Button>Button 2</Button>
  <Button>Button 3</Button>
</VStack>

// 수평 스택
<HStack spacing={2} align="center">
  <Button variant="secondary">Cancel</Button>
  <Button>Submit</Button>
</HStack>

// 구분선과 함께
<VStack 
  spacing={3} 
  divider={<hr className="border-gray-200" />}
>
  <div>Section 1</div>
  <div>Section 2</div>
  <div>Section 3</div>
</VStack>

// 정렬 옵션
<HStack 
  spacing={4}
  align="center"     // start, center, end, stretch
  justify="between"  // start, center, end, between, around, evenly
>
  <span>Left</span>
  <span>Right</span>
</HStack>
```

## ♿ 접근성

### 키보드 네비게이션

모든 인터랙티브 요소는 키보드로 접근 가능합니다:

- **Tab**: 다음 요소로 이동
- **Shift + Tab**: 이전 요소로 이동
- **Enter/Space**: 버튼 활성화
- **Esc**: 모달/드롭다운 닫기
- **Arrow Keys**: 목록/메뉴 네비게이션

### 스크린 리더 지원

```tsx
// ARIA 라벨 사용
<Button aria-label="사용자 메뉴 열기">
  <UserIcon />
</Button>

// 설명적 텍스트
<Input 
  label="비밀번호"
  aria-describedby="password-help"
/>
<div id="password-help">
  8자 이상, 대소문자와 숫자를 포함해야 합니다.
</div>

// 라이브 리전
import { accessibility } from '@/lib/design-system/accessibility'

// 성공 메시지 알림
accessibility.aria.announce('저장이 완료되었습니다', 'polite')

// 오류 메시지 알림
accessibility.aria.announce('오류가 발생했습니다', 'assertive')
```

### 색상 대비

모든 텍스트는 WCAG 2.1 AA 기준을 만족합니다:

```tsx
import { contrast } from '@/lib/design-system/accessibility'

// 대비율 확인
const contrastRatio = contrast.checkContrast('#2196f3', '#ffffff')
console.log(contrastRatio) // { ratio: 4.5, passes: true, level: 'WCAG AA' }

// 접근 가능한 텍스트 색상 자동 선택
const textColor = contrast.getAccessibleTextColor('#2196f3')
```

### 모션 감소 지원

```tsx
// 사용자 모션 선호도 확인
import { motion } from '@/lib/design-system/accessibility'

const respectsReducedMotion = motion.respectsReducedMotion()

// 조건부 애니메이션
<div className={motion.conditionalAnimation('animate-fade-in')}>
  Content
</div>
```

## 🎬 애니메이션

### CSS 클래스 기반 애니메이션

```tsx
// 입장 애니메이션
<div className="animate-fade-in">Fade In</div>
<div className="animate-slide-in-from-top">Slide from Top</div>
<div className="animate-scale-in">Scale In</div>

// 호버 효과
<div className="hover:scale-105 transition-transform duration-200">
  Hover to Scale
</div>

// 포커스 효과
<button className="focus-ring">
  Accessible Focus Ring
</button>
```

### 애니메이션 유틸리티

```tsx
import { 
  createAnimation, 
  createTransition,
  animationClasses 
} from '@/lib/design-system/animations'

// CSS-in-JS 스타일
const fadeInStyle = createAnimation('fadeIn', 'normal', 'standard')

// 전환 효과
const hoverTransition = createTransition(['transform', 'box-shadow'], 'fast')

// 클래스 기반
<div className={animationClasses.enter.fade}>
  Fade in animation
</div>
```

## 🌗 테마

### 다크 모드 지원

```tsx
// HTML 클래스로 제어
<html className="dark">
  <!-- Dark mode content -->
</html>

// 시스템 설정 자동 감지
@media (prefers-color-scheme: dark) {
  /* 자동으로 다크 모드 적용 */
}
```

### 커스텀 테마

```tsx
import { createCSSVariables, lightTheme, darkTheme } from '@/lib/design-system/theme'

// 커스텀 색상으로 테마 생성
const customTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: {
      ...lightTheme.colors.primary,
      500: '#your-brand-color',
    }
  }
}

// CSS 변수 생성
const cssVars = createCSSVariables(customTheme)
```

## 📚 사용 예제

### 직원 관리 폼

```tsx
import { Container, Card, Input, Button, HStack, VStack } from '@/lib/design-system'

function EmployeeForm() {
  return (
    <Container maxWidth="md">
      <Card>
        <Card.Header>
          <Card.Title>직원 정보 등록</Card.Title>
          <Card.Subtitle>새로운 직원의 정보를 입력해주세요</Card.Subtitle>
        </Card.Header>
        
        <Card.Content>
          <VStack spacing={4}>
            <Input 
              label="이름" 
              placeholder="홍길동" 
              required 
            />
            <Input 
              label="이메일" 
              type="email" 
              placeholder="hong@company.com" 
              required 
            />
            <Input 
              label="부서" 
              placeholder="개발팀" 
            />
            <Input 
              label="입사일" 
              type="date" 
              required 
            />
          </VStack>
        </Card.Content>
        
        <Card.Footer>
          <HStack spacing={2} justify="end">
            <Button variant="secondary">취소</Button>
            <Button type="submit">등록</Button>
          </HStack>
        </Card.Footer>
      </Card>
    </Container>
  )
}
```

### 대시보드 레이아웃

```tsx
import { Container, Grid, Card, Stack } from '@/lib/design-system'

function Dashboard() {
  return (
    <Container maxWidth="xl">
      <VStack spacing={6}>
        <h1 className="text-headline-large">HR 대시보드</h1>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <Card.Content>
                <h3 className="text-title-medium">총 직원 수</h3>
                <p className="text-display-small">124명</p>
              </Card.Content>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <Card.Content>
                <h3 className="text-title-medium">이번 달 신규 입사</h3>
                <p className="text-display-small">8명</p>
              </Card.Content>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <Card.Content>
                <h3 className="text-title-medium">대기 중인 휴가 신청</h3>
                <p className="text-display-small">15건</p>
              </Card.Content>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6} lg={3}>
            <Card>
              <Card.Content>
                <h3 className="text-title-medium">평균 만족도</h3>
                <p className="text-display-small">4.2점</p>
              </Card.Content>
            </Card>
          </Grid>
        </Grid>
      </VStack>
    </Container>
  )
}
```

## 🤝 기여 가이드

### 새로운 컴포넌트 추가

1. **타입 정의**: `src/lib/design-system/types.ts`에 Props 인터페이스 추가
2. **컴포넌트 구현**: `src/components/ui/` 또는 `src/components/layout/`에 구현
3. **스토리북 문서**: 컴포넌트 사용법과 예제 작성
4. **테스트 작성**: 접근성과 기능 테스트 추가
5. **문서 업데이트**: 이 가이드에 사용법 추가

### 디자인 토큰 수정

1. `src/lib/design-system/tokens.ts` 수정
2. `tailwind.config.js` 동기화
3. `src/app/globals.css` CSS 변수 업데이트
4. 영향받는 컴포넌트 테스트

### 코드 스타일

- **접근성 우선**: 모든 컴포넌트는 WCAG 2.1 AA 준수
- **타입 안전성**: 완전한 TypeScript 지원
- **성능 최적화**: 번들 크기와 렌더링 성능 고려
- **문서화**: 모든 Props와 사용법 문서화

### 브랜치 전략

- `main`: 안정적인 릴리즈
- `develop`: 개발 브랜치
- `feature/*`: 새로운 기능
- `fix/*`: 버그 수정
- `docs/*`: 문서 개선

## 📞 지원 및 문의

디자인 시스템에 대한 질문이나 제안사항이 있으시면 언제든지 문의해주세요.

- **이슈 리포트**: GitHub Issues
- **기능 요청**: GitHub Discussions
- **긴급 문의**: 개발팀 Slack 채널

---

**Motion Connect HR Design System v1.0.0**
© 2024 Motion Connect Team. MIT License.
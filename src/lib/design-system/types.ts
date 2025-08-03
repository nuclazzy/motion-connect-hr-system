/**
 * Motion Connect HR Design System - TypeScript Types
 * 디자인 시스템의 모든 타입 정의
 */

import { colors, spacing, borderRadius, typography } from './tokens'

// 색상 관련 타입
export type ColorScale = keyof typeof colors.primary
export type ColorToken = keyof typeof colors
export type SemanticColor = 'success' | 'warning' | 'error' | 'info'

// 간격 관련 타입
export type SpacingToken = keyof typeof spacing

// 테두리 반지름 타입
export type BorderRadiusToken = keyof typeof borderRadius

// 타이포그래피 타입
export type FontSizeToken = keyof typeof typography.fontSize
export type FontWeightToken = keyof typeof typography.fontWeight

// 크기 관련 타입
export type ComponentSize = 'sm' | 'md' | 'lg'
export type ResponsiveSize = ComponentSize | 'xs' | 'xl' | '2xl'

// 버튼 관련 타입
export type ButtonVariant = 
  | 'primary'     // 기본 브랜드 컬러
  | 'secondary'   // 보조 컬러  
  | 'outline'     // 테두리만
  | 'ghost'       // 배경 없음
  | 'text'        // 텍스트만

export type ButtonSize = ComponentSize

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  children: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

// 입력 필드 관련 타입
export type InputVariant = 'outlined' | 'filled' | 'standard'
export type InputSize = ComponentSize
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date'

export interface InputProps {
  variant?: InputVariant
  size?: InputSize
  type?: InputType
  label?: string
  placeholder?: string
  value?: string
  defaultValue?: string
  disabled?: boolean
  required?: boolean
  error?: boolean
  errorMessage?: string
  helpText?: string
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
  fullWidth?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  className?: string
  inputClassName?: string
}

// 카드 관련 타입
export type CardVariant = 'elevated' | 'outlined' | 'filled'
export type CardSize = ComponentSize

export interface CardProps {
  variant?: CardVariant
  size?: CardSize
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

export interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export interface CardTitleProps {
  children: React.ReactNode
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}

// 모달 관련 타입
export type ModalSize = ComponentSize | 'xs' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full' | 'auto'

export interface ModalProps {
  open: boolean
  onClose: () => void
  size?: ModalSize
  centered?: boolean
  closeOnBackdropClick?: boolean
  closeOnEsc?: boolean
  showCloseButton?: boolean
  title?: string
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  zIndex?: number
  'data-testid'?: string
}

export interface ModalHeaderProps {
  children: React.ReactNode
  onClose?: () => void
  className?: string
}

export interface ModalContentProps {
  children: React.ReactNode
  className?: string
}

export interface ModalFooterProps {
  children: React.ReactNode
  className?: string
}

// 토스트 관련 타입
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'
export type ToastPosition = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastProps {
  id: string
  variant?: ToastVariant
  title?: string
  message?: string
  duration?: number
  position?: ToastPosition
  showCloseButton?: boolean
  persistent?: boolean
  action?: React.ReactNode
  onClose?: (id: string) => void
  className?: string
}

export interface ToastContextType {
  toasts: ToastProps[]
  addToast: (toast: Omit<ToastProps, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

// 드롭다운 관련 타입
export type DropdownPosition = 
  | 'top-start' | 'top-end'
  | 'bottom-start' | 'bottom-end'
  | 'left-start' | 'left-end'
  | 'right-start' | 'right-end'

export interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  position?: DropdownPosition
  offset?: number
  closeOnItemClick?: boolean
  closeOnClickOutside?: boolean
  disabled?: boolean
  className?: string
  contentClassName?: string
}

export interface DropdownItemProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  icon?: React.ReactNode
  shortcut?: string
  className?: string
}

// 레이아웃 관련 타입
export type ContainerMaxWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | false

export interface ContainerProps {
  maxWidth?: ContainerMaxWidth
  centerContent?: boolean
  children: React.ReactNode
  className?: string
}

// 그리드 관련 타입
export type GridDirection = 'row' | 'column'
export type GridJustify = 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
export type GridAlign = 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline'
export type GridWrap = 'nowrap' | 'wrap' | 'wrap-reverse'
export type GridSize = number | 'auto'

export interface GridProps {
  container?: boolean
  item?: boolean
  spacing?: number
  direction?: GridDirection
  justify?: GridJustify
  align?: GridAlign
  wrap?: GridWrap
  xs?: GridSize
  sm?: GridSize
  md?: GridSize
  lg?: GridSize
  xl?: GridSize
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
  'data-testid'?: string
}

export interface GridItemProps {
  span?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'full'
  children: React.ReactNode
  className?: string
}

// 스택 레이아웃 타입
export type StackDirection = 'horizontal' | 'vertical'
export type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
export type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'

export interface StackProps {
  direction?: StackDirection
  spacing?: SpacingToken
  align?: StackAlign
  justify?: StackJustify
  wrap?: boolean
  children: React.ReactNode
  className?: string
}

// HStack과 VStack을 위한 인터페이스
export interface HStackProps extends Omit<StackProps, 'direction'> {}
export interface VStackProps extends Omit<StackProps, 'direction'> {}

// 뱃지 관련 타입
export type BadgeVariant = 'solid' | 'outline' | 'soft'
export type BadgeColor = SemanticColor | 'primary' | 'secondary' | 'neutral'

export interface BadgeProps {
  variant?: BadgeVariant
  color?: BadgeColor
  size?: ComponentSize
  children: React.ReactNode
  className?: string
}

// 아바타 관련 타입
export interface AvatarProps {
  src?: string
  alt?: string
  name?: string
  size?: ComponentSize | number
  fallback?: React.ReactNode
  className?: string
}

// 테이블 관련 타입
export type TableVariant = 'simple' | 'striped' | 'bordered'

export interface TableProps {
  variant?: TableVariant
  size?: ComponentSize
  children: React.ReactNode
  className?: string
}

// 폼 관련 타입
export interface FormFieldProps {
  children: React.ReactNode
  error?: boolean
  required?: boolean
  className?: string
}

export interface FormLabelProps {
  children: React.ReactNode
  required?: boolean
  className?: string
}

export interface FormErrorProps {
  children: React.ReactNode
  className?: string
}

export interface FormHelpTextProps {
  children: React.ReactNode
  className?: string
}

// Duplicate toast types removed - defined above

// 드롭다운 관련 타입
export interface DropdownProps {
  trigger: React.ReactNode
  children: React.ReactNode
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
  offset?: number
  className?: string
}

export interface DropdownItemProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

// 탭 관련 타입
export type TabsVariant = 'line' | 'enclosed' | 'soft-rounded' | 'solid-rounded'

export interface TabsProps {
  variant?: TabsVariant
  size?: ComponentSize
  children: React.ReactNode
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export interface TabProps {
  value: string
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export interface TabPanelProps {
  value: string
  children: React.ReactNode
  className?: string
}

// 브레드크럼 관련 타입
export interface BreadcrumbProps {
  children: React.ReactNode
  separator?: React.ReactNode
  className?: string
}

export interface BreadcrumbItemProps {
  children: React.ReactNode
  href?: string
  isCurrentPage?: boolean
  className?: string
}

// 페이지네이션 관련 타입
export interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  size?: ComponentSize
  showFirstLast?: boolean
  showPrevNext?: boolean
  maxVisiblePages?: number
  className?: string
}

// 스피너/로딩 관련 타입
export type SpinnerSize = ComponentSize | number

export interface SpinnerProps {
  size?: SpinnerSize
  color?: string
  thickness?: number
  speed?: string
  className?: string
}

// 아코디언 관련 타입
export interface AccordionProps {
  children: React.ReactNode
  allowMultiple?: boolean
  defaultIndex?: number | number[]
  className?: string
}

export interface AccordionItemProps {
  children: React.ReactNode
  value: string | number
  disabled?: boolean
  className?: string
}

export interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

export interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

// 유틸리티 타입들
export type As<T = any> = React.ElementType<T>

export interface PolymorphicProps<T extends As = As> {
  as?: T
}

export type PropsOf<T extends As> = React.ComponentPropsWithoutRef<T>

export type PolymorphicComponentProps<T extends As, Props = {}> = Props &
  PolymorphicProps<T> &
  Omit<PropsOf<T>, keyof Props | 'as'>

// 반응형 관련 타입
export type ResponsiveValue<T> = T | {
  xs?: T
  sm?: T
  md?: T
  lg?: T
  xl?: T
  '2xl'?: T
}

// 테마 관련 타입
export type ThemeMode = 'light' | 'dark' | 'system'

export interface ThemeConfig {
  mode: ThemeMode
  colors: typeof colors
  typography: typeof typography
  spacing: typeof spacing
  borderRadius: typeof borderRadius
}

export interface ThemeContextType {
  theme: ThemeConfig
  toggleMode: () => void
  setMode: (mode: ThemeMode) => void
}

// 애니메이션 관련 타입
export type AnimationPreset = 
  | 'fade-in'
  | 'fade-out' 
  | 'slide-in-up'
  | 'slide-in-down'
  | 'slide-in-left'
  | 'slide-in-right'
  | 'scale-in'
  | 'scale-out'
  | 'bounce-in'
  | 'bounce-out'

export interface AnimationProps {
  preset?: AnimationPreset
  duration?: number
  delay?: number
  easing?: string
  repeat?: boolean | number
  reverse?: boolean
}

// 접근성 관련 타입
export interface AccessibilityProps {
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-disabled'?: boolean
  'aria-hidden'?: boolean
  role?: string
  tabIndex?: number
}

// 이벤트 핸들러 타입들
export type ClickHandler = (event: React.MouseEvent) => void
export type ChangeHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void
export type FocusHandler<T = HTMLElement> = (event: React.FocusEvent<T>) => void
export type KeyboardHandler = (event: React.KeyboardEvent) => void
export type FormHandler = (event: React.FormEvent) => void

// 공통 컴포넌트 props
export interface BaseComponentProps extends AccessibilityProps {
  id?: string
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

// 데이터 관련 타입 (HR 시스템 전용)
export interface EmployeeData {
  id: string
  name: string
  email: string
  department: string
  position: string
  employee_id: string
  hire_date: string
  is_active: boolean
  role: 'admin' | 'user'
}

export interface LeaveRequestData {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  processed_at?: string
  request_data: Record<string, any>
}

export interface NotificationData {
  id: string
  user_id: string
  message: string
  is_read: boolean
  created_at: string
  link?: string
}
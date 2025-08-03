'use client'

import React, { 
  forwardRef, 
  useRef, 
  useState, 
  useEffect, 
  useCallback,
  Children,
  cloneElement,
  isValidElement
} from 'react'
import { cn } from '@/lib/utils'
import { DropdownProps, DropdownItemProps } from '@/lib/design-system/types'

// 드롭다운 위치 계산
const getPositionClasses = (position: DropdownProps['position'] = 'bottom-start') => {
  const positions = {
    'top-start': 'bottom-full left-0 mb-1',
    'top-end': 'bottom-full right-0 mb-1',
    'bottom-start': 'top-full left-0 mt-1',
    'bottom-end': 'top-full right-0 mt-1',
    'left-start': 'right-full top-0 mr-1',
    'left-end': 'right-full bottom-0 mr-1',
    'right-start': 'left-full top-0 ml-1',
    'right-end': 'left-full bottom-0 ml-1'
  }
  return positions[position]
}

// 드롭다운 아이템 컴포넌트
export const DropdownItem = forwardRef<HTMLButtonElement, DropdownItemProps>(({
  children,
  onClick,
  disabled = false,
  destructive = false,
  icon,
  shortcut,
  className,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 text-sm',
        'text-left rounded-md transition-colors duration-fast',
        'focus:outline-none focus:bg-neutral-100',
        disabled 
          ? 'text-neutral-400 cursor-not-allowed'
          : destructive
            ? 'text-error-600 hover:bg-error-50 hover:text-error-700'
            : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
        className
      )}
      {...props}
    >
      <div className="flex items-center space-x-3">
        {icon && (
          <span className="flex-shrink-0 w-4 h-4">
            {icon}
          </span>
        )}
        <span className="flex-1">{children}</span>
      </div>
      {shortcut && (
        <span className="text-xs text-neutral-400 font-mono">
          {shortcut}
        </span>
      )}
    </button>
  )
})

DropdownItem.displayName = 'DropdownItem'

// 드롭다운 구분선 컴포넌트
export const DropdownSeparator = forwardRef<HTMLDivElement, {
  className?: string
}>(({ className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('my-1 h-px bg-neutral-200', className)}
      role="separator"
    />
  )
})

DropdownSeparator.displayName = 'DropdownSeparator'

// 드롭다운 라벨 컴포넌트
export const DropdownLabel = forwardRef<HTMLDivElement, {
  children: React.ReactNode
  className?: string
}>(({ children, className }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide',
        className
      )}
    >
      {children}
    </div>
  )
})

DropdownLabel.displayName = 'DropdownLabel'

// 메인 드롭다운 컴포넌트
export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(({
  trigger,
  children,
  isOpen: controlledIsOpen,
  onOpenChange,
  position = 'bottom-start',
  offset = 4,
  closeOnItemClick = true,
  closeOnClickOutside = true,
  disabled = false,
  className,
  contentClassName,
  ...props
}, ref) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const isControlled = controlledIsOpen !== undefined
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen
  
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // 드롭다운 열기/닫기 핸들러
  const handleToggle = useCallback(() => {
    if (disabled) return
    
    const newIsOpen = !isOpen
    if (isControlled) {
      onOpenChange?.(newIsOpen)
    } else {
      setInternalIsOpen(newIsOpen)
    }
  }, [disabled, isOpen, isControlled, onOpenChange])

  const handleClose = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false)
    } else {
      setInternalIsOpen(false)
    }
  }, [isControlled, onOpenChange])

  // 외부 클릭 감지
  useEffect(() => {
    if (!isOpen || !closeOnClickOutside) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, closeOnClickOutside, handleClose])

  // ESC 키 감지
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, handleClose])

  // 아이템 클릭 핸들러
  const handleItemClick = useCallback((originalOnClick?: () => void) => {
    return () => {
      originalOnClick?.()
      if (closeOnItemClick) {
        handleClose()
      }
    }
  }, [closeOnItemClick, handleClose])

  // 자식 요소들을 처리하여 클릭 핸들러 추가
  const processedChildren = Children.map(children, (child) => {
    if (isValidElement(child) && child.type === DropdownItem) {
      return cloneElement(child as React.ReactElement<DropdownItemProps>, {
        onClick: handleItemClick((child.props as DropdownItemProps).onClick)
      })
    }
    return child
  })

  return (
    <div
      ref={ref || containerRef}
      className={cn('relative inline-block', className)}
      {...props}
    >
      {/* 트리거 */}
      <div onClick={handleToggle}>
        {trigger}
      </div>

      {/* 드롭다운 콘텐츠 */}
      {isOpen && (
        <div
          ref={contentRef}
          className={cn(
            'absolute z-dropdown min-w-48',
            'bg-white border border-neutral-200 rounded-lg shadow-elevation-2',
            'py-1 animate-scale-in origin-top-left',
            getPositionClasses(position),
            contentClassName
          )}
          style={{
            marginTop: position.startsWith('bottom') ? offset : undefined,
            marginBottom: position.startsWith('top') ? offset : undefined,
            marginLeft: position.startsWith('right') ? offset : undefined,
            marginRight: position.startsWith('left') ? offset : undefined
          }}
          role="menu"
          aria-orientation="vertical"
        >
          {processedChildren}
        </div>
      )}
    </div>
  )
})

Dropdown.displayName = 'Dropdown'

// 복합 컴포넌트로 내보내기
const DropdownComponent = Dropdown as typeof Dropdown & {
  Item: typeof DropdownItem
  Separator: typeof DropdownSeparator
  Label: typeof DropdownLabel
}

DropdownComponent.Item = DropdownItem
DropdownComponent.Separator = DropdownSeparator
DropdownComponent.Label = DropdownLabel

// HR 시스템 전용 드롭다운들
export const UserMenuDropdown = forwardRef<HTMLDivElement, {
  user: {
    name: string
    email: string
    avatar?: string
    role: string
  }
  onProfile?: () => void
  onSettings?: () => void
  onLogout?: () => void
  className?: string
}>(({ user, onProfile, onSettings, onLogout, className }, ref) => {
  const trigger = (
    <button className={cn(
      'flex items-center space-x-2 p-2 rounded-lg',
      'hover:bg-neutral-100 transition-colors duration-fast',
      'focus:outline-none focus:ring-2 focus:ring-primary-500'
    )}>
      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <span className="text-primary-600 font-medium text-sm">
            {user.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="hidden md:block text-left">
        <div className="text-sm font-medium text-neutral-900">{user.name}</div>
        <div className="text-xs text-neutral-500">{user.role}</div>
      </div>
      <svg className="w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )

  return (
    <Dropdown
      ref={ref}
      trigger={trigger}
      position="bottom-end"
      className={className}
    >
      <DropdownLabel>계정</DropdownLabel>
      <DropdownItem
        onClick={onProfile}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        }
      >
        프로필
      </DropdownItem>
      <DropdownItem
        onClick={onSettings}
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      >
        설정
      </DropdownItem>
      <DropdownSeparator />
      <DropdownItem
        onClick={onLogout}
        destructive
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        }
      >
        로그아웃
      </DropdownItem>
    </Dropdown>
  )
})

UserMenuDropdown.displayName = 'UserMenuDropdown'

export default DropdownComponent
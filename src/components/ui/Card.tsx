'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { 
  CardProps, 
  CardHeaderProps, 
  CardContentProps, 
  CardFooterProps, 
  CardTitleProps 
} from '@/lib/design-system/types'

// 카드 변형 스타일
const cardVariants = {
  elevated: 'bg-white shadow-md hover:shadow-lg border-0',
  outlined: 'bg-white border border-neutral-200 shadow-sm hover:shadow-md',
  filled: 'bg-neutral-50 border border-neutral-100 shadow-sm'
} as const

// 카드 크기 스타일
const cardSizes = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
} as const

// 기본 카드 스타일
const baseCardStyles = `
  rounded-lg transition-shadow duration-200 ease-in-out
  overflow-hidden
`

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  variant = 'elevated',
  size = 'md',
  children,
  onClick,
  className,
  ...props
}, ref) => {
  const isClickable = Boolean(onClick)
  
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        baseCardStyles,
        cardVariants[variant],
        cardSizes[size],
        isClickable && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Card.displayName = 'Card'

// 카드 헤더 컴포넌트
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({
  children,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col space-y-1.5 -m-6 mb-6 p-6 border-b border-neutral-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

CardHeader.displayName = 'CardHeader'

// 카드 제목 컴포넌트
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({
  children,
  level = 3,
  className,
  ...props
}, ref) => {
  const titleSizes = {
    1: 'text-2xl font-bold',
    2: 'text-xl font-bold',
    3: 'text-lg font-semibold',
    4: 'text-base font-semibold',
    5: 'text-sm font-semibold',
    6: 'text-xs font-semibold'
  }
  
  const titleClass = cn(
    'text-neutral-900 leading-none tracking-tight',
    titleSizes[level],
    className
  )
  
  if (level === 1) return <h1 ref={ref} className={titleClass} {...props}>{children}</h1>
  if (level === 2) return <h2 ref={ref} className={titleClass} {...props}>{children}</h2>
  if (level === 3) return <h3 ref={ref} className={titleClass} {...props}>{children}</h3>
  if (level === 4) return <h4 ref={ref} className={titleClass} {...props}>{children}</h4>
  if (level === 5) return <h5 ref={ref} className={titleClass} {...props}>{children}</h5>
  return <h6 ref={ref} className={titleClass} {...props}>{children}</h6>
})

CardTitle.displayName = 'CardTitle'

// 카드 설명 컴포넌트
export const CardDescription = forwardRef<HTMLParagraphElement, CardHeaderProps>(({
  children,
  className,
  ...props
}, ref) => {
  return (
    <p
      ref={ref}
      className={cn('text-sm text-neutral-500', className)}
      {...props}
    >
      {children}
    </p>
  )
})

CardDescription.displayName = 'CardDescription'

// 카드 콘텐츠 컴포넌트
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({
  children,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn('space-y-4', className)}
      {...props}
    >
      {children}
    </div>
  )
})

CardContent.displayName = 'CardContent'

// 카드 푸터 컴포넌트
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(({
  children,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between -m-6 mt-6 p-6 border-t border-neutral-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

CardFooter.displayName = 'CardFooter'

// 통계 카드 (HR 시스템 전용)
export const StatsCard = forwardRef<HTMLDivElement, {
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  className?: string
}>(({
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  className,
  ...props
}, ref) => {
  const trendColors = {
    up: 'text-success-600',
    down: 'text-error-600',
    neutral: 'text-neutral-500'
  }
  
  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7V17" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17L7 7M7 7H17M7 7V17" />
      </svg>
    ),
    neutral: null
  }
  
  return (
    <Card ref={ref} className={cn('hover:shadow-md', className)} {...props}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">{value}</p>
          {change && (
            <div className={cn('flex items-center mt-2 text-sm', trendColors[trend])}>
              {trendIcons[trend]}
              <span className="ml-1">{change}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-neutral-400">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
})

StatsCard.displayName = 'StatsCard'

// 알림 카드 (HR 시스템 전용)
export const NotificationCard = forwardRef<HTMLDivElement, {
  title: string
  message: string
  time: string
  isRead?: boolean
  onMarkAsRead?: () => void
  className?: string
}>(({
  title,
  message,
  time,
  isRead = false,
  onMarkAsRead,
  className,
  ...props
}, ref) => {
  return (
    <Card 
      ref={ref} 
      variant="outlined" 
      size="sm"
      className={cn(
        'hover:bg-neutral-50 cursor-pointer',
        !isRead && 'border-l-4 border-l-primary-500 bg-primary-50/30',
        className
      )}
      onClick={onMarkAsRead}
      {...props}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h4 className="text-sm font-medium text-neutral-900">{title}</h4>
          {!isRead && (
            <div className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-1"></div>
          )}
        </div>
        <p className="text-sm text-neutral-600">{message}</p>
        <p className="text-xs text-neutral-400">{time}</p>
      </div>
    </Card>
  )
})

NotificationCard.displayName = 'NotificationCard'

// 직원 카드 (HR 시스템 전용)
export const EmployeeCard = forwardRef<HTMLDivElement, {
  name: string
  position: string
  department: string
  email: string
  avatar?: string
  status?: 'active' | 'inactive' | 'on-leave'
  onEdit?: () => void
  onView?: () => void
  className?: string
}>(({
  name,
  position,
  department,
  email,
  avatar,
  status = 'active',
  onEdit,
  onView,
  className,
  ...props
}, ref) => {
  const statusColors = {
    active: 'bg-success-100 text-success-800',
    inactive: 'bg-neutral-100 text-neutral-800',
    'on-leave': 'bg-warning-100 text-warning-800'
  }
  
  const statusLabels = {
    active: '재직',
    inactive: '퇴사',
    'on-leave': '휴직'
  }
  
  return (
    <Card ref={ref} className={cn('hover:shadow-md', className)} {...props}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <span className="text-primary-600 font-medium">
                  {name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <CardTitle level={4}>{name}</CardTitle>
              <CardDescription>{position} • {department}</CardDescription>
            </div>
          </div>
          <span className={cn(
            'px-2 py-1 rounded-full text-xs font-medium',
            statusColors[status]
          )}>
            {statusLabels[status]}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600">{email}</p>
      </CardContent>
      {(onEdit || onView) && (
        <CardFooter>
          <div className="flex space-x-2">
            {onView && (
              <button
                onClick={onView}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                상세 보기
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="text-sm text-neutral-600 hover:text-neutral-700 font-medium"
              >
                편집
              </button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
})

EmployeeCard.displayName = 'EmployeeCard'

// 복합 컴포넌트 타입 정의
const CardComponent = Card as typeof Card & {
  Header: typeof CardHeader
  Title: typeof CardTitle
  Description: typeof CardDescription
  Content: typeof CardContent
  Footer: typeof CardFooter
}

// 기본 Card에 서브 컴포넌트들 연결
CardComponent.Header = CardHeader
CardComponent.Title = CardTitle
CardComponent.Description = CardDescription
CardComponent.Content = CardContent
CardComponent.Footer = CardFooter

export default CardComponent
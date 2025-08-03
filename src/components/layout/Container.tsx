'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ContainerProps } from '@/lib/design-system/types'

// 컨테이너 최대 너비 정의
const maxWidths = {
  xs: 'max-w-screen-xs',    // ~475px
  sm: 'max-w-screen-sm',    // ~640px  
  md: 'max-w-screen-md',    // ~768px
  lg: 'max-w-screen-lg',    // ~1024px
  xl: 'max-w-screen-xl',    // ~1280px
  '2xl': 'max-w-screen-2xl' // ~1536px
} as const

export const Container = forwardRef<HTMLDivElement, ContainerProps>(({
  maxWidth = 'lg',
  centerContent = false,
  children,
  className,
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8',
        maxWidth && maxWidths[maxWidth],
        centerContent && 'flex items-center justify-center min-h-full',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})

Container.displayName = 'Container'

// 페이지 레벨 컨테이너 (HR 시스템 전용)
export const PageContainer = forwardRef<HTMLDivElement, ContainerProps & {
  title?: string
  description?: string
  actions?: React.ReactNode
}>(({
  title,
  description, 
  actions,
  children,
  className,
  ...props
}, ref) => {
  return (
    <Container ref={ref} className={cn('py-6', className)} {...props}>
      {(title || description || actions) && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              {title && (
                <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
              )}
              {description && (
                <p className="mt-2 text-neutral-600">{description}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-4">
                {actions}
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </Container>
  )
})

PageContainer.displayName = 'PageContainer'

// 섹션 컨테이너
export const SectionContainer = forwardRef<HTMLDivElement, ContainerProps & {
  as?: 'section' | 'div' | 'article' | 'aside'
  title?: string
  subtitle?: string
}>(({
  as: Component = 'section',
  title,
  subtitle,
  children,
  className,
  ...props
}, ref) => {
  return (
    <Component
      ref={ref as any}
      className={cn('py-12', className)}
      {...props}
    >
      <Container {...props}>
        {(title || subtitle) && (
          <div className="text-center mb-12">
            {title && (
              <h2 className="text-3xl font-bold text-neutral-900">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </Container>
    </Component>
  )
})

SectionContainer.displayName = 'SectionContainer'

// 대시보드 컨테이너 (HR 시스템 전용)
export const DashboardContainer = forwardRef<HTMLDivElement, ContainerProps>(({
  children,
  className,
  ...props
}, ref) => {
  return (
    <Container 
      ref={ref} 
      maxWidth="2xl" 
      className={cn('py-6 space-y-6', className)} 
      {...props}
    >
      {children}
    </Container>
  )
})

DashboardContainer.displayName = 'DashboardContainer'

export default Container
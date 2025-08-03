'use client'

import React, { forwardRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { ToastProps, ToastContextType } from '@/lib/design-system/types'

// 토스트 변형 스타일
const toastVariants = {
  success: {
    container: 'bg-success-50 border-success-200 text-success-800',
    icon: (
      <svg className="w-5 h-5 text-success-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  },
  error: {
    container: 'bg-error-50 border-error-200 text-error-800',
    icon: (
      <svg className="w-5 h-5 text-error-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
  warning: {
    container: 'bg-warning-50 border-warning-200 text-warning-800',
    icon: (
      <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  info: {
    container: 'bg-info-50 border-info-200 text-info-800',
    icon: (
      <svg className="w-5 h-5 text-info-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
} as const

// 토스트 위치 스타일
const positionStyles = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4'
} as const

export const Toast = forwardRef<HTMLDivElement, ToastProps>(({
  id,
  variant = 'info',
  title,
  message,
  duration = 5000,
  position = 'top-right',
  showCloseButton = true,
  persistent = false,
  action,
  onClose,
  className,
  ...props
}, ref) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isLeaving, setIsLeaving] = useState(false)

  // 자동 삭제 타이머
  useEffect(() => {
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, persistent])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose?.(id)
    }, 200) // 애니메이션 시간과 맞춤
  }

  if (!isVisible) return null

  const toastContent = (
    <div
      ref={ref}
      className={cn(
        'fixed z-toast max-w-sm w-full',
        'border rounded-lg shadow-elevation-2',
        'p-4 transition-all duration-fast ease-standard',
        toastVariants[variant].container,
        positionStyles[position],
        isLeaving ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
        className
      )}
      role="alert"
      aria-live="polite"
      {...props}
    >
      <div className="flex items-start space-x-3">
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          {toastVariants[variant].icon}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="text-sm font-medium mb-1">
              {title}
            </h4>
          )}
          {message && (
            <p className="text-sm">
              {message}
            </p>
          )}
          {action && (
            <div className="mt-2">
              {action}
            </div>
          )}
        </div>

        {/* 닫기 버튼 */}
        {showCloseButton && (
          <button
            onClick={handleClose}
            className={cn(
              'flex-shrink-0 p-1 rounded-md',
              'hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-black/20',
              'transition-colors duration-fast'
            )}
            aria-label="토스트 닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 진행 바 (지속시간 표시) */}
      {!persistent && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg overflow-hidden">
          <div 
            className="h-full bg-current opacity-30 animate-shrink-width" 
            style={{ 
              animationDuration: `${duration}ms`,
              animationTimingFunction: 'linear'
            }}
          />
        </div>
      )}
    </div>
  )

  // 포털로 렌더링
  if (typeof window !== 'undefined') {
    return createPortal(toastContent, document.body)
  }

  return null
})

Toast.displayName = 'Toast'

// 토스트 컨테이너 컴포넌트
export const ToastContainer = forwardRef<HTMLDivElement, {
  toasts: ToastProps[]
  position?: ToastProps['position']
  className?: string
}>(({ toasts, position = 'top-right', className }, ref) => {
  if (toasts.length === 0) return null

  return (
    <div
      ref={ref}
      className={cn(
        'fixed z-toast pointer-events-none',
        positionStyles[position],
        className
      )}
    >
      <div className="space-y-2 pointer-events-auto">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </div>
  )
})

ToastContainer.displayName = 'ToastContainer'

// 토스트 컨텍스트와 훅 (추후 구현을 위한 타입 정의)
export const ToastContext = React.createContext<ToastContextType | null>(null)

// 편의 함수들
export const createToast = (props: Omit<ToastProps, 'id'>): ToastProps => ({
  ...props,
  id: Math.random().toString(36).substr(2, 9)
})

export const createSuccessToast = (title: string, message?: string): ToastProps => 
  createToast({ variant: 'success', title, message })

export const createErrorToast = (title: string, message?: string): ToastProps => 
  createToast({ variant: 'error', title, message })

export const createWarningToast = (title: string, message?: string): ToastProps => 
  createToast({ variant: 'warning', title, message })

export const createInfoToast = (title: string, message?: string): ToastProps => 
  createToast({ variant: 'info', title, message })

export default Toast
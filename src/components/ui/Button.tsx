'use client'

import React, { forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ButtonProps, ButtonVariant, ButtonSize } from '@/lib/design-system/types'

// 버튼 변형 스타일 정의
const buttonVariants = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-white shadow-sm hover:shadow-md focus:ring-primary-500',
  secondary: 'bg-secondary-100 hover:bg-secondary-200 text-secondary-900 border border-secondary-300 hover:border-secondary-400 focus:ring-secondary-500',
  outline: 'border border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
  ghost: 'text-primary-500 hover:bg-primary-50 focus:ring-primary-500',
  text: 'text-primary-500 hover:text-primary-600 focus:ring-primary-500 p-0'
} as const

// 버튼 크기 스타일 정의
const buttonSizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
} as const

// 기본 버튼 스타일
const baseButtonStyles = `
  inline-flex items-center justify-center gap-2
  rounded-md font-medium
  transition-all duration-200 ease-in-out
  focus:outline-none focus:ring-2 focus:ring-offset-2
  disabled:opacity-50 disabled:pointer-events-none
  active:scale-95
`

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  startIcon,
  endIcon,
  children,
  className,
  type = 'button',
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        baseButtonStyles,
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <svg 
            className="animate-spin h-4 w-4" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>로딩 중...</span>
        </>
      ) : (
        <>
          {startIcon && <span className="flex-shrink-0">{startIcon}</span>}
          <span>{children}</span>
          {endIcon && <span className="flex-shrink-0">{endIcon}</span>}
        </>
      )}
    </button>
  )
})

Button.displayName = 'Button'

// 미리 정의된 버튼 변형들
export const PrimaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="primary" {...props} />
)
PrimaryButton.displayName = 'PrimaryButton'

export const SecondaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="secondary" {...props} />
)
SecondaryButton.displayName = 'SecondaryButton'

export const OutlineButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="outline" {...props} />
)
OutlineButton.displayName = 'OutlineButton'

export const GhostButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="ghost" {...props} />
)
GhostButton.displayName = 'GhostButton'

export const TextButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  (props, ref) => <Button ref={ref} variant="text" {...props} />
)
TextButton.displayName = 'TextButton'

// 시맨틱 버튼들 (HR 시스템 전용)
export const SubmitButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'type'>>(
  (props, ref) => <Button ref={ref} type="submit" {...props} />
)
SubmitButton.displayName = 'SubmitButton'

export const CancelButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ children = '취소', ...props }, ref) => 
    <Button ref={ref} variant="outline" {...props}>{children}</Button>
)
CancelButton.displayName = 'CancelButton'

export const ApproveButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ children = '승인', ...props }, ref) => 
    <Button ref={ref} variant="primary" {...props}>{children}</Button>
)
ApproveButton.displayName = 'ApproveButton'

export const RejectButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ children = '거절', className, ...props }, ref) => 
    <Button 
      ref={ref} 
      variant="outline" 
      className={cn('border-error-500 text-error-500 hover:bg-error-50', className)}
      {...props}
    >
      {children}
    </Button>
)
RejectButton.displayName = 'RejectButton'

export const DeleteButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ children = '삭제', className, ...props }, ref) => 
    <Button 
      ref={ref} 
      variant="primary" 
      className={cn('bg-error-500 hover:bg-error-600 focus:ring-error-500', className)}
      {...props}
    >
      {children}
    </Button>
)
DeleteButton.displayName = 'DeleteButton'

export const SaveButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant' | 'type'>>(
  ({ children = '저장', ...props }, ref) => 
    <Button ref={ref} variant="primary" type="submit" {...props}>{children}</Button>
)
SaveButton.displayName = 'SaveButton'

export const EditButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(
  ({ children = '수정', ...props }, ref) => 
    <Button ref={ref} variant="outline" {...props}>{children}</Button>
)
EditButton.displayName = 'EditButton'

export const LoadingButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, loading = true, disabled, ...props }, ref) => 
    <Button ref={ref} loading={loading} disabled={disabled || loading} {...props}>{children}</Button>
)
LoadingButton.displayName = 'LoadingButton'

export default Button
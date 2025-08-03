'use client'

import React, { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { InputProps } from '@/lib/design-system/types'

// 입력 필드 변형 스타일
const inputVariants = {
  outlined: `
    border border-neutral-300 bg-white
    focus:border-primary-500 focus:ring-1 focus:ring-primary-500
    hover:border-neutral-400
  `,
  filled: `
    border-0 bg-neutral-100
    focus:bg-white focus:ring-2 focus:ring-primary-500
    hover:bg-neutral-200
  `,
  standard: `
    border-0 border-b border-neutral-300 bg-transparent rounded-none
    focus:border-b-2 focus:border-primary-500
    hover:border-neutral-400
  `
} as const

// 입력 필드 크기 스타일
const inputSizes = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-base',
  lg: 'h-12 px-6 text-lg'
} as const

// 기본 입력 필드 스타일
const baseInputStyles = `
  w-full rounded-md
  transition-all duration-200 ease-in-out
  placeholder:text-neutral-400
  focus:outline-none
  disabled:opacity-50 disabled:cursor-not-allowed
`

// 레이블 스타일
const labelStyles = 'block text-sm font-medium text-neutral-700 mb-1'

// 에러 메시지 스타일
const errorStyles = 'text-sm text-error-500 mt-1'

// 도움말 텍스트 스타일
const helpTextStyles = 'text-sm text-neutral-500 mt-1'

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  variant = 'outlined',
  size = 'md',
  type = 'text',
  label,
  placeholder,
  value,
  defaultValue,
  disabled = false,
  required = false,
  error = false,
  errorMessage,
  helpText,
  startAdornment,
  endAdornment,
  fullWidth = true,
  className,
  inputClassName,
  ...props
}, ref) => {
  const [focused, setFocused] = useState(false)
  const hasAdornments = startAdornment || endAdornment
  
  const inputElement = (
    <div className={cn('relative', fullWidth && 'w-full')}>
      {hasAdornments ? (
        <div className={cn(
          'relative flex items-center',
          baseInputStyles,
          inputVariants[variant],
          inputSizes[size],
          error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
          focused && variant === 'outlined' && !error && 'border-primary-500 ring-1 ring-primary-500',
          className
        )}>
          {startAdornment && (
            <div className="flex-shrink-0 mr-2 text-neutral-400">
              {startAdornment}
            </div>
          )}
          <input
            ref={ref}
            type={type}
            value={value}
            defaultValue={defaultValue}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            className={cn(
              'flex-1 bg-transparent border-0 outline-none',
              'placeholder:text-neutral-400',
              inputClassName
            )}
            onFocus={(e) => {
              setFocused(true)
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              setFocused(false)
              props.onBlur?.(e)
            }}
            {...props}
          />
          {endAdornment && (
            <div className="flex-shrink-0 ml-2 text-neutral-400">
              {endAdornment}
            </div>
          )}
        </div>
      ) : (
        <input
          ref={ref}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={cn(
            baseInputStyles,
            inputVariants[variant],
            inputSizes[size],
            error && 'border-error-500 focus:border-error-500 focus:ring-error-500',
            className,
            inputClassName
          )}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          {...props}
        />
      )}
    </div>
  )

  // 레이블이 있는 경우 필드 래퍼로 감싸기
  if (label || errorMessage || helpText) {
    return (
      <div className={cn('space-y-1', fullWidth && 'w-full')}>
        {label && (
          <label className={cn(labelStyles, required && 'after:content-["*"] after:text-error-500 after:ml-1')}>
            {label}
          </label>
        )}
        {inputElement}
        {error && errorMessage && (
          <div className={errorStyles}>
            {errorMessage}
          </div>
        )}
        {!error && helpText && (
          <div className={helpTextStyles}>
            {helpText}
          </div>
        )}
      </div>
    )
  }

  return inputElement
})

Input.displayName = 'Input'

// 특수 타입 입력 필드들
export const EmailInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="email" {...props} />
)
EmailInput.displayName = 'EmailInput'

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'endAdornment'>>(
  ({ ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false)
    
    return (
      <Input
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        endAdornment={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-neutral-400 hover:text-neutral-600 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.657 5.657l1.415 1.414M14.121 14.121L18.364 18.364m-4.243-4.243L17.657 17.657" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        }
        {...props}
      />
    )
  }
)
PasswordInput.displayName = 'PasswordInput'

export const NumberInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="number" {...props} />
)
NumberInput.displayName = 'NumberInput'

export const TelInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="tel" {...props} />
)
TelInput.displayName = 'TelInput'

export const SearchInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'startAdornment'>>(
  (props, ref) => (
    <Input
      ref={ref}
      type="search"
      startAdornment={
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      }
      {...props}
    />
  )
)
SearchInput.displayName = 'SearchInput'

// HR 시스템 전용 입력 필드들
export const EmployeeIdInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  ({ placeholder = '사원번호를 입력하세요', ...props }, ref) => (
    <NumberInput
      ref={ref}
      placeholder={placeholder}
      {...props}
    />
  )
)
EmployeeIdInput.displayName = 'EmployeeIdInput'

export const DepartmentInput = forwardRef<HTMLInputElement, InputProps>(
  ({ placeholder = '부서명을 입력하세요', ...props }, ref) => (
    <Input
      ref={ref}
      placeholder={placeholder}
      {...props}
    />
  )
)
DepartmentInput.displayName = 'DepartmentInput'

export const PositionInput = forwardRef<HTMLInputElement, InputProps>(
  ({ placeholder = '직책을 입력하세요', ...props }, ref) => (
    <Input
      ref={ref}
      placeholder={placeholder}
      {...props}
    />
  )
)
PositionInput.displayName = 'PositionInput'

export const DateInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type'>>(
  (props, ref) => <Input ref={ref} type="date" {...props} />
)
DateInput.displayName = 'DateInput'

export default Input
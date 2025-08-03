import { NextResponse } from 'next/server'

/**
 * API 응답 포맷을 일관성 있게 만들기 위한 유틸리티
 */

export interface ApiError {
  code: string
  message: string
  details?: any
}

export interface ApiSuccess<T = any> {
  success: true
  data?: T
  message?: string
}

export interface ApiFailure {
  success: false
  error: ApiError
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiFailure

/**
 * 성공 응답 생성
 */
export function successResponse<T = any>(data?: T, message?: string): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({
    success: true,
    data,
    message
  })
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  code: string, 
  message: string, 
  status: number = 400,
  details?: any
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details
      }
    },
    { status }
  )
}

/**
 * 일반적인 에러 코드들
 */
export const ErrorCodes = {
  // 인증 관련
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // 휴가 관련
  INSUFFICIENT_LEAVE: 'INSUFFICIENT_LEAVE',
  INVALID_LEAVE_REQUEST: 'INVALID_LEAVE_REQUEST',
  LEAVE_ALREADY_PROCESSED: 'LEAVE_ALREADY_PROCESSED',
  
  // 데이터 관련
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // 외부 서비스
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  
  // 일반
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST'
} as const
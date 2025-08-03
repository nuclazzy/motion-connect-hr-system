/**
 * 통합 에러 관리 시스템
 * 기존 문제: 일반적인 "오류 발생" 메시지
 * 개선: 사용자 친화적이고 구체적인 에러 메시지 제공
 */

export enum ErrorCode {
  // 인증 관련
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_PERMISSION = 'AUTH_INSUFFICIENT_PERMISSION',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  
  // 휴가 관련
  LEAVE_INSUFFICIENT_BALANCE = 'LEAVE_INSUFFICIENT_BALANCE',
  LEAVE_OVERLAPPING_REQUEST = 'LEAVE_OVERLAPPING_REQUEST',
  LEAVE_INVALID_DATE_RANGE = 'LEAVE_INVALID_DATE_RANGE',
  LEAVE_PAST_DATE_NOT_ALLOWED = 'LEAVE_PAST_DATE_NOT_ALLOWED',
  LEAVE_MAX_DAYS_EXCEEDED = 'LEAVE_MAX_DAYS_EXCEEDED',
  
  // 데이터 관련
  DATA_NOT_FOUND = 'DATA_NOT_FOUND',
  DATA_DUPLICATE_ENTRY = 'DATA_DUPLICATE_ENTRY',
  DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
  
  // 시스템 관련
  SYSTEM_DATABASE_ERROR = 'SYSTEM_DATABASE_ERROR',
  SYSTEM_NETWORK_ERROR = 'SYSTEM_NETWORK_ERROR',
  SYSTEM_TIMEOUT = 'SYSTEM_TIMEOUT',
  
  // 외부 서비스
  CALENDAR_SERVICE_ERROR = 'CALENDAR_SERVICE_ERROR',
  EMAIL_SERVICE_ERROR = 'EMAIL_SERVICE_ERROR'
}

export interface AppError {
  code: ErrorCode
  message: string
  userMessage: string
  technicalDetails?: any
  suggestions?: string[]
  timestamp: Date
  userId?: string
  context?: any
}

export class ErrorManager {
  /**
   * 에러 코드를 사용자 친화적 메시지로 변환
   */
  static getUserFriendlyMessage(error: any, context?: any): AppError {
    const timestamp = new Date()
    
    // 기존 방식: catch (error) { alert('오류 발생') }
    // 개선 방식: 구체적이고 도움이 되는 메시지
    
    if (error.code) {
      switch (error.code) {
        case ErrorCode.AUTH_TOKEN_EXPIRED:
          return {
            code: ErrorCode.AUTH_TOKEN_EXPIRED,
            message: 'Authentication token has expired',
            userMessage: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
            suggestions: ['로그인 페이지로 이동하여 다시 로그인하세요.'],
            timestamp
          }
          
        case ErrorCode.LEAVE_INSUFFICIENT_BALANCE:
          const { requested, available, leaveType } = context || {}
          return {
            code: ErrorCode.LEAVE_INSUFFICIENT_BALANCE,
            message: 'Insufficient leave balance',
            userMessage: `${leaveType} 잔여량이 부족합니다.`,
            suggestions: [
              `신청일수: ${requested}일, 잔여일수: ${available}일`,
              '더 적은 일수로 신청하거나 관리자에게 문의하세요.'
            ],
            timestamp,
            context
          }
          
        case ErrorCode.LEAVE_OVERLAPPING_REQUEST:
          return {
            code: ErrorCode.LEAVE_OVERLAPPING_REQUEST,
            message: 'Overlapping leave request detected',
            userMessage: '같은 기간에 이미 신청된 휴가가 있습니다.',
            suggestions: [
              '기존 신청을 취소하거나 다른 날짜로 신청하세요.',
              '문의사항이 있으면 관리자에게 연락하세요.'
            ],
            timestamp
          }
          
        case ErrorCode.CALENDAR_SERVICE_ERROR:
          return {
            code: ErrorCode.CALENDAR_SERVICE_ERROR,
            message: 'Google Calendar service error',
            userMessage: '캘린더 등록 중 오류가 발생했습니다.',
            suggestions: [
              '휴가 승인은 완료되었으나 캘린더 등록에 실패했습니다.',
              '관리자가 수동으로 캘린더에 등록하겠습니다.'
            ],
            timestamp
          }
          
        case ErrorCode.DATA_VALIDATION_FAILED:
          const { field, value, rule } = context?.validation || {}
          return {
            code: ErrorCode.DATA_VALIDATION_FAILED,
            message: 'Data validation failed',
            userMessage: `입력 데이터가 올바르지 않습니다.`,
            suggestions: [
              field ? `${field} 필드를 확인해주세요.` : '입력값을 다시 확인해주세요.',
              rule ? `규칙: ${rule}` : ''
            ].filter(Boolean),
            timestamp,
            context
          }
          
        default:
          return ErrorManager.createGenericError(error, timestamp)
      }
    }
    
    // HTTP 상태 코드 기반 에러 처리
    if (error.status) {
      switch (error.status) {
        case 401:
          return {
            code: ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
            message: 'Unauthorized access',
            userMessage: '로그인이 필요하거나 권한이 없습니다.',
            suggestions: [
              '로그인 상태를 확인하세요.',
              '관리자 권한이 필요한 기능일 수 있습니다.'
            ],
            timestamp
          }
          
        case 403:
          return {
            code: ErrorCode.AUTH_INSUFFICIENT_PERMISSION,
            message: 'Forbidden access',
            userMessage: '접근 권한이 없습니다.',
            suggestions: [
              '해당 기능을 사용할 권한이 없습니다.',
              '관리자에게 권한 요청을 하세요.'
            ],
            timestamp
          }
          
        case 404:
          return {
            code: ErrorCode.DATA_NOT_FOUND,
            message: 'Resource not found',
            userMessage: '요청한 데이터를 찾을 수 없습니다.',
            suggestions: [
              '페이지를 새로고침해보세요.',
              '다른 항목을 선택해보세요.'
            ],
            timestamp
          }
          
        case 409:
          return {
            code: ErrorCode.DATA_DUPLICATE_ENTRY,
            message: 'Duplicate entry',
            userMessage: '이미 존재하는 데이터입니다.',
            suggestions: [
              '다른 값으로 시도해보세요.',
              '기존 데이터를 수정하시겠습니까?'
            ],
            timestamp
          }
          
        case 500:
          return {
            code: ErrorCode.SYSTEM_DATABASE_ERROR,
            message: 'Internal server error',
            userMessage: '서버에서 오류가 발생했습니다.',
            suggestions: [
              '잠시 후 다시 시도해주세요.',
              '문제가 계속되면 관리자에게 연락하세요.'
            ],
            timestamp
          }
          
        default:
          return ErrorManager.createGenericError(error, timestamp)
      }
    }
    
    // 네트워크 에러 처리
    if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
      return {
        code: ErrorCode.SYSTEM_NETWORK_ERROR,
        message: 'Network connection error',
        userMessage: '인터넷 연결을 확인해주세요.',
        suggestions: [
          '네트워크 연결 상태를 확인하세요.',
          'VPN 사용 중이면 해제 후 시도해보세요.'
        ],
        timestamp
      }
    }
    
    return ErrorManager.createGenericError(error, timestamp)
  }
  
  private static createGenericError(error: any, timestamp: Date): AppError {
    // 에러 메시지에서 파일 경로 제거 (보안상 민감한 정보 노출 방지)
    let cleanMessage = error.message || 'Unknown error'
    
    // 파일 경로 패턴 제거 (/var/folders/..., /Users/..., C:\... 등)
    cleanMessage = cleanMessage.replace(/\/(?:var|Users|home|tmp)\/[^\s]+/gi, '[시스템 경로]')
    cleanMessage = cleanMessage.replace(/[C-Z]:\\[^\s]+/gi, '[시스템 경로]')
    
    return {
      code: ErrorCode.SYSTEM_DATABASE_ERROR,
      message: cleanMessage,
      userMessage: '예상치 못한 오류가 발생했습니다.',
      suggestions: [
        '페이지를 새로고침해보세요.',
        '문제가 계속되면 관리자에게 연락하세요.'
      ],
      // technicalDetails는 개발 환경에서만 포함
      ...(process.env.NODE_ENV === 'development' && { technicalDetails: error }),
      timestamp
    }
  }
  
  /**
   * 에러를 로그에 기록 (개발/운영 환경 구분)
   */
  static logError(appError: AppError, userId?: string): void {
    const logData = {
      ...appError,
      userId,
      environment: process.env.NODE_ENV,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server'
    }
    
    // 개발 환경에서는 콘솔에 출력
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Application Error')
      console.error('Code:', appError.code)
      console.error('User Message:', appError.userMessage)
      console.error('Technical Details:', appError.technicalDetails)
      console.error('Context:', appError.context)
      console.groupEnd()
    }
    
    // 운영 환경에서는 로깅 서비스로 전송
    // (실제로는 Sentry, LogRocket 등의 서비스 사용)
    if (process.env.NODE_ENV === 'production') {
      // sendToLoggingService(logData)
    }
  }
  
  /**
   * 사용자에게 에러 표시 (토스트, 모달 등)
   */
  static showUserError(appError: AppError): void {
    // 기존: alert('오류 발생')
    // 개선: 구조화된 에러 UI
    
    if (typeof window !== 'undefined') {
      // React Toast 라이브러리 사용 예시
      const errorDisplay = {
        title: '오류',
        message: appError.userMessage,
        type: 'error',
        duration: 5000,
        actions: appError.suggestions?.map(suggestion => ({
          label: '도움말',
          action: () => ErrorManager.showErrorHelp(appError)
        }))
      }
      
      // showToast(errorDisplay)
      
      // 임시로 개선된 alert 사용
      const message = [
        appError.userMessage,
        '',
        '💡 해결 방법:',
        ...appError.suggestions || []
      ].join('\n')
      
      alert(message)
    }
  }
  
  private static showErrorHelp(appError: AppError): void {
    const helpContent = [
      `오류 코드: ${appError.code}`,
      `발생 시간: ${appError.timestamp.toLocaleString()}`,
      '',
      '해결 방법:',
      ...appError.suggestions || [],
      '',
      '문제가 계속되면 다음 정보와 함께 관리자에게 연락하세요:',
      `- 오류 코드: ${appError.code}`,
      `- 발생 시간: ${appError.timestamp.toISOString()}`
    ].join('\n')
    
    alert(helpContent)
  }
}

/**
 * API 응답 에러 처리 유틸리티
 */
export async function handleApiResponse(response: Response, context?: any): Promise<any> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    
    const appError = ErrorManager.getUserFriendlyMessage({
      status: response.status,
      code: errorData.code,
      message: errorData.message || errorData.error
    }, context)
    
    ErrorManager.logError(appError)
    ErrorManager.showUserError(appError)
    
    throw appError
  }
  
  return response.json()
}

/**
 * 사용 예시:
 * 
 * // 기존 방식
 * try {
 *   const response = await fetch('/api/leave-request')
 *   if (!response.ok) throw new Error('Failed')
 * } catch (error) {
 *   alert('오류 발생')
 * }
 * 
 * // 개선된 방식
 * try {
 *   const response = await fetch('/api/leave-request')
 *   const data = await handleApiResponse(response, { requestType: 'leave' })
 * } catch (appError) {
 *   // 자동으로 사용자 친화적 에러 메시지 표시됨
 * }
 */
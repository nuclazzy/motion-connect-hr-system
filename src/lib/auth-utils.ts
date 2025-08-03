import { NextRequest } from 'next/server'
import { errorResponse, ErrorCodes } from './api-response'

/**
 * Authorization 헤더에서 userId를 안전하게 추출
 */
export function extractUserIdFromAuth(request: NextRequest): { userId: string | null, error?: ReturnType<typeof errorResponse> } {
  const authorization = request.headers.get('authorization')
  
  if (!authorization) {
    return { 
      userId: null, 
      error: errorResponse(
        ErrorCodes.UNAUTHORIZED,
        '인증 헤더가 없습니다.',
        401
      )
    }
  }
  
  if (!authorization.startsWith('Bearer ')) {
    return { 
      userId: null, 
      error: errorResponse(
        ErrorCodes.UNAUTHORIZED,
        '잘못된 인증 형식입니다.',
        401
      )
    }
  }
  
  const userId = authorization.replace('Bearer ', '').trim()
  
  // UUID 형식 검증 (간단한 검증)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return { 
      userId: null, 
      error: errorResponse(
        ErrorCodes.UNAUTHORIZED,
        '잘못된 사용자 ID 형식입니다.',
        401
      )
    }
  }
  
  return { userId }
}

/**
 * 관리자 권한 검증
 */
export async function verifyAdminRole(
  supabase: any,
  userId: string
): Promise<{ isAdmin: boolean, error?: ReturnType<typeof errorResponse> }> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return { 
        isAdmin: false,
        error: errorResponse(
          ErrorCodes.NOT_FOUND,
          '사용자를 찾을 수 없습니다.',
          404
        )
      }
    }

    if (user.role !== 'admin') {
      return { 
        isAdmin: false,
        error: errorResponse(
          ErrorCodes.FORBIDDEN,
          '관리자 권한이 필요합니다.',
          403
        )
      }
    }

    return { isAdmin: true }
  } catch (error) {
    return { 
      isAdmin: false,
      error: errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        '권한 확인 중 오류가 발생했습니다.',
        500
      )
    }
  }
}
/**
 * Supabase 인증 관련 유틸리티
 */

// 클라이언트 사이드 인증 함수들

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  employee_id: string
  department: string
  position: string
  hire_date: string
  phone?: string
  dob?: string
  address?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

/**
 * 사용자 로그인 (API Route 사용)
 */
export async function loginUser(credentials: LoginCredentials): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    })

    const result = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || '로그인에 실패했습니다.'
      }
    }

    return result

  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 현재 로그인된 사용자 정보 조회
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // 브라우저 환경에서만 실행
    if (typeof window === 'undefined') {
      return null
    }

    const userString = localStorage.getItem('motion-connect-user')
    if (!userString) {
      return null
    }

    const user = JSON.parse(userString)
    
    // 토큰 유효성 검사 (향후 JWT 구현 시 사용)
    return user

  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}

/**
 * 사용자 로그아웃
 */
export function logoutUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('motion-connect-user')
    window.location.href = '/auth/login'
  }
}

/**
 * 사용자 세션 저장
 */
export function saveUserSession(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('motion-connect-user', JSON.stringify(user))
  }
}

/**
 * 권한 확인
 */
export function checkPermission(user: User | null, requiredRole: 'admin' | 'user'): boolean {
  if (!user) return false
  
  if (requiredRole === 'admin') {
    return user.role === 'admin'
  }
  
  return true // 모든 로그인 사용자는 'user' 권한 보유
}

/**
 * 사용자 정보 업데이트
 */
export async function updateUserProfile(userId: string, updateData: { phone?: string, dob?: string, address?: string }): Promise<AuthResult> {
  try {
    const response = await fetch('/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        ...updateData
      }),
    })

    const result = await response.json()

    if (result.success && result.user) {
      // localStorage의 사용자 정보도 업데이트
      if (typeof window !== 'undefined') {
        localStorage.setItem('motion-connect-user', JSON.stringify(result.user))
      }
      
      return {
        success: true,
        user: result.user
      }
    } else {
      return {
        success: false,
        error: result.error || '프로필 업데이트에 실패했습니다.'
      }
    }
  } catch (error) {
    console.error('프로필 업데이트 오류:', error)
    return {
      success: false,
      error: '프로필 업데이트 중 오류가 발생했습니다.'
    }
  }
}
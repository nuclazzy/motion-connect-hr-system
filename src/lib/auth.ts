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
 * 사용자 로그인 (localStorage 기반)
 */
export async function loginUser(credentials: LoginCredentials): Promise<AuthResult> {
  try {
    // API를 통해 비밀번호 검증 및 사용자 정보 조회
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

    // 로그인 성공 시 localStorage에 사용자 정보 저장
    if (result.success && result.user) {
      localStorage.setItem('motion-connect-user', JSON.stringify(result.user))
      console.log('✅ localStorage에 사용자 정보 저장:', result.user.name)
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
 * 현재 로그인된 사용자 정보 조회 (localStorage + API 검증)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // localStorage에서 사용자 정보 조회
    const userStr = localStorage.getItem('motion-connect-user')
    if (!userStr) {
      return null
    }
    
    const user = JSON.parse(userStr)
    
    // 선택적으로 서버에서 최신 정보 가져오기 (API 호출)
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.user) {
          // localStorage 업데이트
          localStorage.setItem('motion-connect-user', JSON.stringify(result.user))
          return result.user
        }
      }
    } catch (apiError) {
      console.log('API 호출 실패, localStorage 데이터 사용:', apiError)
    }
    
    return user
  } catch (error) {
    console.error('getCurrentUser error:', error)
    return null
  }
}

/**
 * 사용자 로그아웃 (localStorage 기반)
 */
export async function logoutUser() {
  try {
    // localStorage에서 사용자 정보 제거
    localStorage.removeItem('motion-connect-user')
    console.log('✅ localStorage에서 사용자 정보 제거')
    
    // 로그인 페이지로 리디렉션
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  } catch (error) {
    console.error('Logout error:', error)
  }
}

/**
 * Authorization header가 포함된 fetch 옵션 생성
 */
export function getAuthHeaders(): Record<string, string> {
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('motion-connect-user') : null
  if (!userStr) {
    return {}
  }
  
  try {
    const user = JSON.parse(userStr)
    return {
      'Authorization': `Bearer ${user.id}`,
      'Content-Type': 'application/json'
    }
  } catch {
    return {}
  }
}

/**
 * 인증된 fetch 요청
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}) {
  const headers = getAuthHeaders()
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  })
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

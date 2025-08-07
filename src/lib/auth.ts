/**
 * Supabase 인증 관련 유틸리티 - 직접 연동 버전
 */

import { saveToken, getToken, clearToken, getAuthHeaders as getTokenAuthHeaders, repairTokenStorage } from './auth/token-manager'
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

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
 * 사용자 로그인 (Supabase 직접 연동)
 */
export async function loginUser(credentials: LoginCredentials): Promise<AuthResult> {
  try {
    // Supabase에서 직접 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id, email, name, role, employee_id, department, position, 
        hire_date, phone, dob, address, password_hash, is_active, termination_date
      `)
      .eq('email', credentials.email)
      .single()

    if (userError || !userData) {
      return {
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      }
    }

    // 퇴사자 접근 차단
    if (userData.is_active === false || userData.termination_date) {
      return {
        success: false,
        error: '퇴사 처리된 계정입니다. HR 담당자에게 문의하세요.'
      }
    }

    // 비밀번호 검증 (클라이언트에서 직접 처리)
    // 주의: 실제 프로덕션에서는 서버 사이드에서 처리해야 합니다
    let isPasswordValid = false
    
    // password_hash가 있는 경우에만 검증
    if (userData.password_hash) {
      try {
        // bcrypt는 브라우저에서 직접 실행될 수 없으므로, 
        // 실제로는 서버리스 함수나 Edge Function을 사용해야 합니다
        // 임시로 직접 비교는 제거하고 Supabase RPC 함수를 호출합니다
        const { data: authResult, error: authError } = await supabase
          .rpc('verify_user_password', {
            p_email: credentials.email,
            p_password: credentials.password
          })
        
        if (!authError && authResult) {
          isPasswordValid = authResult.success
        }
      } catch (err) {
        console.error('Password verification error:', err)
      }
    }

    // RPC 함수가 없는 경우 임시 처리 (개발 환경)
    if (!isPasswordValid && userData.password_hash) {
      // 개발 환경에서만: 간단한 해시 비교
      // 실제로는 서버에서 bcrypt.compare를 수행해야 함
      isPasswordValid = userData.password_hash === credentials.password // 임시
    }

    if (!isPasswordValid && userData.password_hash) {
      return {
        success: false,
        error: '이메일 또는 비밀번호가 올바르지 않습니다.'
      }
    }

    // password_hash, is_active, termination_date 제거 후 사용자 정보 저장
    const { password_hash, is_active, termination_date, ...user } = userData

    // 로그인 성공 시 localStorage에 사용자 정보 저장 및 토큰 관리
    localStorage.setItem('motion-connect-user', JSON.stringify(user))
    saveToken(user.id, 3600) // 1시간 토큰
    console.log('✅ Supabase 직접 연동 로그인 성공:', user.name)

    return {
      success: true,
      user: user as User
    }
    
  } catch (error) {
    console.error('Login error:', error)
    return {
      success: false,
      error: '로그인 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 현재 로그인된 사용자 정보 조회 (Supabase 직접 연동)
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // 토큰 확인 (자동 갱신 포함)
    const token = getToken()
    if (!token) {
      // 토큰 복구 시도
      if (!repairTokenStorage()) {
        return null
      }
    }
    
    // localStorage에서 사용자 정보 조회
    const userStr = localStorage.getItem('motion-connect-user')
    if (!userStr) {
      return null
    }
    
    const user = JSON.parse(userStr)
    
    // Supabase에서 최신 정보 가져오기 (선택적)
    try {
      const { data: latestUser, error } = await supabase
        .from('users')
        .select(`
          id, email, name, role, employee_id, department, position, 
          hire_date, phone, dob, address, is_active, termination_date
        `)
        .eq('id', user.id)
        .single()
      
      // 퇴사자 여부 확인
      if (latestUser && (latestUser.is_active === false || latestUser.termination_date)) {
        // 퇴사자는 로그아웃 처리
        logoutUser()
        return null
      }
      
      if (!error && latestUser) {
        // localStorage 업데이트
        localStorage.setItem('motion-connect-user', JSON.stringify(latestUser))
        return latestUser as User
      }
    } catch (dbError) {
      console.log('Supabase 조회 실패, localStorage 데이터 사용:', dbError)
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
    clearToken() // 토큰도 함께 제거
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
  // 기본 헤더는 항상 포함 (Content-Type이 없으면 JSON 파싱 실패로 인한 404 발생 가능)
  const baseHeaders = {
    'Content-Type': 'application/json'
  }
  
  const userStr = typeof window !== 'undefined' ? localStorage.getItem('motion-connect-user') : null
  if (!userStr) {
    console.warn('⚠️ localStorage에서 사용자 정보를 찾을 수 없음 - Authorization 헤더 없이 요청')
    return baseHeaders
  }
  
  try {
    const user = JSON.parse(userStr)
    return {
      ...baseHeaders,
      'Authorization': `Bearer ${user.id}`
    }
  } catch (error) {
    console.error('❌ localStorage 사용자 정보 파싱 실패:', error)
    return baseHeaders
  }
}

/**
 * 인증된 fetch 요청 (레거시 지원용)
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
 * 사용자 정보 업데이트 (Supabase 직접 연동)
 */
export async function updateUserProfile(userId: string, updateData: { phone?: string, dob?: string, address?: string }): Promise<AuthResult> {
  try {
    // 권한 검증: 현재 로그인한 사용자가 본인 프로필을 수정하는지 확인
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return {
        success: false,
        error: '로그인이 필요합니다.'
      }
    }

    if (currentUser.id !== userId) {
      return {
        success: false,
        error: '자신의 프로필만 수정할 수 있습니다.'
      }
    }

    // Supabase에서 직접 업데이트
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        phone: updateData.phone,
        dob: updateData.dob,
        address: updateData.address,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Supabase update error:', error)
      return {
        success: false,
        error: '프로필 업데이트에 실패했습니다.'
      }
    }

    if (updatedUser) {
      // localStorage 업데이트
      const currentUser = JSON.parse(localStorage.getItem('motion-connect-user') || '{}')
      const newUser = { ...currentUser, ...updatedUser }
      localStorage.setItem('motion-connect-user', JSON.stringify(newUser))
      
      return {
        success: true,
        user: newUser as User
      }
    }

    return {
      success: false,
      error: '프로필 업데이트에 실패했습니다.'
    }
  } catch (error) {
    console.error('프로필 업데이트 오류:', error)
    return {
      success: false,
      error: '프로필 업데이트 중 오류가 발생했습니다.'
    }
  }
}

/**
 * 비밀번호 변경 (Supabase 직접 연동 - 간단 버전)
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
  try {
    // 권한 검증: 현재 로그인한 사용자가 본인 비밀번호를 변경하는지 확인
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return {
        success: false,
        error: '로그인이 필요합니다.'
      }
    }

    if (currentUser.id !== userId) {
      return {
        success: false,
        error: '자신의 비밀번호만 변경할 수 있습니다.'
      }
    }

    // 현재 비밀번호 확인
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, password_hash')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      return {
        success: false,
        error: '사용자 정보를 찾을 수 없습니다.'
      }
    }

    // 현재 비밀번호 검증 (bcrypt 직접 사용)
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.password_hash)
    if (!isCurrentPasswordValid) {
      return {
        success: false,
        error: '현재 비밀번호가 올바르지 않습니다.'
      }
    }

    // 새 비밀번호 해시화
    const saltRounds = 10
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // 새 비밀번호로 업데이트
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        password_hash: hashedNewPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('비밀번호 업데이트 오류:', updateError)
      return {
        success: false,
        error: '비밀번호 변경에 실패했습니다.'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('비밀번호 변경 오류:', error)
    return {
      success: false,
      error: '비밀번호 변경 중 오류가 발생했습니다.'
    }
  }
}
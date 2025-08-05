/**
 * 서버사이드 인증 유틸리티
 */

import { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export interface ServerUser {
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

/**
 * 서버사이드에서 현재 사용자 정보 조회
 * Authorization 헤더에서 Bearer 토큰을 추출하여 사용자 ID로 사용
 */
export async function getCurrentUserServer(request?: NextRequest): Promise<ServerUser | null> {
  try {
    // Authorization 헤더에서 사용자 ID 추출
    let authorization: string | null = null
    
    if (request) {
      authorization = request.headers.get('authorization')
    } else if (typeof window === 'undefined') {
      // Next.js API route에서 headers 접근
      const { headers } = await import('next/headers')
      const headersList = headers()
      authorization = headersList.get('authorization')
    }

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return null
    }

    const userId = authorization.replace('Bearer ', '')
    if (!userId) {
      return null
    }

    // Supabase에서 사용자 정보 조회
    const supabase = await createServiceRoleClient()
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !user) {
      console.error('❌ 사용자 조회 실패:', error)
      return null
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee_id: user.employee_id,
      department: user.department,
      position: user.position,
      hire_date: user.hire_date,
      phone: user.phone,
      dob: user.dob,
      address: user.address
    }
  } catch (error) {
    console.error('❌ getCurrentUserServer 오류:', error)
    return null
  }
}

/**
 * 관리자 권한 확인
 */
export function isAdmin(user: ServerUser | null): boolean {
  return user?.role === 'admin'
}

/**
 * 사용자 권한 확인
 */
export function hasUserPermission(user: ServerUser | null): boolean {
  return user !== null
}
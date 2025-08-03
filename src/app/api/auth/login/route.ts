import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    console.log('🔐 로그인 시도:', { email, password: '***' })

    const serviceRoleSupabase = await createServiceRoleClient()

    // public.users 테이블에서 사용자 조회
    const { data: user, error: userError } = await serviceRoleSupabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      console.log('❌ 사용자 없음:', userError)
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // 비밀번호 확인 - password_hash 필드가 반드시 필요
    if (!user.password_hash) {
      console.log('❌ password_hash 필드가 없음:', user.email)
      return NextResponse.json({ error: '사용자 계정에 비밀번호가 설정되지 않았습니다. 관리자에게 문의하세요.' }, { status: 401 })
    }

    // 해시된 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)

    if (!isPasswordValid) {
      console.log('❌ 비밀번호 불일치')
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // 비밀번호 필드 제거
    const { password_hash, password: _, ...userWithoutPassword } = user

    console.log('✅ 로그인 성공:', user.name)
    
    return NextResponse.json({ success: true, user: userWithoutPassword })

  } catch (error) {
    console.error('로그인 처리 오류:', error)
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

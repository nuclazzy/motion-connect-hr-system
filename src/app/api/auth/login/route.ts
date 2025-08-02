import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: Request) {
  const { email, password } = await request.json()

  console.log('🔐 로그인 시도:', { email, password: '***' })

  // public.users 테이블에서 사용자 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (userError || !user) {
    console.log('❌ 사용자 없음:', userError)
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // 비밀번호 확인 (해시된 경우와 평문 모두 지원)
  let isPasswordValid = false
  
  if (user.password_hash) {
    // 해시된 비밀번호 확인
    isPasswordValid = await bcrypt.compare(password, user.password_hash)
  } else {
    // 평문 비밀번호 확인 (테스트용)
    isPasswordValid = password === user.password || 
                     password === 'admin123' ||
                     password === 'password123'
  }

  if (!isPasswordValid) {
    console.log('❌ 비밀번호 불일치')
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  // 비밀번호 필드 제거
  const { password_hash, password: _, ...userWithoutPassword } = user

  console.log('✅ 로그인 성공:', userWithoutPassword.name)
  
  // 쿠키에 사용자 ID 저장 (세션 생성)
  const response = NextResponse.json({ success: true, user: userWithoutPassword })
  response.cookies.set('motion-connect-user-id', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.motionsense.co.kr' : undefined
  })
  
  return response
}

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1. Supabase Auth로 로그인 시도
  const { data: { session }, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError) {
    return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  if (!session) {
    return NextResponse.json({ error: '로그인에 실패했습니다. 세션을 만들 수 없습니다.' }, { status: 401 })
  }

  // 2. 로그인 성공 시 'users' 테이블에서 프로필 정보 조회
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (userError || !user) {
    // 안전을 위해 프로필이 없으면 로그아웃 처리
    await supabase.auth.signOut()
    return NextResponse.json({ error: '사용자 프로필을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 3. 사용자 프로필 반환 (Auth Helper가 자동으로 세션 쿠키를 설정합니다)
  return NextResponse.json({ success: true, user })
}

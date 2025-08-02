import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 사용자 ID 가져오기
    const userId = request.cookies.get('motion-connect-user-id')?.value

    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Supabase에서 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      console.log('❌ 사용자 조회 실패:', userError)
      // 잘못된 쿠키 제거
      const response = NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
      response.cookies.set('motion-connect-user-id', '', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0, // 즉시 만료
        path: '/',
        domain: process.env.NODE_ENV === 'production' ? '.motionsense.co.kr' : undefined
      })
      return response
    }

    // 비밀번호 필드 제거
    const { password_hash, password, ...userWithoutPassword } = user

    return NextResponse.json({ 
      success: true, 
      user: userWithoutPassword 
    })

  } catch (error) {
    console.error('현재 사용자 조회 오류:', error)
    return NextResponse.json({ error: '사용자 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
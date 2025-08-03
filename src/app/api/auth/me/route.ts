import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Supabase 세션에서 현재 사용자 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // Supabase에서 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (userError || !user) {
      console.log('❌ 사용자 조회 실패:', userError)
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
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
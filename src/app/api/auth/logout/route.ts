import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    console.log('🚪 로그아웃 요청')
    
    const supabase = await createClient()
    
    // Supabase Auth 세션 종료
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('❌ Supabase Auth 로그아웃 실패:', error)
      return NextResponse.json({ error: '로그아웃 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }
    
    console.log('✅ Supabase Auth 로그아웃 성공')
    
    return NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
    
  } catch (error) {
    console.error('로그아웃 처리 오류:', error)
    return NextResponse.json({ error: '로그아웃 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
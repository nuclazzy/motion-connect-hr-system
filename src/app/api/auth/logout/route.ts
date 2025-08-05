import { NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🚪 로그아웃 요청')
    
    // localStorage 기반 인증에서는 클라이언트에서 localStorage를 삭제하면 됨
    console.log('✅ 로그아웃 성공 (localStorage 기반)')
    
    return NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
    
  } catch (error) {
    console.error('로그아웃 처리 오류:', error)
    return NextResponse.json({ error: '로그아웃 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
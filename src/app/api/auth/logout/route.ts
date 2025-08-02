import { NextResponse } from 'next/server'

export async function POST() {
  console.log('🚪 로그아웃 요청')
  
  // 쿠키 제거로 세션 종료
  const response = NextResponse.json({ success: true, message: '로그아웃되었습니다.' })
  response.cookies.set('motion-connect-user-id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // 즉시 만료
    path: '/'
  })
  
  return response
}
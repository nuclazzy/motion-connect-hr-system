import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  const nodeEnv = process.env.NODE_ENV;
  
  // OAuth URL 생성
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: clientId || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  const authUrl = `${baseUrl}?${params.toString()}`;

  return NextResponse.json({
    debug: {
      clientId,
      redirectUri,
      nodeEnv,
      authUrl
    },
    message: 'Google OAuth 디버그 정보',
    instructions: {
      step1: 'Google Cloud Console로 이동',
      step2: `프로젝트 선택: ecstatic-device-288303`,
      step3: 'API 및 서비스 > 사용자 인증 정보',
      step4: `클라이언트 ID: ${clientId}`,
      step5: `승인된 리디렉션 URI에 추가: ${redirectUri}`
    }
  });
}
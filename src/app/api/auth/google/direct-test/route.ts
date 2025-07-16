import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://motion-connect-hr-system.vercel.app/api/auth/google/callback';
  
  // 환경 변수 상태 체크
  const envCheck = {
    clientId: clientId || 'MISSING',
    redirectUri: redirectUri,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
  };

  // 직접 OAuth URL 생성
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent'
  }).toString()}`;

  return NextResponse.json({
    envCheck,
    authUrl,
    instruction: '직접 authUrl을 브라우저에 복사하여 테스트하세요',
    troubleshooting: {
      step1: 'clientId가 MISSING이면 Vercel 환경 변수를 다시 확인하세요',
      step2: 'authUrl을 브라우저에 직접 입력하여 테스트하세요',
      step3: 'Google Cloud Console에서 redirect_uri가 정확히 설정되었는지 확인하세요'
    }
  });
}
import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 환경 변수 확인
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://motion-connect.vercel.app/api/auth/google/callback';
    
    console.log('OAuth Environment Check:', {
      clientId: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
      clientSecret: clientSecret ? 'EXISTS' : 'MISSING',
      redirectUri: redirectUri || 'MISSING',
      allEnvVars: {
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI
      }
    });

    if (!clientId || clientId.trim() === '') {
      console.error('Client ID is missing or empty:', { clientId });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Client ID is missing from environment variables',
          debug: {
            clientId: clientId,
            clientSecret: clientSecret ? 'EXISTS' : 'MISSING',
            redirectUri: redirectUri,
            processEnv: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
          }
        },
        { status: 500 }
      );
    }

    // 직접 OAuth URL 생성 (googleOAuthService 대신)
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
      access_type: 'offline',
      prompt: 'consent'
    }).toString()}`;
    
    console.log('Generated auth URL:', authUrl);
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth 인증 URL 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate auth URL', details: (error as Error).message },
      { status: 500 }
    );
  }
}
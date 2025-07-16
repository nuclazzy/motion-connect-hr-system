import { NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';

export async function GET() {
  try {
    // 환경 변수 확인
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    console.log('OAuth Environment Check:', {
      clientId: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
      clientSecret: clientSecret ? 'EXISTS' : 'MISSING',
      redirectUri: redirectUri || 'MISSING'
    });

    if (!clientId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Google Client ID is missing from environment variables',
          debug: {
            clientId: clientId,
            clientSecret: clientSecret ? 'EXISTS' : 'MISSING',
            redirectUri: redirectUri
          }
        },
        { status: 500 }
      );
    }

    // Google OAuth 인증 URL 생성
    const authUrl = googleOAuthService.getAuthUrl();
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth 인증 URL 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate auth URL', details: (error as Error).message },
      { status: 500 }
    );
  }
}
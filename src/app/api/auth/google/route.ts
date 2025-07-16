import { NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';

export async function GET() {
  try {
    // Google OAuth 인증 URL 생성
    const authUrl = googleOAuthService.getAuthUrl();
    
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google OAuth 인증 URL 생성 실패:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
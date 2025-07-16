import { NextRequest, NextResponse } from 'next/server';
import { googleOAuthService } from '@/lib/googleOAuth';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth 인증 오류:', error);
      return NextResponse.redirect(new URL('/admin?error=oauth_error', request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/admin?error=no_code', request.url));
    }

    // 인증 코드로 토큰 획득
    const tokens = await googleOAuthService.getAccessToken(code);
    
    // 현재 로그인한 사용자 정보 가져오기
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.redirect(new URL('/admin?error=not_authenticated', request.url));
    }

    // 토큰을 사용자 세션에 저장 (또는 데이터베이스에 저장)
    // 여기서는 간단히 사용자 메타데이터에 저장
    await supabase.auth.updateUser({
      data: {
        google_tokens: tokens,
        google_auth_connected: true
      }
    });

    return NextResponse.redirect(new URL('/admin?success=google_connected', request.url));
  } catch (error) {
    console.error('Google OAuth 콜백 처리 실패:', error);
    return NextResponse.redirect(new URL('/admin?error=callback_error', request.url));
  }
}
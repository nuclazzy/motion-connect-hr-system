import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 모든 환경 변수 확인
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    return NextResponse.json({
      success: true,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
        clientId: clientId ? `${clientId.substring(0, 20)}...` : 'MISSING',
        clientSecret: clientSecret ? 'EXISTS' : 'MISSING',
        redirectUri: redirectUri || 'MISSING',
        allGoogleVars: Object.keys(process.env).filter(key => key.includes('GOOGLE'))
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
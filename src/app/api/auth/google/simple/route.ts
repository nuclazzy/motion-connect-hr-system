import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const redirectUri = 'https://motion-connect.vercel.app/api/auth/google/callback';
  
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID missing' }, { status: 500 });
  }
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent'
  }).toString()}`;
  
  return NextResponse.redirect(authUrl);
}
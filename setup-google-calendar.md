# Google Calendar API 설정 가이드

## 1. Google Cloud Console 설정

1. **Google Cloud Console** 접속: https://console.cloud.google.com/
2. **새 프로젝트 생성** 또는 기존 프로젝트 선택
3. **APIs & Services > Library** 이동
4. **Google Calendar API** 검색 후 활성화

## 2. OAuth 2.0 자격 증명 생성

1. **APIs & Services > Credentials** 이동
2. **+ CREATE CREDENTIALS > OAuth client ID** 클릭
3. **Application type**: Web application
4. **Name**: Motion Connect HR
5. **Authorized redirect URIs** 추가:
   - `https://motion-connect-r3gutcads-motionsenses-projects.vercel.app`
   - `http://localhost:3000` (개발용)

## 3. Vercel 환경변수 설정

생성된 Client ID를 Vercel에 추가:

```bash
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

값: 생성된 Google OAuth Client ID 입력

## 4. 현재 문제들

### Google Calendar 버튼 무반응
- ❌ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` 환경변수 누락
- ❌ Google OAuth 설정 필요

### Supabase API 에러
- ❌ `net::ERR_INSUFFICIENT_RESOURCES` - 네트워크/권한 문제
- ❌ API 키 설정 검증 필요

## 5. 해결 방법

1. Google Cloud Console에서 OAuth Client ID 생성
2. Vercel에 환경변수 추가
3. Supabase API 키 및 URL 재확인
4. 재배포
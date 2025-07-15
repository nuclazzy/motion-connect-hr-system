# Google OAuth 401 에러 해결 방법

## 🚨 현재 문제
- **에러**: 401 Unauthorized
- **원인**: Google Cloud Console OAuth 설정에서 현재 도메인이 승인되지 않음
- **현재 배포 URL**: https://motion-connect-anhfoefrh-motionsenses-projects.vercel.app

## 🔧 해결 방법

### 1. Google Cloud Console 설정 업데이트

1. **Google Cloud Console** 접속: https://console.cloud.google.com/
2. **프로젝트 선택** (Client ID를 생성한 프로젝트)
3. **APIs & Services > Credentials** 이동
4. **OAuth 2.0 Client IDs**에서 기존 Client ID 클릭
5. **Authorized redirect URIs** 섹션에 다음 URL들 추가:

```
https://motion-connect-anhfoefrh-motionsenses-projects.vercel.app
https://motion-connect-anhfoefrh-motionsenses-projects.vercel.app/
http://localhost:3000 (개발용)
http://localhost:3000/ (개발용)
```

6. **Authorized JavaScript origins** 섹션에 다음 도메인들 추가:

```
https://motion-connect-anhfoefrh-motionsenses-projects.vercel.app
http://localhost:3000
```

### 2. 설정 저장 후 대기
- Google OAuth 설정 변경 후 **5-10분** 대기 필요
- 즉시 적용되지 않을 수 있음

### 3. 브라우저 캐시 클리어
- 하드 새로고침: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
- 또는 개발자 도구에서 Network 탭 → "Disable cache" 체크

## 🔍 추가 확인사항

### Client ID 확인
현재 설정된 Client ID: `938304852949-gack01mjr19t6k13lfveeu6jtp79r2ns.apps.googleusercontent.com`

### 도메인 인증 상태 확인
Google Cloud Console → **APIs & Services** → **Domain verification**에서 도메인 인증 상태 확인

## 🚀 테스트 방법
1. Google Cloud Console 설정 완료
2. 5분 대기
3. 브라우저 새로고침
4. Google Calendar 로그인 버튼 클릭
5. Google OAuth 팝업 정상 출현 확인

## 📞 대안 방법
만약 여전히 문제가 발생한다면:
1. **새로운 OAuth Client ID 생성**
2. **올바른 도메인으로 처음부터 설정**
3. **새 Client ID로 환경변수 업데이트**
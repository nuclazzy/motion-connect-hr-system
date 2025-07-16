# Google OAuth 동의 화면 설정 가이드

## 🚨 Authorization Error 해결 방법

### 1. Google Cloud Console 접속
- https://console.cloud.google.com
- 프로젝트: `ecstatic-device-288303` 선택

### 2. OAuth 동의 화면 설정 (중요!)
1. 왼쪽 메뉴 > "API 및 서비스" > "OAuth 동의 화면"
2. 사용자 유형 선택:
   - **내부** (Google Workspace 사용자만) 또는
   - **외부** (모든 Google 계정 사용자)
3. 애플리케이션 정보 입력:
   - 앱 이름: `Motion Connect HR System`
   - 사용자 지원 이메일: `lewis@motionsense.co.kr`
   - 개발자 연락처 정보: `lewis@motionsense.co.kr`

### 3. 범위(Scope) 설정
1. "범위" 섹션에서 "범위 추가 또는 삭제" 클릭
2. 다음 범위들 추가:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

### 4. 테스트 사용자 추가 (외부 선택 시)
1. "테스트 사용자" 섹션
2. "사용자 추가" 클릭
3. 테스트할 Gmail 계정 추가: `lewis@motionsense.co.kr`

### 5. OAuth 2.0 클라이언트 ID 설정
1. "사용자 인증 정보" 메뉴
2. 클라이언트 ID 편집: `938304852949-gack01mjr19t6k13lfveeu6jtp79r2ns.apps.googleusercontent.com`
3. 승인된 리디렉션 URI 추가:
   ```
   http://localhost:3000/api/auth/google/callback
   https://motion-connect-hr-system.vercel.app/api/auth/google/callback
   ```

### 6. API 활성화 확인
1. "API 및 서비스" > "라이브러리"
2. "Google Calendar API" 검색 후 활성화

## 🔧 디버깅 URL
개발 서버 실행 후 다음 URL에서 OAuth 설정 확인:
- http://localhost:3000/api/auth/google/debug
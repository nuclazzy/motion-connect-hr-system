# Google API Key 업데이트 가이드

## 현재 문제
현재 API Key (AIzaSyBvOzRIgIjh8JSfZE2YZtVgNjPYGR3HWoM)가 유효하지 않음

## 해결 방법

### 1. 새 API Key 생성
1. https://console.cloud.google.com 접속
2. 프로젝트: motion-connect-hr-system 선택
3. "API 및 서비스" → "사용자 인증 정보"
4. "+ 사용자 인증 정보 만들기" → "API 키"
5. 생성된 키 복사

### 2. 업데이트 필요한 위치

#### 로컬 파일:
- `.env.local`의 `NEXT_PUBLIC_GOOGLE_API_KEY`
- `.env.production`의 `NEXT_PUBLIC_GOOGLE_API_KEY` (선택사항)

#### Vercel:
- Environment Variables에서 `NEXT_PUBLIC_GOOGLE_API_KEY` 값 변경

### 3. API Key 제한 설정 (권장)
생성한 API Key 클릭 후:

**애플리케이션 제한사항:**
- HTTP 리퍼러 선택
- 허용 URL:
  ```
  https://hr.motionsense.co.kr/*
  http://localhost:3000/*
  https://*.vercel.app/*
  ```

**API 제한사항:**
- API 제한 선택
- 다음 API 추가:
  - Google Calendar API

### 4. 테스트
1. 로컬에서 테스트: `npm run dev`
2. 브라우저 콘솔에서 확인
3. Vercel 재배포 후 프로덕션 테스트

## 참고사항
- API Key는 공개되어도 되는 값입니다 (HTTP 리퍼러로 제한하면 안전)
- Client ID와 Client Secret은 절대 공개하면 안 됩니다
- 새 API Key 적용 후 몇 분 정도 기다려야 할 수 있습니다
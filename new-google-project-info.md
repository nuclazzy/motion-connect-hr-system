# 새 Google Cloud 프로젝트 정보

## 프로젝트 설정 완료 후 다음 정보를 기록하세요:

### 프로젝트 정보
- **프로젝트 ID**: motion-connect-hr-system (또는 생성된 ID)
- **프로젝트 번호**: (생성 후 확인)

### OAuth 2.0 Client ID 정보
- **클라이언트 ID**: (생성 후 복사)
- **클라이언트 시크릿**: (생성 후 복사)

### 환경 변수 업데이트 필요
`.env.local` 파일에서 다음 변수들을 새 값으로 업데이트:

```bash
# Google OAuth - 새 프로젝트
NEXT_PUBLIC_GOOGLE_CLIENT_ID=새로_생성된_클라이언트_ID
GOOGLE_CLIENT_SECRET=새로_생성된_클라이언트_시크릿
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`.env.production` 파일도 동일하게 업데이트

### 설정 완료 체크리스트
- [ ] 새 프로젝트 생성
- [ ] Google Calendar API 활성화
- [ ] OAuth 동의 화면 설정 완료
- [ ] OAuth 2.0 클라이언트 ID 생성
- [ ] 환경 변수 업데이트
- [ ] 테스트 진행

## 다음 단계
1. 프로젝트 설정 완료 후 클라이언트 ID와 시크릿을 알려주세요
2. 환경 변수를 업데이트하겠습니다
3. 테스트를 진행하겠습니다
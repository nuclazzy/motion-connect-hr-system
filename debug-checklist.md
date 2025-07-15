# 🔍 로그인 문제 진단 체크리스트

## 현재 상황
- 새로운 Supabase 프로젝트: lnmgwtljhctrrnezehmw
- 스키마 실행 완료
- Vercel 배포 완료
- 로그인 실패: "이메일 또는 비밀번호가 올바르지 않습니다"

## 🚨 체크포인트 1: 데이터베이스 확인

### A. Supabase에서 사용자 데이터 확인
1. https://supabase.com/dashboard/project/lnmgwtljhctrrnezehmw 접속
2. Table Editor → users 테이블 클릭
3. lewis@motionsense.co.kr 사용자 확인

**확인사항:**
- [ ] 사용자가 존재하는가?
- [ ] password_hash가 bcrypt 형식인가? ($2b$10$...)
- [ ] role이 'admin'인가?

### B. SQL 쿼리로 직접 확인
Table Editor에서 SQL 실행:
```sql
SELECT email, name, role, 
       LEFT(password_hash, 10) || '...' as hash_preview,
       LENGTH(password_hash) as hash_length
FROM users 
WHERE email = 'lewis@motionsense.co.kr';
```

**예상 결과:**
```
email: lewis@motionsense.co.kr
name: 김성호
role: admin
hash_preview: $2b$10$JI4...
hash_length: 60
```

## 🚨 체크포인트 2: 환경변수 확인

### A. Vercel 환경변수 확인
1. https://vercel.com/dashboard 접속
2. motion-connect 프로젝트 → Settings → Environment Variables

**확인사항:**
- [ ] NEXT_PUBLIC_SUPABASE_URL = https://lnmgwtljhctrrnezehmw.supabase.co
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- [ ] SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

### B. 로컬 환경변수 확인
.env.local 파일 내용이 새 프로젝트와 일치하는가?

## 🚨 체크포인트 3: API 라우트 확인

### A. 브라우저 개발자 도구
1. F12 → Network 탭
2. 로그인 시도
3. /api/auth/login 요청 확인

**확인사항:**
- [ ] 요청이 정상적으로 전송되는가?
- [ ] 응답 코드가 401인가?
- [ ] 응답 메시지는?

### B. 수동 API 테스트
브라우저 Console에서:
```javascript
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'lewis@motionsense.co.kr',
    password: '0000'
  })
}).then(r => r.json()).then(console.log)
```

## 🚨 체크포인트 4: 비밀번호 확인

### A. 실제 비밀번호 검증
bcrypt 온라인 테스터에서:
- 입력: '0000'
- 해시: $2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa
- 매치되는가?

## ⚡ 즉시 해결 방법들

### 방법 1: 비밀번호 직접 재설정
Supabase Table Editor에서:
```sql
UPDATE users 
SET password_hash = '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa'
WHERE email = 'lewis@motionsense.co.kr';
```

### 방법 2: 새 사용자 생성
```sql
INSERT INTO users (email, password_hash, name, role, employee_id, work_type, department, position, hire_date)
VALUES ('test@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '테스트', 'admin', 'TEST001', '정규직', 'IT팀', '관리자', '2024-01-01');
```

### 방법 3: 환경변수 강제 업데이트
Vercel에서 환경변수 삭제 후 재생성

## 📋 다음 단계
1. 위 체크포인트들을 순서대로 확인
2. 발견된 문제점 보고
3. 즉시 해결 방법 적용
4. 재테스트
# Motion Connect - 배포 가이드

## 시스템 개요
Motion Connect는 모션센스 HR 관리 시스템으로 Next.js 14 + Supabase + Google Apps Script 연동으로 구현되었습니다.

## 기술 스택
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **External Integration**: Google Apps Script, Google Calendar API
- **Deployment**: Vercel

## 배포 단계

### 1. GitHub 리포지토리 설정
```bash
# GitHub CLI 인증 (필요시)
gh auth login

# 리포지토리 생성 및 푸시
gh repo create motion-connect --public --description "Motion Connect HR Management System"
git remote add origin https://github.com/[YOUR_USERNAME]/motion-connect.git
git push -u origin main
```

### 2. Supabase 프로덕션 설정
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 새 프로젝트 생성: `motion-connect-prod`
3. 데이터베이스 스키마 설정:
   - 테이블: users, leave_days, form_requests, documents, meetings, calendar_configs
   - Row Level Security (RLS) 정책 설정
4. API 키 확인 (URL, anon key, service role key)

### 3. Vercel 배포
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. GitHub 리포지토리 연결
3. 환경변수 설정:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=your_private_key
   
   NEXTAUTH_SECRET=random_secret_string
   NEXTAUTH_URL=https://your-vercel-domain.vercel.app
   ```

### 4. 데이터베이스 초기 설정
```sql
-- 기본 관리자 계정 생성 (패스워드: 0000)
INSERT INTO users (
  email, password_hash, name, role, employee_id, 
  work_type, department, position, hire_date
) VALUES (
  'admin@motionsense.co.kr', 
  '$2b$10$rOvF.7QYf8ZxOQYL4cKhleOp1.KrLyoQ5N3q3B.Hj5r2K9aU4c8vC', 
  '관리자', 'admin', 'ADM001', 
  '정규직', 'IT팀', '대표', '2024-01-01'
);
```

### 5. Google Apps Script 웹앱 URL 확인
현재 설정된 웹앱 URL들:
- 휴직계: `https://script.google.com/a/motionsense.co.kr/macros/s/.../exec?form=leave`
- 재직증명서: `http://script.google.com/a/motionsense.co.kr/macros/s/.../exec?form=certificate`
- 경위서: `https://script.google.com/a/motionsense.co.kr/macros/s/.../exec?form=report`
- 육아휴직: `https://script.google.com/a/motionsense.co.kr/macros/s/.../exec?form=maternity`

## 주요 기능
- ✅ 직원 관리 및 인증 시스템
- ✅ 휴가 관리 (캘린더 뷰 + 한국 공휴일)
- ✅ 팀 일정 (주간 캘린더, 자신팀/타팀 구분)
- ✅ 서식 신청 (Google Apps Script 연동)
- ✅ 자료실 관리
- ✅ 관리자 대시보드 (펼쳐보기 기능)

## 보안 고려사항
- 환경변수로 모든 민감 정보 관리
- Supabase RLS로 데이터 접근 제어
- Google Apps Script CORS 정책으로 외부 접근 제한
- 패스워드 해싱 (bcrypt)

## 사후 개선사항
- 네이버 캘린더 API 연동으로 공휴일 자동 업데이트
- 휴가 현황 통합 관리 기능
- 모바일 반응형 개선
# Motion Connect - HR 관리 시스템

기존 PHP 기반 HR 시스템을 Next.js + Supabase + Vercel로 현대화한 웹 애플리케이션입니다.

## 🚀 주요 기능

### 관리자 기능
- **직원 관리**: 직원 정보 CRUD, 퇴사 처리, 드롭다운 형식
- **휴가 관리**: 직원별 휴가 현황 조회 및 직접 수정
- **서식 관리**: 직원 서식 신청 승인/거부 시스템
- **자료실 관리**: 문서 링크 등록 및 관리 (펼쳐보기 기능)
- **캘린더 설정**: 구글 캘린더 다중 매핑 및 별칭 지정 (펼쳐보기 기능)

### 사용자 기능
- **내 정보**: 프로필 조회 및 수정 (이메일, 근무년차 포함)
- **근태 관리**: 구글 웹앱 연동 출퇴근 기록
- **주간 미팅/답사 일정**: 외부/내부 일정 조회 및 등록
- **팀 일정**: 주간 캘린더 (내 팀/다른 팀 구분)
- **휴가 관리**: 캘린더뷰 + 리스트 형태, 한국 공휴일 표시
- **서식 신청**: 휴직계, 재직증명서, 경위서, 육아휴직 (팝업 연동 + 완료 버튼)
- **자료실**: 문서 조회 및 다운로드 (12개까지 표시)
- **반기 리뷰**: 1월/7월 시즌별 활성화

### 팀장 전용 기능
- **견적서 작성**: 구글 시트 연동

## 🛠️ 기술 스택

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Vercel
- **External**: Google Calendar API, Google Apps Script, Google Sheets

## 📋 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. `supabase-schema.sql` 파일의 내용을 Supabase SQL Editor에서 실행
3. 프로젝트 URL과 API 키 확인

### 3. 환경 변수 설정

`.env.local` 파일의 환경 변수를 실제 값으로 수정:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. 데이터 이전 (기존 시스템에서)

```bash
# 기존 hr-system 폴더가 같은 레벨에 있어야 함
npx tsx src/scripts/migrate-data.ts
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000에서 애플리케이션 확인

## 🎨 UI 설계

### 사용자 대시보드 위젯 순서
1. 상단 기본 정보 (내 정보, 출퇴근 기록, 반기 리뷰)
2. **팀장 전용**: 견적서 작성 (조건부 표시)
3. **주간 미팅/답사 일정** (외부/내부 분리)
4. **팀 일정** (좌측 70% 캘린더 + 우측 30% 리스트)
5. **휴가 관리** (현황 + 통합 신청)
6. 하단 기타 (서식 신청, 자료실)

### 팀 일정 위젯 레이아웃
- **좌측 70%**: 월별 캘린더뷰 (일요일 시작)
- **우측 30%**: 이번 주 일정 리스트
  - 상단: 내 팀 일정
  - 하단: 다른 팀들 주요 일정

## 🔄 외부 서비스 연동 유지

### 기존 시스템과의 연동
- **출퇴근 기록**: Google Apps Script 웹앱
- **근태 조회**: Google Apps Script 웹앱 
- **서식 신청**: Google Apps Script 웹앱
- **반기 리뷰**: Google Apps Script 웹앱
- **근태 관리**: Google Sheets
- **견적서 작성**: Google Sheets

## 📊 데이터베이스 스키마

### 주요 테이블
- `users`: 직원 정보
- `leave_days`: 휴가 정보 (JSONB)
- `form_requests`: 서식 신청
- `documents`: 자료실 문서
- `meetings`: 미팅 일정
- `leave_promotions`: 연차 촉진
- `calendar_configs`: 캘린더 매핑 설정

---

**Motion Connect v1.0** - 모던 HR 관리 시스템
# Force redeploy Wed Jul 16 21:15:59 KST 2025
# Deployment verification - Sat Aug  9 12:23:33 KST 2025

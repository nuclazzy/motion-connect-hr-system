# Motion Connect HR System - 개발 문서

## 📋 프로젝트 개요

**프로젝트명**: Motion Connect HR System  
**개발 기간**: 2024년 ~ 2025년  
**주요 기술**: Next.js 14, TypeScript, Supabase, PostgreSQL, Tailwind CSS  
**배포 환경**: Vercel  
**데이터베이스**: Supabase PostgreSQL  

### 시스템 목적
중소기업을 위한 통합 인사관리 시스템으로, 직원 관리, 급여 관리, 휴가 관리, 출퇴근 관리 등의 핵심 HR 기능을 제공합니다.

---

## 🗂️ 시스템 아키텍처

### 기술 스택
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Lucide React Icons
- **Backend**: Next.js API Routes (서버리스)
- **Database**: Supabase PostgreSQL
- **Authentication**: 자체 구현 (BCrypt 해시)
- **외부 API**: Google Calendar API, 네이버 공휴일 API
- **배포**: Vercel (Production), GitHub Actions (CI/CD)
- **버전 관리**: Git, GitHub

### 프로젝트 구조
```
motion-connect/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/             # 관리자 페이지
│   │   ├── api/               # API 엔드포인트
│   │   │   ├── admin/         # 관리자 API
│   │   │   ├── attendance/    # 출퇴근 API
│   │   │   ├── auth/          # 인증 API
│   │   │   ├── calendar/      # 캘린더 API
│   │   │   └── user/          # 사용자 API
│   │   ├── attendance/        # 출퇴근 페이지
│   │   ├── auth/             # 인증 페이지
│   │   └── user/             # 사용자 페이지
│   ├── components/           # 재사용 컴포넌트
│   ├── lib/                 # 유틸리티 함수
│   ├── middleware.ts        # Next.js 미들웨어
│   └── types/              # TypeScript 타입 정의
├── supabase-attendance-system-schema.sql  # DB 스키마
└── package.json            # 의존성 관리
```

---

## 📊 데이터베이스 설계

### 주요 테이블

#### 1. users (사용자 테이블)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee',
  department VARCHAR(100),
  position VARCHAR(100),
  phone VARCHAR(20),
  start_date DATE,
  salary DECIMAL(12, 0),
  hourly_rate DECIMAL(8, 0),
  annual_leave_days INTEGER DEFAULT 15,
  used_leave_days DECIMAL(3,1) DEFAULT 0.0,
  remaining_leave_days DECIMAL(3,1) DEFAULT 15.0,
  hourly_leave_hours INTEGER DEFAULT 0,
  used_hourly_leave INTEGER DEFAULT 0,
  remaining_hourly_leave INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. attendance_records (출퇴근 기록)
```sql
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  record_time TIME NOT NULL,
  record_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  record_type VARCHAR(10) CHECK (record_type IN ('출근', '퇴근')),
  reason TEXT,
  location_lat DECIMAL(10, 7),
  location_lng DECIMAL(10, 7),
  location_accuracy INTEGER,
  source VARCHAR(20) DEFAULT 'web',
  had_dinner BOOLEAN DEFAULT false,
  is_manual BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 3. daily_work_summary (일별 근무시간 요약)
```sql
CREATE TABLE daily_work_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  basic_hours DECIMAL(4,1) DEFAULT 0,
  overtime_hours DECIMAL(4,1) DEFAULT 0,
  night_hours DECIMAL(4,1) DEFAULT 0,
  substitute_hours DECIMAL(4,1) DEFAULT 0,
  compensatory_hours DECIMAL(4,1) DEFAULT 0,
  work_status VARCHAR(50),
  had_dinner BOOLEAN DEFAULT false,
  auto_calculated BOOLEAN DEFAULT true,
  calculated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, work_date)
);
```

#### 4. monthly_work_stats (월별 근무통계)
```sql
CREATE TABLE monthly_work_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_month DATE NOT NULL,
  total_work_days INTEGER DEFAULT 0,
  total_basic_hours DECIMAL(6,1) DEFAULT 0,
  total_overtime_hours DECIMAL(6,1) DEFAULT 0,
  average_daily_hours DECIMAL(4,1) DEFAULT 0,
  dinner_count INTEGER DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  early_leave_count INTEGER DEFAULT 0,
  absent_count INTEGER DEFAULT 0,
  UNIQUE(user_id, work_month)
);
```

### 자동 계산 트리거
PostgreSQL 트리거를 사용하여 출퇴근 기록 시 자동으로 근무시간을 계산합니다:

- **calculate_daily_work_time()**: 일별 근무시간 자동 계산
- **update_monthly_work_stats()**: 월별 통계 자동 업데이트

---

## 🔧 주요 기능별 상세 사양

### 1. 인증 시스템
- **로그인**: 이메일/비밀번호 기반 인증
- **비밀번호 해시**: BCrypt 알고리즘 사용
- **세션 관리**: JWT 토큰 기반
- **권한 관리**: admin/employee 역할 구분

### 2. 직원 관리 시스템
- **직원 정보 관리**: CRUD 기능
- **부서/직급 관리**: 계층적 조직 구조
- **급여 정보 관리**: 기본급, 시급 설정
- **휴가 정보 관리**: 연차, 시간차 자동 계산

### 3. 출퇴근 관리 시스템 ⭐ **NEW**

#### 핵심 기능
- **실시간 출퇴근 기록**: GPS 위치정보 포함
- **자동 근무시간 계산**: 기본/연장/야간 근무시간 자동 분류
- **한국 근로기준법 준수**: 휴게시간, 저녁식사 시간 자동 차감
- **누락 기록 관리**: 관리자 승인을 통한 수동 보정
- **월별 통계**: 출근율, 지각/조퇴 통계

#### API 엔드포인트
1. **POST /api/attendance/record**: 출퇴근 기록 생성
2. **GET /api/attendance/status**: 현재 출퇴근 상태 조회
3. **GET /api/attendance/summary**: 월별 근무시간 요약
4. **POST /api/attendance/missing**: 누락 기록 추가

#### 사용자 인터페이스
- **AttendanceRecorder**: 실시간 출퇴근 기록 컴포넌트
- **AttendanceDashboard**: 개인 근무현황 대시보드
- **AdminAttendanceManagement**: 관리자용 전체 관리 인터페이스

### 4. 휴가 관리 시스템
- **휴가 신청**: 연차, 반차, 시간차 신청
- **승인 프로세스**: 관리자 승인 워크플로우
- **자동 차감**: 승인 시 잔여 휴가 자동 차감
- **Google 캘린더 연동**: 승인된 휴가 자동 등록

### 5. 급여 관리 시스템
- **급여 정보 설정**: 기본급, 시급 관리
- **초과근무 관리**: 초과근무 시간 및 수당 계산
- **최저임금 연동**: 네이버 API를 통한 최저임금 정보 자동 업데이트

---

## 🚀 개발 과정 및 주요 마일스톤

### v1.0.0 - 기본 인프라 구축 (2024년 초)
- Next.js 14 프로젝트 초기 설정
- Supabase 데이터베이스 연결
- 기본 인증 시스템 구현
- Vercel 배포 파이프라인 구축

### v1.1.0 - 직원 관리 시스템
- 직원 CRUD 기능 구현
- 관리자 대시보드 구축
- 부서/직급 관리 기능

### v1.2.0 - 휴가 관리 시스템
- 휴가 신청/승인 프로세스
- 연차 자동 계산 로직
- Google 캘린더 API 연동

### v1.3.0 - 급여 관리 시스템
- 급여 정보 관리 기능
- 초과근무 관리
- 네이버 최저임금 API 연동

### v2.0.0 - 출퇴근 관리 시스템 🎯 **현재 버전**

#### 개발 과정 상세 (2025년 8월)

**1단계: 기존 시스템 분석 및 문제 해결**
- 급여 데이터 저장 오류 수정
- 초과근무 API 500 에러 해결
- React 컴포넌트 이벤트 핸들링 오류 수정

**2단계: Google Apps Script 웹앱 분석**
- 기존 GAS 기반 근무시간관리 시스템 분석
- 핵심 기능 추출 및 Next.js 환경 적응 방안 수립
- 한국 근로기준법 준수 요구사항 분석

**3단계: 데이터베이스 스키마 설계**
- 출퇴근 기록 테이블 설계
- 자동 계산 트리거 함수 개발
- 성능 최적화를 위한 인덱스 생성

**4단계: API 엔드포인트 개발**
- RESTful API 설계 원칙 적용
- 4개 주요 엔드포인트 구현
- 에러 핸들링 및 검증 로직 추가

**5단계: React 컴포넌트 개발**
- 실시간 UI 업데이트 구현
- GPS 위치정보 연동
- 모바일 반응형 디자인 적용

**6단계: 통합 테스트 및 배포**
- TypeScript 타입 오류 해결
- 프로덕션 빌드 최적화
- Vercel 배포 완료

---

## 📈 성능 및 최적화

### 데이터베이스 최적화
- **인덱스 최적화**: 출퇴근 기록 조회 성능 향상
- **트리거 최적화**: 실시간 계산 성능 향상
- **쿼리 최적화**: N+1 문제 해결

### 프론트엔드 최적화
- **코드 분할**: Next.js 동적 임포트 활용
- **이미지 최적화**: Next.js Image 컴포넌트 사용
- **캐싱 전략**: SWR을 통한 데이터 캐싱

---

## 🔮 향후 개발 계획

### v2.1.0 - 고도화 기능
- [ ] 대시보드 성능 최적화
- [ ] 모바일 앱 개발 (React Native)
- [ ] 실시간 알림 시스템

### v2.2.0 - 분석 기능
- [ ] 근무 패턴 분석
- [ ] 생산성 지표 도출
- [ ] 보고서 자동 생성

### v3.0.0 - 엔터프라이즈 기능
- [ ] 멀티 테넌트 지원
- [ ] 고급 권한 관리
- [ ] 감사 로그 시스템

---

## 🐛 알려진 이슈 및 제한사항

### 현재 이슈
- ESLint 설정 경고 (빌드에는 영향 없음)
- 일부 API 라우트의 정적 생성 오류 (런타임에는 정상 작동)

### 제한사항
- 현재 단일 조직만 지원
- 모바일 최적화 부분적 지원
- 다국어 지원 미구현

---

## 📞 지원 및 문의

### 개발팀 연락처
- **GitHub**: https://github.com/nuclazzy/motion-connect-hr-system
- **배포 URL**: https://motion-connect-hxr9zyo25-motionsenses-projects.vercel.app

### 기술 지원
- 시스템 관련 문의: GitHub Issues
- 긴급 오류 신고: GitHub Issues (긴급 라벨 추가)

---

## 📄 라이선스 및 저작권

**Motion Connect HR System**  
© 2024-2025 MotionSenses  
All rights reserved.

---

## 🚨 개발 지침 및 아키텍처 원칙

### ⚠️ 중요: Supabase 직접 연동 사용 원칙

**더 이상 API route 파일 (route.ts)을 생성하지 마세요.**

본 시스템은 **직접 Supabase 클라이언트 연동** 방식으로 전환되었습니다. 모든 백엔드 기능은 다음 원칙을 따라 구현해야 합니다:

#### 📋 구현 방식

1. **Supabase Provider 사용**
   ```typescript
   import { useSupabase } from '@/components/SupabaseProvider'
   
   export default function MyComponent() {
     const { supabase } = useSupabase()
     // 직접 supabase 클라이언트 사용
   }
   ```

2. **데이터베이스 직접 접근**
   ```typescript
   // ✅ 올바른 방식
   const { data, error } = await supabase
     .from('users')
     .select('*')
     .eq('id', userId)
   
   // ❌ 피해야 할 방식
   const response = await fetch('/api/users')
   ```

3. **인증 처리**
   ```typescript
   import { getCurrentUser } from '@/lib/auth'
   
   const currentUser = await getCurrentUser()
   if (!currentUser || currentUser.role !== 'admin') {
     // 권한 체크
   }
   ```

#### 🎯 장점

- **성능 향상**: HTTP 오버헤드 제거
- **타입 안정성**: TypeScript 완전 지원
- **실시간 기능**: Supabase Realtime 활용 가능
- **단순한 아키텍처**: 불필요한 중간 계층 제거
- **에러 처리**: 데이터베이스 레벨에서 직접 처리

#### 📁 기존 변환 완료 컴포넌트

- ✅ `AdminPayrollManagement.tsx` - 급여 관리
- ✅ `DashboardAttendanceWidget.tsx` - 출퇴근 위젯
- ✅ `AttendanceRecorder.tsx` - 출퇴근 기록

#### 🔄 변환 대상 컴포넌트

나머지 컴포넌트들도 동일한 방식으로 변환 예정:
- `AdminAttendanceManagement.tsx`
- `FormApplicationModal.tsx`
- `AdminEmployeeManagement.tsx`
- 기타 20여개 컴포넌트

### 📝 개발 시 주의사항

- 새로운 기능 개발 시 반드시 **직접 Supabase 연동** 방식 사용
- API route 파일 생성 금지
- 기존 route.ts 파일은 점진적으로 제거 예정
- 컴포넌트에서 `useSupabase()` 훅 활용

---

## 🎯 최신 업데이트 (v2.1.0)

### 2025년 8월 5일 배포 - 아키텍처 개선
- ✅ Supabase 직접 연동 방식으로 전환
- ✅ API route 의존성 제거 (진행 중)
- ✅ AdminPayrollManagement 직접 연동 완료
- ✅ DashboardAttendanceWidget 직접 연동 완료
- ✅ AttendanceRecorder 직접 연동 완료

### 2025년 8월 4일 배포 (v2.0.0)
- ✅ 출퇴근 기록 시스템 완전 구현
- ✅ Google Apps Script 웹앱 기능 완전 이전
- ✅ 자동 근무시간 계산 시스템
- ✅ 관리자용 전체 관리 인터페이스
- ✅ 프로덕션 환경 배포 완료

**배포 URL**: https://motion-connect-hxr9zyo25-motionsenses-projects.vercel.app

**주요 페이지**:
- `/attendance` - 일반 직원용 출퇴근 관리
- `/admin/attendance` - 관리자용 출퇴근 관리
- `/admin` - 관리자 대시보드
- `/user` - 사용자 대시보드

---

*이 문서는 지속적으로 업데이트되며, 각 버전 배포 시마다 변경사항이 기록됩니다.*
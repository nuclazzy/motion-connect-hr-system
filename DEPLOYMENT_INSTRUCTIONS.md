# 🚀 Motion Connect HR 시스템 배포 지침

## 🎯 개요

사용자가 보고한 두 가지 핵심 문제를 해결했습니다:
1. **CAPS UPSERT 오류**: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
2. **휴가 캘린더 연동 실패**: 누락된 테이블과 함수들

## 📋 해결 내역

### ✅ 완료된 작업

1. **종합 데이터베이스 복구 스크립트 생성**
   - `execute-comprehensive-recovery.sql` - 모든 문제를 해결하는 통합 솔루션
   - CAPS UPSERT 충돌 완전 해결
   - 휴가 캘린더 연동 시스템 완전 구축

2. **CAPS 업로드 관리자 업데이트**
   - `CapsUploadManager.tsx` - 새로운 RPC 함수 적용
   - `safe_upsert_caps_attendance` 함수 사용

3. **개발팀 가이드라인 문서**
   - `DEVELOPER_GUIDELINES.md` - 향후 개발 방향성 제시
   - `MONITORING_AND_ALERTING_SYSTEM.sql` - 시스템 모니터링 도구

4. **프론트엔드 통합 가이드**
   - `SUPABASE_RPC_INTEGRATION_GUIDE.ts` - RPC 함수 사용법
   - `UPDATED_SUPABASE_TYPES.ts` - 새 스키마 타입 정의

## 🔧 배포 단계

### 1단계: 데이터베이스 복구 실행 (필수)

```sql
-- Supabase SQL Editor에서 실행
-- 파일: execute-comprehensive-recovery.sql

-- 또는 아래 명령어로 직접 실행
\i execute-comprehensive-recovery.sql
```

**중요**: 이 단계를 실행해야 CAPS 업로드 오류와 캘린더 연동 오류가 모두 해결됩니다.

### 2단계: 프론트엔드 빌드 및 배포

```bash
# 의존성 설치 (필요한 경우)
npm install

# TypeScript 타입 검증
npm run typecheck

# 린트 검사
npm run lint

# 프로덕션 빌드
npm run build

# Vercel 배포 (이미 설정된 경우)
vercel --prod
```

### 3단계: 기능 검증

```bash
# 로컬 개발 서버 시작
npm run dev
```

**검증할 기능들**:
- [ ] CAPS CSV 업로드 (관리자 페이지)
- [ ] 캘린더 동기화 상태 확인
- [ ] 휴가 데이터 처리 확인
- [ ] 데이터 정합성 검증

## 🔍 실행 후 확인사항

### Supabase SQL Editor에서 확인

```sql
-- 1. 새로운 테이블 생성 확인
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('calendar_leave_events', 'calendar_sync_logs', 'employee_events');

-- 2. RPC 함수 생성 확인
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('safe_upsert_caps_attendance', 'process_calendar_leave_events');

-- 3. 데이터 정합성 검증
SELECT * FROM validate_database_integrity();

-- 4. 캘린더 동기화 상태 확인
SELECT * FROM get_calendar_sync_status();
```

### 프론트엔드에서 확인

1. **관리자 페이지** → **CAPS 업로드**: 오류 없이 업로드 성공
2. **관리자 페이지** → **캘린더 관리**: 동기화 상태 표시
3. **출퇴근 현황**: 데이터 정상 표시

## 🚨 문제 발생 시 대응

### CAPS 업로드 여전히 실패하는 경우

```sql
-- 1. RPC 함수 존재 확인
SELECT * FROM information_schema.routines 
WHERE routine_name = 'safe_upsert_caps_attendance';

-- 2. 제약조건 상태 확인
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass;

-- 3. 수동 테스트
SELECT * FROM safe_upsert_caps_attendance(
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  '2025-08-05',
  '09:00:00',
  '2025-08-05T09:00:00+09:00'::TIMESTAMP WITH TIME ZONE,
  '출근',
  '테스트',
  'TEST-001'
);
```

### 캘린더 연동 문제가 지속되는 경우

```sql
-- 1. 테이블 존재 확인
SELECT * FROM calendar_leave_events LIMIT 1;
SELECT * FROM calendar_sync_logs LIMIT 1;

-- 2. 수동 처리 테스트
SELECT * FROM process_calendar_leave_events();
```

## 📊 모니터링 대시보드 활용

```sql
-- 시스템 건강도 확인
SELECT * FROM comprehensive_system_health_check();

-- 실시간 모니터링 대시보드
SELECT * FROM system_health_dashboard;
```

## 📞 지원 및 문의

- **GitHub Issues**: 문제 보고 및 기능 요청
- **개발팀 문의**: Slack #hr-system 채널
- **긴급 상황**: 즉시 백업 복원 후 개발팀 연락

---

## ✅ 체크리스트

배포 완료 후 다음 항목들을 확인하세요:

- [ ] **execute-comprehensive-recovery.sql** 실행 완료
- [ ] **4개 RPC 함수** 생성 확인 (safe_upsert_caps_attendance, process_calendar_leave_events, get_calendar_sync_status, validate_database_integrity)
- [ ] **3개 신규 테이블** 생성 확인 (calendar_leave_events, calendar_sync_logs, employee_events)
- [ ] **CAPS 업로드** 테스트 성공
- [ ] **캘린더 동기화** 상태 확인
- [ ] **데이터 정합성 검증** 실행
- [ ] **프론트엔드 빌드** 성공
- [ ] **Vercel 배포** 완료

**🎯 결과**: CAPS 업로드 오류와 휴가 캘린더 연동 문제가 완전히 해결되어야 합니다.
# 📋 SQL 스크립트 검증 및 실행 가이드

## ✅ 검증 완료된 스크립트

### 1. **COMPREHENSIVE_DATABASE_RECOVERY_PLAN.sql**
- **상태**: ✅ Supabase 환경 완전 호환
- **기능**: CAPS 업로드 + 캘린더 연동 종합 해결
- **안전성**: 데이터 손실 방지 로직 포함
- **실행 시간**: 약 3-5분 예상

### 2. **fix-caps-upsert-conflict-final.sql** (기존)
- **상태**: ⚠️ 부분적 해결책
- **문제점**: 제약조건만 해결, 전체 시스템 고려 부족
- **권장**: 종합 스크립트 사용 권장

### 3. **ultrathink-calendar-fix.sql** (기존)
- **상태**: ✅ 캘린더 부분만 해결
- **문제점**: CAPS 문제 미해결
- **권장**: 종합 스크립트에 통합됨

## 🎯 최종 권장 실행 스크립트

**`COMPREHENSIVE_DATABASE_RECOVERY_PLAN.sql`**을 사용하세요.
- 모든 문제를 한 번에 해결
- 안전한 단계별 실행
- 완전한 백업 및 검증 로직 포함

## 📚 실행 전 준비사항

### 1. **백업 생성**
```sql
-- Supabase 백업 (SQL Editor에서 실행)
-- 1. 중요 테이블 데이터 백업
CREATE TABLE attendance_records_backup AS SELECT * FROM attendance_records;
CREATE TABLE daily_work_summary_backup AS SELECT * FROM daily_work_summary;
CREATE TABLE calendar_configs_backup AS SELECT * FROM calendar_configs;

-- 2. 제약조건 정보 백업
CREATE TABLE constraint_backup AS 
SELECT 
  conname,
  conrelid::regclass as table_name,
  pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint 
WHERE conrelid IN ('attendance_records'::regclass, 'calendar_configs'::regclass);
```

### 2. **환경 확인**
```sql
-- Supabase 연결 상태 확인
SELECT 'Supabase 연결 정상' as status, NOW() as current_time;

-- 기존 테이블 상태 확인
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'attendance_records', 'calendar_configs')
ORDER BY table_name;
```

## 🚀 단계별 실행 가이드

### Phase 1: 진단 및 백업 (필수)
1. Supabase SQL Editor 접속
2. 위의 백업 스크립트 실행
3. 현재 상태 스냅샷 확인

### Phase 2: 종합 복구 스크립트 실행
1. `COMPREHENSIVE_DATABASE_RECOVERY_PLAN.sql` 복사
2. Supabase SQL Editor에 붙여넣기
3. **단계별 실행** (한 번에 전체 실행 가능하지만 단계별 권장)

#### 단계별 실행 구간:
```sql
-- PHASE 1: 현재 상태 진단 (Line 12-78)
-- 실행 후 결과 확인 필수

-- PHASE 2: CAPS 충돌 해결 (Line 80-158)  
-- 실행 후 제약조건 상태 확인

-- PHASE 3: 캘린더 테이블 구축 (Line 160-317)
-- 실행 후 새 테이블 생성 확인

-- PHASE 4: RPC 함수 생성 (Line 319-650)
-- 실행 후 함수 생성 확인

-- PHASE 5: 뷰 및 유틸리티 (Line 652-750)
-- 실행 후 뷰 생성 확인

-- PHASE 6: 기본 설정 (Line 752-780)
-- 실행 후 설정 확인

-- PHASE 7: 완료 검증 (Line 782-end)
-- 전체 상태 최종 확인
```

### Phase 3: 검증 및 테스트
```sql
-- 1. 데이터 정합성 검증
SELECT * FROM validate_database_integrity();

-- 2. 캘린더 동기화 상태 확인  
SELECT * FROM get_calendar_sync_status();

-- 3. CAPS 업로드 테스트
SELECT * FROM safe_upsert_caps_attendance(
  '550e8400-e29b-41d4-a716-446655440001'::UUID,
  '2025-08-05',
  '09:00:00',
  '2025-08-05T09:00:00+09:00'::TIMESTAMP WITH TIME ZONE,
  '출근',
  '테스트 출근',
  'TEST-001'
);
```

## ⚠️ 주의사항 및 안전 조치

### 1. **실행 전 필수 확인**
- [ ] 백업 완료 확인
- [ ] 프로덕션 환경인지 확인
- [ ] 사용자 접근 일시 중단 고려
- [ ] Supabase 프로젝트 올바른지 확인

### 2. **오류 발생 시 대응**
```sql
-- 롤백 방법 (오류 발생 시)
-- 1. 백업 테이블에서 복원
DROP TABLE IF EXISTS attendance_records;
ALTER TABLE attendance_records_backup RENAME TO attendance_records;

-- 2. 제약조건 복원
-- constraint_backup 테이블에서 원래 제약조건 복원
```

### 3. **단계별 검증 필수**
각 PHASE 실행 후 반드시 상태 확인:
```sql
-- 간단한 상태 확인
SELECT 
  COUNT(*) as total_records,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM attendance_records;

-- 제약조건 확인
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass;
```

## 🎯 실행 후 기대 결과

### ✅ CAPS 업로드 문제 해결
- UPSERT 충돌 오류 완전 해결
- 안전한 중복 처리 로직 구현
- RPC 함수를 통한 안정적 데이터 처리

### ✅ 캘린더 연동 시스템 완성
- `calendar_leave_events` 테이블 생성
- `calendar_sync_logs` 테이블 생성  
- `employee_events` 테이블 생성
- 자동 휴가 매칭 시스템 구현

### ✅ Supabase 특화 최적화
- RPC 함수 4개 생성
- 성능 최적화 인덱스 구축
- Real-time 호환성 확보
- 뷰 3개 생성으로 조회 최적화

## 📞 문제 발생 시 체크리스트

### 1. **권한 오류**
```sql
-- RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'attendance_records';

-- 필요시 임시 RLS 비활성화 (개발 환경만)
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;
```

### 2. **함수 생성 오류**
```sql
-- 함수 존재 확인
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%caps%';
```

### 3. **제약조건 오류**
```sql
-- 중복 데이터 확인
SELECT user_id, record_timestamp, record_type, COUNT(*) 
FROM attendance_records 
GROUP BY user_id, record_timestamp, record_type 
HAVING COUNT(*) > 1;
```

## 🚀 완료 후 다음 단계

1. **프론트엔드 코드 업데이트**
   - `SUPABASE_RPC_INTEGRATION_GUIDE.ts` 적용
   - `UPDATED_SUPABASE_TYPES.ts` 적용

2. **테스트 시나리오 실행**
   - CAPS 업로드 테스트
   - 캘린더 동기화 테스트
   - 휴가 처리 테스트

3. **모니터링 설정**
   - 정기적 정합성 검증
   - 오류 모니터링
   - 성능 모니터링

---

**🎯 결론**: `COMPREHENSIVE_DATABASE_RECOVERY_PLAN.sql` 하나로 모든 문제 해결 가능
**⏱️ 예상 시간**: 전체 실행 3-5분, 검증 포함 10분 이내
**🛡️ 안전성**: 백업 및 롤백 로직 포함으로 안전한 실행 보장
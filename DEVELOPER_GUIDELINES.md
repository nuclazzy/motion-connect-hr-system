# 🛡️ Motion Connect HR 시스템 - 개발팀 가이드라인

## 📋 개요

이 문서는 Motion Connect HR 시스템의 Supabase 데이터베이스 스키마 문제 해결 후, 향후 유사한 문제를 방지하고 안정적인 시스템 운영을 위한 개발 가이드라인을 제공합니다.

## 🚨 핵심 원칙

### 1. **Supabase 직접 연동 우선**
- ❌ API route 파일 (route.ts) 생성 금지
- ✅ Supabase 클라이언트 직접 사용
- ✅ RPC 함수 활용한 복잡한 로직 처리

### 2. **데이터 안전성 최우선**
- ✅ 모든 데이터 변경 전 백업
- ✅ 트랜잭션 단위 작업
- ✅ 롤백 계획 수립

### 3. **타입 안전성 보장**
- ✅ TypeScript 타입 정의 최신 유지
- ✅ Supabase 스키마 변경 시 타입 동기화
- ✅ 컴파일 타임 오류 해결

## 🔧 데이터베이스 작업 가이드라인

### 스키마 변경 시 필수 절차

#### 1. **계획 단계**
```sql
-- 1.1 현재 상태 백업
CREATE TABLE [table_name]_backup AS SELECT * FROM [table_name];

-- 1.2 영향도 분석
SELECT 
  table_name,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = '[target_table]';
```

#### 2. **실행 단계**
```sql
-- 2.1 트랜잭션 시작
BEGIN;

-- 2.2 변경 작업 수행
-- (스키마 변경 SQL)

-- 2.3 검증
SELECT COUNT(*) FROM [table_name];
-- 기대값과 일치하는지 확인

-- 2.4 커밋 또는 롤백
COMMIT; -- 또는 ROLLBACK;
```

#### 3. **검증 단계**
```sql
-- 3.1 데이터 정합성 검증
SELECT * FROM validate_database_integrity();

-- 3.2 시스템 건강도 확인
SELECT * FROM comprehensive_system_health_check();

-- 3.3 모니터링 대시보드 확인
SELECT * FROM system_health_dashboard;
```

### 제약조건 관리 원칙

#### ✅ 올바른 UNIQUE 제약조건 설계
```sql
-- 좋은 예: 의미있는 비즈니스 로직 반영
ALTER TABLE attendance_records 
ADD CONSTRAINT unique_attendance_record_precise 
UNIQUE (user_id, record_timestamp, record_type, COALESCE(source, 'web'));

-- 나쁜 예: 너무 단순하거나 복잡한 제약조건
-- ALTER TABLE attendance_records ADD CONSTRAINT unique_all_fields UNIQUE (user_id, record_date, record_type); -- 너무 단순
```

#### ✅ ON CONFLICT 처리 방식
```sql
-- 좋은 예: RPC 함수 사용
SELECT * FROM safe_upsert_caps_attendance(
  p_user_id => user_id,
  p_record_timestamp => timestamp,
  -- ... 기타 파라미터
);

-- 나쁜 예: 복잡한 ON CONFLICT 구문
-- INSERT ... ON CONFLICT (...) DO UPDATE SET ... (중복 가능성 있음)
```

## 📊 CAPS 업로드 작업 가이드라인

### 안전한 CAPS 데이터 처리

#### 1. **프론트엔드에서 RPC 함수 사용**
```typescript
import { safeCapsUpload } from '@/lib/supabase-rpc'

// ✅ 올바른 방식
const uploadResult = await safeCapsUpload(capsRecords)
if (uploadResult.success) {
  console.log(`성공: ${uploadResult.summary.inserted}개 추가, ${uploadResult.summary.updated}개 업데이트`)
} else {
  console.error('CAPS 업로드 실패:', uploadResult.results)
}

// ❌ 잘못된 방식 (더 이상 사용하지 말 것)
// const response = await fetch('/api/attendance/bulk-upload', {...})
```

#### 2. **대용량 데이터 처리**
```typescript
// ✅ 배치 단위 처리
const BATCH_SIZE = 100
const batches = chunkArray(capsRecords, BATCH_SIZE)

for (const batch of batches) {
  const result = await safeCapsUpload(batch)
  // 배치별 결과 처리
  await new Promise(resolve => setTimeout(resolve, 100)) // 100ms 대기
}

// ❌ 한 번에 모든 데이터 처리 (시간 초과 위험)
// const result = await safeCapsUpload(allRecords) // 수천개 레코드
```

#### 3. **오류 처리 및 복구**
```typescript
// ✅ 상세한 오류 처리
const uploadResult = await safeCapsUpload(records)

uploadResult.results.forEach((result, index) => {
  if (!result.success) {
    console.error(`레코드 ${index} 업로드 실패:`, result.message)
    
    // 실패한 레코드만 재시도 로직
    failedRecords.push(records[index])
  }
})

// 실패한 레코드 재시도
if (failedRecords.length > 0) {
  const retryResult = await safeCapsUpload(failedRecords)
  // 재시도 결과 처리
}
```

## 📅 캘린더 연동 작업 가이드라인

### 휴가 데이터 동기화

#### 1. **캘린더 이벤트 처리**
```typescript
// ✅ 배치 단위 처리
const processingResult = await supabase.rpc('process_calendar_leave_events', {
  p_sync_batch_id: batchId // 특정 배치만 처리
})

if (processingResult.data?.[0]) {
  const result = processingResult.data[0]
  console.log(`처리됨: ${result.processed_count}개`)
  console.log(`매칭됨: ${result.matched_count}개`)
  console.log(`휴가 생성: ${result.created_leave_count}개`)
}
```

#### 2. **동기화 상태 모니터링**
```typescript
// ✅ 정기적 상태 확인
const syncStatus = await supabase.rpc('get_calendar_sync_status')

syncStatus.data?.forEach(calendar => {
  if (calendar.sync_status === '동기화 필요') {
    console.warn(`${calendar.calendar_name} 동기화 필요`)
    // 자동 동기화 트리거
    triggerCalendarSync(calendar.calendar_id)
  }
})
```

#### 3. **오류 복구**
```typescript
// ✅ 오류 상황 처리
const syncStatus = await supabase.rpc('get_calendar_sync_status')

syncStatus.data?.forEach(calendar => {
  if (calendar.sync_status === '오류 발생') {
    console.error(`캘린더 오류: ${calendar.error_message}`)
    
    // 오류 초기화 및 재시도
    await supabase
      .from('calendar_configs')
      .update({
        sync_error_count: 0,
        last_error_message: null
      })
      .eq('calendar_id', calendar.calendar_id)
  }
})
```

## 🔍 모니터링 및 디버깅 가이드라인

### 시스템 건강도 확인

#### 1. **일일 체크리스트**
```typescript
// ✅ 매일 실행할 건강도 체크
const healthCheck = async () => {
  // 1. 전체 시스템 건강도
  const health = await supabase.rpc('comprehensive_system_health_check')
  console.log('시스템 상태:', health.data?.[0]?.overall_status)
  
  // 2. 데이터 정합성 검증
  const integrity = await supabase.rpc('validate_database_integrity')
  integrity.data?.forEach(check => {
    if (check.status !== '정상') {
      console.warn(`정합성 문제: ${check.details}`)
    }
  })
  
  // 3. 대시보드 확인
  const dashboard = await supabase
    .from('system_health_dashboard')
    .select('*')
    .single()
  
  console.log(`건강도 점수: ${dashboard.data?.health_score}%`)
}

// 매일 오전 9시 실행 권장
```

#### 2. **문제 상황 대응**
```typescript
// ✅ 문제 발생 시 체계적 대응
const troubleshoot = async () => {
  // 1. 즉시 백업 생성
  await createEmergencyBackup()
  
  // 2. 상세 진단
  const diagnostics = await runDetailedDiagnostics()
  
  // 3. 문제 격리
  await isolateProblematicData()
  
  // 4. 복구 실행
  await executeRecoveryPlan()
  
  // 5. 검증
  await verifyRecovery()
}
```

### 로그 분석 및 디버깅

#### 1. **의미있는 로그 작성**
```typescript
// ✅ 구조화된 로그
console.log('[CAPS_UPLOAD]', {
  timestamp: new Date().toISOString(),
  user_id: userId,
  record_count: records.length,
  batch_id: batchId,
  status: 'started'
})

// ❌ 의미없는 로그
// console.log('uploading...') // 컨텍스트 부족
```

#### 2. **오류 추적**
```typescript
// ✅ 상세한 오류 정보
try {
  const result = await safeCapsUpload(records)
} catch (error) {
  console.error('[CAPS_UPLOAD_ERROR]', {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    context: {
      user_id: userId,
      record_count: records.length,
      batch_id: batchId
    }
  })
  
  // 오류 리포팅
  await reportError('CAPS_UPLOAD_FAILED', error, context)
}
```

## 🚀 성능 최적화 가이드라인

### 데이터베이스 쿼리 최적화

#### 1. **인덱스 활용**
```sql
-- ✅ 인덱스를 고려한 쿼리
SELECT * FROM attendance_records 
WHERE user_id = ? 
AND record_date >= ? 
ORDER BY record_timestamp DESC;
-- idx_attendance_records_user_date 인덱스 활용

-- ❌ 인덱스를 무시하는 쿼리
SELECT * FROM attendance_records 
WHERE EXTRACT(YEAR FROM record_date) = 2025; -- 함수 사용으로 인덱스 미활용
```

#### 2. **배치 처리**
```typescript
// ✅ 적절한 배치 크기
const OPTIMAL_BATCH_SIZE = 50 // 경험적 최적값

// ❌ 너무 작은 배치 (오버헤드 증가)
const TOO_SMALL_BATCH = 10

// ❌ 너무 큰 배치 (타임아웃 위험)
const TOO_LARGE_BATCH = 1000
```

#### 3. **캐싱 전략**
```typescript
// ✅ 적절한 캐싱
const getCachedUserData = memoize(
  async (userId: string) => {
    return await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
  },
  { ttl: 5 * 60 * 1000 } // 5분 캐시
)
```

## 🔒 보안 가이드라인

### 데이터 접근 보안

#### 1. **Row Level Security (RLS) 활용**
```sql
-- ✅ 적절한 RLS 정책
CREATE POLICY "사용자는 자신의 출퇴근 기록만 조회" ON attendance_records
  FOR SELECT USING (user_id = auth.uid()::UUID);

-- ✅ 관리자 전체 접근
CREATE POLICY "관리자는 모든 기록 접근" ON attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid()::UUID 
      AND role = 'admin'
    )
  );
```

#### 2. **민감 정보 보호**
```typescript
// ✅ 민감 정보 마스킹
const logSafeUserData = (user: User) => {
  console.log({
    id: user.id,
    name: user.name.substring(0, 1) + '***', // 첫 글자만
    department: user.department,
    // password_hash는 로그에서 제외
  })
}

// ❌ 민감 정보 노출
// console.log('User data:', user) // 비밀번호 해시 포함
```

## 📚 문서화 가이드라인

### 코드 문서화

#### 1. **RPC 함수 문서화**
```sql
-- ✅ 상세한 함수 문서화
/*
함수명: safe_upsert_caps_attendance
목적: CAPS 시스템에서 출퇴근 기록을 안전하게 업로드/업데이트
매개변수:
  - p_user_id: 사용자 UUID
  - p_record_timestamp: 기록 시간 (중복 확인 키)
  - p_record_type: '출근' 또는 '퇴근'
반환값: success, record_id, action_taken, message
주의사항: 중복 처리 로직 포함, 트랜잭션 안전
사용 예시: SELECT * FROM safe_upsert_caps_attendance(...)
*/
CREATE OR REPLACE FUNCTION safe_upsert_caps_attendance(...)
```

#### 2. **변경 이력 관리**
```typescript
/**
 * CAPS 업로드 함수
 * 
 * @version 2.1.0
 * @since 2025-08-05
 * @author 개발팀
 * 
 * 변경 이력:
 * - 2025-08-05: UPSERT 충돌 문제 해결을 위한 RPC 함수 방식 전환
 * - 2025-08-04: 초기 구현 (API route 방식)
 * 
 * @param records CAPS 출퇴근 기록 배열
 * @returns 업로드 결과 및 통계
 */
export async function safeCapsUpload(records: CapsUploadRecord[]) {
  // 구현...
}
```

## 🚨 비상 대응 가이드라인

### 시스템 장애 대응

#### 1. **긴급 상황 체크리스트**
- [ ] 즉시 백업 생성
- [ ] 사용자 접근 일시 차단 (필요 시)
- [ ] 문제 범위 파악
- [ ] 롤백 계획 수립
- [ ] 복구 작업 실행
- [ ] 시스템 검증
- [ ] 사용자 서비스 재개
- [ ] 사후 분석 및 개선

#### 2. **롤백 절차**
```sql
-- 긴급 롤백 스크립트 (사전 준비)
-- 1. 백업에서 복원
DROP TABLE IF EXISTS attendance_records;
ALTER TABLE attendance_records_backup RENAME TO attendance_records;

-- 2. 제약조건 복원
-- (constraint_backup 테이블 참조)

-- 3. 인덱스 재생성
-- (백업된 인덱스 스크립트 실행)

-- 4. RPC 함수 복원
-- (이전 버전 함수 스크립트 실행)
```

## 📞 지원 및 에스컬레이션

### 문제 해결 단계

1. **1차: 개발자 자가 해결**
   - 로그 분석
   - 문서 참조
   - 기본 디버깅

2. **2차: 팀 내 협의**
   - 코드 리뷰
   - 동료 개발자 상담
   - 팀 회의

3. **3차: 시니어/아키텍트 에스컬레이션**
   - 복잡한 아키텍처 문제
   - 성능 최적화
   - 보안 이슈

4. **4차: 외부 전문가 지원**
   - Supabase 지원팀 문의
   - 데이터베이스 전문가 컨설팅

### 연락처 및 리소스

- **내부 문서**: `/docs` 폴더
- **모니터링 대시보드**: Supabase Dashboard
- **로그 분석**: `system_health_logs` 테이블
- **긴급 상황**: Slack #emergency 채널

---

## ✅ 체크리스트 템플릿

### 새로운 기능 개발 시
- [ ] 기존 스키마 영향도 분석
- [ ] 백업 계획 수립
- [ ] TypeScript 타입 정의 업데이트
- [ ] RPC 함수 필요성 검토
- [ ] 테스트 케이스 작성
- [ ] 성능 영향 분석
- [ ] 보안 검토
- [ ] 문서 업데이트
- [ ] 모니터링 대시보드 확인

### 버그 수정 시
- [ ] 문제 원인 정확한 파악
- [ ] 수정 범위 최소화
- [ ] 테스트 환경에서 검증
- [ ] 롤백 계획 준비
- [ ] 프로덕션 적용
- [ ] 모니터링 강화
- [ ] 근본 원인 분석
- [ ] 재발 방지 대책 수립

**이 가이드라인을 준수하여 안정적이고 확장 가능한 HR 시스템을 구축하세요! 🚀**
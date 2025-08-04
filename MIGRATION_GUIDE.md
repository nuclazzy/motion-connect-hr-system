# 대체휴가/보상휴가 컬럼 제거 마이그레이션 가이드

## 🎯 목적
`leave_days` 테이블에서 중복된 별도 컬럼(`substitute_leave_hours`, `compensatory_leave_hours`)을 제거하고, JSON 필드만을 단일 소스로 사용하도록 정리합니다.

## 📋 생성된 파일들

### 1. 마이그레이션 파일들
- `/supabase/migrations/20250804_safe_column_removal_preparation.sql` - 사전 준비 및 안전성 검증
- `/supabase/migrations/20250804_remove_separate_leave_columns.sql` - 실제 컬럼 제거

### 2. 롤백 파일
- `/supabase/rollback_20250804_column_removal.sql` - 필요시 이전 상태로 완전 롤백

### 3. 문서
- `/table_structure_comparison.md` - 마이그레이션 전후 구조 비교
- `/MIGRATION_GUIDE.md` - 이 가이드

## ⚡ 빠른 실행 (권장)

마이그레이션이 안전하다고 판단되면 다음 명령어로 실행:

```bash
# Supabase 마이그레이션 실행
npx supabase db push
```

## 🔍 단계별 실행 (신중한 접근)

### 1단계: 사전 준비 실행
```bash
# 준비 마이그레이션만 먼저 실행
psql -d your_database -f supabase/migrations/20250804_safe_column_removal_preparation.sql
```

### 2단계: 데이터 검증
```sql
-- 1. 컬럼-JSON 데이터 일치 확인
SELECT * FROM verify_column_json_consistency() WHERE NOT is_consistent;

-- 2. 불일치가 있다면 자동 수정
SELECT * FROM fix_column_json_inconsistencies();

-- 3. 컬럼 제거 안전성 최종 확인
SELECT * FROM validate_safe_for_column_removal();
```

### 3단계: 컬럼 제거 실행
```bash
# 모든 검증이 통과했다면 컬럼 제거 실행
psql -d your_database -f supabase/migrations/20250804_remove_separate_leave_columns.sql
```

### 4단계: 완료 확인
```sql
-- 마이그레이션 성공 확인
SELECT * FROM verify_column_removal_success();
```

## 🚨 문제 발생시 롤백

만약 마이그레이션 후 문제가 발생하면:

```bash
# 즉시 롤백 실행
psql -d your_database -f supabase/rollback_20250804_column_removal.sql

# 롤백 성공 확인
psql -d your_database -c "SELECT * FROM verify_rollback_success();"
```

## 📊 현재 상태 확인

마이그레이션 전 현재 시스템 상태 확인:

```bash
# 코드에서 컬럼 사용 현황 확인
grep -r "substitute_leave_hours\|compensatory_leave_hours" src/ --include="*.ts" --include="*.js"
```

## ✅ 마이그레이션 후 코드 업데이트

마이그레이션 완료 후 다음 파일들을 업데이트해야 합니다:

### 1. 타입 정의 업데이트
```typescript
// src/lib/supabase.ts
export interface LeaveDays {
  id: number
  user_id: string
  leave_types: {
    annual_days: number
    used_annual_days: number
    sick_days: number
    used_sick_days: number
    substitute_leave_hours: number
    compensatory_leave_hours: number
  }
  // substitute_leave_hours: number  <- 제거됨
  // compensatory_leave_hours: number <- 제거됨
  created_at: string
  updated_at: string
}
```

### 2. API 라우트 업데이트
별도 컬럼 참조하는 코드를 JSON 필드 참조로 변경:

```typescript
// Before (제거할 코드)
const hours = leaveData.substitute_leave_hours

// After (JSON 필드 사용)
const hours = leaveData.leave_types.substitute_leave_hours
```

### 3. 새로운 헬퍼 함수 사용
```typescript
// 대체휴가 시간 조회
const substituteHours = await supabase.rpc('get_substitute_hours', { p_user_id: userId })

// 보상휴가 시간 조회
const compensatoryHours = await supabase.rpc('get_compensatory_hours', { p_user_id: userId })

// 휴가 시간 업데이트
await supabase.rpc('update_leave_hours', { 
  p_user_id: userId, 
  p_leave_type: 'substitute', 
  p_hours: newHours 
})
```

## ⚠️ 주의사항

1. **운영 환경에서는 반드시 백업 후 실행**
2. **사용자가 적은 시간대에 실행 권장**
3. **마이그레이션 전 전체 데이터 백업 필수**
4. **롤백 스크립트 준비 상태 유지**

## 🔧 트러블슈팅

### 문제: 데이터 불일치 발견
```sql
-- 불일치 데이터 확인
SELECT * FROM verify_column_json_consistency() WHERE NOT is_consistent;

-- 자동 수정
SELECT * FROM fix_column_json_inconsistencies();
```

### 문제: 마이그레이션 실패
```bash
# 롤백 실행
psql -d your_database -f supabase/rollback_20250804_column_removal.sql
```

### 문제: 코드에서 컬럼 참조 오류
1. 타입 정의 업데이트
2. 별도 컬럼 참조 코드를 JSON 필드 참조로 변경
3. 새로운 헬퍼 함수 활용

## 📈 마이그레이션 이점

### 1. 데이터 일관성
- ✅ 중복 데이터 제거
- ✅ 동기화 문제 해결
- ✅ 단일 소스 보장

### 2. 확장성
- ✅ 새로운 휴가 유형 쉽게 추가
- ✅ 동적 필드 관리
- ✅ 스키마 변경 없이 확장

### 3. 성능
- ✅ 스토리지 절약
- ✅ 인덱스 최적화
- ✅ 쿼리 단순화

### 4. 유지보수성
- ✅ 코드 복잡도 감소
- ✅ 버그 가능성 감소
- ✅ 관리 포인트 감소

## 📞 지원

문제가 발생하면:
1. 먼저 롤백으로 안전한 상태로 복원
2. 로그 및 오류 메시지 확인
3. 데이터 백업 상태 확인
4. 필요시 개발팀 문의
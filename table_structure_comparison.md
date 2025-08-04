# Leave Days 테이블 구조 변경 비교

## 현재 상태 (마이그레이션 전)
```sql
-- leave_days 테이블 구조
CREATE TABLE leave_days (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    leave_types JSONB,
    substitute_leave_hours NUMERIC DEFAULT 0,     -- 제거 대상
    compensatory_leave_hours NUMERIC DEFAULT 0,   -- 제거 대상  
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 현재 데이터 구조 예시
{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "leave_types": {
        "annual_days": 15,
        "used_annual_days": 5,
        "sick_days": 3,
        "used_sick_days": 1,
        "substitute_leave_hours": 8,      -- JSON 필드
        "compensatory_leave_hours": 12    -- JSON 필드
    },
    "substitute_leave_hours": 8,          -- 별도 컬럼 (중복)
    "compensatory_leave_hours": 12        -- 별도 컬럼 (중복)
}
```

## 마이그레이션 후 상태
```sql
-- leave_days 테이블 구조 (정리된 버전)
CREATE TABLE leave_days (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    leave_types JSONB,                   -- 단일 소스
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 정리된 데이터 구조
{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "leave_types": {
        "annual_days": 15,
        "used_annual_days": 5,
        "sick_days": 3,
        "used_sick_days": 1,
        "substitute_leave_hours": 8,      -- 단일 소스
        "compensatory_leave_hours": 12    -- 단일 소스
    }
}
```

## 주요 변경사항

### 1. 제거되는 컬럼들
- `substitute_leave_hours` (NUMERIC) 컬럼 제거
- `compensatory_leave_hours` (NUMERIC) 컬럼 제거

### 2. 유지되는 구조
- `leave_types` JSONB 필드는 그대로 유지
- JSON 내부의 모든 휴가 관련 데이터 구조 유지
- 기존 인덱스들 유지

### 3. 새로운 헬퍼 함수들
```sql
-- 대체휴가 시간 조회
SELECT get_substitute_hours('user-uuid');

-- 보상휴가 시간 조회  
SELECT get_compensatory_hours('user-uuid');

-- 휴가 시간 업데이트
SELECT update_leave_hours('user-uuid', 'substitute', 10);
SELECT update_leave_hours('user-uuid', 'compensatory', 15);
```

## 마이그레이션의 장점

### 1. 데이터 일관성
- ✅ 단일 소스로 데이터 중복 제거
- ✅ 동기화 문제 완전 해결
- ✅ 데이터 불일치 가능성 제거

### 2. 유연성 향상
- ✅ 새로운 휴가 유형 추가시 컬럼 생성 불필요
- ✅ JSON 스키마만 업데이트하면 됨
- ✅ 동적 필드 관리 가능

### 3. 성능 개선
- ✅ 스토리지 공간 절약
- ✅ 인덱스 수 감소
- ✅ JSONB의 효율적인 쿼리 활용

### 4. 유지보수성
- ✅ 코드 복잡도 감소
- ✅ 데이터 모델 단순화
- ✅ 버그 발생 가능성 감소

## 안전성 보장

### 1. 백업 전략
- `leave_days_backup_20250804` 테이블로 원본 데이터 백업
- 롤백 스크립트 제공
- 마이그레이션 전후 검증 함수 제공

### 2. 점진적 마이그레이션
1. **준비 단계**: 데이터 백업 및 일관성 확인
2. **실행 단계**: 컬럼 제거 및 검증 강화
3. **검증 단계**: 완료 상태 확인

### 3. 롤백 계획
- 완전한 롤백 스크립트 제공
- 원본 상태로 완전 복원 가능
- 롤백 전 현재 상태도 백업

## 코드 업데이트 필요사항

마이그레이션 후 다음 파일들의 코드 업데이트가 필요합니다:

1. **API 라우트들**: 별도 컬럼 참조 제거
2. **Supabase 타입 정의**: 컬럼 제거 반영
3. **휴가 관련 함수들**: JSON 전용 접근 방식으로 변경
4. **테스트 코드들**: 새로운 구조에 맞게 업데이트

## 마이그레이션 실행 순서

```bash
# 1. 준비 마이그레이션 실행
psql -f supabase/migrations/20250804_safe_column_removal_preparation.sql

# 2. 데이터 일관성 확인
SELECT * FROM verify_column_json_consistency();

# 3. 불일치 데이터 수정 (필요시)
SELECT * FROM fix_column_json_inconsistencies();

# 4. 최종 안전성 확인
SELECT * FROM validate_safe_for_column_removal();

# 5. 컬럼 제거 마이그레이션 실행
psql -f supabase/migrations/20250804_remove_separate_leave_columns.sql

# 6. 완료 확인
SELECT * FROM verify_column_removal_success();
```

## 롤백 방법 (필요시)

```bash
# 롤백 스크립트 실행
psql -f supabase/rollback_20250804_column_removal.sql

# 롤백 성공 확인
SELECT * FROM verify_rollback_success();
```
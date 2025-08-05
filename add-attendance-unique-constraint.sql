-- attendance_records 테이블에 unique 제약조건 추가
-- CAPS 데이터 업로드를 위한 ON CONFLICT 지원

-- 1. 기존 중복 데이터 확인 및 정리
WITH duplicates AS (
  SELECT 
    id,
    user_id,
    record_timestamp,
    record_type,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, record_timestamp, record_type 
      ORDER BY created_at ASC, id::text ASC
    ) as rn
  FROM attendance_records
)
DELETE FROM attendance_records
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. unique 제약조건 추가
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_user_timestamp_type_unique 
UNIQUE (user_id, record_timestamp, record_type);

-- 3. 제약조건 생성 확인
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  conkey as constrained_columns
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass 
  AND contype = 'u';

-- 성공 메시지
SELECT '✅ attendance_records 테이블에 unique 제약조건이 성공적으로 추가되었습니다.' as result;
-- 🚨 CAPS 중복 제약조건 오류 핵심 수정 (Supabase Dashboard에서 실행)
-- "ON CONFLICT DO UPDATE command cannot affect row a second time" 해결

-- 1. 현재 중복 데이터 확인
SELECT 
  'attendance_records 중복 현황' as check_type,
  user_id,
  record_timestamp,
  record_type,
  COUNT(*) as duplicate_count
FROM attendance_records
GROUP BY user_id, record_timestamp, record_type
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 5;

-- 2. 중복 데이터 정리 (가장 최근 것만 유지)
WITH duplicate_records AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, record_timestamp, record_type 
      ORDER BY created_at DESC
    ) as rn
  FROM attendance_records
)
DELETE FROM attendance_records 
WHERE id IN (
  SELECT id FROM duplicate_records WHERE rn > 1
);

-- 3. 핵심 수정: UNIQUE 제약조건 추가
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_unique_key 
UNIQUE (user_id, record_timestamp, record_type);

-- 4. 성능 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_attendance_upsert 
ON attendance_records(user_id, record_timestamp, record_type);

-- 5. 안전한 UPSERT 함수 생성
CREATE OR REPLACE FUNCTION safe_upsert_attendance_record(
  p_user_id UUID,
  p_record_date DATE,
  p_record_time TIME,
  p_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_record_type VARCHAR(10),
  p_reason TEXT DEFAULT NULL,
  p_source VARCHAR(20) DEFAULT 'CAPS',
  p_is_manual BOOLEAN DEFAULT false,
  p_had_dinner BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  INSERT INTO attendance_records (
    user_id, record_date, record_time, record_timestamp, record_type,
    reason, source, is_manual, had_dinner
  ) VALUES (
    p_user_id, p_record_date, p_record_time, p_record_timestamp, p_record_type,
    p_reason, p_source, p_is_manual, p_had_dinner
  )
  ON CONFLICT (user_id, record_timestamp, record_type)
  DO UPDATE SET
    record_date = EXCLUDED.record_date,
    record_time = EXCLUDED.record_time,
    reason = COALESCE(EXCLUDED.reason, attendance_records.reason),
    source = EXCLUDED.source,
    is_manual = EXCLUDED.is_manual,
    had_dinner = EXCLUDED.had_dinner,
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'UPSERT failed: %, %, %', p_user_id, p_record_timestamp, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. 완료 확인
SELECT 
  '🎯 CAPS 제약조건 수정 완료!' as status,
  'attendance_records_unique_key 제약조건 추가됨' as constraint_added,
  'safe_upsert_attendance_record 함수 생성됨' as function_created,
  'CapsUploadManager에서 .rpc("safe_upsert_attendance_record") 사용 가능' as usage;
-- 🚨 CAPS 데이터 업로드 오류 긴급 수정
-- "ON CONFLICT DO UPDATE command cannot affect row a second time" 오류 해결

-- 1. 현재 데이터베이스 상태 확인
SELECT 
  '=== 현재 attendance_records 제약조건 현황 ===' as status,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'attendance_records'
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
GROUP BY tc.constraint_name, tc.constraint_type
ORDER BY tc.constraint_type, tc.constraint_name;

-- 2. 기존 중복 데이터 확인 및 정리
SELECT 
  '=== 중복 데이터 현황 ===' as status,
  user_id,
  record_timestamp,
  record_type,
  COUNT(*) as duplicate_count
FROM attendance_records
GROUP BY user_id, record_timestamp, record_type
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 3. 중복 데이터 안전 제거 (가장 최근 생성된 것만 유지)
WITH duplicate_records AS (
  SELECT 
    id,
    user_id,
    record_timestamp,
    record_type,
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

-- 4. 정리 결과 확인
SELECT 
  '=== 중복 제거 후 현황 ===' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT (user_id, record_timestamp, record_type)) as unique_combinations,
  COUNT(*) - COUNT(DISTINCT (user_id, record_timestamp, record_type)) as remaining_duplicates
FROM attendance_records;

-- 5. UNIQUE 제약조건 추가 (중복 방지의 핵심)
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_unique_timestamp_user_type 
UNIQUE (user_id, record_timestamp, record_type);

-- 6. 성능 최적화 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_attendance_records_upsert_key 
ON attendance_records(user_id, record_timestamp, record_type);

-- 7. safe_upsert_attendance_record 함수 존재 확인
SELECT 
  '=== UPSERT 함수 확인 ===' as status,
  proname as function_name,
  prosrc IS NOT NULL as function_exists
FROM pg_proc 
WHERE proname = 'safe_upsert_attendance_record';

-- 8. 함수가 없다면 생성
CREATE OR REPLACE FUNCTION safe_upsert_attendance_record(
  p_user_id UUID,
  p_record_date DATE,
  p_record_time TIME,
  p_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_record_type VARCHAR(10),
  p_reason TEXT DEFAULT NULL,
  p_source VARCHAR(20) DEFAULT 'CAPS',
  p_is_manual BOOLEAN DEFAULT false,
  p_had_dinner BOOLEAN DEFAULT false,
  p_location_lat DECIMAL(10, 7) DEFAULT NULL,
  p_location_lng DECIMAL(10, 7) DEFAULT NULL,
  p_location_accuracy INTEGER DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  result_id UUID;
BEGIN
  -- UPSERT: INSERT with ON CONFLICT UPDATE
  INSERT INTO attendance_records (
    user_id,
    record_date,
    record_time,
    record_timestamp,
    record_type,
    reason,
    source,
    is_manual,
    had_dinner,
    location_lat,
    location_lng,
    location_accuracy,
    notes
  ) VALUES (
    p_user_id,
    p_record_date,
    p_record_time,
    p_record_timestamp,
    p_record_type,
    p_reason,
    p_source,
    p_is_manual,
    p_had_dinner,
    p_location_lat,
    p_location_lng,
    p_location_accuracy,
    p_notes
  )
  ON CONFLICT (user_id, record_timestamp, record_type)
  DO UPDATE SET
    record_date = EXCLUDED.record_date,
    record_time = EXCLUDED.record_time,
    reason = COALESCE(EXCLUDED.reason, attendance_records.reason),
    source = EXCLUDED.source,
    is_manual = EXCLUDED.is_manual,
    had_dinner = EXCLUDED.had_dinner,
    location_lat = COALESCE(EXCLUDED.location_lat, attendance_records.location_lat),
    location_lng = COALESCE(EXCLUDED.location_lng, attendance_records.location_lng),
    location_accuracy = COALESCE(EXCLUDED.location_accuracy, attendance_records.location_accuracy),
    notes = COALESCE(EXCLUDED.notes, attendance_records.notes),
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
EXCEPTION
  WHEN OTHERS THEN
    -- 오류 로깅
    RAISE WARNING 'UPSERT 실패: %, %, %', p_user_id, p_record_timestamp, SQLERRM;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 9. 최종 확인 및 완료 메시지
SELECT 
  '🎯 CAPS 중복 오류 수정 완료!' as message,
  '✅ 중복 데이터 제거' as step1,  
  '✅ UNIQUE 제약조건 추가' as step2,
  '✅ UPSERT 함수 생성/확인' as step3,
  '✅ 성능 인덱스 추가' as step4,
  '🔄 이제 CapsUploadManager에서 safe_upsert_attendance_record 함수 사용 가능' as next_step;

-- 10. 사용 방법 안내
SELECT 
  '=== 수정된 CapsUploadManager 사용법 ===' as guide,
  'await supabase.rpc("safe_upsert_attendance_record", { p_user_id: ..., p_record_timestamp: ..., p_record_type: ... })' as usage,
  '중복 시 자동 업데이트, 신규 시 삽입, race condition 완전 해결' as benefit;
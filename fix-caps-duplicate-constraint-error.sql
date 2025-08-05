-- CAPS 데이터 업로드 중복 제약조건 오류 해결

-- 1. 현재 attendance_records 테이블 제약조건 확인
SELECT 
  '=== attendance_records 테이블 제약조건 현황 ===' as status,
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

-- 2. 문제가 되는 중복 데이터 확인
SELECT 
  '=== 중복 데이터 현황 확인 ===' as status,
  user_id,
  record_timestamp,
  record_type,
  COUNT(*) as duplicate_count
FROM attendance_records
GROUP BY user_id, record_timestamp, record_type
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- 3. 7월 데이터 중 중복 가능성이 있는 데이터 확인
SELECT 
  '=== 7월 데이터 중복 확인 ===' as status,
  COUNT(*) as total_july_records,
  COUNT(DISTINCT (user_id, record_timestamp, record_type)) as unique_combinations,
  COUNT(*) - COUNT(DISTINCT (user_id, record_timestamp, record_type)) as potential_duplicates
FROM attendance_records
WHERE record_date >= '2025-07-01' 
AND record_date < '2025-08-01';

-- 4. 안전한 중복 제거 함수 생성
CREATE OR REPLACE FUNCTION safe_remove_attendance_duplicates()
RETURNS TABLE (
  removed_count INTEGER,
  remaining_count INTEGER
) AS $$
DECLARE
  duplicate_record RECORD;
  removed_cnt INTEGER := 0;
  remaining_cnt INTEGER := 0;
BEGIN
  -- 중복된 출퇴근 기록들을 찾아서 가장 최근에 생성된 것만 남기고 나머지 삭제
  FOR duplicate_record IN
    SELECT 
      user_id,
      record_timestamp,
      record_type,
      array_agg(id ORDER BY created_at DESC) as ids,
      COUNT(*) as cnt
    FROM attendance_records
    GROUP BY user_id, record_timestamp, record_type
    HAVING COUNT(*) > 1
  LOOP
    -- 첫 번째(가장 최근) ID를 제외한 나머지 삭제
    DELETE FROM attendance_records
    WHERE id = ANY(duplicate_record.ids[2:array_length(duplicate_record.ids, 1)]);
    
    removed_cnt := removed_cnt + (duplicate_record.cnt - 1);
    remaining_cnt := remaining_cnt + 1;
  END LOOP;
  
  removed_count := removed_cnt;
  remaining_count := remaining_cnt;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. 중복 제거 실행
SELECT 
  '=== 중복 제거 실행 결과 ===' as status,
  removed_count as removed_duplicates,
  remaining_count as kept_unique_records
FROM safe_remove_attendance_duplicates();

-- 6. 더 강력한 UNIQUE 제약조건 추가 (기존 제약조건을 대체)
-- 기존 제약조건 확인 후 삭제
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- 기존 UNIQUE 제약조건들 찾기
  FOR constraint_record IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'attendance_records'
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%user%timestamp%type%'
  LOOP
    EXECUTE 'ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    RAISE NOTICE '기존 제약조건 삭제: %', constraint_record.constraint_name;
  END LOOP;
END $$;

-- 새로운 강력한 UNIQUE 제약조건 추가
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_unique_key 
UNIQUE (user_id, record_timestamp, record_type);

-- 7. 인덱스 최적화 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_date_type 
ON attendance_records(user_id, record_date, record_type);

CREATE INDEX IF NOT EXISTS idx_attendance_records_timestamp_type 
ON attendance_records(record_timestamp, record_type);

-- 8. CAPS 업로드용 안전한 UPSERT 함수 생성
CREATE OR REPLACE FUNCTION safe_upsert_attendance_record(
  p_user_id UUID,
  p_record_date DATE,
  p_record_time TIME,
  p_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_record_type VARCHAR(10),
  p_reason TEXT DEFAULT NULL,
  p_source VARCHAR(20) DEFAULT 'caps',
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
  -- 먼저 기존 기록이 있는지 확인
  SELECT id INTO result_id
  FROM attendance_records
  WHERE user_id = p_user_id
  AND record_timestamp = p_record_timestamp
  AND record_type = p_record_type
  LIMIT 1;
  
  IF result_id IS NOT NULL THEN
    -- 기존 기록이 있으면 업데이트
    UPDATE attendance_records
    SET 
      record_date = p_record_date,
      record_time = p_record_time,
      reason = COALESCE(p_reason, reason),
      source = p_source,
      is_manual = p_is_manual,
      had_dinner = p_had_dinner,
      location_lat = COALESCE(p_location_lat, location_lat),
      location_lng = COALESCE(p_location_lng, location_lng),
      location_accuracy = COALESCE(p_location_accuracy, location_accuracy),
      notes = COALESCE(p_notes, notes),
      updated_at = NOW()
    WHERE id = result_id;
    
  ELSE
    -- 새로운 기록 생성
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
    RETURNING id INTO result_id;
  END IF;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- 9. 일괄 CAPS 데이터 업로드용 함수
CREATE OR REPLACE FUNCTION bulk_upload_caps_attendance(
  caps_data JSONB[]
)
RETURNS TABLE (
  success_count INTEGER,
  error_count INTEGER,
  duplicate_count INTEGER,
  total_processed INTEGER
) AS $$
DECLARE
  caps_record JSONB;
  success_cnt INTEGER := 0;
  error_cnt INTEGER := 0;
  duplicate_cnt INTEGER := 0;
  total_cnt INTEGER := 0;
  result_id UUID;
  existing_id UUID;
BEGIN
  -- 각 CAPS 레코드 처리
  FOREACH caps_record IN ARRAY caps_data
  LOOP
    total_cnt := total_cnt + 1;
    
    BEGIN
      -- 중복 확인
      SELECT id INTO existing_id
      FROM attendance_records
      WHERE user_id = (caps_record->>'user_id')::UUID
      AND record_timestamp = (caps_record->>'record_timestamp')::TIMESTAMP WITH TIME ZONE
      AND record_type = caps_record->>'record_type'
      LIMIT 1;
      
      IF existing_id IS NOT NULL THEN
        duplicate_cnt := duplicate_cnt + 1;
      ELSE
        -- 안전한 삽입
        SELECT safe_upsert_attendance_record(
          (caps_record->>'user_id')::UUID,
          (caps_record->>'record_date')::DATE,
          (caps_record->>'record_time')::TIME,
          (caps_record->>'record_timestamp')::TIMESTAMP WITH TIME ZONE,
          caps_record->>'record_type',
          caps_record->>'reason',
          COALESCE(caps_record->>'source', 'caps'),
          COALESCE((caps_record->>'is_manual')::BOOLEAN, false),
          COALESCE((caps_record->>'had_dinner')::BOOLEAN, false),
          (caps_record->>'location_lat')::DECIMAL(10, 7),
          (caps_record->>'location_lng')::DECIMAL(10, 7),
          (caps_record->>'location_accuracy')::INTEGER,
          caps_record->>'notes'
        ) INTO result_id;
        
        success_cnt := success_cnt + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_cnt := error_cnt + 1;
      -- 오류 로그 (옵션)
      RAISE WARNING '레코드 처리 실패: %, 오류: %', caps_record, SQLERRM;
    END;
  END LOOP;
  
  success_count := success_cnt;
  error_count := error_cnt;
  duplicate_count := duplicate_cnt;
  total_processed := total_cnt;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 10. 제약조건 확인 및 완료 메시지
SELECT 
  '=== 수정 완료 후 제약조건 현황 ===' as status,
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

-- 11. 완료 메시지
SELECT 
  '🔧 CAPS 데이터 업로드 중복 오류 해결 완료!' as message,
  '✅ 기존 중복 데이터 안전 제거' as step1,
  '✅ 강력한 UNIQUE 제약조건 추가' as step2,
  '✅ 안전한 UPSERT 함수 생성' as step3,
  '✅ 일괄 업로드용 함수 생성' as step4,
  '✅ 성능 향상 인덱스 추가' as step5;

-- 12. 사용 방법 안내
SELECT 
  '=== 사용 방법 ===' as guide,
  '단일 레코드: SELECT safe_upsert_attendance_record(...)' as single_record,
  '일괄 업로드: SELECT * FROM bulk_upload_caps_attendance(ARRAY[...]::JSONB[])' as bulk_upload,
  '중복 제거: SELECT * FROM safe_remove_attendance_duplicates()' as remove_duplicates;
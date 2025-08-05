-- 🚨 CAPS 업로드 UPSERT 충돌 완전 해결 스크립트
-- PostgreSQL 구문 오류 수정 버전

-- ====================================================================
-- PHASE 1: 기존 제약조건 안전 제거
-- ====================================================================

DO $$
DECLARE
  constraint_name TEXT;
  constraint_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 기존 UNIQUE 제약조건 안전 제거 시작';
  
  -- attendance_records 테이블의 모든 UNIQUE 제약조건 찾기 (PK 제외)
  FOR constraint_name IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'attendance_records'::regclass
    AND contype = 'u'
    AND conname != 'attendance_records_pkey'
  LOOP
    EXECUTE 'ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS ' || constraint_name;
    constraint_count := constraint_count + 1;
    RAISE NOTICE '✅ 제거된 제약조건: %', constraint_name;
  END LOOP;
  
  RAISE NOTICE '🎯 총 % 개의 중복 제약조건 제거 완료', constraint_count;
END $$;

-- ====================================================================
-- PHASE 2: 중복 데이터 정리
-- ====================================================================

WITH duplicate_cleanup AS (
  SELECT 
    id,
    user_id,
    record_timestamp,
    record_type,
    source,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, record_timestamp, record_type, COALESCE(source, 'web')
      ORDER BY created_at DESC, updated_at DESC
    ) as rn
  FROM attendance_records
  WHERE source IN ('CAPS', 'web', 'manual') OR source IS NULL
)
DELETE FROM attendance_records 
WHERE id IN (
  SELECT id FROM duplicate_cleanup WHERE rn > 1
);

-- ====================================================================
-- PHASE 3: source 컬럼 정규화 (NOT NULL 강제 적용)
-- ====================================================================

-- NULL 값을 기본값으로 변경
UPDATE attendance_records SET source = 'web' WHERE source IS NULL;

-- 컬럼을 NOT NULL로 변경
ALTER TABLE attendance_records ALTER COLUMN source SET DEFAULT 'web';
ALTER TABLE attendance_records ALTER COLUMN source SET NOT NULL;

-- ====================================================================
-- PHASE 4: 새로운 안전한 제약조건 생성
-- ====================================================================

ALTER TABLE attendance_records 
ADD CONSTRAINT unique_attendance_record_final 
UNIQUE (user_id, record_timestamp, record_type, source);

-- ====================================================================
-- PHASE 5: CAPS 전용 안전한 RPC 함수 생성
-- ====================================================================

CREATE OR REPLACE FUNCTION safe_upsert_caps_attendance(
  p_user_id UUID,
  p_record_date DATE,
  p_record_time TIME,
  p_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_record_type VARCHAR(10),
  p_reason TEXT DEFAULT NULL,
  p_device_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  record_id UUID,
  action_taken VARCHAR(20),
  message TEXT
) AS $$
DECLARE
  existing_id UUID;
  new_record_id UUID;
  source_value VARCHAR(20) := 'CAPS';
BEGIN
  -- 1. 기존 레코드 정확한 매칭 확인
  SELECT id INTO existing_id
  FROM attendance_records
  WHERE user_id = p_user_id
  AND record_timestamp = p_record_timestamp
  AND record_type = p_record_type
  AND source = source_value
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- 2. 기존 레코드 업데이트 (안전한 업데이트)
    UPDATE attendance_records 
    SET 
      record_date = p_record_date,
      record_time = p_record_time,
      reason = COALESCE(p_reason, reason),
      notes = CASE 
        WHEN p_device_id IS NOT NULL 
        THEN COALESCE(notes, '') || ' [Device: ' || p_device_id || ']'
        ELSE notes
      END,
      updated_at = NOW()
    WHERE id = existing_id;
    
    success := true;
    record_id := existing_id;
    action_taken := 'updated';
    message := 'CAPS 기록 업데이트 완료';
    RETURN NEXT;
    
  ELSE
    -- 3. 새 레코드 안전한 삽입
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
      notes
    ) VALUES (
      p_user_id,
      p_record_date,
      p_record_time,
      p_record_timestamp,
      p_record_type,
      p_reason,
      source_value,
      false,
      false,
      CASE 
        WHEN p_device_id IS NOT NULL 
        THEN 'CAPS 업로드 [Device: ' || p_device_id || ']'
        ELSE 'CAPS 업로드'
      END
    )
    RETURNING id INTO new_record_id;
    
    success := true;
    record_id := new_record_id;
    action_taken := 'inserted';
    message := 'CAPS 기록 신규 생성 완료';
    RETURN NEXT;
  END IF;

EXCEPTION 
  WHEN OTHERS THEN
    success := false;
    record_id := null;
    action_taken := 'error';
    message := 'CAPS 업로드 오류: ' || SQLERRM;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- 완료 확인 및 검증
-- ====================================================================

-- 제약조건 상태 확인
SELECT 
  '=== attendance_records 제약조건 최종 상태 ===' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass
AND contype = 'u'
ORDER BY conname;

-- RPC 함수 생성 확인
SELECT 
  '=== RPC 함수 생성 확인 ===' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'safe_upsert_caps_attendance';

-- 완료 메시지
SELECT 
  '✅ CAPS 업로드 UPSERT 충돌 해결 완료' as status,
  '🚀 안전한 RPC 함수 구현 완료' as rpc_status,
  NOW() as completion_time;

/*
🎯 사용법:
프론트엔드에서 다음과 같이 호출:

const { data, error } = await supabase.rpc('safe_upsert_caps_attendance', {
  p_user_id: userId,
  p_record_date: '2025-08-05',
  p_record_time: '09:00:00',
  p_record_timestamp: '2025-08-05T09:00:00+09:00',
  p_record_type: '출근',
  p_reason: 'CAPS 지문인식',
  p_device_id: 'CAPS-001'
});
*/
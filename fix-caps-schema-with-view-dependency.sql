-- CAPS 형식 지원을 위한 스키마 업데이트 (뷰 의존성 해결)
-- attendance_records 테이블의 record_type 필드 확장

-- 1. 뷰 의존성 확인 및 임시 제거
DO $$
BEGIN
    -- recent_attendance_view가 존재하는지 확인하고 임시 백업
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'recent_attendance_view') THEN
        -- 뷰 정의 백업 (재생성을 위해)
        CREATE TEMP TABLE view_backup AS 
        SELECT pg_get_viewdef('recent_attendance_view') as view_definition;
        
        -- 뷰 임시 삭제
        DROP VIEW IF EXISTS recent_attendance_view;
        RAISE NOTICE '뷰 recent_attendance_view를 임시 제거했습니다.';
    END IF;
END $$;

-- 2. 기존 CHECK 제약조건 제거
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS attendance_records_record_type_check;

-- 3. CAPS 모든 모드를 지원하는 새로운 CHECK 제약조건 추가
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_record_type_check 
CHECK (record_type IN ('출근', '퇴근', '해제', '세트', '출입'));

-- 4. source 필드 값 확장 (뷰 제거 후 안전하게 변경)
ALTER TABLE attendance_records 
ALTER COLUMN source TYPE VARCHAR(30);

-- 5. 인덱스 최적화 (CAPS 기록 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_caps_lookup 
ON attendance_records (user_id, record_date, record_type, record_timestamp);

-- 6. recent_attendance_view 재생성 (개선된 버전)
CREATE OR REPLACE VIEW recent_attendance_view AS
SELECT 
    ar.id,
    ar.user_id,
    ar.record_date,
    ar.record_time,
    ar.record_timestamp,
    ar.record_type,
    ar.reason,
    ar.source,
    ar.location_lat,
    ar.location_lng,
    ar.location_accuracy,
    ar.had_dinner,
    ar.is_manual,
    ar.notes,
    ar.created_at,
    u.name as user_name,
    u.department,
    u.position
FROM attendance_records ar
LEFT JOIN users u ON ar.user_id = u.id
WHERE ar.record_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY ar.record_timestamp DESC
LIMIT 1000;

-- 7. 뷰에 대한 코멘트 추가
COMMENT ON VIEW recent_attendance_view IS 'CAPS 호환 최근 30일간 출퇴근 기록 뷰 (출근/퇴근/해제/세트/출입 모두 지원)';

-- 8. 확인 및 결과
SELECT 'CAPS 형식 지원 스키마 업데이트 완료 (뷰 의존성 해결)' as status;

-- 9. 현재 record_type 값들 확인
SELECT DISTINCT record_type, COUNT(*) as count
FROM attendance_records 
GROUP BY record_type
ORDER BY record_type;

-- 10. 업데이트된 뷰 확인
SELECT 'recent_attendance_view 재생성 완료' as view_status;

-- 11. source 필드 타입 확인
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'attendance_records' 
AND column_name = 'source';
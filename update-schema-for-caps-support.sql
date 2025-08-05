-- CAPS 형식 지원을 위한 스키마 업데이트
-- attendance_records 테이블의 record_type 필드 확장

-- 1. 기존 CHECK 제약조건 제거
ALTER TABLE attendance_records 
DROP CONSTRAINT IF EXISTS attendance_records_record_type_check;

-- 2. CAPS 모든 모드를 지원하는 새로운 CHECK 제약조건 추가
ALTER TABLE attendance_records 
ADD CONSTRAINT attendance_records_record_type_check 
CHECK (record_type IN ('출근', '퇴근', '해제', '세트', '출입'));

-- 3. source 필드 값 확장 (caps_bulk_upload, caps 등)
ALTER TABLE attendance_records 
ALTER COLUMN source TYPE VARCHAR(30);

-- 4. 인덱스 최적화 (CAPS 기록 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_attendance_caps_lookup 
ON attendance_records (user_id, record_date, record_type, record_timestamp);

-- 5. 확인
SELECT 'CAPS 형식 지원 스키마 업데이트 완료' as status;

-- 6. 현재 record_type 값들 확인
SELECT DISTINCT record_type, COUNT(*) as count
FROM attendance_records 
GROUP BY record_type
ORDER BY record_type;
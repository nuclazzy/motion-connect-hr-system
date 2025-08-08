-- attendance_records 테이블에 임시로 check_in_time, check_out_time 컬럼 추가
-- 이는 트리거 오류를 해결하기 위한 임시 조치입니다

-- 1. 컬럼이 없다면 추가 (이미 있으면 무시)
ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE attendance_records 
ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMP WITH TIME ZONE;

-- 2. 컬럼에 대한 설명 추가
COMMENT ON COLUMN attendance_records.check_in_time IS '임시 컬럼 - 트리거 호환성을 위해 추가 (실제로는 daily_work_summary에서 관리)';
COMMENT ON COLUMN attendance_records.check_out_time IS '임시 컬럼 - 트리거 호환성을 위해 추가 (실제로는 daily_work_summary에서 관리)';

-- 3. 기존 트리거 확인 (정보 확인용)
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgrelid = 'attendance_records'::regclass;

-- 4. 트리거 함수 소스 확인 (어떤 트리거가 check_in_time을 참조하는지 확인)
SELECT 
    proname AS function_name,
    prosrc AS function_source
FROM pg_proc
WHERE prosrc LIKE '%check_in_time%'
   OR prosrc LIKE '%attendance_records%';

-- 5. 기존 데이터 업데이트 (출근 기록은 check_in_time에, 퇴근 기록은 check_out_time에)
UPDATE attendance_records 
SET check_in_time = record_timestamp 
WHERE record_type = '출근' AND check_in_time IS NULL;

UPDATE attendance_records 
SET check_out_time = record_timestamp 
WHERE record_type = '퇴근' AND check_out_time IS NULL;
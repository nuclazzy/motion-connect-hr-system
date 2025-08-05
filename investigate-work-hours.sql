-- 1. attendance_records 테이블에 실제 데이터가 있는지 확인
SELECT 
  user_id,
  record_date,
  record_type,
  record_time,
  record_timestamp,
  source,
  created_at
FROM attendance_records
WHERE record_date >= '2025-06-01'
  AND record_date < '2025-07-01'
ORDER BY user_id, record_date, record_timestamp
LIMIT 20;

-- 2. daily_work_summary 테이블 확인
SELECT 
  u.name,
  dws.work_date,
  dws.check_in_time,
  dws.check_out_time,
  dws.basic_hours,
  dws.overtime_hours,
  dws.break_minutes,
  dws.work_status,
  dws.calculated_at,
  dws.updated_at
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date >= '2025-06-01'
  AND dws.work_date < '2025-07-01'
ORDER BY u.name, dws.work_date
LIMIT 20;

-- 3. 특정 사용자의 특정 날짜 상세 확인
SELECT 
  ar.*,
  u.name
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE ar.record_date = '2025-06-03'
  AND u.name = '김성호'
ORDER BY ar.record_timestamp;

-- 4. 트리거 함수가 제대로 동작하는지 테스트
-- 특정 레코드의 updated_at을 업데이트하여 트리거 재실행
UPDATE attendance_records 
SET updated_at = NOW()
WHERE record_date = '2025-06-03'
  AND user_id = (SELECT id FROM users WHERE name = '김성호' LIMIT 1)
  AND ctid = (
    SELECT ctid FROM attendance_records 
    WHERE record_date = '2025-06-03' 
      AND user_id = (SELECT id FROM users WHERE name = '김성호' LIMIT 1)
    LIMIT 1
  );

-- 5. 트리거 재실행 후 daily_work_summary 다시 확인
SELECT 
  u.name,
  dws.*
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date = '2025-06-03'
  AND u.name = '김성호';

-- 6. 현재 트리거 함수 정의 확인
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'calculate_daily_work_time'
  AND routine_type = 'FUNCTION';

-- 7. 수동으로 근무시간 계산해보기
WITH work_data AS (
  SELECT 
    user_id,
    record_date,
    MIN(CASE WHEN record_type = '출근' THEN record_timestamp END) as check_in,
    MAX(CASE WHEN record_type = '퇴근' THEN record_timestamp END) as check_out
  FROM attendance_records
  WHERE record_date = '2025-06-03'
  GROUP BY user_id, record_date
)
SELECT 
  u.name,
  wd.record_date,
  wd.check_in,
  wd.check_out,
  EXTRACT(EPOCH FROM (wd.check_out - wd.check_in)) / 3600 as total_hours,
  CASE 
    WHEN EXTRACT(EPOCH FROM (wd.check_out - wd.check_in)) / 3600 > 4 
    THEN EXTRACT(EPOCH FROM (wd.check_out - wd.check_in)) / 3600 - 1
    ELSE EXTRACT(EPOCH FROM (wd.check_out - wd.check_in)) / 3600
  END as work_hours_with_break
FROM work_data wd
JOIN users u ON wd.user_id = u.id
WHERE wd.check_in IS NOT NULL AND wd.check_out IS NOT NULL;
-- 1. 2025년 6월 attendance_records 데이터 확인
SELECT 
  ar.user_id,
  u.name,
  ar.record_date,
  ar.record_type,
  ar.record_time,
  ar.record_timestamp,
  ar.had_dinner,
  ar.source,
  ar.created_at
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE ar.record_date >= '2025-06-01'
  AND ar.record_date < '2025-07-01'
ORDER BY u.name, ar.record_date, ar.record_timestamp
LIMIT 30;

-- 2. 2025년 6월 daily_work_summary 데이터 확인
SELECT 
  u.name,
  dws.work_date,
  dws.check_in_time,
  dws.check_out_time,
  dws.basic_hours,
  dws.overtime_hours,
  dws.break_minutes,
  dws.work_status,
  dws.had_dinner,
  dws.calculated_at
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date >= '2025-06-01'
  AND dws.work_date < '2025-07-01'
ORDER BY u.name, dws.work_date
LIMIT 30;

-- 3. 특정 사용자의 특정 날짜 상세 분석
WITH user_records AS (
  SELECT 
    ar.*,
    u.name
  FROM attendance_records ar
  JOIN users u ON ar.user_id = u.id
  WHERE ar.record_date = '2025-06-03'
    AND u.name IN ('김성호', '김경은', '한종윤')
  ORDER BY u.name, ar.record_timestamp
)
SELECT * FROM user_records;

-- 4. 수동으로 근무시간 계산해보기 (김성호, 2025-06-03)
WITH work_times AS (
  SELECT 
    u.name,
    ar.record_date,
    MIN(CASE WHEN ar.record_type = '출근' THEN ar.record_timestamp END) as check_in,
    MAX(CASE WHEN ar.record_type = '퇴근' THEN ar.record_timestamp END) as check_out,
    BOOL_OR(CASE WHEN ar.record_type = '퇴근' THEN ar.had_dinner ELSE false END) as had_dinner
  FROM attendance_records ar
  JOIN users u ON ar.user_id = u.id
  WHERE ar.record_date = '2025-06-03'
    AND u.name = '김성호'
  GROUP BY u.name, ar.record_date
)
SELECT 
  name,
  record_date,
  check_in,
  check_out,
  EXTRACT(EPOCH FROM (check_out - check_in)) / 60 as total_minutes,
  CASE 
    WHEN EXTRACT(EPOCH FROM (check_out - check_in)) / 60 >= 240 THEN 60
    ELSE 0
  END as break_minutes,
  CASE 
    WHEN had_dinner THEN 60
    ELSE 0
  END as dinner_minutes,
  ROUND(
    (EXTRACT(EPOCH FROM (check_out - check_in)) / 60 - 
     CASE WHEN EXTRACT(EPOCH FROM (check_out - check_in)) / 60 >= 240 THEN 60 ELSE 0 END -
     CASE WHEN had_dinner THEN 60 ELSE 0 END
    ) / 60.0, 1
  ) as calculated_work_hours
FROM work_times
WHERE check_in IS NOT NULL AND check_out IS NOT NULL;

-- 5. 트리거를 수동으로 재실행하기 위해 특정 레코드 업데이트
-- 김성호의 2025-06-03 퇴근 기록 업데이트
UPDATE attendance_records 
SET updated_at = NOW(),
    notes = 'Manual trigger test at ' || NOW()::TEXT
WHERE user_id = (SELECT id FROM users WHERE name = '김성호' LIMIT 1)
  AND record_date = '2025-06-03'
  AND record_type = '퇴근';

-- 6. 업데이트 후 daily_work_summary 다시 확인
SELECT 
  u.name,
  dws.*
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date = '2025-06-03'
  AND u.name = '김성호';
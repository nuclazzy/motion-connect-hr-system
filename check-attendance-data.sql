-- 1. attendance_records 데이터 확인
SELECT 
  user_id,
  record_date,
  record_type,
  record_time,
  record_timestamp,
  source,
  is_manual
FROM attendance_records
WHERE record_date >= '2025-06-01'
AND record_date < '2025-07-01'
ORDER BY user_id, record_date, record_timestamp
LIMIT 20;

-- 2. daily_work_summary 데이터 확인
SELECT 
  u.name,
  dws.work_date,
  dws.check_in_time,
  dws.check_out_time,
  dws.basic_hours,
  dws.overtime_hours,
  dws.work_status,
  dws.had_dinner,
  dws.calculated_at
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_date >= '2025-06-01'
AND dws.work_date < '2025-07-01'
ORDER BY u.name, dws.work_date
LIMIT 20;

-- 3. 트리거 수동 실행 테스트
-- 특정 사용자의 특정 날짜에 대해 수동으로 계산
UPDATE attendance_records 
SET updated_at = NOW()
WHERE record_date = '2025-06-02'
LIMIT 1;
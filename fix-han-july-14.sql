-- 한종운 7월 14일 출퇴근 기록 직접 수정
-- Supabase SQL Editor에서 실행하세요

-- 1. 먼저 한종운의 user_id 확인
SELECT id, name, employee_number 
FROM users 
WHERE name = '한종운';

-- 2. 7월 14일 현재 기록 확인
SELECT * FROM attendance_records 
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND record_date = '2025-07-14'
ORDER BY record_time;

-- 3. 잘못된 attendance_records 삭제
DELETE FROM attendance_records 
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND record_date = '2025-07-14';

-- 4. 올바른 attendance_records 삽입
INSERT INTO attendance_records (
  user_id,
  employee_number,
  record_date,
  record_time,
  record_timestamp,
  record_type,
  source,
  reason,
  is_manual,
  created_at
) VALUES 
(
  (SELECT id FROM users WHERE name = '한종운'),
  '15',
  '2025-07-14',
  '11:20:00',
  '2025-07-14 11:20:00+09',
  '출근',
  'WEB',
  '대학내일 정관장 대전 촬영 서울역 출발',
  false,
  NOW()
),
(
  (SELECT id FROM users WHERE name = '한종운'),
  '15',
  '2025-07-14',
  '19:09:01',
  '2025-07-14 19:09:01+09',
  '퇴근',
  'CAPS',
  NULL,
  false,
  NOW()
);

-- 5. daily_work_summary 수정
DELETE FROM daily_work_summary 
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND work_date = '2025-07-14';

INSERT INTO daily_work_summary (
  user_id,
  work_date,
  check_in_time,
  check_out_time,
  basic_hours,
  overtime_hours,
  night_hours,
  work_status,
  had_dinner,
  auto_calculated,
  calculated_at
) VALUES (
  (SELECT id FROM users WHERE name = '한종운'),
  '2025-07-14',
  '2025-07-14 11:20:00+09',
  '2025-07-14 19:09:01+09',
  6.8, -- 7시간 49분 - 점심 1시간 = 6시간 49분
  0,
  0,
  '정상근무',
  false,
  false,
  NOW()
);

-- 6. 수정 결과 확인
SELECT 
  work_date,
  TO_CHAR(check_in_time, 'HH24:MI') as 출근,
  TO_CHAR(check_out_time, 'HH24:MI') as 퇴근,
  basic_hours as 근무시간
FROM daily_work_summary
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND work_date = '2025-07-14';

-- 7. monthly_work_stats 재계산 (선택사항)
UPDATE monthly_work_stats
SET 
  total_basic_hours = (
    SELECT COALESCE(SUM(basic_hours), 0)
    FROM daily_work_summary
    WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
    AND DATE_TRUNC('month', work_date) = '2025-07-01'
  ),
  total_overtime_hours = (
    SELECT COALESCE(SUM(overtime_hours), 0)
    FROM daily_work_summary
    WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
    AND DATE_TRUNC('month', work_date) = '2025-07-01'
  )
WHERE user_id = (SELECT id FROM users WHERE name = '한종운')
AND work_month = '2025-07-01';
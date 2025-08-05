-- 허지현 6월 11-12일 데이터 완전 정리 후 올바른 CAPS 데이터 입력

-- 1. 현재 상황 파악: 허지현의 모든 출퇴근 기록 확인
SELECT 
  '=== 현재 허지현 전체 데이터 ===' as status,
  u.name,
  ar.record_date,
  ar.record_type,
  ar.record_timestamp,
  ar.source,
  ar.id
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE u.name = '허지현' 
AND ar.record_date BETWEEN '2025-06-10' AND '2025-06-13'
ORDER BY ar.record_timestamp;

-- 2. 허지현의 user_id 확인
SELECT 
  '=== 허지현 사용자 ID ===' as status,
  id as user_id,
  name,
  email
FROM users 
WHERE name = '허지현';

-- 3. 허지현의 6월 10-13일 모든 데이터 완전 삭제 (안전 범위 확대)
-- 먼저 daily_work_summary 삭제
DELETE FROM daily_work_summary 
WHERE user_id = (SELECT id FROM users WHERE name = '허지현')
AND work_date BETWEEN '2025-06-10' AND '2025-06-13';

-- 그 다음 attendance_records 완전 삭제
DELETE FROM attendance_records 
WHERE user_id = (SELECT id FROM users WHERE name = '허지현')
AND record_date BETWEEN '2025-06-10' AND '2025-06-13';

-- 4. 삭제 확인
SELECT 
  '=== 삭제 후 확인 ===' as status,
  COUNT(*) as remaining_records
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE u.name = '허지현' 
AND ar.record_date BETWEEN '2025-06-10' AND '2025-06-13';

-- 5. CAPS 원본 데이터만 정확히 입력
-- 6월 11일 데이터
WITH user_info AS (
  SELECT id as user_id FROM users WHERE name = '허지현'
)
INSERT INTO attendance_records (
  user_id,
  record_date,
  record_time,
  record_timestamp,
  record_type,
  source,
  had_dinner,
  is_manual,
  notes,
  created_at,
  updated_at
) 
SELECT 
  ui.user_id,
  '2025-06-11'::date,
  '08:45:58'::time,
  '2025-06-11 08:45:58+09:00'::timestamptz,
  '출근',
  'CAPS',
  false,
  false,
  'CAPS 원본 데이터 (08:45:58 출근)',
  NOW(),
  NOW()
FROM user_info ui;

WITH user_info AS (
  SELECT id as user_id FROM users WHERE name = '허지현'
)
INSERT INTO attendance_records (
  user_id,
  record_date,
  record_time,
  record_timestamp,
  record_type,
  source,
  had_dinner,
  is_manual,
  notes,
  created_at,
  updated_at
) 
SELECT 
  ui.user_id,
  '2025-06-11'::date,
  '19:09:47'::time,
  '2025-06-11 19:09:47+09:00'::timestamptz,
  '퇴근',
  'CAPS',
  true,
  false,
  'CAPS 원본 데이터 (19:09:47 퇴근)',
  NOW(),
  NOW()
FROM user_info ui;

-- 6월 12일 데이터
WITH user_info AS (
  SELECT id as user_id FROM users WHERE name = '허지현'
)
INSERT INTO attendance_records (
  user_id,
  record_date,
  record_time,
  record_timestamp,
  record_type,
  source,
  had_dinner,
  is_manual,
  notes,
  created_at,
  updated_at
) 
SELECT 
  ui.user_id,
  '2025-06-12'::date,
  '08:39:01'::time,
  '2025-06-12 08:39:01+09:00'::timestamptz,
  '출근',
  'CAPS',
  false,
  false,
  'CAPS 원본 데이터 (08:39:01 출근)',
  NOW(),
  NOW()
FROM user_info ui;

WITH user_info AS (
  SELECT id as user_id FROM users WHERE name = '허지현'
)
INSERT INTO attendance_records (
  user_id,
  record_date,
  record_time,
  record_timestamp,
  record_type,
  source,
  had_dinner,
  is_manual,
  notes,
  created_at,
  updated_at
) 
SELECT 
  ui.user_id,
  '2025-06-12'::date,
  '21:06:43'::time,
  '2025-06-12 21:06:43+09:00'::timestamptz,
  '퇴근',
  'CAPS',
  true,
  false,
  'CAPS 원본 데이터 (21:06:43 퇴근)',
  NOW(),
  NOW()
FROM user_info ui;

-- 6. 입력 완료 후 데이터 확인
SELECT 
  '=== 입력 완료 후 확인 ===' as status;

SELECT 
  u.name,
  ar.record_date,
  ar.record_type,
  TO_CHAR(ar.record_timestamp, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
  ar.had_dinner,
  ar.source,
  ar.notes
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE u.name = '허지현' 
AND ar.record_date BETWEEN '2025-06-11' AND '2025-06-12'
ORDER BY ar.record_timestamp;

-- 7. 트리거 실행 대기 및 결과 확인
-- 잠시 후 자동으로 daily_work_summary가 생성됩니다.

SELECT 
  '=== 트리거 실행 후 결과 ===' as status;

SELECT 
  u.name,
  dws.work_date,
  TO_CHAR(dws.check_in_time, 'HH24:MI:SS') as check_in,
  TO_CHAR(dws.check_out_time, 'HH24:MI:SS') as check_out,
  dws.basic_hours,
  dws.overtime_hours,
  dws.night_hours,
  dws.break_minutes,
  dws.work_status,
  dws.had_dinner,
  -- 수동 검증
  EXTRACT(EPOCH FROM (dws.check_out_time - dws.check_in_time)) / 3600 as total_hours,
  ROUND(((EXTRACT(EPOCH FROM (dws.check_out_time - dws.check_in_time)) / 60 - dws.break_minutes) / 60.0)::numeric, 1) as net_hours
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '허지현' 
AND dws.work_date BETWEEN '2025-06-11' AND '2025-06-12'
ORDER BY dws.work_date;

-- 8. 예상 결과와 비교
SELECT 
  '=== 예상 결과 ===' as status,
  '6월 11일 예상: 08:45~19:09 = 10.4시간, 휴게 2시간, 실근무 8.4시간 → 기본 8h + 초과 0.4h' as june_11,
  '6월 12일 예상: 08:39~21:06 = 12.5시간, 휴게 2시간, 실근무 10.5시간 → 기본 8h + 초과 2.5h' as june_12,
  '합계: 기본 16h + 초과 2.9h (기존 오류 25.8h에서 대폭 감소!)' as total;
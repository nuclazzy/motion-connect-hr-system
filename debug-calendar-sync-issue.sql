-- 연차 캘린더 동기화 문제 진단

-- 1. 캘린더 설정 상태 확인
SELECT 
  '=== 캘린더 설정 상태 ===' as check_type,
  target_name,
  calendar_alias,
  calendar_id,
  is_active,
  auto_sync_enabled,
  sync_interval_hours,
  last_sync_at,
  created_at
FROM calendar_configs 
WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
OR target_name ILIKE '%연차%'
OR target_name ILIKE '%leave%';

-- 2. 캘린더 동기화 로그 확인
SELECT 
  '=== 최근 동기화 로그 ===' as check_type,
  calendar_id,
  calendar_type,
  sync_start_date,
  sync_end_date,
  total_events,
  matched_events,
  created_events,
  error_count,
  status,
  error_message,
  created_at,
  completed_at
FROM calendar_sync_logs 
WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 저장된 캘린더 이벤트 확인
SELECT 
  '=== 저장된 캘린더 이벤트 ===' as check_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN matched_user_id IS NOT NULL THEN 1 END) as matched_events,
  COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_events,
  MIN(start_date) as earliest_event,
  MAX(start_date) as latest_event
FROM calendar_leave_events 
WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com';

-- 4. 개별 이벤트 상세 확인 (최근 10개)
SELECT 
  '=== 최근 캘린더 이벤트 상세 ===' as check_type,
  event_title,
  start_date,
  end_date,
  matched_user_name,
  leave_type,
  leave_hours,
  matching_confidence,
  is_processed,
  created_at
FROM calendar_leave_events 
WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
ORDER BY created_at DESC 
LIMIT 10;

-- 5. 직원 정보 확인 (매칭 가능한 직원들)
SELECT 
  '=== 매칭 가능한 직원 목록 ===' as check_type,
  id,
  name,
  department,
  role,
  created_at
FROM users 
WHERE role = 'employee'
ORDER BY name;

-- 6. 연차 데이터 연동 상태 확인
SELECT 
  '=== 연차 데이터 연동 상태 ===' as check_type,
  u.name,
  dws.work_date,
  dws.work_status,
  dws.basic_hours,
  dws.auto_calculated,
  dws.calculated_at
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_status ILIKE '%연차%'
   OR dws.work_status ILIKE '%반차%'
   OR dws.work_status ILIKE '%시간차%'
ORDER BY dws.work_date DESC
LIMIT 20;

-- 7. 테이블 존재 및 구조 확인  
SELECT 
  '=== 테이블 존재 확인 ===' as check_type,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN ('calendar_configs', 'calendar_leave_events', 'calendar_sync_logs')
ORDER BY table_name;

-- 8. 제약조건 확인
SELECT 
  '=== UNIQUE 제약조건 확인 ===' as check_type,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('calendar_configs', 'calendar_leave_events')
AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, kcu.column_name;
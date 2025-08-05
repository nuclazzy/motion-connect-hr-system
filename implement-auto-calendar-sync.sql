-- 연차 및 경조사 캘린더 자동 동기화 시스템 구현

-- 1. 캘린더 동기화 로그 테이블 생성
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id VARCHAR(255) NOT NULL,
  calendar_type VARCHAR(50) NOT NULL, -- 'leave', 'event'
  sync_start_date DATE NOT NULL,
  sync_end_date DATE NOT NULL,
  total_events INTEGER DEFAULT 0,
  matched_events INTEGER DEFAULT 0,
  created_events INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. 자동 동기화를 위한 크론 함수 생성
CREATE OR REPLACE FUNCTION auto_sync_calendar_data()
RETURNS void AS $$
DECLARE
  v_calendar RECORD;
  v_sync_result JSONB;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- 동기화 기간 설정 (과거 1개월 ~ 미래 3개월)
  v_start_date := CURRENT_DATE - INTERVAL '1 month';
  v_end_date := CURRENT_DATE + INTERVAL '3 months';
  
  -- 연차 캘린더 동기화
  FOR v_calendar IN 
    SELECT * FROM calendar_configs 
    WHERE config_type = 'function' 
    AND (target_name ILIKE '%연차%' OR target_name ILIKE '%leave%')
    AND is_active = true
  LOOP
    -- 동기화 로그 시작
    INSERT INTO calendar_sync_logs (
      calendar_id,
      calendar_type,
      sync_start_date,
      sync_end_date,
      status
    ) VALUES (
      v_calendar.calendar_id,
      'leave',
      v_start_date,
      v_end_date,
      'running'
    );
    
    -- 실제 동기화는 server action으로 처리됨
    -- 여기서는 플래그만 설정
    UPDATE calendar_configs
    SET last_sync_at = NOW()
    WHERE id = v_calendar.id;
  END LOOP;
  
  -- 경조사 캘린더 동기화
  FOR v_calendar IN 
    SELECT * FROM calendar_configs 
    WHERE config_type = 'function' 
    AND (target_name ILIKE '%경조사%' OR target_name ILIKE '%event%')
    AND is_active = true
  LOOP
    -- 동기화 로그 시작
    INSERT INTO calendar_sync_logs (
      calendar_id,
      calendar_type,
      sync_start_date,
      sync_end_date,
      status
    ) VALUES (
      v_calendar.calendar_id,
      'event',
      v_start_date,
      v_end_date,
      'running'
    );
    
    -- 실제 동기화는 server action으로 처리됨
    UPDATE calendar_configs
    SET last_sync_at = NOW()
    WHERE id = v_calendar.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. calendar_configs 테이블에 동기화 관련 컬럼 추가
ALTER TABLE calendar_configs 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER DEFAULT 24;

-- 4. 경조사 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS employee_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- '결혼', '출산', '장례', '생일' 등
  event_date DATE NOT NULL,
  description TEXT,
  calendar_event_id VARCHAR(255), -- Google Calendar 이벤트 ID
  is_from_calendar BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_employee_events_user_date 
ON employee_events(user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_employee_events_calendar 
ON employee_events(calendar_event_id);

-- 5. 연차 및 경조사 이벤트 뷰
CREATE OR REPLACE VIEW calendar_events_view AS
-- 연차 이벤트
SELECT 
  u.name as employee_name,
  u.department,
  'leave' as event_type,
  dws.work_date as event_date,
  dws.work_status as description,
  dws.basic_hours as hours,
  NULL as calendar_event_id
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_status IN ('연차(유급)', '반차(유급)', '시간차(유급)')
UNION ALL
-- 경조사 이벤트
SELECT 
  u.name as employee_name,
  u.department,
  ee.event_type,
  ee.event_date,
  ee.description,
  NULL as hours,
  ee.calendar_event_id
FROM employee_events ee
JOIN users u ON ee.user_id = u.id
ORDER BY event_date DESC, employee_name;

-- 6. 자동 동기화 상태 확인 뷰
CREATE OR REPLACE VIEW calendar_sync_status AS
SELECT 
  cc.target_name,
  cc.calendar_alias,
  cc.calendar_id,
  cc.is_active,
  cc.auto_sync_enabled,
  cc.sync_interval_hours,
  cc.last_sync_at,
  CASE 
    WHEN cc.last_sync_at IS NULL THEN '동기화 안됨'
    WHEN cc.last_sync_at < NOW() - (cc.sync_interval_hours || ' hours')::INTERVAL THEN '동기화 필요'
    ELSE '최신'
  END as sync_status,
  csl.status as last_sync_result,
  csl.total_events as last_sync_events,
  csl.matched_events as last_sync_matched,
  csl.error_message as last_sync_error
FROM calendar_configs cc
LEFT JOIN LATERAL (
  SELECT * FROM calendar_sync_logs 
  WHERE calendar_id = cc.calendar_id 
  ORDER BY created_at DESC 
  LIMIT 1
) csl ON true
WHERE cc.config_type = 'function'
AND (cc.target_name ILIKE '%연차%' OR cc.target_name ILIKE '%경조사%' 
     OR cc.target_name ILIKE '%leave%' OR cc.target_name ILIKE '%event%');

-- 7. 기본 연차/경조사 캘린더 설정 활성화
UPDATE calendar_configs
SET 
  auto_sync_enabled = true,
  sync_interval_hours = 24
WHERE config_type = 'function'
AND (target_name ILIKE '%연차%' OR target_name ILIKE '%leave%');

-- 8. 동기화 상태 확인
SELECT * FROM calendar_sync_status;
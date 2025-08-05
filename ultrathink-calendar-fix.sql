-- 🧠 ultrathink: 휴가 캘린더 연동 시스템 완전 해결
-- Phase 1: 데이터베이스 스키마 확인 및 복구

-- 1. 필수 테이블 존재 확인
SELECT 
  '=== 필수 테이블 존재 여부 확인 ===' as check_status,
  table_name,
  CASE 
    WHEN table_name IS NOT NULL THEN '✅ 존재'
    ELSE '❌ 누락'
  END as status
FROM information_schema.tables 
WHERE table_name IN ('calendar_configs', 'calendar_leave_events', 'calendar_sync_logs')
ORDER BY table_name;

-- 2. calendar_leave_events 테이블 생성 (누락 시)
CREATE TABLE IF NOT EXISTS calendar_leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id VARCHAR(255) UNIQUE NOT NULL,
  calendar_id VARCHAR(255) NOT NULL,
  event_title TEXT NOT NULL,
  event_description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN DEFAULT true,
  matched_user_id UUID REFERENCES users(id),
  matched_user_name VARCHAR(100),
  leave_type VARCHAR(50),
  leave_hours DECIMAL(4,1),
  matching_confidence DECIMAL(3,2),
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. calendar_sync_logs 테이블 생성 (누락 시)
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id VARCHAR(255) NOT NULL,
  calendar_type VARCHAR(50) NOT NULL,
  sync_start_date DATE NOT NULL,
  sync_end_date DATE NOT NULL,
  total_events INTEGER DEFAULT 0,
  matched_events INTEGER DEFAULT 0,
  created_events INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. calendar_configs 테이블 구조 확장
ALTER TABLE calendar_configs 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER DEFAULT 24;

-- 5. 필수 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_calendar_id 
ON calendar_leave_events(calendar_id);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_start_date 
ON calendar_leave_events(start_date);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_matched_user 
ON calendar_leave_events(matched_user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_calendar_id 
ON calendar_sync_logs(calendar_id, created_at);

-- 6. calendar_sync_status 뷰 생성
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

-- 7. 기본 휴가 캘린더 설정 생성/업데이트
INSERT INTO calendar_configs (
  config_type,
  target_name,
  calendar_alias,
  calendar_id,
  description,
  is_active,
  auto_sync_enabled,
  sync_interval_hours
) VALUES (
  'function',
  '연차 및 경조사 현황',
  '휴가 관리',
  'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
  'Google Calendar 연차 및 경조사 자동 동기화',
  true,
  true,
  24
) 
ON CONFLICT (calendar_id) 
DO UPDATE SET
  auto_sync_enabled = EXCLUDED.auto_sync_enabled,
  sync_interval_hours = EXCLUDED.sync_interval_hours,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 8. process_calendar_leave_events 함수 생성
CREATE OR REPLACE FUNCTION process_calendar_leave_events()
RETURNS TABLE(
  processed_count INTEGER,
  matched_count INTEGER,
  created_leave_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  v_processed INTEGER := 0;
  v_matched INTEGER := 0;
  v_created_leave INTEGER := 0;
  v_errors INTEGER := 0;
  v_event RECORD;
  v_user RECORD;
  v_leave_type VARCHAR(50);
  v_leave_hours DECIMAL(4,1);
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- 처리되지 않은 이벤트들 처리
  FOR v_event IN 
    SELECT * FROM calendar_leave_events 
    WHERE is_processed = false 
    OR (matched_user_id IS NULL AND matching_confidence IS NULL)
  LOOP
    BEGIN
      v_processed := v_processed + 1;
      
      -- 직원 이름 매칭 시도
      SELECT id, name INTO v_user
      FROM users 
      WHERE name = ANY(
        string_to_array(
          regexp_replace(v_event.event_title, '[연차|반차|시간차|휴가|오전|오후]', '', 'g'),
          ' '
        )
      )
      OR v_event.event_title ILIKE '%' || name || '%'
      LIMIT 1;
      
      IF FOUND THEN
        v_matched := v_matched + 1;
        
        -- 휴가 유형 결정
        v_leave_type := CASE
          WHEN v_event.event_title ILIKE '%반차%' THEN 
            CASE 
              WHEN v_event.event_title ILIKE '%오전%' THEN '오전 반차'
              WHEN v_event.event_title ILIKE '%오후%' THEN '오후 반차'
              ELSE '반차'
            END
          WHEN v_event.event_title ILIKE '%시간차%' THEN '시간차'
          WHEN v_event.event_title ILIKE '%병가%' THEN '병가'
          ELSE '연차'
        END;
        
        -- 휴가 시간 계산
        v_leave_hours := CASE
          WHEN v_leave_type LIKE '%반차%' THEN 4.0
          WHEN v_leave_type = '시간차' THEN 1.0
          ELSE 8.0
        END;
        
        -- calendar_leave_events 업데이트
        UPDATE calendar_leave_events 
        SET 
          matched_user_id = v_user.id,
          matched_user_name = v_user.name,
          leave_type = v_leave_type,
          leave_hours = v_leave_hours,
          matching_confidence = 0.9,
          is_processed = true,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = v_event.id;
        
        -- daily_work_summary에 휴가 기록 생성
        v_start_date := v_event.start_date;
        v_end_date := v_event.end_date;
        
        -- 휴가 기간의 각 날짜에 대해 근무시간 기록
        WHILE v_start_date <= v_end_date LOOP
          -- 주말 제외 (0=일요일, 6=토요일)
          IF EXTRACT(DOW FROM v_start_date) NOT IN (0, 6) THEN
            INSERT INTO daily_work_summary (
              user_id,
              work_date,
              basic_hours,
              overtime_hours,
              night_hours,
              work_status,
              auto_calculated,
              calculated_at
            ) VALUES (
              v_user.id,
              v_start_date,
              v_leave_hours,
              0,
              0,
              v_leave_type || '(유급)',
              true,
              NOW()
            )
            ON CONFLICT (user_id, work_date)
            DO UPDATE SET
              basic_hours = EXCLUDED.basic_hours,
              work_status = EXCLUDED.work_status,
              auto_calculated = EXCLUDED.auto_calculated,
              calculated_at = EXCLUDED.calculated_at,
              updated_at = NOW();
            
            v_created_leave := v_created_leave + 1;
          END IF;
          
          v_start_date := v_start_date + INTERVAL '1 day';
        END LOOP;
        
      ELSE
        -- 매칭 실패한 경우도 처리됨으로 표시
        UPDATE calendar_leave_events 
        SET 
          is_processed = true,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = v_event.id;
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        -- 오류 로그 (선택사항)
        RAISE WARNING 'Event processing failed for %: %', v_event.event_title, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_processed, v_matched, v_created_leave, v_errors;
END;
$$ LANGUAGE plpgsql;

-- 9. 완료 확인
SELECT 
  '🎯 ultrathink 캘린더 시스템 구축 완료!' as status,
  '✅ 테이블 생성 완료' as tables,
  '✅ 뷰 생성 완료' as views,
  '✅ 함수 생성 완료' as functions,
  '✅ 기본 설정 완료' as config,
  '🔄 이제 AdminCalendarSync 컴포넌트 업데이트 필요' as next_step;
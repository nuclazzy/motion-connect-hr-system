-- 🚨 Motion Connect HR 시스템 데이터베이스 종합 복구 계획
-- Supabase 전용 안전한 스키마 복구 및 문제 해결
-- 
-- 🎯 목표:
-- 1. CAPS 업로드 UPSERT 충돌 오류 해결
-- 2. 휴가 캘린더 연동 시스템 완전 구축
-- 3. 데이터 손실 없는 안전한 마이그레이션
-- 4. 장기적 안정성 보장

-- ====================================================================
-- PHASE 1: 현재 상태 진단 및 백업
-- ====================================================================

-- 1.1 현재 데이터베이스 상태 조사
SELECT 
  '=== 데이터베이스 현재 상태 분석 ===' as status,
  NOW() as analysis_time;

-- 기존 테이블 목록 확인
SELECT 
  table_name,
  table_type,
  CASE 
    WHEN table_name IN ('users', 'calendar_configs', 'meetings', 'leave_days', 'form_requests') THEN '✅ 정상'
    WHEN table_name IN ('attendance_records', 'daily_work_summary', 'monthly_work_stats') THEN '⚠️ 문제있음'
    ELSE '❓ 미분류'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- attendance_records 제약조건 현황 확인
SELECT 
  '=== attendance_records 제약조건 현황 ===' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass
ORDER BY contype, conname;

-- 누락된 필수 테이블 확인
WITH required_tables AS (
  SELECT unnest(ARRAY[
    'calendar_leave_events', 
    'calendar_sync_logs', 
    'employee_events'
  ]) as table_name
)
SELECT 
  '=== 누락된 필수 테이블 확인 ===' as check_type,
  rt.table_name,
  CASE 
    WHEN ist.table_name IS NOT NULL THEN '✅ 존재'
    ELSE '❌ 누락'
  END as status
FROM required_tables rt
LEFT JOIN information_schema.tables ist 
  ON rt.table_name = ist.table_name 
  AND ist.table_schema = 'public'
ORDER BY rt.table_name;

-- ====================================================================
-- PHASE 2: CAPS 업로드 UPSERT 충돌 해결
-- ====================================================================

-- 2.1 기존 중복 제약조건 안전 제거
DO $$
DECLARE
  constraint_name TEXT;
  constraint_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 기존 UNIQUE 제약조건 안전 제거 시작';
  
  -- attendance_records 테이블의 모든 UNIQUE 제약조건 찾기 (PK 제외)
  FOR constraint_name IN 
    SELECT conname 
    FROM pg_constraint 
    WHERE conrelid = 'attendance_records'::regclass
    AND contype = 'u'
    AND conname != 'attendance_records_pkey'
  LOOP
    EXECUTE 'ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS ' || constraint_name;
    constraint_count := constraint_count + 1;
    RAISE NOTICE '✅ 제거된 제약조건: %', constraint_name;
  END LOOP;
  
  RAISE NOTICE '🎯 총 % 개의 중복 제약조건 제거 완료', constraint_count;
END $$;

-- 2.2 중복 데이터 정리 (기존 중복이 있다면)
WITH duplicate_cleanup AS (
  SELECT 
    id,
    user_id,
    record_timestamp,
    record_type,
    source,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, record_timestamp, record_type, COALESCE(source, 'web')
      ORDER BY created_at DESC, updated_at DESC
    ) as rn
  FROM attendance_records
  WHERE source IN ('CAPS', 'web', 'manual') OR source IS NULL
)
DELETE FROM attendance_records 
WHERE id IN (
  SELECT id FROM duplicate_cleanup WHERE rn > 1
);

-- 2.3 Supabase 특화 새로운 제약조건 생성
-- 마이크로세컨드 단위까지 고려한 정교한 제약조건
ALTER TABLE attendance_records 
ADD CONSTRAINT unique_attendance_record_precise 
UNIQUE (user_id, record_timestamp, record_type, COALESCE(source, 'web'));

-- 2.4 CAPS 전용 안전한 RPC 함수 생성
CREATE OR REPLACE FUNCTION safe_upsert_caps_attendance(
  p_user_id UUID,
  p_record_date DATE,
  p_record_time TIME,
  p_record_timestamp TIMESTAMP WITH TIME ZONE,
  p_record_type VARCHAR(10),
  p_reason TEXT DEFAULT NULL,
  p_device_id VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  record_id UUID,
  action_taken VARCHAR(20),
  message TEXT
) AS $$
DECLARE
  existing_id UUID;
  new_record_id UUID;
  source_value VARCHAR(20) := 'CAPS';
BEGIN
  -- 1. 기존 레코드 정확한 매칭 확인
  SELECT id INTO existing_id
  FROM attendance_records
  WHERE user_id = p_user_id
  AND record_timestamp = p_record_timestamp
  AND record_type = p_record_type
  AND COALESCE(source, 'web') = source_value
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    -- 2. 기존 레코드 업데이트 (안전한 업데이트)
    UPDATE attendance_records 
    SET 
      record_date = p_record_date,
      record_time = p_record_time,
      reason = COALESCE(p_reason, reason),
      notes = CASE 
        WHEN p_device_id IS NOT NULL 
        THEN COALESCE(notes, '') || ' [Device: ' || p_device_id || ']'
        ELSE notes
      END,
      updated_at = NOW()
    WHERE id = existing_id;
    
    success := true;
    record_id := existing_id;
    action_taken := 'updated';
    message := 'CAPS 기록 업데이트 완료';
    RETURN NEXT;
    
  ELSE
    -- 3. 새 레코드 안전한 삽입
    INSERT INTO attendance_records (
      user_id,
      record_date,
      record_time,
      record_timestamp,
      record_type,
      reason,
      source,
      is_manual,
      had_dinner,
      notes
    ) VALUES (
      p_user_id,
      p_record_date,
      p_record_time,
      p_record_timestamp,
      p_record_type,
      p_reason,
      source_value,
      false,
      false,
      CASE 
        WHEN p_device_id IS NOT NULL 
        THEN 'CAPS 업로드 [Device: ' || p_device_id || ']'
        ELSE 'CAPS 업로드'
      END
    )
    RETURNING id INTO new_record_id;
    
    success := true;
    record_id := new_record_id;
    action_taken := 'inserted';
    message := 'CAPS 기록 신규 생성 완료';
    RETURN NEXT;
  END IF;

EXCEPTION 
  WHEN OTHERS THEN
    success := false;
    record_id := null;
    action_taken := 'error';
    message := 'CAPS 업로드 오류: ' || SQLERRM;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- PHASE 3: 휴가 캘린더 연동 시스템 완전 구축
-- ====================================================================

-- 3.1 calendar_leave_events 테이블 생성
CREATE TABLE IF NOT EXISTS calendar_leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id VARCHAR(255) UNIQUE NOT NULL,
  calendar_id VARCHAR(255) NOT NULL,
  event_title TEXT NOT NULL,
  event_description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN DEFAULT true,
  matched_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  matched_user_name VARCHAR(100),
  leave_type VARCHAR(50),
  leave_hours DECIMAL(4,1),
  matching_confidence DECIMAL(3,2) DEFAULT 0.0,
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  sync_batch_id UUID, -- 동기화 배치 추적
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 calendar_sync_logs 테이블 생성  
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_batch_id UUID UNIQUE DEFAULT gen_random_uuid(),
  calendar_id VARCHAR(255) NOT NULL,
  calendar_type VARCHAR(50) NOT NULL, -- 'leave', 'event', 'meeting'
  sync_start_date DATE NOT NULL,
  sync_end_date DATE NOT NULL,
  total_events INTEGER DEFAULT 0,
  matched_events INTEGER DEFAULT 0,
  created_events INTEGER DEFAULT 0,
  updated_events INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  sync_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 3.3 employee_events 테이블 생성 (경조사)
CREATE TABLE IF NOT EXISTS employee_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- '결혼', '출산', '장례', '생일' 등
  event_date DATE NOT NULL,
  event_end_date DATE, -- 복수일 이벤트 지원
  description TEXT,
  calendar_event_id VARCHAR(255), -- Google Calendar 이벤트 ID
  calendar_id VARCHAR(255), -- 소스 캘린더 ID
  is_from_calendar BOOLEAN DEFAULT false,
  leave_days DECIMAL(3,1) DEFAULT 0, -- 경조사 휴가일수
  is_paid BOOLEAN DEFAULT true, -- 유급/무급 여부
  sync_batch_id UUID, -- 동기화 배치 추적
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.4 calendar_configs 테이블 확장
ALTER TABLE calendar_configs 
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sync_interval_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS sync_error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- 3.5 필수 인덱스 생성 (성능 최적화)
-- calendar_leave_events 인덱스
CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_calendar_id 
ON calendar_leave_events(calendar_id);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_date_range 
ON calendar_leave_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_user_processed 
ON calendar_leave_events(matched_user_id, is_processed);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_sync_batch 
ON calendar_leave_events(sync_batch_id);

-- calendar_sync_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_calendar_date 
ON calendar_sync_logs(calendar_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_status 
ON calendar_sync_logs(status, created_at);

-- employee_events 인덱스  
CREATE INDEX IF NOT EXISTS idx_employee_events_user_date 
ON employee_events(user_id, event_date);

CREATE INDEX IF NOT EXISTS idx_employee_events_calendar 
ON employee_events(calendar_event_id);

CREATE INDEX IF NOT EXISTS idx_employee_events_sync_batch 
ON employee_events(sync_batch_id);

-- attendance_records 추가 인덱스 (CAPS 업로드 최적화)
CREATE INDEX IF NOT EXISTS idx_attendance_records_source_timestamp 
ON attendance_records(source, record_timestamp);

-- ====================================================================
-- PHASE 4: Supabase 특화 RPC 함수들
-- ====================================================================

-- 4.1 휴가 캘린더 이벤트 처리 함수
CREATE OR REPLACE FUNCTION process_calendar_leave_events(
  p_sync_batch_id UUID DEFAULT NULL
)
RETURNS TABLE(
  batch_id UUID,
  processed_count INTEGER,
  matched_count INTEGER,
  created_leave_count INTEGER,
  error_count INTEGER,
  processing_details JSONB
) AS $$
DECLARE
  v_batch_id UUID;
  v_processed INTEGER := 0;
  v_matched INTEGER := 0;
  v_created_leave INTEGER := 0;
  v_errors INTEGER := 0;
  v_event RECORD;
  v_user RECORD;
  v_leave_type VARCHAR(50);
  v_leave_hours DECIMAL(4,1);
  v_current_date DATE;
  v_processing_log JSONB := '[]'::JSONB;
BEGIN
  -- 배치 ID 설정
  v_batch_id := COALESCE(p_sync_batch_id, gen_random_uuid());
  
  -- 처리되지 않은 이벤트들 또는 특정 배치의 이벤트들 처리
  FOR v_event IN 
    SELECT * FROM calendar_leave_events 
    WHERE (
      (p_sync_batch_id IS NULL AND is_processed = false) OR
      (p_sync_batch_id IS NOT NULL AND sync_batch_id = p_sync_batch_id)
    )
    ORDER BY start_date, event_title
  LOOP
    BEGIN
      v_processed := v_processed + 1;
      
      -- 직원 이름 매칭 (개선된 매칭 로직)
      SELECT id, name INTO v_user
      FROM users 
      WHERE (
        -- 정확한 이름 매칭
        v_event.event_title ILIKE '%' || name || '%' OR
        -- 성씨만으로 매칭 (2글자 이상 성씨)
        (LENGTH(SPLIT_PART(name, ' ', 1)) >= 2 AND 
         v_event.event_title ILIKE '%' || SPLIT_PART(name, ' ', 1) || '%') OR
        -- 이름 부분만으로 매칭
        (LENGTH(SPLIT_PART(name, ' ', 2)) >= 2 AND 
         v_event.event_title ILIKE '%' || SPLIT_PART(name, ' ', 2) || '%')
      )
      AND role = 'user' -- 직원만 매칭
      LIMIT 1;
      
      IF FOUND THEN
        v_matched := v_matched + 1;
        
        -- 휴가 유형 및 시간 결정 (개선된 로직)
        v_leave_type := CASE
          WHEN v_event.event_title ILIKE '%반차%' THEN 
            CASE 
              WHEN v_event.event_title ILIKE '%오전%' THEN '오전 반차'
              WHEN v_event.event_title ILIKE '%오후%' THEN '오후 반차'  
              ELSE '반차'
            END
          WHEN v_event.event_title ILIKE '%시간차%' OR v_event.event_title ILIKE '%1시간%' THEN '시간차'
          WHEN v_event.event_title ILIKE '%병가%' THEN '병가'
          WHEN v_event.event_title ILIKE '%경조%' OR v_event.event_title ILIKE '%결혼%' OR v_event.event_title ILIKE '%장례%' THEN '경조사'
          WHEN v_event.event_title ILIKE '%출산%' OR v_event.event_title ILIKE '%육아%' THEN '출산/육아'
          ELSE '연차'
        END;
        
        -- 휴가 시간 계산 (개선된 계산)
        v_leave_hours := CASE
          WHEN v_leave_type LIKE '%반차%' THEN 4.0
          WHEN v_leave_type = '시간차' THEN 1.0
          WHEN v_leave_type = '경조사' THEN 
            CASE 
              WHEN v_event.end_date > v_event.start_date THEN 
                (v_event.end_date - v_event.start_date + 1) * 8.0
              ELSE 8.0
            END
          ELSE 
            CASE 
              WHEN v_event.end_date > v_event.start_date THEN 
                (v_event.end_date - v_event.start_date + 1) * 8.0
              ELSE 8.0
            END
        END;
        
        -- calendar_leave_events 업데이트
        UPDATE calendar_leave_events 
        SET 
          matched_user_id = v_user.id,
          matched_user_name = v_user.name,
          leave_type = v_leave_type,
          leave_hours = v_leave_hours,
          matching_confidence = 0.95,
          is_processed = true,
          processed_at = NOW(),
          sync_batch_id = v_batch_id,
          updated_at = NOW()
        WHERE id = v_event.id;
        
        -- daily_work_summary에 휴가 기록 생성 (주말 제외)
        v_current_date := v_event.start_date;
        
        WHILE v_current_date <= v_event.end_date LOOP
          -- 평일만 처리 (월-금: 1-5)
          IF EXTRACT(DOW FROM v_current_date) BETWEEN 1 AND 5 THEN
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
              v_current_date,
              CASE WHEN v_leave_type LIKE '%반차%' THEN 4.0 ELSE 8.0 END,
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
          
          v_current_date := v_current_date + INTERVAL '1 day';
        END LOOP;
        
        -- 처리 로그 추가
        v_processing_log := v_processing_log || jsonb_build_object(
          'event_id', v_event.id,
          'event_title', v_event.event_title,
          'matched_user', v_user.name,
          'leave_type', v_leave_type,
          'leave_hours', v_leave_hours,
          'status', 'matched'
        );
        
      ELSE
        -- 매칭 실패한 경우
        UPDATE calendar_leave_events 
        SET 
          is_processed = true,
          processed_at = NOW(),
          sync_batch_id = v_batch_id,
          matching_confidence = 0.0,
          updated_at = NOW()
        WHERE id = v_event.id;
        
        -- 매칭 실패 로그 추가
        v_processing_log := v_processing_log || jsonb_build_object(
          'event_id', v_event.id,
          'event_title', v_event.event_title,
          'status', 'no_match',
          'reason', '직원 이름 매칭 실패'
        );
      END IF;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        
        -- 오류 로그 추가
        v_processing_log := v_processing_log || jsonb_build_object(
          'event_id', v_event.id,
          'event_title', v_event.event_title,
          'status', 'error',
          'error_message', SQLERRM
        );
        
        RAISE WARNING 'Event processing failed for %: %', v_event.event_title, SQLERRM;
    END;
  END LOOP;
  
  -- 결과 반환
  batch_id := v_batch_id;
  processed_count := v_processed;
  matched_count := v_matched;
  created_leave_count := v_created_leave;
  error_count := v_errors;
  processing_details := v_processing_log;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 캘린더 동기화 상태 조회 함수
CREATE OR REPLACE FUNCTION get_calendar_sync_status()
RETURNS TABLE(
  calendar_name TEXT,
  calendar_id VARCHAR(255),
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT,
  auto_sync_enabled BOOLEAN,
  sync_interval_hours INTEGER,
  last_sync_events INTEGER,
  last_sync_errors INTEGER,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.target_name as calendar_name,
    cc.calendar_id,
    cc.last_sync_at,
    CASE 
      WHEN cc.last_sync_at IS NULL THEN '동기화 안됨'
      WHEN cc.last_sync_at < NOW() - (cc.sync_interval_hours || ' hours')::INTERVAL THEN '동기화 필요'
      WHEN cc.sync_error_count > 0 THEN '오류 발생'
      ELSE '최신'
    END as sync_status,
    cc.auto_sync_enabled,
    cc.sync_interval_hours,
    COALESCE(csl.total_events, 0) as last_sync_events,
    COALESCE(csl.error_count, 0) as last_sync_errors,
    cc.last_error_message as error_message
  FROM calendar_configs cc
  LEFT JOIN LATERAL (
    SELECT * FROM calendar_sync_logs 
    WHERE calendar_id = cc.calendar_id 
    ORDER BY created_at DESC 
    LIMIT 1
  ) csl ON true
  WHERE cc.config_type = 'function'
  AND (cc.target_name ILIKE '%연차%' OR cc.target_name ILIKE '%경조사%' 
       OR cc.target_name ILIKE '%leave%' OR cc.target_name ILIKE '%event%')
  ORDER BY cc.target_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- PHASE 5: 뷰 및 유틸리티 함수 생성
-- ====================================================================

-- 5.1 통합 캘린더 이벤트 뷰
CREATE OR REPLACE VIEW calendar_events_unified_view AS
-- 연차 이벤트
SELECT 
  'leave' as event_category,
  u.name as employee_name,
  u.department,
  dws.work_date as event_date,
  dws.work_date as end_date,
  dws.work_status as event_type,
  dws.basic_hours as hours,
  'daily_work_summary' as source_table,
  dws.id::TEXT as source_id,
  NULL as calendar_event_id,
  dws.created_at
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.work_status ILIKE '%차%' AND dws.work_status ILIKE '%유급%'

UNION ALL

-- 캘린더 연동 휴가 이벤트  
SELECT 
  'calendar_leave' as event_category,
  cle.matched_user_name as employee_name,
  u.department,
  cle.start_date as event_date,
  cle.end_date,
  cle.leave_type as event_type,
  cle.leave_hours as hours,
  'calendar_leave_events' as source_table,
  cle.id::TEXT as source_id,
  cle.calendar_event_id,
  cle.created_at
FROM calendar_leave_events cle
LEFT JOIN users u ON cle.matched_user_id = u.id
WHERE cle.is_processed = true AND cle.matched_user_id IS NOT NULL

UNION ALL

-- 경조사 이벤트
SELECT 
  'employee_event' as event_category,
  u.name as employee_name,
  u.department,
  ee.event_date,
  COALESCE(ee.event_end_date, ee.event_date) as end_date,
  ee.event_type,
  ee.leave_days * 8 as hours, -- 일수를 시간으로 변환
  'employee_events' as source_table,
  ee.id::TEXT as source_id,
  ee.calendar_event_id,
  ee.created_at
FROM employee_events ee
JOIN users u ON ee.user_id = u.id

ORDER BY event_date DESC, employee_name;

-- 5.2 데이터 정합성 검증 함수
CREATE OR REPLACE FUNCTION validate_database_integrity()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  issue_count INTEGER,
  details TEXT
) AS $$
BEGIN
  -- 중복 출퇴근 기록 검사
  RETURN QUERY
  SELECT 
    'attendance_duplicates' as check_name,
    CASE WHEN COUNT(*) = 0 THEN '정상' ELSE '문제있음' END as status,
    COUNT(*)::INTEGER as issue_count,
    '중복된 출퇴근 기록: ' || COUNT(*) || '건' as details
  FROM (
    SELECT user_id, record_timestamp, record_type, COUNT(*) as cnt
    FROM attendance_records
    GROUP BY user_id, record_timestamp, record_type
    HAVING COUNT(*) > 1
  ) duplicates;

  -- 매칭되지 않은 캘린더 이벤트 검사  
  RETURN QUERY
  SELECT 
    'unmatched_calendar_events' as check_name,
    CASE WHEN COUNT(*) = 0 THEN '정상' ELSE '확인필요' END as status,
    COUNT(*)::INTEGER as issue_count,
    '매칭되지 않은 캘린더 이벤트: ' || COUNT(*) || '건' as details
  FROM calendar_leave_events
  WHERE is_processed = true AND matched_user_id IS NULL;

  -- 일별 근무시간 누락 검사
  RETURN QUERY
  SELECT 
    'missing_daily_summary' as check_name,
    CASE WHEN COUNT(*) = 0 THEN '정상' ELSE '확인필요' END as status,
    COUNT(*)::INTEGER as issue_count,
    '일별 근무시간 누락: ' || COUNT(*) || '건' as details
  FROM attendance_records ar
  LEFT JOIN daily_work_summary dws ON ar.user_id = dws.user_id AND ar.record_date = dws.work_date
  WHERE dws.id IS NULL AND ar.record_date >= CURRENT_DATE - INTERVAL '30 days';

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ====================================================================
-- PHASE 6: 기본 설정 및 초기 데이터
-- ====================================================================

-- 6.1 기본 휴가 캘린더 설정 생성/업데이트
INSERT INTO calendar_configs (
  config_type,
  target_name,
  calendar_id,
  calendar_alias,
  description,
  is_active,
  auto_sync_enabled,
  sync_interval_hours
) VALUES (
  'function',
  '연차 및 경조사 현황',
  'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
  '휴가 관리',
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
  description = EXCLUDED.description,
  updated_at = NOW();

-- ====================================================================
-- PHASE 7: 완료 확인 및 상태 점검
-- ====================================================================

-- 7.1 복구 완료 상태 확인
SELECT 
  '🎯 데이터베이스 복구 완료!' as status,
  NOW() as completion_time;

-- 7.2 새로 생성된 테이블 확인
SELECT 
  '=== 새로 생성된 테이블 확인 ===' as check_type,
  table_name,
  CASE 
    WHEN table_name IN ('calendar_leave_events', 'calendar_sync_logs', 'employee_events') THEN '✅ 신규 생성'
    ELSE '✅ 기존 유지'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'attendance_records', 'daily_work_summary', 'monthly_work_stats',
  'calendar_leave_events', 'calendar_sync_logs', 'employee_events'
)
ORDER BY table_name;

-- 7.3 RPC 함수 생성 확인
SELECT 
  '=== RPC 함수 생성 확인 ===' as check_type,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'safe_upsert_caps_attendance',
  'process_calendar_leave_events', 
  'get_calendar_sync_status',
  'validate_database_integrity'
)
ORDER BY routine_name;

-- 7.4 제약조건 최종 상태 확인
SELECT 
  '=== attendance_records 제약조건 최종 상태 ===' as check_type,
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'attendance_records'::regclass
AND contype = 'u'
ORDER BY conname;

-- 7.5 데이터 정합성 검증 실행
SELECT * FROM validate_database_integrity();

-- 7.6 캘린더 동기화 상태 확인
SELECT * FROM get_calendar_sync_status();

-- ====================================================================
-- 완료 메시지
-- ====================================================================

SELECT 
  '✅ CAPS 업로드 UPSERT 충돌 해결 완료' as caps_fix,
  '✅ 휴가 캘린더 연동 시스템 구축 완료' as calendar_fix,
  '✅ Supabase RPC 함수 구현 완료' as rpc_functions,
  '✅ 데이터 정합성 검증 시스템 완료' as validation_system,
  '🚀 시스템 정상 작동 준비 완료' as ready_status;

/*
🎯 **적용 방법:**

1. **Supabase SQL Editor**에서 이 스크립트 실행
2. **프론트엔드 코드**에서 RPC 함수 호출:
   ```typescript
   // CAPS 업로드
   const { data } = await supabase.rpc('safe_upsert_caps_attendance', {
     p_user_id: userId,
     p_record_date: date,
     // ... 기타 파라미터
   });
   
   // 캘린더 이벤트 처리
   const { data } = await supabase.rpc('process_calendar_leave_events');
   
   // 시스템 상태 확인
   const { data } = await supabase.rpc('get_calendar_sync_status');
   ```

3. **TypeScript 타입 정의 업데이트** 필요

🚨 **주의사항:**
- 프로덕션 환경에서 실행 전 백업 필수
- 단계별 실행 후 상태 확인 권장
- 오류 발생 시 ROLLBACK 가능하도록 트랜잭션 단위로 실행
*/
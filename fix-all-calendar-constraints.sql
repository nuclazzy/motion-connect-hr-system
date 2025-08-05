-- 모든 캘린더 관련 테이블 제약조건 문제 해결

-- 1. calendar_configs 테이블 UNIQUE 제약조건 추가
-- 먼저 중복 데이터 확인
SELECT 
  calendar_id, 
  COUNT(*) as duplicate_count
FROM calendar_configs 
WHERE calendar_id IS NOT NULL
GROUP BY calendar_id 
HAVING COUNT(*) > 1;

-- 중복 데이터가 있다면 최신 것만 남기고 삭제
WITH duplicate_configs AS (
  SELECT 
    id,
    calendar_id,
    ROW_NUMBER() OVER (PARTITION BY calendar_id ORDER BY updated_at DESC, created_at DESC) as rn
  FROM calendar_configs
  WHERE calendar_id IS NOT NULL
  AND calendar_id IN (
    SELECT calendar_id 
    FROM calendar_configs 
    WHERE calendar_id IS NOT NULL
    GROUP BY calendar_id 
    HAVING COUNT(*) > 1
  )
)
DELETE FROM calendar_configs 
WHERE id IN (
  SELECT id FROM duplicate_configs WHERE rn > 1
);

-- calendar_configs에 UNIQUE 제약조건 추가
DO $$
BEGIN
  BEGIN
    ALTER TABLE calendar_configs 
    ADD CONSTRAINT unique_calendar_id UNIQUE (calendar_id);
    
    RAISE NOTICE '✅ calendar_configs.calendar_id UNIQUE 제약조건이 추가되었습니다.';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️ calendar_configs.calendar_id UNIQUE 제약조건이 이미 존재합니다.';
  END;
END $$;

-- 2. calendar_leave_events 테이블 생성 (존재하지 않는 경우)
CREATE TABLE IF NOT EXISTS calendar_leave_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id VARCHAR(255) NOT NULL UNIQUE, -- UNIQUE 제약조건 즉시 추가
  calendar_id VARCHAR(255) NOT NULL,
  event_title TEXT NOT NULL,
  event_description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN DEFAULT true,
  matched_user_id UUID REFERENCES users(id),
  matched_user_name VARCHAR(100),
  leave_type VARCHAR(50), -- '연차', '반차', '시간차', '병가', '경조사' 등
  leave_hours DECIMAL(3,1), -- 0.5(반차), 1.0(시간차), 8.0(연차)
  matching_confidence DECIMAL(3,2), -- 0.0~1.0 매칭 신뢰도
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- calendar_leave_events에 UNIQUE 제약조건이 없다면 추가
DO $$
BEGIN
  BEGIN
    ALTER TABLE calendar_leave_events 
    ADD CONSTRAINT unique_calendar_event_id UNIQUE (calendar_event_id);
    
    RAISE NOTICE '✅ calendar_leave_events.calendar_event_id UNIQUE 제약조건이 추가되었습니다.';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'ℹ️ calendar_leave_events.calendar_event_id UNIQUE 제약조건이 이미 존재합니다.';
  END;
END $$;

-- 3. 필수 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_calendar_configs_type_active 
ON calendar_configs(config_type, is_active);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_dates 
ON calendar_leave_events(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_user 
ON calendar_leave_events(matched_user_id, is_processed);

CREATE INDEX IF NOT EXISTS idx_calendar_leave_events_calendar 
ON calendar_leave_events(calendar_id, is_processed);

-- 4. 연차 캘린더 설정 안전하게 추가 (UPSERT 대신 수동 처리)
DO $$
BEGIN
  -- 기존 설정이 있는지 확인
  IF NOT EXISTS (
    SELECT 1 FROM calendar_configs 
    WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
  ) THEN
    -- 새로 추가
    INSERT INTO calendar_configs (
      config_type,
      target_name,
      calendar_alias,
      calendar_id,
      is_active,
      auto_sync_enabled,
      sync_interval_hours,
      created_at,
      updated_at
    ) VALUES (
      'function',
      '연차 및 경조사 캘린더',
      'leave_calendar',
      'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
      true,
      true,
      6, -- 6시간마다 동기화
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ 연차 캘린더 설정이 새로 추가되었습니다.';
  ELSE
    -- 기존 설정 업데이트
    UPDATE calendar_configs
    SET 
      target_name = '연차 및 경조사 캘린더',
      calendar_alias = 'leave_calendar',
      is_active = true,
      auto_sync_enabled = true,
      sync_interval_hours = 6,
      updated_at = NOW()
    WHERE calendar_id = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com';
    
    RAISE NOTICE '✅ 기존 연차 캘린더 설정이 업데이트되었습니다.';
  END IF;
END $$;

-- 5. 직원 이름 매칭 함수 생성
CREATE OR REPLACE FUNCTION match_employee_from_text(event_text TEXT)
RETURNS TABLE (
  user_id UUID,
  user_name VARCHAR(100),
  confidence DECIMAL(3,2)
) AS $$
DECLARE
  user_record RECORD;
  similarity_score DECIMAL(3,2);
  max_confidence DECIMAL(3,2) := 0.0;
  best_match_id UUID;
  best_match_name VARCHAR(100);
BEGIN
  -- 모든 직원에 대해 이름 매칭 시도
  FOR user_record IN 
    SELECT id, name FROM users WHERE role = 'employee'
  LOOP
    -- 정확한 이름 매칭 (100% 신뢰도)
    IF event_text ILIKE '%' || user_record.name || '%' THEN
      similarity_score := 1.0;
    -- 성씨만 매칭 (70% 신뢰도)
    ELSIF event_text ILIKE '%' || LEFT(user_record.name, 1) || '%' THEN
      similarity_score := 0.7;
    -- 이름 부분 매칭 (50% 신뢰도)
    ELSIF event_text ILIKE '%' || RIGHT(user_record.name, LENGTH(user_record.name)-1) || '%' THEN
      similarity_score := 0.5;
    ELSE
      similarity_score := 0.0;
    END IF;
    
    -- 최고 신뢰도 매칭 선택
    IF similarity_score > max_confidence THEN
      max_confidence := similarity_score;
      best_match_id := user_record.id;
      best_match_name := user_record.name;
    END IF;
  END LOOP;
  
  -- 결과 반환 (최소 50% 신뢰도 이상만)
  IF max_confidence >= 0.5 THEN
    user_id := best_match_id;
    user_name := best_match_name;
    confidence := max_confidence;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. 휴가 유형 분류 함수
CREATE OR REPLACE FUNCTION classify_leave_type(event_title TEXT, start_date DATE, end_date DATE)
RETURNS TABLE (
  leave_type VARCHAR(50),
  leave_hours DECIMAL(3,1)
) AS $$
BEGIN
  -- 연차 관련 키워드
  IF event_title ILIKE '%연차%' OR event_title ILIKE '%휴가%' OR event_title ILIKE '%annual%' THEN
    -- 하루 종일 연차
    IF start_date = end_date THEN
      leave_type := '연차(유급)';
      leave_hours := 8.0;
    ELSE
      -- 여러 날 연차
      leave_type := '연차(유급)';
      leave_hours := (end_date - start_date + 1) * 8.0;
    END IF;
    
  -- 반차 관련 키워드
  ELSIF event_title ILIKE '%반차%' OR event_title ILIKE '%half%' THEN
    leave_type := '반차(유급)';
    leave_hours := 4.0;
    
  -- 시간차 관련 키워드
  ELSIF event_title ILIKE '%시간차%' OR event_title ILIKE '%hour%' THEN
    leave_type := '시간차(유급)';
    leave_hours := 1.0; -- 기본 1시간, 실제로는 제목에서 파싱 필요
    
  -- 병가 관련 키워드
  ELSIF event_title ILIKE '%병가%' OR event_title ILIKE '%sick%' THEN
    leave_type := '병가(유급)';
    leave_hours := 8.0;
    
  -- 경조사 관련 키워드
  ELSIF event_title ILIKE '%경조사%' OR event_title ILIKE '%결혼%' OR event_title ILIKE '%장례%' THEN
    leave_type := '경조사(유급)';
    leave_hours := 8.0;
    
  -- 기타 휴가
  ELSE
    leave_type := '기타휴가';
    leave_hours := 8.0;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 7. 캘린더 이벤트 처리 함수
CREATE OR REPLACE FUNCTION process_calendar_leave_events()
RETURNS TABLE (
  processed_count INTEGER,
  matched_count INTEGER,
  created_leave_count INTEGER,
  error_count INTEGER
) AS $$
DECLARE
  event_record RECORD;
  match_result RECORD;
  leave_result RECORD;
  processed_cnt INTEGER := 0;
  matched_cnt INTEGER := 0;
  created_cnt INTEGER := 0;
  error_cnt INTEGER := 0;
BEGIN
  -- 미처리된 캘린더 이벤트들 처리
  FOR event_record IN 
    SELECT * FROM calendar_leave_events 
    WHERE is_processed = false
    AND (event_title ILIKE '%연차%' OR event_title ILIKE '%휴가%' 
         OR event_title ILIKE '%반차%' OR event_title ILIKE '%시간차%'
         OR event_title ILIKE '%병가%' OR event_title ILIKE '%경조사%')
    ORDER BY start_date
  LOOP
    BEGIN
      processed_cnt := processed_cnt + 1;
      
      -- 직원 매칭 시도
      SELECT * INTO match_result 
      FROM match_employee_from_text(event_record.event_title || ' ' || COALESCE(event_record.event_description, ''))
      LIMIT 1;
      
      -- 휴가 유형 분류
      SELECT * INTO leave_result
      FROM classify_leave_type(event_record.event_title, event_record.start_date, event_record.end_date)
      LIMIT 1;
      
      IF match_result.user_id IS NOT NULL AND leave_result.leave_type IS NOT NULL THEN
        matched_cnt := matched_cnt + 1;
        
        -- calendar_leave_events 테이블 업데이트
        UPDATE calendar_leave_events
        SET 
          matched_user_id = match_result.user_id,
          matched_user_name = match_result.user_name,
          leave_type = leave_result.leave_type,
          leave_hours = leave_result.leave_hours,
          matching_confidence = match_result.confidence,
          is_processed = true,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = event_record.id;
        
        created_cnt := created_cnt + 1;
        
      ELSE
        -- 매칭 실패한 경우에도 처리됨으로 표시
        UPDATE calendar_leave_events
        SET 
          is_processed = true,
          processed_at = NOW(),
          updated_at = NOW()
        WHERE id = event_record.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_cnt := error_cnt + 1;
      CONTINUE;
    END;
  END LOOP;
  
  -- 결과 반환
  processed_count := processed_cnt;
  matched_count := matched_cnt;
  created_leave_count := created_cnt;
  error_count := error_cnt;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. 매칭 결과 확인을 위한 뷰
CREATE OR REPLACE VIEW calendar_leave_matching_view AS
SELECT 
  cle.event_title,
  cle.start_date,
  cle.end_date,
  cle.matched_user_name,
  u.name as actual_user_name,
  u.department,
  cle.leave_type,
  cle.leave_hours,
  cle.matching_confidence,
  cle.is_processed,
  CASE 
    WHEN cle.matching_confidence >= 0.9 THEN '매우 높음'
    WHEN cle.matching_confidence >= 0.7 THEN '높음'
    WHEN cle.matching_confidence >= 0.5 THEN '보통'
    ELSE '낮음'
  END as confidence_level,
  cle.created_at
FROM calendar_leave_events cle
LEFT JOIN users u ON cle.matched_user_id = u.id
ORDER BY cle.start_date DESC, cle.matching_confidence DESC;

-- 9. 테이블 상태 확인
SELECT 
  '🔧 모든 캘린더 테이블 제약조건 수정 완료!' as message,
  '✅ calendar_configs UNIQUE 제약조건 추가' as config_constraint,
  '✅ calendar_leave_events 테이블 및 제약조건 생성' as events_table,
  '✅ 연차 캘린더 설정 등록 완료' as calendar_registered,
  '✅ 직원 매칭 및 처리 함수 생성' as functions_created;

-- 10. 제약조건 최종 확인
SELECT 
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
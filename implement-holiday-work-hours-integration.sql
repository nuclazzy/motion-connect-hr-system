-- 공휴일 API와 근무시간 데이터 연동 시스템 구현

-- 1. 공휴일 정보 저장 테이블 생성
CREATE TABLE IF NOT EXISTS holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  source VARCHAR(50) DEFAULT 'naver_api', -- 'naver_api', 'manual', 'default'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
CREATE INDEX IF NOT EXISTS idx_holidays_active ON holidays(is_active);

-- 2. daily_work_summary 테이블에 공휴일 관련 컬럼 추가
DO $$
BEGIN
  -- is_holiday 컬럼 추가
  BEGIN
    ALTER TABLE daily_work_summary 
    ADD COLUMN is_holiday BOOLEAN DEFAULT false;
    
    RAISE NOTICE '✅ is_holiday 컬럼이 추가되었습니다.';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'ℹ️ is_holiday 컬럼이 이미 존재합니다.';
  END;
  
  -- holiday_name 컬럼 추가
  BEGIN
    ALTER TABLE daily_work_summary 
    ADD COLUMN holiday_name VARCHAR(100);
    
    RAISE NOTICE '✅ holiday_name 컬럼이 추가되었습니다.';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'ℹ️ holiday_name 컬럼이 이미 존재합니다.';
  END;
END $$;

-- 3. 공휴일 확인 함수 생성
CREATE OR REPLACE FUNCTION check_if_holiday(check_date DATE)
RETURNS TABLE (
  is_holiday BOOLEAN,
  holiday_name VARCHAR(100)
) AS $$
DECLARE
  holiday_record RECORD;
  day_of_week INTEGER;
BEGIN
  -- 공휴일 테이블에서 확인
  SELECT h.holiday_name INTO holiday_record
  FROM holidays h
  WHERE h.holiday_date = check_date
  AND h.is_active = true
  LIMIT 1;
  
  IF holiday_record.holiday_name IS NOT NULL THEN
    -- 공휴일인 경우
    is_holiday := true;
    holiday_name := holiday_record.holiday_name;
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- 주말 확인 (일요일: 0, 토요일: 6)
  day_of_week := EXTRACT(DOW FROM check_date);
  
  IF day_of_week = 0 THEN
    -- 일요일
    is_holiday := true;
    holiday_name := '일요일';
    RETURN NEXT;
    RETURN;
  ELSIF day_of_week = 6 THEN
    -- 토요일
    is_holiday := true;
    holiday_name := '토요일';
    RETURN NEXT;
    RETURN;
  END IF;
  
  -- 평일
  is_holiday := false;
  holiday_name := NULL;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 4. 공휴일 근무시간 자동 생성 함수
CREATE OR REPLACE FUNCTION create_holiday_work_hours(
  target_user_id UUID,
  target_date DATE,
  target_holiday_name VARCHAR(100)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- 공휴일에 8시간 근무 데이터 생성
  INSERT INTO daily_work_summary (
    user_id,
    work_date,
    check_in_time,
    check_out_time,
    basic_hours,
    overtime_hours,
    night_hours,
    substitute_hours,
    compensatory_hours,
    work_status,
    is_holiday,
    holiday_name,
    had_dinner,
    auto_calculated,
    calculated_at
  ) VALUES (
    target_user_id,
    target_date,
    NULL, -- 공휴일은 출퇴근 시간 없음
    NULL,
    8.0, -- 공휴일 근무 기본 8시간
    0.0, -- 초과근무 없음
    0.0, -- 야간근무 없음
    0.0, -- 대체휴가 없음
    0.0, -- 보상휴가 없음
    target_holiday_name || ' 근무',
    true, -- 공휴일 표시
    target_holiday_name,
    false, -- 저녁식사 없음
    true, -- 자동 계산
    NOW()
  )
  ON CONFLICT (user_id, work_date)
  DO UPDATE SET
    basic_hours = CASE 
      WHEN daily_work_summary.auto_calculated = true 
      THEN 8.0 
      ELSE daily_work_summary.basic_hours 
    END,
    is_holiday = true,
    holiday_name = target_holiday_name,
    work_status = CASE 
      WHEN daily_work_summary.auto_calculated = true 
      THEN target_holiday_name || ' 근무'
      ELSE daily_work_summary.work_status 
    END,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. 모든 직원에 대해 공휴일 근무시간 일괄 생성 함수
CREATE OR REPLACE FUNCTION generate_holiday_work_hours_for_all(
  start_date DATE,
  end_date DATE
)
RETURNS TABLE (
  processed_dates INTEGER,
  processed_employees INTEGER,
  created_records INTEGER,
  updated_records INTEGER
) AS $$
DECLARE
  current_date DATE;
  holiday_info RECORD;
  employee_record RECORD;
  date_count INTEGER := 0;
  employee_count INTEGER := 0;
  created_count INTEGER := 0;
  updated_count INTEGER := 0;
  existing_record RECORD;
BEGIN
  -- 날짜 범위 순회
  current_date := start_date;
  
  WHILE current_date <= end_date LOOP
    date_count := date_count + 1;
    
    -- 해당 날짜가 공휴일인지 확인
    SELECT * INTO holiday_info
    FROM check_if_holiday(current_date)
    LIMIT 1;
    
    -- 공휴일이거나 주말인 경우
    IF holiday_info.is_holiday = true THEN
      
      -- 모든 직원에 대해 처리
      FOR employee_record IN 
        SELECT id, name FROM users WHERE role = 'employee' AND id IS NOT NULL
      LOOP
        employee_count := employee_count + 1;
        
        -- 기존 기록이 있는지 확인
        SELECT work_status, auto_calculated INTO existing_record
        FROM daily_work_summary
        WHERE user_id = employee_record.id
        AND work_date = current_date;
        
        -- 공휴일 근무시간 생성
        PERFORM create_holiday_work_hours(
          employee_record.id,
          current_date,
          holiday_info.holiday_name
        );
        
        -- 기록 카운트 업데이트
        IF existing_record.work_status IS NULL THEN
          created_count := created_count + 1;
        ELSE
          updated_count := updated_count + 1;
        END IF;
        
      END LOOP;
      
    END IF;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
  
  -- 결과 반환
  processed_dates := date_count;
  processed_employees := employee_count;
  created_records := created_count;
  updated_records := updated_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 6. 공휴일 데이터 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION auto_update_holiday_work_hours()
RETURNS TRIGGER AS $$
DECLARE
  employee_record RECORD;
BEGIN
  -- 공휴일 데이터가 추가되거나 업데이트된 경우
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    
    -- 모든 직원에 대해 해당 날짜의 공휴일 근무시간 생성
    FOR employee_record IN 
      SELECT id FROM users WHERE role = 'employee'
    LOOP
      PERFORM create_holiday_work_hours(
        employee_record.id,
        NEW.holiday_date,
        NEW.holiday_name
      );
    END LOOP;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_auto_update_holiday_work_hours ON holidays;

CREATE TRIGGER trigger_auto_update_holiday_work_hours
  AFTER INSERT OR UPDATE ON holidays
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_holiday_work_hours();

-- 7. 기본 공휴일 데이터 삽입 (2025년)
INSERT INTO holidays (holiday_date, holiday_name, year, source) VALUES
  ('2025-01-01', '신정', 2025, 'default'),
  ('2025-01-28', '설날연휴', 2025, 'default'),
  ('2025-01-29', '설날', 2025, 'default'),
  ('2025-01-30', '설날연휴', 2025, 'default'),
  ('2025-03-01', '삼일절', 2025, 'default'),
  ('2025-05-05', '어린이날', 2025, 'default'),
  ('2025-05-06', '대체공휴일(어린이날)', 2025, 'default'),
  ('2025-06-06', '현충일', 2025, 'default'),
  ('2025-08-15', '광복절', 2025, 'default'),
  ('2025-09-28', '추석연휴', 2025, 'default'),
  ('2025-09-29', '추석', 2025, 'default'),
  ('2025-09-30', '추석연휴', 2025, 'default'),
  ('2025-10-03', '개천절', 2025, 'default'),
  ('2025-10-09', '한글날', 2025, 'default'),
  ('2025-12-25', '성탄절', 2025, 'default')
ON CONFLICT (holiday_date) DO UPDATE SET
  holiday_name = EXCLUDED.holiday_name,
  source = EXCLUDED.source,
  updated_at = NOW();

-- 8. 월별 공휴일 현황 뷰 생성
CREATE OR REPLACE VIEW monthly_holiday_summary AS
SELECT 
  DATE_TRUNC('month', h.holiday_date)::DATE as month,
  COUNT(*) as total_holidays,
  STRING_AGG(h.holiday_name, ', ' ORDER BY h.holiday_date) as holiday_list,
  ARRAY_AGG(h.holiday_date ORDER BY h.holiday_date) as holiday_dates
FROM holidays h
WHERE h.is_active = true
GROUP BY DATE_TRUNC('month', h.holiday_date)
ORDER BY month;

-- 9. 공휴일 근무현황 확인 뷰
CREATE OR REPLACE VIEW holiday_work_status AS
SELECT 
  u.name as employee_name,
  u.department,
  dws.work_date,
  dws.holiday_name,
  dws.basic_hours,
  dws.work_status,
  dws.is_holiday,
  dws.auto_calculated,
  CASE 
    WHEN dws.is_holiday = true AND dws.basic_hours = 8.0 THEN '정상'
    WHEN dws.is_holiday = true AND dws.basic_hours != 8.0 THEN '비정상'
    ELSE '평일'
  END as status_check
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE dws.is_holiday = true
ORDER BY dws.work_date DESC, u.name;

-- 10. 완료 메시지 및 현황 확인
SELECT 
  '🎉 공휴일 근무시간 연동 시스템 구축 완료!' as message,
  '✅ 공휴일 정보 저장 테이블 생성' as table_created,
  '✅ 공휴일 확인 및 근무시간 생성 함수' as functions_created,
  '✅ 자동 업데이트 트리거 설정' as trigger_created,
  '✅ 2025년 기본 공휴일 데이터 삽입' as default_data_inserted;

-- 현재 등록된 공휴일 수 확인
SELECT 
  '=== 등록된 공휴일 현황 ===' as status,
  COUNT(*) as total_holidays,
  MIN(holiday_date) as earliest_holiday,
  MAX(holiday_date) as latest_holiday
FROM holidays 
WHERE is_active = true;

-- 이번 달 공휴일 현황
SELECT 
  '=== 이번 달 공휴일 ===' as status,
  holiday_date,
  holiday_name
FROM holidays
WHERE holiday_date >= DATE_TRUNC('month', CURRENT_DATE)
AND holiday_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
AND is_active = true
ORDER BY holiday_date;
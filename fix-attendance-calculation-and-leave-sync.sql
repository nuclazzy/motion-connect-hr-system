-- 1. 올바른 근무시간 계산 트리거 적용 및 휴가 잔액 자동 연동

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;

-- Google Apps Script 로직 완전 구현
CREATE OR REPLACE FUNCTION calculate_daily_work_time()
RETURNS TRIGGER AS $$
DECLARE
  check_in_record TIMESTAMP WITH TIME ZONE;
  check_out_record TIMESTAMP WITH TIME ZONE;
  work_minutes INTEGER := 0;
  break_minutes INTEGER := 0;
  net_work_hours DECIMAL(4,1) := 0;
  basic_hours DECIMAL(4,1) := 0;
  overtime_hours DECIMAL(4,1) := 0;
  night_hours DECIMAL(4,1) := 0;
  substitute_hours DECIMAL(4,1) := 0;
  compensatory_hours DECIMAL(4,1) := 0;
  work_status TEXT := '';
  overtime_threshold INTEGER := 8;
  is_holiday BOOLEAN := false;
  current_hour INTEGER;
  temp_time TIMESTAMP WITH TIME ZONE;
  day_of_week INTEGER;
  leave_hours DECIMAL(4,1) := 0;
  holiday_extension DECIMAL(4,1) := 0;
BEGIN
  -- 요일 확인 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week := EXTRACT(DOW FROM NEW.record_date);
  
  -- 연차 사용일 확인 (최우선 처리)
  SELECT 
    CASE 
      WHEN form_data->>'leave_type' LIKE '%반차%' THEN 4.0
      WHEN form_data->>'leave_type' LIKE '%시간차%' THEN 
        COALESCE((form_data->>'hours')::DECIMAL, 0)
      ELSE 8.0
    END INTO leave_hours
  FROM form_requests 
  WHERE user_id = NEW.user_id 
  AND status = 'approved'
  AND (form_type = '휴가 신청서' OR form_type = '연차 신청서')
  AND NEW.record_date BETWEEN 
    COALESCE((form_data->>'start_date')::DATE, created_at::DATE) AND
    COALESCE((form_data->>'end_date')::DATE, created_at::DATE)
  LIMIT 1;

  -- 연차 사용일인 경우 즉시 처리하고 종료
  IF leave_hours > 0 THEN
    INSERT INTO daily_work_summary (
      user_id, work_date, basic_hours, work_status,
      auto_calculated, calculated_at
    ) VALUES (
      NEW.user_id, NEW.record_date, leave_hours,
      CASE 
        WHEN leave_hours = 8 THEN '연차'
        WHEN leave_hours = 4 THEN '반차'
        ELSE leave_hours || '시간 연차'
      END,
      true, NOW()
    )
    ON CONFLICT (user_id, work_date) 
    DO UPDATE SET
      basic_hours = EXCLUDED.basic_hours,
      work_status = EXCLUDED.work_status,
      auto_calculated = true,
      calculated_at = NOW(),
      updated_at = NOW();
    
    RETURN NEW;
  END IF;

  -- 탄력근로제 설정 확인
  SELECT COALESCE(
    (SELECT overtime_threshold 
     FROM flex_work_settings 
     WHERE NEW.record_date BETWEEN start_date AND end_date 
     AND is_active = true 
     LIMIT 1), 8
  ) INTO overtime_threshold;

  -- 공휴일 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM work_calendar 
    WHERE calendar_date = NEW.record_date 
    AND calendar_type = '공휴일'
  ) INTO is_holiday;

  -- 공휴일/일요일 무급무를 한 경우 유급휴일 처리
  IF (is_holiday OR day_of_week = 0) AND NEW.user_id IS NULL THEN
    INSERT INTO daily_work_summary (
      user_id, work_date, basic_hours, work_status,
      is_holiday, auto_calculated, calculated_at
    ) VALUES (
      NEW.user_id, NEW.record_date, 8.0,
      CASE WHEN is_holiday THEN '유급휴일' ELSE '주휴일' END,
      true, true, NOW()
    )
    ON CONFLICT (user_id, work_date) DO NOTHING;
    
    RETURN NEW;
  END IF;

  -- 출퇴근 기록 조회
  SELECT 
    MIN(CASE WHEN record_type = '출근' THEN record_timestamp END),
    MAX(CASE WHEN record_type = '퇴근' THEN record_timestamp END)
  INTO check_in_record, check_out_record
  FROM attendance_records 
  WHERE user_id = NEW.user_id 
  AND record_date = NEW.record_date;

  -- 출퇴근이 모두 기록된 경우 근무시간 계산
  IF check_in_record IS NOT NULL AND check_out_record IS NOT NULL THEN
    work_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
    
    -- 휴게시간 계산
    IF work_minutes >= 240 THEN break_minutes := 60; END IF;
    IF NEW.record_type = '퇴근' AND NEW.had_dinner = true THEN
      break_minutes := break_minutes + 60;
      work_status := '+저녁';
    END IF;

    net_work_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 야간근무시간 계산 (22시~06시)
    night_hours := 0;
    temp_time := check_in_record;
    WHILE temp_time < check_out_record LOOP
      current_hour := EXTRACT(HOUR FROM temp_time);
      IF current_hour >= 22 OR current_hour < 6 THEN
        night_hours := night_hours + 1;
      END IF;
      temp_time := temp_time + INTERVAL '1 hour';
    END LOOP;
    night_hours := ROUND(night_hours::NUMERIC, 1);

    -- Google Apps Script 완전 로직 적용
    IF day_of_week = 6 THEN -- 토요일
      basic_hours := net_work_hours;
      overtime_hours := 0;
      -- 토요일 대체휴가 정확한 계산
      IF net_work_hours > 8 THEN
        substitute_hours := 8 + ((net_work_hours - 8) * 1.5);
      ELSE
        substitute_hours := net_work_hours;
      END IF;
      work_status := '정상근무(토요일)' || work_status;
      
    ELSIF day_of_week = 0 OR is_holiday THEN -- 일요일 또는 공휴일
      basic_hours := net_work_hours;
      overtime_hours := 0;
      
      -- 보상휴가 정확한 가산 계산 (Google Apps Script 로직)
      IF net_work_hours <= 8 THEN
        compensatory_hours := net_work_hours * 1.5;
      ELSE
        holiday_extension := net_work_hours - 8;
        compensatory_hours := (8 * 1.5) + (holiday_extension * 2.0);
      END IF;
      
      -- 야간근무 가산 (0.5배 추가)
      compensatory_hours := compensatory_hours + (night_hours * 0.5);
      
      work_status := CASE 
        WHEN is_holiday THEN '정상근무(공휴일)'
        ELSE '정상근무(일요일)'
      END || work_status;
      
    ELSE -- 평일 (월~금)
      IF net_work_hours > overtime_threshold THEN
        overtime_hours := ROUND((net_work_hours - overtime_threshold)::NUMERIC, 1);
        basic_hours := ROUND((net_work_hours - overtime_hours)::NUMERIC, 1);
      ELSE
        basic_hours := net_work_hours;
        overtime_hours := 0;
      END IF;
      
      work_status := '정상근무' || work_status;
    END IF;

  ELSE
    -- 출퇴근 기록 누락 처리
    IF check_in_record IS NOT NULL THEN
      work_status := '퇴근기록누락';
    ELSIF check_out_record IS NOT NULL THEN
      work_status := '출근기록누락';
    END IF;
  END IF;

  -- daily_work_summary 테이블 업데이트
  INSERT INTO daily_work_summary (
    user_id, work_date, check_in_time, check_out_time,
    basic_hours, overtime_hours, night_hours,
    substitute_hours, compensatory_hours,
    break_minutes, work_status, is_holiday,
    had_dinner, auto_calculated, calculated_at
  ) VALUES (
    NEW.user_id, NEW.record_date, check_in_record, check_out_record,
    basic_hours, overtime_hours, night_hours,
    substitute_hours, compensatory_hours,
    break_minutes, work_status, is_holiday,
    NEW.had_dinner, true, NOW()
  )
  ON CONFLICT (user_id, work_date) 
  DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    basic_hours = EXCLUDED.basic_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    night_hours = EXCLUDED.night_hours,
    substitute_hours = EXCLUDED.substitute_hours,
    compensatory_hours = EXCLUDED.compensatory_hours,
    break_minutes = EXCLUDED.break_minutes,
    work_status = EXCLUDED.work_status,
    is_holiday = EXCLUDED.is_holiday,
    had_dinner = EXCLUDED.had_dinner,
    auto_calculated = true,
    calculated_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
CREATE TRIGGER trigger_calculate_daily_work_time
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_work_time();

-- 2. 휴가 잔액 자동 업데이트 트리거

-- 휴가 잔액 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_substitute_diff DECIMAL(4,1);
  v_compensatory_diff DECIMAL(4,1);
BEGIN
  -- INSERT의 경우 OLD가 NULL이므로 처리
  IF TG_OP = 'INSERT' THEN
    v_substitute_diff := COALESCE(NEW.substitute_hours, 0);
    v_compensatory_diff := COALESCE(NEW.compensatory_hours, 0);
  ELSE
    -- UPDATE의 경우 차이 계산
    v_substitute_diff := COALESCE(NEW.substitute_hours, 0) - COALESCE(OLD.substitute_hours, 0);
    v_compensatory_diff := COALESCE(NEW.compensatory_hours, 0) - COALESCE(OLD.compensatory_hours, 0);
  END IF;
  
  -- 차이가 있을 때만 업데이트
  IF v_substitute_diff != 0 OR v_compensatory_diff != 0 THEN
    UPDATE users
    SET 
      substitute_leave_hours = GREATEST(0, COALESCE(substitute_leave_hours, 0) + v_substitute_diff),
      compensatory_leave_hours = GREATEST(0, COALESCE(compensatory_leave_hours, 0) + v_compensatory_diff),
      updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- 로그 출력 (디버깅용)
    RAISE NOTICE '사용자 % 휴가 잔액 업데이트: 대체휴가 +%, 보상휴가 +%', 
      NEW.user_id, v_substitute_diff, v_compensatory_diff;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_update_user_leave_balance ON daily_work_summary;

-- 새 트리거 생성
CREATE TRIGGER trigger_update_user_leave_balance
  AFTER INSERT OR UPDATE OF substitute_hours, compensatory_hours ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_user_leave_balance();

-- 3. 6월 11일 데이터 재계산
-- 허지현의 6월 11일 출퇴근 기록을 업데이트하여 트리거가 재실행되도록 함
UPDATE attendance_records 
SET updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE name = '허지현')
AND record_date = '2025-06-11'
AND record_type = '퇴근';

-- 4. 과거 데이터 동기화 (필요시 실행)
-- 이미 기록된 대체/보상휴가 시간을 사용자 잔액에 반영
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN 
    SELECT 
      user_id,
      SUM(substitute_hours) as total_substitute,
      SUM(compensatory_hours) as total_compensatory
    FROM daily_work_summary
    WHERE substitute_hours > 0 OR compensatory_hours > 0
    GROUP BY user_id
  LOOP
    UPDATE users
    SET 
      substitute_leave_hours = COALESCE(v_user_record.total_substitute, 0),
      compensatory_leave_hours = COALESCE(v_user_record.total_compensatory, 0),
      updated_at = NOW()
    WHERE id = v_user_record.user_id;
    
    RAISE NOTICE '사용자 % 휴가 잔액 동기화: 대체휴가 %, 보상휴가 %', 
      v_user_record.user_id, v_user_record.total_substitute, v_user_record.total_compensatory;
  END LOOP;
END $$;

-- 5. 결과 확인
SELECT 
  u.name,
  dws.work_date,
  dws.check_in_time,
  dws.check_out_time,
  dws.basic_hours,
  dws.overtime_hours,
  dws.night_hours,
  dws.substitute_hours,
  dws.compensatory_hours,
  dws.break_minutes,
  dws.work_status
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '허지현' AND dws.work_date = '2025-06-11';

-- 사용자 휴가 잔액 확인
SELECT 
  name,
  substitute_leave_hours,
  compensatory_leave_hours
FROM users
WHERE name = '허지현';
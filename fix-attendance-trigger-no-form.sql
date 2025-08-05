-- 1. form_requests 의존성 제거한 트리거 함수

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;

-- Google Apps Script 로직 구현 (form_requests 제외)
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
  holiday_extension DECIMAL(4,1) := 0;
BEGIN
  -- 요일 확인 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week := EXTRACT(DOW FROM NEW.record_date);

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
    IF work_minutes >= 240 THEN 
      break_minutes := 60; 
    END IF;
    
    -- 저녁식사 여부 확인 (퇴근 기록에서)
    IF EXISTS(
      SELECT 1 FROM attendance_records 
      WHERE user_id = NEW.user_id 
      AND record_date = NEW.record_date
      AND record_type = '퇴근'
      AND had_dinner = true
    ) THEN
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

    -- Google Apps Script 로직 적용
    IF day_of_week = 6 THEN -- 토요일
      basic_hours := net_work_hours;
      overtime_hours := 0;
      -- 토요일 대체휴가 계산
      IF net_work_hours > 8 THEN
        substitute_hours := 8 + ((net_work_hours - 8) * 1.5);
      ELSE
        substitute_hours := net_work_hours;
      END IF;
      work_status := '정상근무(토요일)' || work_status;
      
    ELSIF day_of_week = 0 OR is_holiday THEN -- 일요일 또는 공휴일
      basic_hours := net_work_hours;
      overtime_hours := 0;
      
      -- 보상휴가 계산
      IF net_work_hours <= 8 THEN
        compensatory_hours := net_work_hours * 1.5;
      ELSE
        holiday_extension := net_work_hours - 8;
        compensatory_hours := (8 * 1.5) + (holiday_extension * 2.0);
      END IF;
      
      -- 야간근무 가산 (0.5배 추가)
      IF night_hours > 0 THEN
        compensatory_hours := compensatory_hours + (night_hours * 0.5);
      END IF;
      
      work_status := CASE 
        WHEN is_holiday THEN '정상근무(공휴일)'
        ELSE '정상근무(일요일)'
      END || work_status;
      
    ELSE -- 평일 (월~금)
      IF net_work_hours > overtime_threshold THEN
        overtime_hours := ROUND((net_work_hours - overtime_threshold)::NUMERIC, 1);
        basic_hours := overtime_threshold;
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
    (SELECT had_dinner FROM attendance_records WHERE user_id = NEW.user_id AND record_date = NEW.record_date AND record_type = '퇴근' LIMIT 1),
    true, NOW()
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

-- 2. 6월 11일 데이터 재계산
-- 허지현의 6월 11일 출퇴근 기록을 업데이트하여 트리거가 재실행되도록 함
UPDATE attendance_records 
SET updated_at = NOW()
WHERE user_id = (SELECT id FROM users WHERE name = '허지현')
AND record_date = '2025-06-11'
AND record_type = '퇴근';

-- 3. 결과 확인
SELECT 
  u.name,
  dws.work_date,
  TO_CHAR(dws.check_in_time, 'AM HH:MI:SS') as check_in,
  TO_CHAR(dws.check_out_time, 'PM HH:MI:SS') as check_out,
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
  substitute_leave_hours as "대체휴가 잔액",
  compensatory_leave_hours as "보상휴가 잔액"
FROM users
WHERE name = '허지현';
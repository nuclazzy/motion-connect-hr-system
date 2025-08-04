-- 근무시간 계산 함수 수정 (PostgreSQL 트리거 오류 해결)
CREATE OR REPLACE FUNCTION calculate_daily_work_time()
RETURNS TRIGGER AS $$
DECLARE
  check_in_record TIMESTAMP WITH TIME ZONE;
  check_out_record TIMESTAMP WITH TIME ZONE;
  work_minutes INTEGER := 0;
  break_minutes INTEGER := 0;
  basic_hours DECIMAL(4,1) := 0;
  overtime_hours DECIMAL(4,1) := 0;
  night_hours DECIMAL(4,1) := 0;
  work_status TEXT := '';
  is_holiday BOOLEAN := false;
  user_overtime_threshold INTEGER := 8; -- 변수명을 명확하게 변경
BEGIN
  -- 사용자별 초과근무 기준시간 조회
  SELECT 
    COALESCE(
      (SELECT flex_work_settings.overtime_threshold 
       FROM flex_work_settings 
       WHERE flex_work_settings.user_id = NEW.user_id 
       AND flex_work_settings.is_active = true 
       LIMIT 1), 
      8
    ) INTO user_overtime_threshold; -- 변수명 변경

  -- 해당 날짜의 출퇴근 기록 조회
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
    
    -- 휴게시간 계산 (4시간 이상 근무 시 1시간, 저녁식사 시 추가 1시간)
    IF work_minutes >= 240 THEN
      break_minutes := 60;
    END IF;
    
    -- 저녁식사 여부 확인
    IF NEW.record_type = '퇴근' AND NEW.had_dinner = true THEN
      break_minutes := break_minutes + 60;
      work_status := work_status || '+저녁';
    END IF;

    -- 실 근무시간 계산 (총 근무시간 - 휴게시간)
    basic_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 연장근무시간 계산 (수정된 변수명 사용)
    IF basic_hours > user_overtime_threshold THEN
      overtime_hours := basic_hours - user_overtime_threshold;
      basic_hours := user_overtime_threshold;
    END IF;

    -- 야간근무시간 계산 (22시~06시)
    -- 이 부분은 복잡한 로직이므로 별도 함수로 분리 가능

    work_status := '정상근무' || work_status;
  ELSE
    -- 출근 또는 퇴근 기록이 누락된 경우
    IF check_in_record IS NOT NULL THEN
      work_status := '퇴근기록누락';
    ELSIF check_out_record IS NOT NULL THEN
      work_status := '출근기록누락';
    END IF;
  END IF;

  -- daily_work_summary 테이블에 삽입 또는 업데이트
  INSERT INTO daily_work_summary (
    user_id, work_date, check_in_time, check_out_time,
    basic_hours, overtime_hours, night_hours,
    break_minutes, work_status, is_holiday,
    had_dinner, calculated_at
  ) VALUES (
    NEW.user_id, NEW.record_date, check_in_record, check_out_record,
    basic_hours, overtime_hours, night_hours,
    break_minutes, work_status, is_holiday,
    NEW.had_dinner, NOW()
  )
  ON CONFLICT (user_id, work_date) 
  DO UPDATE SET
    check_in_time = EXCLUDED.check_in_time,
    check_out_time = EXCLUDED.check_out_time,
    basic_hours = EXCLUDED.basic_hours,
    overtime_hours = EXCLUDED.overtime_hours,
    night_hours = EXCLUDED.night_hours,
    break_minutes = EXCLUDED.break_minutes,
    work_status = EXCLUDED.work_status,
    is_holiday = EXCLUDED.is_holiday,
    had_dinner = EXCLUDED.had_dinner,
    calculated_at = NOW(),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
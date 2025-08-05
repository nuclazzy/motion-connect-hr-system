-- attendance_records 트리거 임시 수정
-- form_data 참조를 제거한 버전

-- 1. 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_calculate_enhanced_work_time ON attendance_records;
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;

-- 2. 원래의 간단한 트리거 함수로 복원
CREATE OR REPLACE FUNCTION calculate_daily_work_time()
RETURNS TRIGGER AS $$
DECLARE
  check_in_record TIMESTAMP WITH TIME ZONE;
  check_out_record TIMESTAMP WITH TIME ZONE;
  work_minutes INTEGER;
  break_minutes INTEGER := 0;
  basic_hours DECIMAL(4,1) := 0;
  overtime_hours DECIMAL(4,1) := 0;
  night_hours DECIMAL(4,1) := 0;
  work_status TEXT := '';
  is_holiday BOOLEAN := false;
  overtime_threshold INTEGER := 8;
BEGIN
  -- 해당 날짜의 공휴일 여부 확인
  SELECT EXISTS(
    SELECT 1 FROM work_calendar 
    WHERE calendar_date = NEW.record_date 
    AND calendar_type = '공휴일'
  ) INTO is_holiday;

  -- 해당 날짜의 출근/퇴근 기록 조회
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
    
    -- 휴게시간 계산 (4시간 이상 근무 시 1시간)
    IF work_minutes >= 240 THEN
      break_minutes := 60;
    END IF;
    
    -- 저녁식사 여부 확인 (had_dinner 필드 사용)
    IF NEW.record_type = '퇴근' AND NEW.had_dinner = true THEN
      break_minutes := break_minutes + 60;
      work_status := work_status || '+저녁';
    END IF;

    -- 실 근무시간 계산 (총 근무시간 - 휴게시간)
    basic_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 연장근무시간 계산
    IF basic_hours > overtime_threshold THEN
      overtime_hours := basic_hours - overtime_threshold;
      basic_hours := overtime_threshold;
    END IF;

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

-- 3. 트리거 재생성
CREATE TRIGGER trigger_calculate_daily_work_time
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_work_time();

-- 4. 확인
SELECT '✅ attendance_records 트리거가 수정되었습니다. form_data 참조가 제거되었습니다.' as result;
-- 근무시간 계산 트리거 함수 수정
-- Google Apps Script 로직 기반으로 정확한 기본시간/연장시간 계산

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
  work_status TEXT := '';
  overtime_threshold INTEGER := 8;
  is_holiday BOOLEAN := false;
  current_hour INTEGER;
  temp_time TIMESTAMP WITH TIME ZONE;
  day_of_week INTEGER;
BEGIN
  -- 해당 날짜의 출근/퇴근 기록 조회
  SELECT 
    MIN(CASE WHEN record_type = '출근' THEN record_timestamp END),
    MAX(CASE WHEN record_type = '퇴근' THEN record_timestamp END)
  INTO check_in_record, check_out_record
  FROM attendance_records 
  WHERE user_id = NEW.user_id 
  AND record_date = NEW.record_date;

  -- 요일 확인 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week := EXTRACT(DOW FROM NEW.record_date);
  
  -- 탄력근로제 확인 (기본값 8시간, 탄력근로제 적용시 12시간)
  SELECT COALESCE(overtime_threshold, 8) INTO overtime_threshold
  FROM flex_work_settings 
  WHERE NEW.record_date BETWEEN start_date AND end_date 
  AND is_active = true
  LIMIT 1;

  -- 공휴일 확인
  SELECT EXISTS(
    SELECT 1 FROM work_calendar 
    WHERE calendar_date = NEW.record_date 
    AND calendar_type = '공휴일'
  ) INTO is_holiday;

  -- 출퇴근이 모두 기록된 경우 근무시간 계산
  IF check_in_record IS NOT NULL AND check_out_record IS NOT NULL THEN
    -- 총 근무 분수 계산
    work_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
    
    -- 휴게시간 계산 (Google Apps Script 로직)
    -- 4시간(240분) 이상 근무 시 1시간 휴게
    IF work_minutes >= 240 THEN
      break_minutes := 60;
    END IF;
    
    -- 저녁식사 시 추가 1시간 휴게
    IF NEW.record_type = '퇴근' AND NEW.had_dinner = true THEN
      break_minutes := break_minutes + 60;
      work_status := '+저녁';
    END IF;

    -- 실제 근무시간 계산 (총 근무시간 - 휴게시간)
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

    -- 근무 유형별 시간 계산 (Google Apps Script 로직)
    IF day_of_week = 6 THEN -- 토요일
      -- 토요일 근무는 대체휴가 발생
      basic_hours := net_work_hours;
      overtime_hours := 0;
      work_status := '정상근무(토요일)' || work_status;
      -- substitute_hours는 별도 컬럼에서 관리
      
    ELSIF day_of_week = 0 OR is_holiday THEN -- 일요일 또는 공휴일
      -- 공휴일 근무는 보상휴가 발생
      basic_hours := net_work_hours;
      overtime_hours := 0;
      work_status := CASE 
        WHEN is_holiday THEN '정상근무(공휴일)'
        ELSE '정상근무(일요일)'
      END || work_status;
      -- compensatory_hours는 별도 계산 필요
      
    ELSE -- 평일 (월~금)
      -- ⭐ 핵심 수정 부분: Google Apps Script 로직 적용
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
    had_dinner, auto_calculated, calculated_at
  ) VALUES (
    NEW.user_id, NEW.record_date, check_in_record, check_out_record,
    basic_hours, overtime_hours, night_hours,
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
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;
CREATE TRIGGER trigger_calculate_daily_work_time
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_work_time();

-- 기존 데이터 재계산 (김경은 직원 2025년 7월 데이터)
UPDATE attendance_records 
SET updated_at = NOW() 
WHERE user_id = '550e8400-e29b-41d4-a716-446655440001' 
AND record_date BETWEEN '2025-07-01' AND '2025-07-31';

SELECT '근무시간 계산 트리거 수정 완료' as status;
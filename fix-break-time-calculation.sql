-- 휴게시간 계산 로직 수정
-- 8시간까지만 60분, 이후는 저녁식사 여부에 따라 추가 60분

CREATE OR REPLACE FUNCTION calculate_enhanced_work_time()
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
  check_in_hour INTEGER;
  dinner_detected BOOLEAN := false;
  total_work_hours DECIMAL(4,1) := 0;
BEGIN
  -- 요일 확인 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week := EXTRACT(DOW FROM NEW.record_date);
  
  -- 🆕 연차 사용일 확인 (최우선 처리)
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
        WHEN leave_hours = 4 THEN '반차(유급)'
        WHEN leave_hours < 8 THEN '시간차(유급)'
        ELSE '연차(유급)'
      END,
      true, NOW()
    )
    ON CONFLICT (user_id, work_date) 
    DO UPDATE SET
      basic_hours = EXCLUDED.basic_hours,
      work_status = EXCLUDED.work_status,
      updated_at = NOW();
    
    RETURN NEW;
  END IF;

  -- 🆕 탄력근무제 기간 확인 (동적 임계값)
  SELECT get_overtime_threshold(NEW.record_date) INTO overtime_threshold;

  -- 공휴일 확인
  SELECT EXISTS(
    SELECT 1 FROM work_calendar 
    WHERE calendar_date = NEW.record_date 
    AND calendar_type = '공휴일'
  ) INTO is_holiday;

  -- 출퇴근 기록 조회 (🆕 캡스 기록 우선순위 적용)
  SELECT 
    MIN(CASE WHEN record_type IN ('출근', '해제') THEN record_timestamp END),
    MAX(CASE WHEN record_type IN ('퇴근', '세트') THEN record_timestamp END)
  INTO check_in_record, check_out_record
  FROM attendance_records 
  WHERE user_id = NEW.user_id 
  AND record_date = NEW.record_date;

  -- 🆕 마지막 기록이 '출입'인 경우 특별 처리
  IF check_out_record IS NULL THEN
    SELECT record_timestamp INTO check_out_record
    FROM attendance_records 
    WHERE user_id = NEW.user_id 
    AND record_date = NEW.record_date
    AND record_type IN ('퇴근', '세트')
    AND record_timestamp < (
      SELECT MAX(record_timestamp) 
      FROM attendance_records 
      WHERE user_id = NEW.user_id 
      AND record_date = NEW.record_date
      AND record_type = '출입'
    )
    ORDER BY record_timestamp DESC
    LIMIT 1;
  END IF;

  -- 출퇴근이 모두 기록된 경우 근무시간 계산
  IF check_in_record IS NOT NULL AND check_out_record IS NOT NULL THEN
    work_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
    total_work_hours := work_minutes / 60.0;
    check_in_hour := EXTRACT(HOUR FROM check_in_record);
    
    -- 🆕 수정된 휴게시간 계산
    IF check_in_hour >= 12 THEN
      -- 12시 이후 출근: 휴게시간 0분 (저녁식사 제외)
      break_minutes := 0;
    ELSE
      -- 8시간까지만 단계적 휴게시간 계산
      IF total_work_hours >= 4 AND total_work_hours < 8 THEN 
        break_minutes := 30;  -- 4시간 이상 8시간 미만: 30분
      ELSIF total_work_hours >= 8 THEN 
        break_minutes := 60;  -- 8시간 이상: 60분 (최대)
      END IF;
    END IF;

    -- 🆕 저녁식사 자동 감지 (8시간 초과 + 19시 조건)
    IF total_work_hours > 8 THEN -- 8시간 초과 근무
      IF EXTRACT(HOUR FROM check_in_record) <= 19 
         AND (EXTRACT(HOUR FROM check_out_record) >= 19 
              OR check_out_record::DATE > check_in_record::DATE) THEN
        dinner_detected := true;
        -- 8시간 초과 시에만 저녁식사 시간 추가
        break_minutes := break_minutes + 60;
        work_status := '+저녁';
      END IF;
    END IF;

    net_work_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 🆕 향상된 야간근무시간 계산 (30:00 형식 지원)
    night_hours := 0;
    temp_time := check_in_record;
    WHILE temp_time < check_out_record LOOP
      current_hour := EXTRACT(HOUR FROM temp_time);
      -- 야간시간: 22시~06시 (다음날 06시 = 30시)
      IF current_hour >= 22 OR current_hour < 6 THEN
        night_hours := night_hours + 1;
      END IF;
      temp_time := temp_time + INTERVAL '1 hour';
    END LOOP;
    night_hours := ROUND(night_hours::NUMERIC, 1);

    -- 🆕 Google Apps Script 완전 로직 적용
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
      
      -- 🆕 보상휴가 정확한 가산 계산 (Google Apps Script 로직)
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
      -- 🆕 동적 초과근무 임계값 적용
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
    dinner_detected, true, NOW()
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

SELECT '✅ 휴게시간 계산 로직 수정 완료 - 8시간까지 60분, 초과시 저녁식사에 따라 +60분' as status;
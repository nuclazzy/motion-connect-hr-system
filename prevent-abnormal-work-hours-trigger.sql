-- 비정상 근무시간 방지 트리거 함수 개선

-- 1. 기존 트리거 함수에 안전 장치 추가
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
  existing_auto_calculated BOOLEAN;
  -- 새로 추가: 비정상 근무시간 감지 변수
  max_daily_work_hours CONSTANT INTEGER := 18; -- 최대 일일 근무시간 제한
  work_hours_total DECIMAL(4,1) := 0;
BEGIN
  -- 이미 수동으로 계산된 경우 건너뛰기
  SELECT auto_calculated INTO existing_auto_calculated
  FROM daily_work_summary
  WHERE user_id = NEW.user_id 
  AND work_date = NEW.record_date;
  
  IF existing_auto_calculated = false THEN
    RETURN NEW;
  END IF;

  -- 요일 확인 (0=일요일, 1=월요일, ..., 6=토요일)
  day_of_week := EXTRACT(DOW FROM NEW.record_date);

  -- 탄력근로제 설정 확인
  SELECT COALESCE(
    (SELECT fws.overtime_threshold 
     FROM flex_work_settings fws
     WHERE NEW.record_date BETWEEN fws.start_date AND fws.end_date 
     AND fws.is_active = true 
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
    work_hours_total := work_minutes / 60.0;
    
    -- 🚨 안전 장치 1: 비정상적으로 긴 근무시간 감지
    IF work_hours_total > max_daily_work_hours THEN
      -- 로그 테이블에 기록 (필요시 생성)
      INSERT INTO work_time_anomalies (
        user_id, 
        work_date, 
        check_in_time, 
        check_out_time, 
        calculated_hours,
        anomaly_type,
        created_at
      ) VALUES (
        NEW.user_id,
        NEW.record_date,
        check_in_record,
        check_out_record,
        work_hours_total,
        'excessive_work_hours',
        NOW()
      ) ON CONFLICT DO NOTHING;
      
      -- 비정상 데이터로 표시하고 계산 중단
      work_status := '⚠️ 비정상근무시간감지(' || work_hours_total::text || '시간)';
      basic_hours := 0;
      overtime_hours := 0;
      night_hours := 0;
      
      -- 수동 검토 필요 상태로 설정
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
        0, work_status, is_holiday,
        false, false, NOW() -- auto_calculated = false로 수동 검토 필요
      )
      ON CONFLICT (user_id, work_date) 
      DO UPDATE SET
        work_status = EXCLUDED.work_status,
        auto_calculated = false,
        updated_at = NOW();
      
      RETURN NEW;
    END IF;

    -- 🚨 안전 장치 2: 날짜 경계 넘어간 근무 감지
    IF check_out_record::date > check_in_record::date THEN
      -- 다음날로 넘어간 경우 경고
      work_status := '⚠️ 날짜경계초과근무';
      
      -- 특별한 경우가 아니라면 당일 23:59로 제한
      IF work_hours_total > 16 THEN -- 16시간 초과시 제한
        check_out_record := check_in_record::date + INTERVAL '23 hours 59 minutes';
        work_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
        work_status := work_status || '(시간제한적용)';
      END IF;
    END IF;
    
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
      work_status := COALESCE(work_status, '') || '+저녁';
    END IF;

    net_work_hours := ROUND(((work_minutes - break_minutes) / 60.0)::NUMERIC, 1);
    
    -- 🚨 안전 장치 3: 실근무시간 최종 확인
    IF net_work_hours > max_daily_work_hours THEN
      net_work_hours := max_daily_work_hours;
      work_status := COALESCE(work_status, '') || '(최대시간제한)';
    END IF;
    
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

    -- 주말/공휴일/평일별 계산
    IF day_of_week = 6 THEN -- 토요일
      basic_hours := net_work_hours;
      overtime_hours := 0;
      -- 토요일 대체휴가 계산
      IF net_work_hours > 8 THEN
        substitute_hours := 8 + ((net_work_hours - 8) * 1.5);
      ELSE
        substitute_hours := net_work_hours;
      END IF;
      work_status := COALESCE('정상근무(토요일)', '') || COALESCE(work_status, '');
      
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
      END || COALESCE(work_status, '');
      
    ELSE -- 평일 (월~금)
      -- 초과근무 계산 로직
      IF net_work_hours > overtime_threshold THEN
        overtime_hours := ROUND((net_work_hours - overtime_threshold)::NUMERIC, 1);
        basic_hours := overtime_threshold;
      ELSE
        basic_hours := net_work_hours;
        overtime_hours := 0;
      END IF;
      
      work_status := COALESCE('정상근무', '') || COALESCE(work_status, '');
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
    auto_calculated = EXCLUDED.auto_calculated,
    calculated_at = NOW(),
    updated_at = NOW()
  WHERE daily_work_summary.auto_calculated = true; -- 수동 계산된 것은 덮어쓰지 않음

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 근무시간 이상 감지 로그 테이블 생성 (선택사항)
CREATE TABLE IF NOT EXISTS work_time_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  calculated_hours DECIMAL(4,1),
  anomaly_type VARCHAR(50), -- 'excessive_work_hours', 'cross_date_work', 'negative_hours'
  resolution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'resolved', 'ignored'
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, work_date, anomaly_type)
);

-- 3. 이상 근무시간 모니터링 뷰
CREATE OR REPLACE VIEW work_time_anomalies_view AS
SELECT 
  u.name as employee_name,
  u.department,
  wta.work_date,
  wta.check_in_time,
  wta.check_out_time,
  wta.calculated_hours,
  wta.anomaly_type,
  wta.resolution_status,
  ru.name as resolved_by_name,
  wta.resolved_at,
  wta.notes,
  wta.created_at
FROM work_time_anomalies wta
JOIN users u ON wta.user_id = u.id
LEFT JOIN users ru ON wta.resolved_by = ru.id
ORDER BY wta.created_at DESC;

-- 4. 관리자 알림을 위한 함수 (선택사항)
CREATE OR REPLACE FUNCTION notify_abnormal_work_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- 이상 근무시간 감지시 관리자에게 알림
  -- 실제 구현에서는 이메일이나 슬랙 알림 등을 보낼 수 있음
  
  RAISE NOTICE '⚠️ 비정상 근무시간 감지: 사용자 ID %, 날짜 %, 시간 %시간', 
    NEW.user_id, NEW.work_date, NEW.calculated_hours;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 이상 감지 알림 트리거 생성
CREATE TRIGGER trigger_notify_abnormal_work_hours
  AFTER INSERT ON work_time_anomalies
  FOR EACH ROW
  EXECUTE FUNCTION notify_abnormal_work_hours();

-- 완료 메시지
SELECT 
  '🛡️ 비정상 근무시간 방지 시스템이 추가되었습니다!' as message,
  '✅ 최대 일일 근무시간 제한: 18시간' as limit_added,
  '✅ 날짜 경계 초과 근티 감지' as cross_date_detection,
  '✅ 이상 근무시간 로그 시스템' as anomaly_logging,
  '✅ 관리자 알림 시스템' as admin_notification;
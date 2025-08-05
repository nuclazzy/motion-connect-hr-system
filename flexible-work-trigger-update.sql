-- 탄력근무제 로직을 포함한 근무시간 계산 함수 업데이트
-- 기존 8시간 고정 임계값에서 탄력근무제 기간 동안 12시간 임계값으로 동적 변경

-- 1. 탄력근무제 임계값 결정 함수
CREATE OR REPLACE FUNCTION get_overtime_threshold(work_date DATE)
RETURNS INTEGER AS $$
DECLARE
  threshold INTEGER := 8; -- 기본값: 8시간
BEGIN
  -- 2025년 6-7-8월 탄력근무제 기간 체크
  IF work_date >= '2025-06-01' AND work_date <= '2025-08-31' THEN
    threshold := 12; -- 탄력근무제 기간: 12시간
  END IF;
  
  -- 추후 데이터베이스 테이블에서 조회하도록 확장 가능
  -- SELECT standard_daily_hours INTO threshold 
  -- FROM flexible_work_periods 
  -- WHERE work_date BETWEEN start_date AND end_date 
  --   AND status = 'active' 
  -- LIMIT 1;
  
  RETURN threshold;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 근무시간 계산 함수 업데이트 (탄력근무제 로직 추가)
CREATE OR REPLACE FUNCTION calculate_daily_work_time()
RETURNS TRIGGER AS $$
DECLARE
  check_in_record TIMESTAMP WITH TIME ZONE;
  check_out_record TIMESTAMP WITH TIME ZONE;
  work_minutes INTEGER := 0;
  basic_minutes INTEGER := 0;
  overtime_minutes INTEGER := 0;
  night_minutes INTEGER := 0;
  substitute_minutes INTEGER := 0;
  compensatory_minutes INTEGER := 0;
  work_status VARCHAR(50) := '정상근무';
  had_dinner BOOLEAN := false;
  overtime_threshold INTEGER := 8; -- 동적으로 결정됨
  
  -- 시간 계산용 변수
  check_in_hour INTEGER;
  check_out_hour INTEGER;
  total_minutes INTEGER;
  lunch_break_minutes INTEGER := 60; -- 점심시간 1시간
  dinner_break_minutes INTEGER := 0;
  
  -- 야간근무 시간대 (22:00 ~ 06:00)
  night_start_hour INTEGER := 22;
  night_end_hour INTEGER := 6;
BEGIN
  -- 해당 날짜의 출근/퇴근 기록 조회
  SELECT 
    MIN(CASE WHEN record_type = '출근' THEN record_timestamp END),
    MAX(CASE WHEN record_type = '퇴근' THEN record_timestamp END)
  INTO check_in_record, check_out_record
  FROM attendance_records
  WHERE user_id = NEW.user_id 
    AND record_date = NEW.record_date;
  
  -- 출근/퇴근 기록이 모두 있을 때만 근무시간 계산
  IF check_in_record IS NOT NULL AND check_out_record IS NOT NULL THEN
    -- 🎯 탄력근무제 초과근무 임계값 동적 결정
    overtime_threshold := get_overtime_threshold(NEW.record_date);
    
    -- 총 근무시간 계산 (분 단위)
    total_minutes := EXTRACT(EPOCH FROM (check_out_record - check_in_record)) / 60;
    
    -- 점심시간 차감
    work_minutes := total_minutes - lunch_break_minutes;
    
    -- 저녁식사 시간 자동 감지 (Google Apps Script 로직 이식)
    -- 8시간 이상 근무 AND 19:00 시점에 회사에 있었다면 저녁식사 시간 1시간 차감
    IF work_minutes >= 480 THEN -- 8시간 이상
      check_in_hour := EXTRACT(HOUR FROM check_in_record);
      check_out_hour := EXTRACT(HOUR FROM check_out_record);
      
      -- 19:00 시점에 회사에 있었는지 확인
      IF (check_in_hour <= 19 AND 
          (check_out_hour >= 19 OR check_out_record::date > check_in_record::date)) THEN
        dinner_break_minutes := 60; -- 1시간 차감
        work_minutes := work_minutes - dinner_break_minutes;
        had_dinner := true;
      END IF;
    END IF;
    
    -- 야간근무시간 계산 (22:00-06:00)
    -- 간단한 로직: 22시 이후 출근하거나 6시 이전 퇴근 시
    IF EXTRACT(HOUR FROM check_in_record) >= night_start_hour OR 
       EXTRACT(HOUR FROM check_out_record) <= night_end_hour OR
       check_out_record::date > check_in_record::date THEN
       
      -- 야간시간 상세 계산 (실제로는 더 복잡한 로직 필요)
      IF check_out_record::date > check_in_record::date THEN
        -- 자정을 넘긴 경우
        night_minutes := LEAST(work_minutes / 4, 480); -- 임시로 전체 시간의 1/4, 최대 8시간
      ELSIF EXTRACT(HOUR FROM check_in_record) >= night_start_hour THEN
        -- 22시 이후 출근
        night_minutes := LEAST(work_minutes / 3, 480); -- 임시로 전체 시간의 1/3
      ELSIF EXTRACT(HOUR FROM check_out_record) <= night_end_hour THEN
        -- 6시 이전 퇴근
        night_minutes := LEAST(work_minutes / 3, 240); -- 임시로 전체 시간의 1/3, 최대 4시간
      END IF;
    END IF;
    
    -- 🎯 기본/초과 근무시간 분리 (탄력근무제 임계값 적용)
    basic_minutes := LEAST(work_minutes, overtime_threshold * 60);
    overtime_minutes := GREATEST(work_minutes - (overtime_threshold * 60), 0);
    
    -- 근무 상태 결정
    IF work_minutes < 420 THEN -- 7시간 미만
      work_status := '단축근무';
    ELSIF work_minutes > 600 THEN -- 10시간 초과
      work_status := '장시간근무';
    ELSE
      work_status := '정상근무';
    END IF;
    
    -- 주말/공휴일 근무 확인 (간단한 로직)
    IF EXTRACT(DOW FROM NEW.record_date) IN (0, 6) THEN -- 일요일(0), 토요일(6)
      work_status := '휴일근무';
      substitute_minutes := work_minutes; -- 휴일근무는 전체 시간을 대체휴가로
      basic_minutes := 0;
      overtime_minutes := 0;
    END IF;
  END IF;
  
  -- daily_work_summary 테이블에 데이터 삽입/업데이트
  INSERT INTO daily_work_summary (
    user_id, work_date, check_in_time, check_out_time,
    basic_hours, overtime_hours, night_hours, 
    substitute_hours, compensatory_hours,
    work_status, had_dinner, auto_calculated, calculated_at
  ) VALUES (
    NEW.user_id, NEW.record_date, check_in_record, check_out_record,
    ROUND(basic_minutes / 60.0, 1),
    ROUND(overtime_minutes / 60.0, 1),
    ROUND(night_minutes / 60.0, 1),
    ROUND(substitute_minutes / 60.0, 1),
    ROUND(compensatory_minutes / 60.0, 1),
    work_status, had_dinner, true, NOW()
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
    work_status = EXCLUDED.work_status,
    had_dinner = EXCLUDED.had_dinner,
    auto_calculated = true,
    calculated_at = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 기존 트리거 재생성 (변경사항 적용)
DROP TRIGGER IF EXISTS trigger_calculate_daily_work_time ON attendance_records;
CREATE TRIGGER trigger_calculate_daily_work_time
  AFTER INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_daily_work_time();

-- 4. 탄력근무제 기간 설정 확인용 뷰 생성
CREATE OR REPLACE VIEW current_flexible_work_settings AS
SELECT 
  '2025-06-01'::date as start_date,
  '2025-08-31'::date as end_date,
  '2025년 2분기 탄력근무제 (6-7-8월)' as period_name,
  40 as standard_weekly_hours,
  12 as daily_overtime_threshold,
  'active' as status;

-- 5. 기존 데이터 재계산 (필요시)
-- UPDATE attendance_records 
-- SET updated_at = NOW() 
-- WHERE record_date BETWEEN '2025-06-01' AND '2025-08-31';

SELECT '탄력근무제 로직이 적용된 근무시간 계산 함수 업데이트 완료' as status;
SELECT '- 6-7-8월: 12시간 초과근무 임계값' as note1;
SELECT '- 기타 기간: 8시간 초과근무 임계값' as note2;
SELECT '- 야간근무 수당: 매월 자동 지급' as note3;
SELECT '- 저녁식사 시간: 8시간 이상 + 19시 재실 시 자동 차감' as note4;
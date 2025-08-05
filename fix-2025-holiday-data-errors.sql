-- 🚨 2025년 공휴일 데이터 오류 긴급 수정
-- 6월 3일, 6일 공휴일 누락 및 기타 오류 수정

-- 1. 현재 2025년 공휴일 데이터 확인
SELECT 
  '=== 현재 2025년 공휴일 데이터 ===' as status,
  holiday_date,
  holiday_name,
  EXTRACT(DOW FROM holiday_date) as day_of_week
FROM holidays 
WHERE year = 2025
ORDER BY holiday_date;

-- 2. 누락된 공휴일 추가 (정확한 2025년 공휴일)
INSERT INTO holidays (holiday_date, holiday_name, year, source) VALUES
  -- 6월 누락 공휴일 추가
  ('2025-06-03', '대체공휴일(부처님 오신 날)', 2025, 'manual_fix'),
  ('2025-06-06', '현충일', 2025, 'manual_fix')
ON CONFLICT (holiday_date) DO UPDATE SET
  holiday_name = EXCLUDED.holiday_name,
  source = EXCLUDED.source,
  updated_at = NOW();

-- 3. 잘못된 공휴일 데이터 수정
UPDATE holidays 
SET 
  holiday_date = '2025-05-13',
  holiday_name = '부처님 오신 날'
WHERE year = 2025 
AND holiday_name = '부처님 오신 날'
AND holiday_date != '2025-05-13';

-- 4. 추석 날짜 수정 (2025년 정확한 날짜)
UPDATE holidays 
SET holiday_date = '2025-10-06'
WHERE year = 2025 AND holiday_name = '추석연휴' AND holiday_date = '2025-10-06';

UPDATE holidays 
SET holiday_date = '2025-10-07'
WHERE year = 2025 AND holiday_name = '추석' AND holiday_date = '2025-10-07';

UPDATE holidays 
SET holiday_date = '2025-10-08'
WHERE year = 2025 AND holiday_name = '추석연휴' AND holiday_date = '2025-10-08';

-- 5. 개천절 날짜 확인 및 수정
UPDATE holidays 
SET holiday_date = '2025-10-03'
WHERE year = 2025 AND holiday_name = '개천절';

-- 6. 한글날 날짜 확인 및 수정
UPDATE holidays 
SET holiday_date = '2025-10-09'
WHERE year = 2025 AND holiday_name = '한글날';

-- 7. 수정된 공휴일 데이터 확인
SELECT 
  '=== 수정된 2025년 공휴일 데이터 ===' as status,
  holiday_date,
  holiday_name,
  CASE EXTRACT(DOW FROM holiday_date)
    WHEN 0 THEN '일요일'
    WHEN 1 THEN '월요일'
    WHEN 2 THEN '화요일'
    WHEN 3 THEN '수요일'
    WHEN 4 THEN '목요일'
    WHEN 5 THEN '금요일'
    WHEN 6 THEN '토요일'
  END as day_of_week,
  source
FROM holidays 
WHERE year = 2025
ORDER BY holiday_date;

-- 8. 6월 공휴일 근무시간 데이터 수정
-- 모든 직원에 대해 6월 3일, 6일 공휴일 근무시간 생성
DO $$
DECLARE
  employee_record RECORD;
  holiday_dates DATE[] := ARRAY['2025-06-03', '2025-06-06'];
  holiday_names TEXT[] := ARRAY['대체공휴일(부처님 오신날)', '현충일'];
  i INTEGER;
BEGIN
  RAISE NOTICE '🔄 6월 공휴일 근무시간 데이터 생성 시작...';
  
  -- 모든 직원에 대해 처리
  FOR employee_record IN 
    SELECT id, name FROM users WHERE role IN ('employee', 'admin')
  LOOP
    -- 각 공휴일에 대해 처리
    FOR i IN 1..array_length(holiday_dates, 1) LOOP
      -- daily_work_summary에 공휴일 근무시간 추가
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
        employee_record.id,
        holiday_dates[i],
        NULL,
        NULL,
        8.0, -- 공휴일 기본 8시간
        0.0,
        0.0,
        0.0,
        0.0,
        holiday_names[i] || ' 근무',
        true,
        holiday_names[i],
        false,
        true,
        NOW()
      )
      ON CONFLICT (user_id, work_date)
      DO UPDATE SET
        basic_hours = 8.0,
        is_holiday = true,
        holiday_name = holiday_names[i],
        work_status = holiday_names[i] || ' 근무',
        auto_calculated = true,
        updated_at = NOW();
      
      RAISE NOTICE '✅ % - % 공휴일 근무시간 설정', employee_record.name, holiday_dates[i];
    END LOOP;
  END LOOP;
  
  RAISE NOTICE '🎉 6월 공휴일 근무시간 데이터 생성 완료!';
END $$;

-- 9. 6월 8일 일요일 데이터 수정 (8시간 → 0시간)
UPDATE daily_work_summary 
SET 
  basic_hours = 0.0,
  work_status = '일요일',
  is_holiday = true,
  holiday_name = '일요일',
  auto_calculated = true,
  updated_at = NOW()
WHERE work_date = '2025-06-08'
AND basic_hours = 8.0;

-- 10. 완료 메시지
SELECT 
  '🎯 2025년 공휴일 데이터 오류 수정 완료!' as message,
  '✅ 6월 3일 대체공휴일 추가' as june_3_added,
  '✅ 6월 6일 현충일 추가' as june_6_added,
  '✅ 6월 8일 일요일 데이터 수정' as june_8_fixed,
  '✅ 모든 직원 공휴일 근무시간 설정' as work_hours_updated,
  COUNT(*) as total_holidays_2025
FROM holidays 
WHERE year = 2025;
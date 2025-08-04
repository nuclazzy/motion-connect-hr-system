-- ===============================================
-- leave_days 데이터를 users 테이블로 마이그레이션
-- 위의 스키마 업데이트 완료 후 실행
-- ===============================================

-- 1. 연차 계산 함수 (입사일 기준)
CREATE OR REPLACE FUNCTION calculate_annual_leave(hire_date_input DATE)
RETURNS INTEGER AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
    hire_year INTEGER := EXTRACT(YEAR FROM hire_date_input);
    today_year INTEGER := EXTRACT(YEAR FROM today_date);
    calendar_years_passed INTEGER := today_year - hire_year;
    result INTEGER := 0;
BEGIN
    -- 입사 1년차 (입사한 해)
    IF calendar_years_passed = 0 THEN
        result := EXTRACT(MONTH FROM today_date) - EXTRACT(MONTH FROM hire_date_input);
        IF EXTRACT(DAY FROM today_date) >= EXTRACT(DAY FROM hire_date_input) THEN
            result := result + 1;
        END IF;
        RETURN GREATEST(0, result);
    END IF;
    
    -- 입사 2년차 (입사 다음 해)
    IF calendar_years_passed = 1 THEN
        DECLARE
            end_of_hire_year DATE := DATE(hire_year || '-12-31');
            days_in_first_year INTEGER := end_of_hire_year - hire_date_input + 1;
            pro_rated_leave INTEGER := CEIL((days_in_first_year::NUMERIC / 365) * 15);
            month_bonus INTEGER := EXTRACT(MONTH FROM hire_date_input) - 1;
        BEGIN
            RETURN pro_rated_leave + month_bonus;
        END;
    END IF;
    
    -- 입사 3년차 (입사 2년 후)
    IF calendar_years_passed = 2 THEN
        RETURN 15;
    END IF;
    
    -- 입사 4년차 이상 (입사 3년 후부터)
    IF calendar_years_passed > 2 THEN
        DECLARE
            additional_leave INTEGER := FLOOR((calendar_years_passed - 1) / 2);
        BEGIN
            RETURN LEAST(15 + additional_leave, 25);
        END;
    END IF;
    
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 leave_days 데이터를 users 테이블로 마이그레이션
UPDATE users 
SET 
    annual_days = calculate_annual_leave(hire_date::DATE),
    used_annual_days = COALESCE((
        SELECT (leave_types->>'used_annual_days')::INTEGER 
        FROM leave_days 
        WHERE leave_days.user_id = users.id
    ), 0),
    sick_days = COALESCE((
        SELECT (leave_types->>'sick_days')::INTEGER 
        FROM leave_days 
        WHERE leave_days.user_id = users.id
    ), 60),
    used_sick_days = COALESCE((
        SELECT (leave_types->>'used_sick_days')::INTEGER 
        FROM leave_days 
        WHERE leave_days.user_id = users.id
    ), 0),
    substitute_leave_hours = COALESCE((
        SELECT (leave_types->>'substitute_leave_hours')::NUMERIC 
        FROM leave_days 
        WHERE leave_days.user_id = users.id
    ), 0),
    compensatory_leave_hours = COALESCE((
        SELECT (leave_types->>'compensatory_leave_hours')::NUMERIC 
        FROM leave_days 
        WHERE leave_days.user_id = users.id
    ), 0);

-- 3. 마이그레이션 결과 확인
SELECT 
    name,
    email,
    hire_date,
    annual_days,
    used_annual_days,
    sick_days,
    used_sick_days,
    substitute_leave_hours,
    compensatory_leave_hours,
    (annual_days - used_annual_days) as remaining_annual,
    (sick_days - used_sick_days) as remaining_sick
FROM users 
ORDER BY hire_date;

-- 4. 특정 사용자 확인 (김경은)
SELECT 
    name,
    email,
    hire_date,
    calculate_annual_leave(hire_date::DATE) as calculated_annual,
    annual_days,
    used_annual_days,
    substitute_leave_hours,
    compensatory_leave_hours
FROM users 
WHERE email = 'ke.kim@motionsense.co.kr';

-- 5. 임시 함수 삭제 (마이그레이션 완료 후)
-- DROP FUNCTION IF EXISTS calculate_annual_leave(DATE);
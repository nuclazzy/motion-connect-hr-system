-- ===============================================
-- 마이그레이션 문제 디버깅
-- ===============================================

-- 1. 모든 사용자와 leave_days 매칭 상태 확인
SELECT 
    u.name,
    u.email,
    u.hire_date,
    CASE WHEN ld.user_id IS NOT NULL THEN '✅ 있음' ELSE '❌ 없음' END as leave_days_존재,
    ld.leave_types
FROM users u
LEFT JOIN leave_days ld ON u.id = ld.user_id
ORDER BY u.hire_date;

-- 2. leave_days 테이블의 모든 데이터 확인
SELECT 
    ld.user_id,
    u.name,
    u.email,
    ld.leave_types,
    ld.created_at,
    ld.updated_at
FROM leave_days ld
LEFT JOIN users u ON ld.user_id = u.id
ORDER BY ld.created_at;

-- 3. leave_days가 없는 사용자들 확인
SELECT 
    u.name,
    u.email,
    u.hire_date,
    calculate_annual_leave(u.hire_date::DATE) as should_be_annual_days
FROM users u
LEFT JOIN leave_days ld ON u.id = ld.user_id
WHERE ld.user_id IS NULL
ORDER BY u.hire_date;

-- 4. 마이그레이션 결과 확인 (현재 상태)
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
    CASE 
        WHEN annual_days > 0 THEN '✅ 마이그레이션됨'
        ELSE '❌ 마이그레이션 안됨'
    END as migration_status
FROM users 
ORDER BY hire_date;

-- 5. leave_days가 없는 사용자들을 위한 기본값 설정
UPDATE users 
SET 
    annual_days = calculate_annual_leave(hire_date::DATE),
    used_annual_days = 0,
    sick_days = 60,
    used_sick_days = 0,
    substitute_leave_hours = 0,
    compensatory_leave_hours = 0
WHERE id IN (
    SELECT u.id 
    FROM users u
    LEFT JOIN leave_days ld ON u.id = ld.user_id
    WHERE ld.user_id IS NULL
);

-- 6. 최종 결과 확인
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
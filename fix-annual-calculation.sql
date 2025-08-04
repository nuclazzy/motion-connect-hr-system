-- ===============================================
-- 연차 자동 계산으로 수정
-- ===============================================

-- 1. 모든 사용자의 연차를 입사일 기준으로 재계산
UPDATE users 
SET annual_days = calculate_annual_leave(hire_date::DATE)
WHERE hire_date IS NOT NULL;

-- 2. 계산 결과 확인
SELECT 
    name,
    email,
    hire_date,
    EXTRACT(YEAR FROM CURRENT_DATE) - EXTRACT(YEAR FROM hire_date::DATE) as 근속년수,
    calculate_annual_leave(hire_date::DATE) as 계산된_연차,
    annual_days as 현재_연차,
    used_annual_days,
    (annual_days - used_annual_days) as 잔여_연차
FROM users 
ORDER BY hire_date;

-- 3. 특별한 경우들 확인
-- 김성호의 경우 병가가 5일로 특별 설정되어 있는지 확인
SELECT 
    name,
    email,
    hire_date,
    annual_days,
    sick_days,
    '특별한 케이스인지 확인' as note
FROM users 
WHERE email = 'lewis@motionsense.co.kr';

-- 4. 연차 계산 공식 확인을 위한 테스트
SELECT 
    '2015-08-01'::DATE as 입사일,
    calculate_annual_leave('2015-08-01'::DATE) as 계산된_연차,
    '2025년 기준 김성호 연차' as 설명
UNION ALL
SELECT 
    '2020-06-24'::DATE as 입사일,
    calculate_annual_leave('2020-06-24'::DATE) as 계산된_연차,
    '2025년 기준 김경은 연차' as 설명
UNION ALL
SELECT 
    '2024-06-01'::DATE as 입사일,
    calculate_annual_leave('2024-06-01'::DATE) as 계산된_연차,
    '2025년 기준 허지현 연차' as 설명;
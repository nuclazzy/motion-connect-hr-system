-- 연차 촉진 대상자 미리 확인
-- 기준: 연차 50% 이상 미사용자

SELECT 
    u.name as "직원명",
    u.department as "부서",
    u.position as "직책",
    CAST(ld.leave_types->'annual'->>'total' AS numeric) as "총연차",
    CAST(ld.leave_types->'annual'->>'used' AS numeric) as "사용연차",
    CAST((ld.leave_types->'annual'->>'total')::numeric - (ld.leave_types->'annual'->>'used')::numeric AS numeric) as "잔여연차",
    ROUND(
        (CAST((ld.leave_types->'annual'->>'total')::numeric - (ld.leave_types->'annual'->>'used')::numeric AS numeric) 
        / CAST(ld.leave_types->'annual'->>'total' AS numeric)) * 100, 1
    ) as "미사용률(%)",
    CASE 
        WHEN (CAST(ld.leave_types->'annual'->>'total' AS numeric) - CAST(ld.leave_types->'annual'->>'used' AS numeric)) 
             >= (CAST(ld.leave_types->'annual'->>'total' AS numeric) * 0.5)
        THEN '촉진대상 ⚠️'
        ELSE '정상'
    END as "촉진여부"
FROM users u
JOIN leave_days ld ON u.id = ld.user_id
WHERE u.email != 'admin@motionsense.co.kr'
ORDER BY 
    (CAST((ld.leave_types->'annual'->>'total')::numeric - (ld.leave_types->'annual'->>'used')::numeric AS numeric) 
    / CAST(ld.leave_types->'annual'->>'total' AS numeric)) DESC;
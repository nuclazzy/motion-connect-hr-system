-- 허지현의 6월 11일 출퇴근 기록 확인
SELECT 
    ar.record_date,
    ar.record_type,
    ar.record_time,
    ar.record_timestamp,
    ar.is_manual,
    ar.notes
FROM attendance_records ar
JOIN users u ON ar.user_id = u.id
WHERE u.name = '허지현'
AND ar.record_date = '2025-06-11'
ORDER BY ar.record_timestamp;

-- 허지현의 6월 11일 일일 근무 요약 확인
SELECT 
    dws.*,
    u.name
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '허지현'
AND dws.work_date = '2025-06-11';

-- 허지현의 6월 전체 근무 요약 확인
SELECT 
    work_date,
    check_in_time,
    check_out_time,
    basic_hours,
    overtime_hours,
    night_hours,
    substitute_hours,
    compensatory_hours,
    work_status
FROM daily_work_summary dws
JOIN users u ON dws.user_id = u.id
WHERE u.name = '허지현'
AND work_date BETWEEN '2025-06-01' AND '2025-06-30'
ORDER BY work_date;

-- 허지현의 대체/보상휴가 확인
SELECT 
    u.name,
    u.substitute_leave_hours,
    u.compensatory_leave_hours
FROM users u
WHERE u.name = '허지현';
EOF < /dev/null
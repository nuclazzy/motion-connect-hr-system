-- 테스트 계정 생성 스크립트
-- Motion Connect HR System - 로컬 개발용 테스트 계정

-- 테스트 관리자 계정 생성
INSERT INTO public.users (
    email, password_hash, name, role, employee_id, work_type, department, position, 
    hire_date, dob, phone, address
) VALUES 
    -- 테스트 관리자 - bcrypt 해시: 'test123'
    ('admin@test.com', '$2b$10$T5q8g8gPfJmAb9zO2wHlhO6mKYRJ4rCNNVdKqXQnzOYj8S2Y4c4kC', '테스트 관리자', 'admin', 'ADM001', '정규직', '테스트팀', '테스트 관리자', '2024-01-01', '1990-01-01', '010-1111-1111', '서울시 테스트구 테스트로 123'),
    
    -- 테스트 직원 계정들 - bcrypt 해시: 'test123'  
    ('employee1@test.com', '$2b$10$T5q8g8gPfJmAb9zO2wHlhO6mKYRJ4rCNNVdKqXQnzOYj8S2Y4c4kC', '테스트 직원1', 'user', 'EMP001', '정규직', '개발팀', '개발자', '2024-01-15', '1995-03-15', '010-2222-2222', '서울시 강남구 테스트로 456'),
    ('employee2@test.com', '$2b$10$T5q8g8gPfJmAb9zO2wHlhO6mKYRJ4rCNNVdKqXQnzOYj8S2Y4c4kC', '테스트 직원2', 'user', 'EMP002', '정규직', '디자인팀', '디자이너', '2024-02-01', '1992-07-20', '010-3333-3333', '서울시 서초구 테스트로 789'),
    ('employee3@test.com', '$2b$10$T5q8g8gPfJmAb9zO2wHlhO6mKYRJ4rCNNVdKqXQnzOYj8S2Y4c4kC', '테스트 직원3', 'user', 'EMP003', '계약직', '마케팅팀', '마케터', '2024-03-01', '1988-11-10', '010-4444-4444', '경기도 성남시 테스트로 012');

-- 테스트 계정들의 휴가 데이터 생성
INSERT INTO public.leave_days (user_id, leave_types) 
SELECT 
    u.id,
    CASE 
        WHEN u.email = 'admin@test.com' THEN 
            '{"annual": {"total": 20, "used": 0}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'employee1@test.com' THEN 
            '{"annual": {"total": 15, "used": 3}, "sick": {"total": 60, "used": 1}}'::jsonb
        WHEN u.email = 'employee2@test.com' THEN 
            '{"annual": {"total": 15, "used": 5}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'employee3@test.com' THEN 
            '{"annual": {"total": 12, "used": 2}, "sick": {"total": 60, "used": 2}}'::jsonb
        ELSE 
            '{"annual": {"total": 15, "used": 0}, "sick": {"total": 60, "used": 0}}'::jsonb
    END
FROM users u
WHERE u.email IN ('admin@test.com', 'employee1@test.com', 'employee2@test.com', 'employee3@test.com');

-- 테스트 서식 신청 데이터 (샘플)
INSERT INTO public.form_requests (
    user_id, form_type, status, request_data, submitted_at
)
SELECT 
    u.id,
    '휴가 신청서',
    'pending',
    '{"휴가형태": "연차", "시작일": "2024-08-15", "종료일": "2024-08-16", "사유": "개인 용무", "전달사항": "업무 인수인계 완료"}'::jsonb,
    NOW()
FROM users u 
WHERE u.email = 'employee1@test.com';

INSERT INTO public.form_requests (
    user_id, form_type, status, request_data, submitted_at
)
SELECT 
    u.id,
    '재직증명서',
    'approved',
    '{"제출처": "은행 대출 신청용"}'::jsonb,
    NOW() - INTERVAL '2 days'
FROM users u 
WHERE u.email = 'employee2@test.com';

-- 테스트 계정 생성 완료 확인
SELECT 
    '🎯 테스트 계정 생성 완료!' as status,
    '👤 관리자: admin@test.com / test123' as admin_account,
    '👥 직원 계정들: employee1@test.com, employee2@test.com, employee3@test.com / test123' as employee_accounts,
    '📊 총 ' || COUNT(*) || '개 테스트 계정 생성됨' as summary
FROM users 
WHERE email LIKE '%@test.com';
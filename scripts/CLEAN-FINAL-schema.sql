-- Motion Connect HR System - 깔끔한 새 데이터베이스
-- 새로운 Supabase 프로젝트용 (lnmgwtljhctrrnezehmw)
-- 2025-07-14 - 완전 초기화 후 재구축

-- ========================================
-- 1단계: Extensions 및 기본 설정
-- ========================================

-- 1-1. 필수 Extensions 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================================
-- 2단계: 핵심 테이블 스키마 생성 (5개 테이블만)
-- ========================================

-- 2-1. Users table (직원 마스터 데이터) - HR 시스템 핵심
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    work_type VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    dob DATE,
    phone VARCHAR(20),
    address TEXT,
    hire_date DATE NOT NULL,
    termination_date DATE,
    contract_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2-2. Leave days table (휴가 관리) - 법적 컴플라이언스 필수
CREATE TABLE leave_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    leave_types JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2-3. Form requests table (서식 신청 워크플로) - 업무 프로세스 관리
CREATE TABLE form_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    form_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    request_data JSONB,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2-4. Documents table (자료실 메타데이터) - 문서 접근 제어
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    link TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2-5. Leave promotions table (연차 촉진) - 근로기준법 제61조 컴플라이언스
CREATE TABLE leave_promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id VARCHAR(50) NOT NULL,
    promotion_type VARCHAR(50) NOT NULL,
    target_year INTEGER NOT NULL,
    promotion_stage VARCHAR(20) NOT NULL CHECK (promotion_stage IN ('first', 'second', 'hire_based')),
    remaining_days DECIMAL(4,1) NOT NULL,
    promotion_date DATE NOT NULL,
    deadline DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'responded', 'completed', 'expired')),
    employee_response JSONB DEFAULT '{}',
    company_designation JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3단계: 성능 최적화 인덱스
-- ========================================

-- Users 테이블 인덱스
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department);

-- Leave days 인덱스
CREATE INDEX idx_leave_days_user_id ON leave_days(user_id);

-- Form requests 인덱스
CREATE INDEX idx_form_requests_user_id ON form_requests(user_id);
CREATE INDEX idx_form_requests_status ON form_requests(status);
CREATE INDEX idx_form_requests_submitted_at ON form_requests(submitted_at);

-- Documents 인덱스
CREATE INDEX idx_documents_name ON documents(name);

-- Leave promotions 인덱스
CREATE INDEX idx_leave_promotions_employee_id ON leave_promotions(employee_id);
CREATE INDEX idx_leave_promotions_target_year ON leave_promotions(target_year);
CREATE INDEX idx_leave_promotions_status ON leave_promotions(status);

-- ========================================
-- 4단계: RLS (Row Level Security) 정책
-- ========================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_promotions ENABLE ROW LEVEL SECURITY;

-- Users 정책: 자신의 데이터만 보기, 관리자는 모든 데이터
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all users" ON users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Leave days 정책
CREATE POLICY "Users can view their own leave data" ON leave_days
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all leave data" ON leave_days
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Form requests 정책
CREATE POLICY "Users can view their own form requests" ON form_requests
    FOR SELECT USING (user_id::text = auth.uid()::text OR EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

CREATE POLICY "Users can create their own form requests" ON form_requests
    FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "Admins can manage all form requests" ON form_requests
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Documents 정책: 모든 사용자가 문서 조회 가능
CREATE POLICY "All users can view documents" ON documents
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage documents" ON documents
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- Leave promotions 정책: 관리자만 관리
CREATE POLICY "Admins can manage leave promotions" ON leave_promotions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'
    ));

-- ========================================
-- 5단계: 자동 업데이트 트리거
-- ========================================

-- Updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- 모든 테이블에 updated_at 트리거 추가
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_days_updated_at BEFORE UPDATE ON leave_days
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_requests_updated_at BEFORE UPDATE ON form_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_promotions_updated_at BEFORE UPDATE ON leave_promotions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6단계: 로컬 데이터 마이그레이션 (올바른 bcrypt 해시 포함)
-- ========================================

-- 6-1. 직원 데이터 삽입 (올바른 bcrypt 해시 포함)
INSERT INTO users (
    email, password_hash, name, role, employee_id, work_type, department, position, 
    hire_date, dob, phone, address, termination_date, contract_end_date
) VALUES 
    -- 김성호 (lewis) - 실제 관리자 - bcrypt 해시: '0000'
    ('lewis@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '김성호', 'admin', '1', '정규직', '경영팀', '대표', '2015-08-01', '1984-08-08', '010-2726-2491', '서울시 성북구 북악산로 1길 43, 스카이힐스테이 101호', NULL, NULL),
    
    -- 직원들 (로컬 시스템의 정확한 데이터) - 모두 bcrypt 해시: '0000'
    ('ke.kim@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '김경은', 'user', '10', '정규직', '편집팀', '팀장', '2020-06-24', '1984-06-24', '010-8704-6066', '서울시 성북구 동선동2가 115번지 블루빌 502b호', NULL, NULL),
    ('jw.han@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '한종운', 'user', '15', '정규직', '촬영팀', '팀장', '2020-12-15', '1987-04-07', '010-4565-1330', '경기도 의정부시 녹양동 청구아파트 101동 1307호', NULL, NULL),
    ('ht.no@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '노현태', 'user', '17', '정규직', '편집팀', 'PD', '2021-02-01', '1998-02-09', '010-5502-5336', '서울특별시 노원구 동일로207길 186, 107동 1402호(학여울청구아파트)', '2025-06-30', NULL),
    ('jh.park@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '박종호', 'user', '19', '정규직', '편집팀', 'PD', '2022-02-01', '1990-06-28', '010-3325-5374', '서울시 서대문구 통일로 39다길 38', '2025-05-31', NULL),
    ('jh.lee@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '이재혁', 'user', '23', '정규직', '촬영팀', '촬영감독', '2023-12-01', '1997-12-11', '010-4454-6307', '경기도 의정부시 평화로 363-7 601동 2005호', NULL, NULL),
    ('jh.heo@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '허지현', 'user', '24', '정규직', '행사기획팀', '매니저', '2024-06-01', '1995-02-13', '010-2025-9028', '서울시 종로구 창경궁로 35나길 10 혜화빌라트 302호', NULL, NULL),
    ('hs.ryoo@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '유희수', 'user', '25', '정규직', '촬영팀', '촬영감독', '2024-07-01', '1998-01-19', '010-2672-2284', '서울특별시 성북구 동소문로 11길 27-4 송산맨션 102호', NULL, NULL),
    ('sr.yun@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '윤서랑', 'user', '27', '정규직', '행사기획팀', '디자이너', '2024-10-28', '1994-11-02', '010-4502-6842', '경기도 남양주시 식송2로 43 202호', NULL, NULL);

-- 6-2. 휴가 데이터 삽입 (정리된 버전)
INSERT INTO leave_days (user_id, leave_types) 
SELECT 
    u.id,
    CASE 
        WHEN u.email = 'lewis@motionsense.co.kr' THEN 
            '{"annual": {"total": 19, "used": 0}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'ke.kim@motionsense.co.kr' THEN 
            '{"annual": {"total": 17, "used": 7.5}, "sick": {"total": 60, "used": 1.5}}'::jsonb
        WHEN u.email = 'jw.han@motionsense.co.kr' THEN 
            '{"annual": {"total": 17, "used": 9}, "sick": {"total": 60, "used": 1}}'::jsonb
        WHEN u.email = 'ht.no@motionsense.co.kr' THEN 
            '{"annual": {"total": 16, "used": 0}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'jh.park@motionsense.co.kr' THEN 
            '{"annual": {"total": 16, "used": 0}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'jh.lee@motionsense.co.kr' THEN 
            '{"annual": {"total": 15, "used": 9}, "sick": {"total": 60, "used": 1}}'::jsonb
        WHEN u.email = 'jh.heo@motionsense.co.kr' THEN 
            '{"annual": {"total": 14, "used": 9}, "sick": {"total": 60, "used": 0}}'::jsonb
        WHEN u.email = 'hs.ryoo@motionsense.co.kr' THEN 
            '{"annual": {"total": 14, "used": 14}, "sick": {"total": 60, "used": 2}}'::jsonb
        WHEN u.email = 'sr.yun@motionsense.co.kr' THEN 
            '{"annual": {"total": 12, "used": 8}, "sick": {"total": 60, "used": 1}}'::jsonb
        ELSE 
            '{"annual": {"total": 15, "used": 0}, "sick": {"total": 5, "used": 0}}'::jsonb
    END
FROM users u;

-- 6-3. 회사 문서들 (실제 Google Drive/Docs 링크)
INSERT INTO documents (name, link, upload_date) VALUES 
    ('취업규칙', 'https://drive.google.com/file/d/1VgJqx56DJCx5_QzllK8X3WZnnhRaFrqO/view', '2025-07-06 10:55:05'),
    ('회사소개서', 'https://docs.google.com/presentation/d/1UT_t0VKWq7rLIk2eUHd8uZBr0gjfWiv_PbCGGL02QVY/present', '2025-07-08 05:45:52'),
    ('사업자등록증 사본', 'https://drive.google.com/file/d/1--Blc_JlSv4a6k0HHNvaUkI5cOcK_DBY/view?usp=share_link', '2025-07-08 05:46:21'),
    ('통장 사본', 'https://drive.google.com/file/d/0B-JERjbAWjRVSW1CV1p0NS1CbUU/view?usp=share_link&resourcekey=0-6fdc2pD6Het6UFfJN7J_tA', '2025-07-08 05:46:38'),
    ('회사 공용 서비스 계정 모음', 'https://docs.google.com/document/d/1Y8jlxmxkVXjrrHUJkHS3SFUp4Ppk-9E25j5KTG8krAI/edit?usp=sharing', '2025-07-08 05:46:54'),
    ('촬영 스튜디오 DB', 'https://docs.google.com/spreadsheets/d/1cTNJZp7RH6g7A2SxwpaWEnKmvO90uaNaBxGfRS8_TAk/edit?gid=0#gid=0', '2025-07-08 05:47:20'),
    ('스트리밍 서비스 가이드북', 'https://docs.google.com/presentation/d/1i0y0MXsaN_vyaaUudK5wMhkUrdA6qckvnyF3VY-xltc/present', '2025-07-08 05:47:40'),
    ('모슐랭가이드 (스프레드시트)', 'https://docs.google.com/spreadsheets/d/1Kt6LLuVnFKkcBPsvy-rKmaMB1f_iGtUl02EFhbh7Bps/edit?usp=sharing', '2025-07-08 05:48:02'),
    ('모슐랭가이드 (지도보기)', 'https://naver.me/xJGHatFM', '2025-07-08 05:48:25');

-- 6-4. 연차 촉진 시스템 데이터 (실제 직원 연차 현황 기반)
-- 근로기준법 제61조: 연차 미사용자에 대한 촉진 의무
-- 기준: 연간 연차의 50% 이상 미사용 시 촉진 대상

INSERT INTO leave_promotions (
    employee_id, promotion_type, target_year, promotion_stage, 
    remaining_days, promotion_date, deadline, status, employee_response, company_designation
)
SELECT 
    u.email as employee_id,
    'annual_promotion' as promotion_type,
    2024 as target_year,
    'first' as promotion_stage,
    CAST((ld.leave_types->'annual'->>'total')::numeric - (ld.leave_types->'annual'->>'used')::numeric AS DECIMAL(4,1)) as remaining_days,
    CURRENT_DATE as promotion_date,
    CURRENT_DATE + INTERVAL '30 days' as deadline,
    'pending' as status,
    '{"submitted": false, "submission_date": null, "planned_dates": [], "message": ""}'::jsonb as employee_response,
    '{"designated": false, "designated_dates": [], "designation_date": null}'::jsonb as company_designation
FROM users u
JOIN leave_days ld ON u.id = ld.user_id
WHERE 
    -- 연차 총 일수가 10일 이상이고
    CAST(ld.leave_types->'annual'->>'total' AS numeric) >= 10
    AND
    -- 미사용 연차가 총 연차의 50% 이상인 경우
    (CAST(ld.leave_types->'annual'->>'total' AS numeric) - CAST(ld.leave_types->'annual'->>'used' AS numeric)) 
    >= (CAST(ld.leave_types->'annual'->>'total' AS numeric) * 0.5);

-- ========================================
-- 7단계: 최종 검증 및 확인
-- ========================================

-- 7-1. 테이블별 데이터 건수 확인
SELECT 'Users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Leave Days' as table_name, COUNT(*) as count FROM leave_days
UNION ALL
SELECT 'Documents' as table_name, COUNT(*) as count FROM documents
UNION ALL
SELECT 'Form Requests' as table_name, COUNT(*) as count FROM form_requests
UNION ALL
SELECT 'Leave Promotions' as table_name, COUNT(*) as count FROM leave_promotions;

-- 7-2. 비밀번호 해시 검증
SELECT 
    email,
    name,
    role,
    CASE 
        WHEN password_hash LIKE '$2b$%' THEN 'Valid bcrypt hash ✅'
        ELSE 'Invalid hash ❌'
    END as hash_status,
    LENGTH(password_hash) as hash_length
FROM users 
ORDER BY email;

-- 7-3. 완료 메시지
SELECT '🎉 깔끔한 새 Motion Connect HR 데이터베이스 구축 완료!' as status,
       '🔑 관리자 로그인: lewis@motionsense.co.kr / 0000' as admin_login,
       '📊 ' || (SELECT COUNT(*) FROM users) || '명 직원, ' || 
       (SELECT COUNT(*) FROM documents) || '개 문서, bcrypt 해시 완료' as summary,
       '✨ 새로운 프로젝트로 깔끔하게 시작!' as message;
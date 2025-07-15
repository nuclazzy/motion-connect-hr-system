-- Motion Connect HR System - Clean Database Schema
-- Version: 2025-07-15

-- Step 1: Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Create core tables
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

CREATE TABLE leave_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    leave_types JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    link TEXT NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Step 3: Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_form_requests_user_id ON form_requests(user_id);
CREATE INDEX idx_form_requests_status ON form_requests(status);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_promotions ENABLE ROW LEVEL SECURITY;

-- Step 5: Define RLS policies
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid() = id OR role = 'admin');
CREATE POLICY "Admins can manage all users" ON users FOR ALL USING (role = 'admin');
CREATE POLICY "Users can view their own leave data" ON leave_days FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage all leave data" ON leave_days FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Users can manage their own form requests" ON form_requests FOR ALL USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "All users can view documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Admins can manage documents" ON documents FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage leave promotions" ON leave_promotions FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));


-- Step 6: Auto-update 'updated_at' column trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_days_updated_at BEFORE UPDATE ON leave_days FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_form_requests_updated_at BEFORE UPDATE ON form_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_promotions_updated_at BEFORE UPDATE ON leave_promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Insert initial data
INSERT INTO users (email, password_hash, name, role, employee_id, work_type, department, position, hire_date, dob, phone, address, termination_date, contract_end_date) VALUES 
('lewis@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '김성호', 'admin', '1', '정규직', '경영팀', '대표', '2015-08-01', '1984-08-08', '010-2726-2491', '서울시 성북구 북악산로 1길 43, 스카이힐스테이 101호', NULL, NULL),
('ke.kim@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '김경은', 'user', '10', '정규직', '편집팀', '팀장', '2020-06-24', '1984-06-24', '010-8704-6066', '서울시 성북구 동선동2가 115번지 블루빌 502b호', NULL, NULL),
('jw.han@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '한종운', 'user', '15', '정규직', '촬영팀', '팀장', '2020-12-15', '1987-04-07', '010-4565-1330', '경기도 의정부시 녹양동 청구아파트 101동 1307호', NULL, NULL),
('ht.no@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '노현태', 'user', '17', '정규직', '편집팀', 'PD', '2021-02-01', '1998-02-09', '010-5502-5336', '서울특별시 노원구 동일로207길 186, 107동 1402호(학여울청구아파트)', '2025-06-30', NULL),
('jh.park@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '박종호', 'user', '19', '정규직', '편집팀', 'PD', '2022-02-01', '1990-06-28', '010-3325-5374', '서울시 서대문구 통일로 39다길 38', '2025-05-31', NULL),
('jh.lee@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '이재혁', 'user', '23', '정규직', '촬영팀', '촬영감독', '2023-12-01', '1997-12-11', '010-4454-6307', '경기도 의정부시 평화로 363-7 601동 2005호', NULL, NULL),
('jh.heo@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '허지현', 'user', '24', '정규직', '행사기획팀', '매니저', '2024-06-01', '1995-02-13', '010-2025-9028', '서울시 종로구 창경궁로 35나길 10 혜화빌라트 302호', NULL, NULL),
('hs.ryoo@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '유희수', 'user', '25', '정규직', '촬영팀', '촬영감독', '2024-07-01', '1998-01-19', '010-2672-2284', '서울특별시 성북구 동소문로 11길 27-4 송산맨션 102호', NULL, NULL),
('sr.yun@motionsense.co.kr', '$2b$10$JI4RmJcsvrjyOcRQEpt.fOQ7wWkp6JJU5.mbyFIO4oGB.sdNyyzCa', '윤서랑', 'user', '27', '정규직', '행사기획팀', '디자이너', '2024-10-28', '1994-11-02', '010-4502-6842', '경기도 남양주시 식송2로 43 202호', NULL, NULL);

INSERT INTO leave_days (user_id, leave_types) 
SELECT 
    u.id,
    CASE 
        WHEN u.email = 'lewis@motionsense.co.kr' THEN '{"annual_days": 19, "used_annual_days": 0, "sick_days": 60, "used_sick_days": 0}'::jsonb
        WHEN u.email = 'ke.kim@motionsense.co.kr' THEN '{"annual_days": 17, "used_annual_days": 7.5, "sick_days": 60, "used_sick_days": 1.5}'::jsonb
        WHEN u.email = 'jw.han@motionsense.co.kr' THEN '{"annual_days": 17, "used_annual_days": 9, "sick_days": 60, "used_sick_days": 1}'::jsonb
        WHEN u.email = 'ht.no@motionsense.co.kr' THEN '{"annual_days": 16, "used_annual_days": 0, "sick_days": 60, "used_sick_days": 0}'::jsonb
        WHEN u.email = 'jh.park@motionsense.co.kr' THEN '{"annual_days": 16, "used_annual_days": 0, "sick_days": 60, "used_sick_days": 0}'::jsonb
        WHEN u.email = 'jh.lee@motionsense.co.kr' THEN '{"annual_days": 15, "used_annual_days": 9, "sick_days": 60, "used_sick_days": 1}'::jsonb
        WHEN u.email = 'jh.heo@motionsense.co.kr' THEN '{"annual_days": 14, "used_annual_days": 9, "sick_days": 60, "used_sick_days": 0}'::jsonb
        WHEN u.email = 'hs.ryoo@motionsense.co.kr' THEN '{"annual_days": 14, "used_annual_days": 14, "sick_days": 60, "used_sick_days": 2}'::jsonb
        WHEN u.email = 'sr.yun@motionsense.co.kr' THEN '{"annual_days": 12, "used_annual_days": 8, "sick_days": 60, "used_sick_days": 1}'::jsonb
        ELSE '{"annual_days": 15, "used_annual_days": 0, "sick_days": 5, "used_sick_days": 0}'::jsonb
    END
FROM users u;

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

INSERT INTO leave_promotions (employee_id, promotion_type, target_year, promotion_stage, remaining_days, promotion_date, deadline, status, employee_response, company_designation)
SELECT 
    u.employee_id,
    'annual_promotion' as promotion_type,
    2024 as target_year,
    'first' as promotion_stage,
    ( (ld.leave_types->>'annual_days')::numeric - (ld.leave_types->>'used_annual_days')::numeric ) as remaining_days,
    CURRENT_DATE as promotion_date,
    CURRENT_DATE + INTERVAL '30 days' as deadline,
    'pending' as status,
    '{}'::jsonb,
    '{}'::jsonb
FROM (
    SELECT 
        u.employee_id,
        (SELECT leave_types FROM leave_days WHERE user_id = u.id) as leave_types
    FROM users u
) ld
JOIN users u ON ld.employee_id = u.employee_id
WHERE 
    (ld.leave_types->>'annual_days')::numeric >= 10 AND
    ((ld.leave_types->>'annual_days')::numeric - (ld.leave_types->>'used_annual_days')::numeric) >= ((ld.leave_types->>'annual_days')::numeric * 0.5);

-- Motion Connect HR System - COMPLETE Database Schema
-- Version: 2025-07-15 - NEW PROJECT
-- All tables included: users, leave_days, form_requests, documents, meetings, calendar_configs, leave_promotions

-- Step 1: Clean existing data (if any)
DROP TABLE IF EXISTS leave_promotions CASCADE;
DROP TABLE IF EXISTS calendar_configs CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS form_requests CASCADE;
DROP TABLE IF EXISTS leave_days CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Step 2: Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 3: Create all tables
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
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    link TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_type VARCHAR(20) NOT NULL CHECK (meeting_type IN ('external', 'internal')),
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    time VARCHAR(10) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    client VARCHAR(255),
    participants TEXT,
    created_by UUID REFERENCES users(id) ON DELETE CASCADE,
    calendar_id VARCHAR(255),
    google_event_id VARCHAR(255),
    calendar_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE calendar_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_type VARCHAR(20) NOT NULL CHECK (config_type IN ('team', 'function')),
    target_name VARCHAR(100) NOT NULL,
    calendar_id VARCHAR(255) NOT NULL,
    calendar_alias VARCHAR(100),
    description TEXT,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
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

-- Step 4: Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_leave_days_user_id ON leave_days(user_id);
CREATE INDEX idx_form_requests_user_id ON form_requests(user_id);
CREATE INDEX idx_form_requests_status ON form_requests(status);
CREATE INDEX idx_meetings_date ON meetings(date);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_calendar_configs_config_type ON calendar_configs(config_type);

-- Step 5: Auto-update 'updated_at' column trigger
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
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_configs_updated_at BEFORE UPDATE ON calendar_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_promotions_updated_at BEFORE UPDATE ON leave_promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Insert sample data with password '0000'
INSERT INTO users (email, password_hash, name, role, employee_id, work_type, department, position, hire_date, dob, phone, address, termination_date, contract_end_date) VALUES 
('lewis@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '김성호', 'admin', '1', '정규직', '경영팀', '대표', '2015-08-01', '1984-08-08', '010-2726-2491', '서울시 성북구 북악산로 1길 43, 스카이힐스테이 101호', NULL, NULL),
('ke.kim@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '김경은', 'user', '10', '정규직', '편집팀', '팀장', '2020-06-24', '1984-06-24', '010-8704-6066', '서울시 성북구 동선동2가 115번지 블루빌 502b호', NULL, NULL),
('jw.han@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '한종운', 'user', '15', '정규직', '촬영팀', '팀장', '2020-12-15', '1987-04-07', '010-4565-1330', '경기도 의정부시 녹양동 청구아파트 101동 1307호', NULL, NULL),
('ht.no@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '노현태', 'user', '17', '정규직', '편집팀', 'PD', '2021-02-01', '1998-02-09', '010-5502-5336', '서울특별시 노원구 동일로207길 186, 107동 1402호(학여울청구아파트)', '2025-06-30', NULL),
('jh.park@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '박종호', 'user', '19', '정규직', '편집팀', 'PD', '2022-02-01', '1990-06-28', '010-3325-5374', '서울시 서대문구 통일로 39다길 38', '2025-05-31', NULL),
('jh.lee@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '이재혁', 'user', '23', '정규직', '촬영팀', '촬영감독', '2023-12-01', '1997-12-11', '010-4454-6307', '경기도 의정부시 평화로 363-7 601동 2005호', NULL, NULL),
('jh.heo@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '허지현', 'user', '24', '정규직', '행사기획팀', '매니저', '2024-06-01', '1995-02-13', '010-2025-9028', '서울시 종로구 창경궁로 35나길 10 혜화빌라트 302호', NULL, NULL),
('hs.ryoo@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '유희수', 'user', '25', '정규직', '촬영팀', '촬영감독', '2024-07-01', '1998-01-19', '010-2672-2284', '서울특별시 성북구 동소문로 11길 27-4 송산맨션 102호', NULL, NULL),
('sr.yun@motionsense.co.kr', '$2b$10$6Q1.1yDHqKYRlYJ3kUqgRuWO8YqKPOKWVjhOFXIXuQBqHZdWpJrSG', '윤서랑', 'user', '27', '정규직', '행사기획팀', '디자이너', '2024-10-28', '1994-11-02', '010-4502-6842', '경기도 남양주시 식송2로 43 202호', NULL, NULL);

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

INSERT INTO documents (name, link, uploaded_by, upload_date) 
SELECT 
    doc.name,
    doc.link,
    u.id,
    doc.upload_date
FROM (
    SELECT '취업규칙' as name, 'https://drive.google.com/file/d/1VgJqx56DJCx5_QzllK8X3WZnnhRaFrqO/view' as link, '2025-07-06 10:55:05'::timestamp as upload_date
    UNION ALL
    SELECT '회사소개서', 'https://docs.google.com/presentation/d/1UT_t0VKWq7rLIk2eUHd8uZBr0gjfWiv_PbCGGL02QVY/present', '2025-07-08 05:45:52'::timestamp
    UNION ALL
    SELECT '사업자등록증 사본', 'https://drive.google.com/file/d/1--Blc_JlSv4a6k0HHNvaUkI5cOcK_DBY/view?usp=share_link', '2025-07-08 05:46:21'::timestamp
    UNION ALL
    SELECT '통장 사본', 'https://drive.google.com/file/d/0B-JERjbAWjRVSW1CV1p0NS1CbUU/view?usp=share_link&resourcekey=0-6fdc2pD6Het6UFfJN7J_tA', '2025-07-08 05:46:38'::timestamp
    UNION ALL
    SELECT '회사 공용 서비스 계정 모음', 'https://docs.google.com/document/d/1Y8jlxmxkVXjrrHUJkHS3SFUp4Ppk-9E25j5KTG8krAI/edit?usp=sharing', '2025-07-08 05:46:54'::timestamp
    UNION ALL
    SELECT '촬영 스튜디오 DB', 'https://docs.google.com/spreadsheets/d/1cTNJZp7RH6g7A2SxwpaWEnKmvO90uaNaBxGfRS8_TAk/edit?gid=0#gid=0', '2025-07-08 05:47:20'::timestamp
    UNION ALL
    SELECT '스트리밍 서비스 가이드북', 'https://docs.google.com/presentation/d/1i0y0MXsaN_vyaaUudK5wMhkUrdA6qckvnyF3VY-xltc/present', '2025-07-08 05:47:40'::timestamp
    UNION ALL
    SELECT '모슐랭가이드 (스프레드시트)', 'https://docs.google.com/spreadsheets/d/1Kt6LLuVnFKkcBPsvy-rKmaMB1f_iGtUl02EFhbh7Bps/edit?usp=sharing', '2025-07-08 05:48:02'::timestamp
    UNION ALL
    SELECT '모슐랭가이드 (지도보기)', 'https://naver.me/xJGHatFM', '2025-07-08 05:48:25'::timestamp
) doc
CROSS JOIN (SELECT id FROM users WHERE role = 'admin' LIMIT 1) u;

-- Enable Row Level Security (RLS) but with permissive policies for development
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_promotions ENABLE ROW LEVEL SECURITY;

-- Create permissive RLS policies for development
CREATE POLICY "Allow all access for development" ON users FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON leave_days FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON form_requests FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON meetings FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON calendar_configs FOR ALL USING (true);
CREATE POLICY "Allow all access for development" ON leave_promotions FOR ALL USING (true);

-- Create sample meeting data
INSERT INTO meetings (meeting_type, title, date, time, location, description, created_by)
SELECT 
    'internal' as meeting_type,
    '팀 회의' as title,
    CURRENT_DATE as date,
    '14:00' as time,
    '회의실 A' as location,
    '정기 팀 회의' as description,
    u.id
FROM users u WHERE u.role = 'admin' LIMIT 1;

-- Summary
SELECT 
    'Database setup complete!' as message,
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM leave_days) as leave_days_count,
    (SELECT COUNT(*) FROM documents) as documents_count,
    (SELECT COUNT(*) FROM meetings) as meetings_count;
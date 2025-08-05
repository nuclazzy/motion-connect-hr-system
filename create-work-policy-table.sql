-- 근무정책 관리 테이블 생성
-- 탄력근무제, 야간/초과근무, 대체/보상휴가 설정 관리

-- 1. 전체 근무정책 설정 테이블
CREATE TABLE IF NOT EXISTS work_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name VARCHAR(100) NOT NULL,
    policy_type VARCHAR(50) NOT NULL, -- 'flexible_work', 'overtime', 'leave_calculation'
    is_active BOOLEAN DEFAULT true,
    effective_start_date DATE NOT NULL,
    effective_end_date DATE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 탄력근무제 설정 테이블
CREATE TABLE IF NOT EXISTS flexible_work_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES work_policies(id) ON DELETE CASCADE,
    period_name VARCHAR(100) NOT NULL, -- '1분기 탄력근무제', '여름철 탄력근무제' 등
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    standard_work_hours DECIMAL(4,1) DEFAULT 8.0, -- 기준 근무시간
    core_time_required BOOLEAN DEFAULT false, -- 핵심시간 필수 여부
    core_start_time TIME, -- 핵심시간 시작
    core_end_time TIME, -- 핵심시간 종료
    min_daily_hours DECIMAL(4,1) DEFAULT 4.0, -- 최소 일일 근무시간
    max_daily_hours DECIMAL(4,1) DEFAULT 12.0, -- 최대 일일 근무시간
    weekly_standard_hours DECIMAL(4,1) DEFAULT 40.0, -- 주당 기준 근무시간
    settlement_period_weeks INTEGER DEFAULT 4, -- 정산 주기 (주)
    overtime_threshold DECIMAL(4,1) DEFAULT 8.0, -- 초과근무 기준시간
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 야간/초과근무 설정 테이블
CREATE TABLE IF NOT EXISTS overtime_night_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES work_policies(id) ON DELETE CASCADE,
    setting_name VARCHAR(100) NOT NULL,
    -- 야간근무 설정
    night_start_time TIME DEFAULT '22:00:00', -- 야간근무 시작시간
    night_end_time TIME DEFAULT '06:00:00', -- 야간근무 종료시간
    night_allowance_rate DECIMAL(4,2) DEFAULT 0.5, -- 야간수당 비율 (0.5 = 50% 가산)
    -- 초과근무 설정
    overtime_threshold DECIMAL(4,1) DEFAULT 8.0, -- 초과근무 기준시간
    overtime_allowance_rate DECIMAL(4,2) DEFAULT 1.5, -- 초과근무수당 비율 (1.5 = 150%)
    max_daily_overtime DECIMAL(4,1) DEFAULT 12.0, -- 일일 최대 초과근무시간
    max_monthly_overtime DECIMAL(5,1) DEFAULT 52.0, -- 월 최대 초과근무시간
    -- 휴게시간 설정
    break_minutes_4h INTEGER DEFAULT 30, -- 4시간 근무 시 휴게시간
    break_minutes_8h INTEGER DEFAULT 60, -- 8시간 근무 시 휴게시간
    dinner_time_threshold DECIMAL(4,1) DEFAULT 6.0, -- 저녁시간 인정 기준
    dinner_break_minutes INTEGER DEFAULT 60, -- 저녁식사 시간
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 대체휴가/보상휴가 계산 설정 테이블
CREATE TABLE IF NOT EXISTS leave_calculation_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES work_policies(id) ON DELETE CASCADE,
    setting_name VARCHAR(100) NOT NULL,
    -- 토요일 대체휴가 설정
    saturday_substitute_enabled BOOLEAN DEFAULT true,
    saturday_base_rate DECIMAL(4,2) DEFAULT 1.0, -- 8시간 이하 기본 비율
    saturday_overtime_rate DECIMAL(4,2) DEFAULT 1.5, -- 8시간 초과 가산 비율
    saturday_night_additional_rate DECIMAL(4,2) DEFAULT 0.5, -- 야간근무 추가 가산
    -- 일요일/공휴일 보상휴가 설정
    sunday_compensatory_enabled BOOLEAN DEFAULT true,
    sunday_base_rate DECIMAL(4,2) DEFAULT 1.5, -- 8시간 이하 기본 비율
    sunday_overtime_rate DECIMAL(4,2) DEFAULT 2.0, -- 8시간 초과 가산 비율
    sunday_night_additional_rate DECIMAL(4,2) DEFAULT 0.5, -- 야간근무 추가 가산
    -- 공휴일 보상휴가 설정 (일요일과 동일)
    holiday_compensatory_enabled BOOLEAN DEFAULT true,
    holiday_base_rate DECIMAL(4,2) DEFAULT 1.5,
    holiday_overtime_rate DECIMAL(4,2) DEFAULT 2.0,
    holiday_night_additional_rate DECIMAL(4,2) DEFAULT 0.5,
    -- 최대 적립 제한
    max_substitute_hours DECIMAL(6,1) DEFAULT 240.0, -- 대체휴가 최대 적립시간
    max_compensatory_hours DECIMAL(6,1) DEFAULT 240.0, -- 보상휴가 최대 적립시간
    expire_months INTEGER DEFAULT 12, -- 소멸 시효 (개월)
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 사용자별 정책 적용 테이블 (개별 설정 가능)
CREATE TABLE IF NOT EXISTS user_work_policy_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    flexible_work_setting_id UUID REFERENCES flexible_work_settings(id),
    overtime_night_setting_id UUID REFERENCES overtime_night_settings(id),
    leave_calculation_setting_id UUID REFERENCES leave_calculation_settings(id),
    assigned_by UUID REFERENCES users(id),
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, start_date)
);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_policies_type_active ON work_policies(policy_type, is_active);
CREATE INDEX IF NOT EXISTS idx_flexible_work_period ON flexible_work_settings(start_date, end_date, is_active);
CREATE INDEX IF NOT EXISTS idx_overtime_settings_active ON overtime_night_settings(is_active, effective_date);
CREATE INDEX IF NOT EXISTS idx_leave_calc_settings_active ON leave_calculation_settings(is_active, effective_date);
CREATE INDEX IF NOT EXISTS idx_user_policy_assignments ON user_work_policy_assignments(user_id, is_active);

-- 7. 기본 설정 데이터 삽입
INSERT INTO work_policies (policy_name, policy_type, is_active, effective_start_date) VALUES
('기본 근무정책', 'general', true, '2025-01-01'),
('표준 탄력근무제', 'flexible_work', true, '2025-01-01'),
('표준 야간초과근무', 'overtime', true, '2025-01-01'),
('표준 대체보상휴가', 'leave_calculation', true, '2025-01-01');

-- 기본 야간/초과근무 설정
INSERT INTO overtime_night_settings (
    policy_id, setting_name, night_start_time, night_end_time, 
    night_allowance_rate, overtime_threshold, overtime_allowance_rate,
    break_minutes_4h, break_minutes_8h, dinner_time_threshold, dinner_break_minutes
) VALUES (
    (SELECT id FROM work_policies WHERE policy_name = '표준 야간초과근무'),
    '기본 야간초과근무 설정',
    '22:00:00', '06:00:00', 0.5, 8.0, 1.5, 30, 60, 6.0, 60
);

-- 기본 대체휴가/보상휴가 설정
INSERT INTO leave_calculation_settings (
    policy_id, setting_name,
    saturday_substitute_enabled, saturday_base_rate, saturday_overtime_rate, saturday_night_additional_rate,
    sunday_compensatory_enabled, sunday_base_rate, sunday_overtime_rate, sunday_night_additional_rate,
    holiday_compensatory_enabled, holiday_base_rate, holiday_overtime_rate, holiday_night_additional_rate,
    max_substitute_hours, max_compensatory_hours, expire_months
) VALUES (
    (SELECT id FROM work_policies WHERE policy_name = '표준 대체보상휴가'),
    '기본 대체보상휴가 설정',
    true, 1.0, 1.5, 0.5,
    true, 1.5, 2.0, 0.5,
    true, 1.5, 2.0, 0.5,
    240.0, 240.0, 12
);

SELECT '근무정책 관리 테이블 생성 완료' as status;
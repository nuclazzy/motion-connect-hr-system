-- 탄력근무제 근무계획표 관리 스키마
-- 1단계: 근무계획표 시스템 설계

-- 1. 탄력근무제 기간별 근무계획표 테이블
CREATE TABLE IF NOT EXISTS flexible_work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID REFERENCES flexible_work_settings(id) ON DELETE CASCADE,
    schedule_name VARCHAR(100) NOT NULL, -- '2025년 1분기 탄력근무제 계획'
    
    -- 기간 설정
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    settlement_weeks INTEGER DEFAULT 12, -- 정산 주기 (주)
    
    -- 기본 설정
    standard_weekly_hours DECIMAL(4,1) DEFAULT 40.0, -- 주당 평균 기준시간
    max_daily_hours DECIMAL(4,1) DEFAULT 12.0, -- 일일 최대 근무시간
    max_weekly_hours DECIMAL(4,1) DEFAULT 52.0, -- 주간 최대 근무시간
    
    -- 승인 및 상태
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'active', 'completed'
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타데이터
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 일별 계획 근무시간 테이블
CREATE TABLE IF NOT EXISTS daily_scheduled_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES flexible_work_schedules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    
    -- 계획된 근무시간
    planned_start_time TIME,
    planned_end_time TIME,
    planned_work_hours DECIMAL(4,1) NOT NULL, -- 계획된 총 근무시간
    planned_break_minutes INTEGER DEFAULT 60, -- 계획된 휴게시간 (분)
    
    -- 특별 사항
    is_holiday BOOLEAN DEFAULT false,
    is_weekend BOOLEAN DEFAULT false,
    work_type VARCHAR(20) DEFAULT 'normal', -- 'normal', 'overtime_planned', 'off'
    
    -- 메모 및 사유
    notes TEXT,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(schedule_id, user_id, work_date)
);

-- 3. 주간 계획 요약 테이블
CREATE TABLE IF NOT EXISTS weekly_schedule_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES flexible_work_schedules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- 주간 정보
    week_start_date DATE NOT NULL, -- 주의 시작일 (월요일)
    week_number INTEGER NOT NULL, -- 해당 연도의 주차
    year INTEGER NOT NULL,
    
    -- 계획된 시간
    planned_total_hours DECIMAL(5,1) DEFAULT 0, -- 주간 계획 총 근무시간
    planned_work_days INTEGER DEFAULT 0, -- 계획된 근무일수
    
    -- 실제 근무시간 (업데이트됨)
    actual_total_hours DECIMAL(5,1) DEFAULT 0,
    actual_work_days INTEGER DEFAULT 0,
    
    -- 차이 분석
    hour_variance DECIMAL(5,1) DEFAULT 0, -- 계획 대비 실제 시간 차이
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(schedule_id, user_id, week_start_date)
);

-- 4. 3개월 단위기간 정산 테이블
CREATE TABLE IF NOT EXISTS settlement_period_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES flexible_work_schedules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- 정산 기간
    settlement_start_date DATE NOT NULL,
    settlement_end_date DATE NOT NULL,
    total_weeks INTEGER NOT NULL,
    
    -- 계획 vs 실제
    planned_total_hours DECIMAL(7,1) DEFAULT 0, -- 전체 기간 계획 시간
    actual_total_hours DECIMAL(7,1) DEFAULT 0, -- 전체 기간 실제 시간
    
    -- 평균 계산
    planned_weekly_average DECIMAL(5,1) DEFAULT 0, -- 계획된 주평균
    actual_weekly_average DECIMAL(5,1) DEFAULT 0, -- 실제 주평균
    
    -- 초과근무 수당 대상 시간
    excess_hours_over_40 DECIMAL(6,1) DEFAULT 0, -- 주40시간 초과분
    unplanned_overtime_hours DECIMAL(6,1) DEFAULT 0, -- 계획외 초과근무
    
    -- 야간근무 (항상 수당 대상)
    total_night_hours DECIMAL(6,1) DEFAULT 0,
    
    -- 정산 상태
    is_finalized BOOLEAN DEFAULT false,
    finalized_at TIMESTAMP WITH TIME ZONE,
    finalized_by UUID REFERENCES users(id),
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(schedule_id, user_id, settlement_start_date)
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_flexible_schedules_period ON flexible_work_schedules(start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_daily_scheduled_user_date ON daily_scheduled_hours(user_id, work_date);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_user_week ON weekly_schedule_summary(user_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_settlement_user_period ON settlement_period_summary(user_id, settlement_start_date, settlement_end_date);

-- 6. 자동 업데이트 트리거 준비
-- (이후 단계에서 구현될 예정)

SELECT '탄력근무제 근무계획표 스키마 생성 완료' as status;
-- 관리자 대시보드 오류 종합 해결
-- 누락된 테이블, 컬럼, 권한 문제 해결

-- 1. settings_history 테이블 생성
CREATE TABLE IF NOT EXISTS settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT
);

-- 2. users 테이블에 누락된 컬럼들 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS car_allowance DECIMAL(10,2) DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS bonus DECIMAL(10,2) DEFAULT 0;

-- meal_allowance가 없다면 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS meal_allowance DECIMAL(10,2) DEFAULT 0;

-- work_type 컬럼 추가 (정규직, 계약직 등)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS work_type VARCHAR(20) DEFAULT '정규직';

-- 3. 기존 함수들 권한 수정 (public 권한 부여)
DROP FUNCTION IF EXISTS get_all_system_settings();

CREATE OR REPLACE FUNCTION public.get_all_system_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value TEXT,
    setting_type TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER -- 함수 소유자 권한으로 실행
AS $$
BEGIN
    -- system_settings 테이블이 없다면 생성
    CREATE TABLE IF NOT EXISTS public.system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(50) DEFAULT 'string',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 기본 설정값들 삽입 (존재하지 않는 경우만)
    INSERT INTO public.system_settings (setting_key, setting_value, setting_type, description)
    VALUES 
        ('company_name', 'Motion Connect', 'string', '회사명'),
        ('work_start_time', '09:00', 'time', '기본 근무 시작 시간'),
        ('work_end_time', '18:00', 'time', '기본 근무 종료 시간'),
        ('lunch_break_minutes', '60', 'integer', '점심시간 (분)'),
        ('overtime_rate', '1.5', 'decimal', '연장근무 수당 배율'),
        ('night_work_rate', '1.5', 'decimal', '야간근무 수당 배율'),
        ('holiday_work_rate', '2.0', 'decimal', '휴일근무 수당 배율'),
        ('flexible_work_enabled', 'true', 'boolean', '탄력근무제 활성화 여부'),
        ('caps_integration_enabled', 'true', 'boolean', 'CAPS 연동 활성화 여부'),
        ('auto_dinner_detection', 'true', 'boolean', '저녁식사 자동 감지'),
        ('max_daily_work_hours', '12', 'integer', '일일 최대 근무시간'),
        ('weekly_work_hours', '40', 'integer', '주간 기준 근무시간')
    ON CONFLICT (setting_key) DO NOTHING;

    -- 설정값들 반환
    RETURN QUERY
    SELECT 
        ss.setting_key,
        ss.setting_value,
        ss.setting_type,
        ss.description,
        ss.updated_at
    FROM public.system_settings ss
    ORDER BY ss.setting_key;
END;
$$;

-- 4. 시스템 설정 업데이트 함수 (권한 수정)
CREATE OR REPLACE FUNCTION public.update_system_setting(
    p_setting_key TEXT,
    p_setting_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- 함수 소유자 권한으로 실행
AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- 현재 사용자 ID 가져오기
    SELECT auth.uid() INTO current_user_id;
    
    -- 기존 값 기록을 위한 history 저장
    INSERT INTO public.settings_history (setting_key, old_value, new_value, changed_by)
    SELECT 
        p_setting_key,
        setting_value,
        p_setting_value,
        current_user_id
    FROM public.system_settings 
    WHERE setting_key = p_setting_key;

    -- 설정 업데이트
    UPDATE public.system_settings 
    SET setting_value = p_setting_value,
        updated_at = NOW()
    WHERE setting_key = p_setting_key;
    
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        -- 설정이 없으면 새로 생성
        INSERT INTO public.system_settings (setting_key, setting_value)
        VALUES (p_setting_key, p_setting_value)
        ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = NOW();
        RETURN TRUE;
    END IF;
END;
$$;

-- 5. 권한 설정 (authenticated 사용자에게 모든 권한 부여)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 새로 생성된 테이블들에 대한 권한
GRANT ALL ON public.system_settings TO authenticated;
GRANT ALL ON public.settings_history TO authenticated;

-- 6. Row Level Security 설정 (필요한 경우)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 설정에 접근 가능
CREATE POLICY "Admin can manage system settings" ON public.system_settings
    FOR ALL USING (
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 일반 사용자는 읽기만 가능
CREATE POLICY "Users can read system settings" ON public.system_settings
    FOR SELECT USING (true);

-- 설정 이력은 관리자만 조회 가능
CREATE POLICY "Admin can view settings history" ON public.settings_history
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 7. 기존 사용자들의 work_type 기본값 설정
UPDATE public.users 
SET work_type = '정규직' 
WHERE work_type IS NULL;

-- 8. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_settings_history_changed_by ON public.settings_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_settings_history_changed_at ON public.settings_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_users_work_type ON public.users(work_type);

-- 9. 확인 및 결과
SELECT 'comprehensive database fixes applied' as status;

-- 10. 생성된 테이블들 확인
SELECT 'Tables:' as type, tablename as name FROM pg_tables WHERE schemaname = 'public' 
AND tablename IN ('system_settings', 'settings_history')
UNION ALL
SELECT 'Functions:' as type, proname as name FROM pg_proc 
WHERE proname IN ('get_all_system_settings', 'update_system_setting')
ORDER BY type, name;
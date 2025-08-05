-- 관리자 대시보드 오류 해결 (안전한 순서로 실행)
-- 단계별로 테이블 생성 후 함수 생성

-- =====================================================
-- 1단계: 기본 테이블들 먼저 생성
-- =====================================================

-- system_settings 테이블 생성
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- settings_history 테이블 생성
CREATE TABLE IF NOT EXISTS public.settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT
);

-- =====================================================
-- 2단계: users 테이블에 누락된 컬럼들 추가
-- =====================================================

-- car_allowance 컬럼 추가 (차량 수당)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'car_allowance') THEN
        ALTER TABLE users ADD COLUMN car_allowance DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- bonus 컬럼 추가 (상여금)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'bonus') THEN
        ALTER TABLE users ADD COLUMN bonus DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- meal_allowance 컬럼 추가 (식대)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'meal_allowance') THEN
        ALTER TABLE users ADD COLUMN meal_allowance DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- work_type 컬럼 추가 (정규직, 계약직 등)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'work_type') THEN
        ALTER TABLE users ADD COLUMN work_type VARCHAR(20) DEFAULT '정규직';
    END IF;
END $$;

-- =====================================================
-- 3단계: 기본 설정값들 삽입
-- =====================================================

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

-- =====================================================
-- 4단계: 시스템 함수들 생성
-- =====================================================

-- get_all_system_settings 함수 생성
CREATE OR REPLACE FUNCTION public.get_all_system_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value TEXT,
    setting_type TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- update_system_setting 함수 생성
CREATE OR REPLACE FUNCTION public.update_system_setting(
    p_setting_key TEXT,
    p_setting_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    old_value_record TEXT;
BEGIN
    -- 현재 사용자 ID 가져오기 (가능한 경우)
    BEGIN
        SELECT auth.uid() INTO current_user_id;
    EXCEPTION
        WHEN OTHERS THEN
            current_user_id := NULL;
    END;
    
    -- 기존 값 가져오기
    SELECT setting_value INTO old_value_record
    FROM public.system_settings 
    WHERE setting_key = p_setting_key;
    
    -- 이력 저장 (사용자가 있는 경우만)
    IF current_user_id IS NOT NULL AND old_value_record IS NOT NULL THEN
        INSERT INTO public.settings_history (setting_key, old_value, new_value, changed_by)
        VALUES (p_setting_key, old_value_record, p_setting_value, current_user_id);
    END IF;

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

-- =====================================================
-- 5단계: 권한 설정
-- =====================================================

-- 스키마 사용 권한
GRANT USAGE ON SCHEMA public TO authenticated;

-- 테이블 권한
GRANT ALL ON public.system_settings TO authenticated;
GRANT ALL ON public.settings_history TO authenticated;
GRANT ALL ON public.users TO authenticated;

-- 함수 실행 권한
GRANT EXECUTE ON FUNCTION public.get_all_system_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_system_setting(TEXT, TEXT) TO authenticated;

-- =====================================================
-- 6단계: Row Level Security 정책
-- =====================================================

-- system_settings RLS 활성화
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있음
DROP POLICY IF EXISTS "Users can read system settings" ON public.system_settings;
CREATE POLICY "Users can read system settings" ON public.system_settings
    FOR SELECT USING (true);

-- 관리자만 수정 가능
DROP POLICY IF EXISTS "Admin can manage system settings" ON public.system_settings;
CREATE POLICY "Admin can manage system settings" ON public.system_settings
    FOR ALL USING (
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- settings_history RLS
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view settings history" ON public.settings_history;
CREATE POLICY "Admin can view settings history" ON public.settings_history
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- =====================================================
-- 7단계: 기존 데이터 정리
-- =====================================================

-- 기존 사용자들의 work_type 기본값 설정
UPDATE public.users 
SET work_type = '정규직' 
WHERE work_type IS NULL;

-- 차량수당, 상여금, 식대 기본값 설정
UPDATE public.users 
SET car_allowance = 0
WHERE car_allowance IS NULL;

UPDATE public.users 
SET bonus = 0
WHERE bonus IS NULL;

UPDATE public.users 
SET meal_allowance = 0
WHERE meal_allowance IS NULL;

-- =====================================================
-- 8단계: 인덱스 생성 (성능 최적화)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settings_history_changed_by ON public.settings_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_settings_history_changed_at ON public.settings_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_users_work_type ON public.users(work_type);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(setting_key);

-- =====================================================
-- 9단계: 확인 및 결과
-- =====================================================

SELECT '✅ 데이터베이스 오류 해결 완료' as status;

-- 생성된 항목들 확인
SELECT 
    'Tables' as category,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('system_settings', 'settings_history')

UNION ALL

SELECT 
    'Functions' as category,
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_all_system_settings', 'update_system_setting');

-- 추가된 컬럼들 확인
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('car_allowance', 'bonus', 'meal_allowance', 'work_type')
ORDER BY column_name;
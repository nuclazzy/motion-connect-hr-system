-- 누락된 시스템 함수들 생성
-- 관리자 대시보드 오류 해결

-- 1. get_all_system_settings 함수 생성
CREATE OR REPLACE FUNCTION get_all_system_settings()
RETURNS TABLE (
    setting_key TEXT,
    setting_value TEXT,
    setting_type TEXT,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
AS $$
BEGIN
    -- system_settings 테이블이 없다면 생성
    CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type VARCHAR(50) DEFAULT 'string',
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 기본 설정값들 삽입 (존재하지 않는 경우만)
    INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
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
    FROM system_settings ss
    ORDER BY ss.setting_key;
END;
$$;

-- 2. 시스템 설정 업데이트 함수
CREATE OR REPLACE FUNCTION update_system_setting(
    p_setting_key TEXT,
    p_setting_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE system_settings 
    SET setting_value = p_setting_value,
        updated_at = NOW()
    WHERE setting_key = p_setting_key;
    
    IF FOUND THEN
        RETURN TRUE;
    ELSE
        -- 설정이 없으면 새로 생성
        INSERT INTO system_settings (setting_key, setting_value)
        VALUES (p_setting_key, p_setting_value)
        ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = NOW();
        RETURN TRUE;
    END IF;
END;
$$;

-- 3. CAPS 데이터 처리 관련 유틸리티 함수들
CREATE OR REPLACE FUNCTION parse_caps_time(time_str TEXT)
RETURNS TIME
LANGUAGE plpgsql
AS $$
DECLARE
    result_time TIME;
BEGIN
    -- 다양한 시간 형식 처리
    IF time_str ~ '^오후 \d{1,2}:\d{2}:\d{2}$' THEN
        -- "오후 8:00:00" 형식
        SELECT (REPLACE(time_str, '오후 ', '') || ' PM')::TIME INTO result_time;
    ELSIF time_str ~ '^오전 \d{1,2}:\d{2}:\d{2}$' THEN
        -- "오전 9:00:00" 형식
        SELECT (REPLACE(time_str, '오전 ', '') || ' AM')::TIME INTO result_time;
    ELSIF time_str ~ '^PM \d{1,2}:\d{2}:\d{2}$' THEN
        -- "PM 8:00:00" 형식
        SELECT time_str::TIME INTO result_time;
    ELSIF time_str ~ '^AM \d{1,2}:\d{2}:\d{2}$' THEN
        -- "AM 9:00:00" 형식
        SELECT time_str::TIME INTO result_time;
    ELSE
        -- 기본 형식 시도
        SELECT time_str::TIME INTO result_time;
    END IF;
    
    RETURN result_time;
EXCEPTION
    WHEN OTHERS THEN
        -- 파싱 실패 시 NULL 반환
        RETURN NULL;
END;
$$;

-- 4. 출퇴근 데이터 정리 함수
CREATE OR REPLACE FUNCTION clean_attendance_data()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- 중복된 기록 제거 (같은 사용자, 같은 날, 같은 타입, 같은 시간)
    WITH duplicates AS (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY user_id, record_date, record_type, record_time 
            ORDER BY created_at ASC
        ) as rn
        FROM attendance_records
    )
    DELETE FROM attendance_records 
    WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN format('정리 완료: %s건의 중복 기록 제거', cleaned_count);
END;
$$;

-- 5. 권한 설정
GRANT EXECUTE ON FUNCTION get_all_system_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION update_system_setting(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION parse_caps_time(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION clean_attendance_data() TO authenticated;

-- 6. 확인
SELECT 'CAPS 호환 시스템 함수들 생성 완료' as status;

-- 7. 생성된 함수들 확인
SELECT 
    proname as function_name,
    pg_catalog.pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('get_all_system_settings', 'update_system_setting', 'parse_caps_time', 'clean_attendance_data')
ORDER BY proname;
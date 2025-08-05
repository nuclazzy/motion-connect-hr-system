-- 함수 반환 타입 오류 수정
-- VARCHAR(100) vs TEXT 타입 불일치 해결

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS public.get_all_system_settings();

-- 정확한 타입으로 함수 재생성
CREATE OR REPLACE FUNCTION public.get_all_system_settings()
RETURNS TABLE (
    setting_key VARCHAR(100),  -- TEXT 대신 VARCHAR(100) 사용
    setting_value TEXT,
    setting_type VARCHAR(50),  -- TEXT 대신 VARCHAR(50) 사용
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 설정값들 반환 (타입 캐스팅 명시적으로 처리)
    RETURN QUERY
    SELECT 
        ss.setting_key::VARCHAR(100),
        ss.setting_value::TEXT,
        ss.setting_type::VARCHAR(50),
        ss.description::TEXT,
        ss.updated_at
    FROM public.system_settings ss
    ORDER BY ss.setting_key;
END;
$$;

-- 권한 재부여
GRANT EXECUTE ON FUNCTION public.get_all_system_settings() TO authenticated;

-- 함수 정상 작동 테스트
SELECT '✅ 함수 반환 타입 수정 완료' as status;

-- 함수 테스트 실행
SELECT * FROM public.get_all_system_settings() LIMIT 3;
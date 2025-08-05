-- 대안: 간단한 뷰 기반 접근법
-- 함수 대신 뷰 사용으로 타입 문제 완전 회피

-- 기존 함수 완전 제거
DROP FUNCTION IF EXISTS public.get_all_system_settings() CASCADE;

-- 시스템 설정 뷰 생성 (함수 대신)
CREATE OR REPLACE VIEW public.system_settings_view AS
SELECT 
    setting_key,
    setting_value,
    setting_type,
    description,
    updated_at
FROM public.system_settings
ORDER BY setting_key;

-- 뷰 권한 부여
GRANT SELECT ON public.system_settings_view TO authenticated;

-- 간단한 래퍼 함수 (매개변수 없음)
CREATE OR REPLACE FUNCTION public.get_all_system_settings()
RETURNS SETOF public.system_settings_view
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT * FROM public.system_settings_view;
$$;

-- 함수 권한 부여
GRANT EXECUTE ON FUNCTION public.get_all_system_settings() TO authenticated;

-- 확인
SELECT '✅ 대안 방법으로 함수 재생성 완료' as status;

-- 테스트
SELECT setting_key, setting_value FROM public.get_all_system_settings() LIMIT 3;
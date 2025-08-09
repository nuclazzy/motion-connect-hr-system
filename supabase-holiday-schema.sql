-- 공휴일 관리 테이블 스키마 (Supabase)
-- "개발자는 게을러져야 한다" 철학 기반 자동화 시스템

-- 공휴일 마스터 테이블
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  holiday_name VARCHAR(100) NOT NULL,
  is_temporary BOOLEAN DEFAULT false,     -- 임시공휴일 여부
  is_substitute BOOLEAN DEFAULT false,    -- 대체공휴일 여부
  is_company_custom BOOLEAN DEFAULT false, -- 기업 맞춤 공휴일 여부
  source VARCHAR(50) DEFAULT 'kasi-api', -- 데이터 출처
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON public.holidays(EXTRACT(YEAR FROM holiday_date));
CREATE INDEX IF NOT EXISTS idx_holidays_temporary ON public.holidays(is_temporary) WHERE is_temporary = true;
CREATE INDEX IF NOT EXISTS idx_holidays_substitute ON public.holidays(is_substitute) WHERE is_substitute = true;

-- 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_holidays_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_holidays_updated_at
    BEFORE UPDATE ON public.holidays
    FOR EACH ROW
    EXECUTE FUNCTION update_holidays_updated_at();

-- Row Level Security (RLS) 설정
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can read holidays" ON public.holidays
    FOR SELECT USING (true);

-- 정책: 관리자만 수정 가능
CREATE POLICY "Only admins can modify holidays" ON public.holidays
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users u
            JOIN public.users pu ON u.id = pu.id
            WHERE u.id = auth.uid() 
            AND pu.role = 'admin'
        )
    );

-- 공휴일 동기화 로그 테이블
CREATE TABLE IF NOT EXISTS public.holiday_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_year INTEGER NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source VARCHAR(50) NOT NULL,
  holidays_fetched INTEGER DEFAULT 0,
  holidays_inserted INTEGER DEFAULT 0,
  holidays_updated INTEGER DEFAULT 0,
  new_temporary INTEGER DEFAULT 0,
  new_substitute INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_holiday_sync_logs_date ON public.holiday_sync_logs(sync_date);
CREATE INDEX IF NOT EXISTS idx_holiday_sync_logs_year ON public.holiday_sync_logs(sync_year);

-- 공휴일 관련 유틸리티 함수들

-- 특정 날짜가 공휴일인지 확인
CREATE OR REPLACE FUNCTION is_holiday(check_date DATE)
RETURNS TABLE(
  is_holiday BOOLEAN,
  holiday_name TEXT,
  is_temporary BOOLEAN,
  is_substitute BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE WHEN h.holiday_date IS NOT NULL THEN true ELSE false END,
    h.holiday_name::TEXT,
    COALESCE(h.is_temporary, false),
    COALESCE(h.is_substitute, false)
  FROM public.holidays h
  WHERE h.holiday_date = check_date;
  
  -- 결과가 없으면 false 반환
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, null::TEXT, false, false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 특정 년도의 모든 공휴일 조회
CREATE OR REPLACE FUNCTION get_yearly_holidays(target_year INTEGER)
RETURNS TABLE(
  holiday_date DATE,
  holiday_name TEXT,
  is_temporary BOOLEAN,
  is_substitute BOOLEAN,
  is_company_custom BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.holiday_date,
    h.holiday_name::TEXT,
    h.is_temporary,
    h.is_substitute,
    h.is_company_custom
  FROM public.holidays h
  WHERE EXTRACT(YEAR FROM h.holiday_date) = target_year
  ORDER BY h.holiday_date;
END;
$$ LANGUAGE plpgsql;

-- 주말 또는 공휴일 여부 확인 (근무일 계산용)
CREATE OR REPLACE FUNCTION is_weekend_or_holiday(check_date DATE)
RETURNS TABLE(
  is_non_working_day BOOLEAN,
  reason TEXT,
  holiday_name TEXT
) AS $$
DECLARE
  day_of_week INTEGER;
  holiday_info RECORD;
BEGIN
  -- 요일 확인 (0=일요일, 6=토요일)
  day_of_week := EXTRACT(DOW FROM check_date);
  
  -- 주말 체크
  IF day_of_week = 0 OR day_of_week = 6 THEN
    RETURN QUERY SELECT true, 'weekend'::TEXT, 
                        CASE WHEN day_of_week = 0 THEN '일요일' ELSE '토요일' END::TEXT;
    RETURN;
  END IF;
  
  -- 공휴일 체크
  SELECT * INTO holiday_info FROM is_holiday(check_date);
  
  IF holiday_info.is_holiday THEN
    RETURN QUERY SELECT true, 'holiday'::TEXT, holiday_info.holiday_name;
  ELSE
    RETURN QUERY SELECT false, 'working_day'::TEXT, null::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 샘플 데이터 삽입 (2025년 주요 공휴일)
INSERT INTO public.holidays (holiday_date, holiday_name, is_temporary, is_substitute, source) VALUES
('2025-01-01', '신정', false, false, 'manual'),
('2025-01-27', '임시공휴일(설 연휴)', true, false, 'government-announcement'),
('2025-01-28', '설날 연휴', false, false, 'manual'),
('2025-01-29', '설날', false, false, 'manual'),
('2025-01-30', '설날 연휴', false, false, 'manual'),
('2025-03-01', '삼일절', false, false, 'manual'),
('2025-03-03', '대체휴일(삼일절)', false, true, 'manual'),
('2025-05-05', '어린이날', false, false, 'manual'),
('2025-05-06', '대체휴일(어린이날)', false, true, 'manual'),
('2025-06-03', '임시공휴일(대통령 선거일)', true, false, 'government-announcement'),
('2025-06-06', '현충일', false, false, 'manual'),
('2025-08-15', '광복절', false, false, 'manual'),
('2025-10-03', '개천절', false, false, 'manual'),
('2025-10-05', '추석 연휴', false, false, 'manual'),
('2025-10-06', '추석', false, false, 'manual'),
('2025-10-07', '추석 연휴', false, false, 'manual'),
('2025-10-08', '대체휴일(추석)', false, true, 'manual'),
('2025-10-09', '한글날', false, false, 'manual'),
('2025-12-25', '성탄절', false, false, 'manual')
ON CONFLICT (holiday_date) DO UPDATE SET
  holiday_name = EXCLUDED.holiday_name,
  is_temporary = EXCLUDED.is_temporary,
  is_substitute = EXCLUDED.is_substitute,
  updated_at = NOW();

-- 정보 확인 쿼리
COMMENT ON TABLE public.holidays IS '공휴일 마스터 테이블 - 자동 동기화 및 수동 관리 지원';
COMMENT ON COLUMN public.holidays.is_temporary IS '임시공휴일 여부 (선거일, 특별휴일 등)';
COMMENT ON COLUMN public.holidays.is_substitute IS '대체공휴일 여부';
COMMENT ON COLUMN public.holidays.is_company_custom IS '기업별 맞춤 공휴일 (회사 창립일 등)';
COMMENT ON COLUMN public.holidays.source IS '데이터 출처: kasi-api, enhanced-api, manual, government-announcement';

-- 유용한 뷰 생성
CREATE OR REPLACE VIEW public.view_current_year_holidays AS
SELECT 
  holiday_date,
  holiday_name,
  is_temporary,
  is_substitute,
  is_company_custom,
  source,
  EXTRACT(DOW FROM holiday_date) as day_of_week
FROM public.holidays 
WHERE EXTRACT(YEAR FROM holiday_date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY holiday_date;

-- 통계 뷰
CREATE OR REPLACE VIEW public.view_holiday_stats AS
SELECT 
  EXTRACT(YEAR FROM holiday_date) as year,
  COUNT(*) as total_holidays,
  COUNT(*) FILTER (WHERE is_temporary) as temporary_holidays,
  COUNT(*) FILTER (WHERE is_substitute) as substitute_holidays,
  COUNT(*) FILTER (WHERE is_company_custom) as company_holidays,
  COUNT(*) FILTER (WHERE source = 'enhanced-api') as api_sourced,
  COUNT(*) FILTER (WHERE source = 'manual') as manually_added
FROM public.holidays 
GROUP BY EXTRACT(YEAR FROM holiday_date)
ORDER BY year DESC;
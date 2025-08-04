-- flex_work_settings 테이블에 user_id 컬럼 추가
-- 이 SQL을 Supabase 대시보드에서 실행하세요

-- 1. flex_work_settings 테이블 존재 확인 및 생성
CREATE TABLE IF NOT EXISTS flex_work_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. user_id 컬럼이 없으면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        
        -- 인덱스 추가
        CREATE INDEX IF NOT EXISTS idx_flex_work_settings_user_id 
        ON flex_work_settings(user_id);
        
        RAISE NOTICE 'user_id 컬럼이 flex_work_settings 테이블에 추가되었습니다.';
    ELSE
        RAISE NOTICE 'user_id 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 3. 기타 필요한 컬럼들 추가 (유연근무제 관련)
DO $$ 
BEGIN
    -- 시작일 컬럼
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'start_date'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN start_date DATE;
    END IF;
    
    -- 종료일 컬럼
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'end_date'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN end_date DATE;
    END IF;
    
    -- 유연근무 타입 컬럼
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'flex_type'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN flex_type VARCHAR(50) DEFAULT 'standard';
    END IF;
    
    -- 핵심시간 시작 컬럼
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'core_start_time'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN core_start_time TIME DEFAULT '10:00:00';
    END IF;
    
    -- 핵심시간 종료 컬럼
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'flex_work_settings' 
        AND column_name = 'core_end_time'
    ) THEN
        ALTER TABLE flex_work_settings 
        ADD COLUMN core_end_time TIME DEFAULT '16:00:00';
    END IF;
    
    RAISE NOTICE 'flex_work_settings 테이블 구조가 업데이트되었습니다.';
END $$;

-- 4. 테이블 코멘트 추가
COMMENT ON TABLE flex_work_settings IS '유연근무제 설정 테이블';
COMMENT ON COLUMN flex_work_settings.user_id IS '사용자 ID (외래키)';
COMMENT ON COLUMN flex_work_settings.start_date IS '유연근무 시작일';
COMMENT ON COLUMN flex_work_settings.end_date IS '유연근무 종료일';
COMMENT ON COLUMN flex_work_settings.flex_type IS '유연근무 타입 (standard, flex_time, flex_place)';
COMMENT ON COLUMN flex_work_settings.core_start_time IS '핵심근무시간 시작';
COMMENT ON COLUMN flex_work_settings.core_end_time IS '핵심근무시간 종료';
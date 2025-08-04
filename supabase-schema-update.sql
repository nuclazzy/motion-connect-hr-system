-- ===============================================
-- users 테이블에 휴가 관련 컬럼 추가
-- Supabase Dashboard > SQL Editor에서 실행
-- ===============================================

-- 1. 휴가 관련 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS annual_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_annual_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_days INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS used_sick_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS substitute_leave_hours NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_hours NUMERIC DEFAULT 0;

-- 2. 컬럼 설명 추가 (선택사항)
COMMENT ON COLUMN users.annual_days IS '연차 총 일수';
COMMENT ON COLUMN users.used_annual_days IS '사용한 연차 일수';
COMMENT ON COLUMN users.sick_days IS '병가 총 일수';
COMMENT ON COLUMN users.used_sick_days IS '사용한 병가 일수';
COMMENT ON COLUMN users.substitute_leave_hours IS '대체휴가 시간';
COMMENT ON COLUMN users.compensatory_leave_hours IS '보상휴가 시간';

-- 3. 컬럼 추가 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN (
    'annual_days', 'used_annual_days', 'sick_days', 
    'used_sick_days', 'substitute_leave_hours', 'compensatory_leave_hours'
)
ORDER BY ordinal_position;
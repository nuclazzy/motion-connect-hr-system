-- Users 테이블에 퇴사/복직 관련 컬럼 추가
-- 실행 전에 이미 존재하는 컬럼은 제거하고 실행하세요

-- 1. 퇴사 처리 관리자 정보
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS resignation_processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS resignation_processed_at TIMESTAMP WITH TIME ZONE;

-- 2. 휴가 정산 정보
ALTER TABLE users
ADD COLUMN IF NOT EXISTS leave_settlement_days DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS leave_settlement_hours INTEGER;

-- 3. 복직 처리 관리자 정보
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reinstatement_processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reinstatement_processed_at TIMESTAMP WITH TIME ZONE;

-- 컬럼 설명 추가 (선택사항)
COMMENT ON COLUMN users.resignation_processed_by IS '퇴사 처리한 관리자 ID';
COMMENT ON COLUMN users.resignation_processed_at IS '퇴사 처리 시간';
COMMENT ON COLUMN users.leave_settlement_days IS '퇴사 시 정산할 연차 일수';
COMMENT ON COLUMN users.leave_settlement_hours IS '퇴사 시 정산할 시간차';
COMMENT ON COLUMN users.reinstatement_processed_by IS '복직 처리한 관리자 ID';
COMMENT ON COLUMN users.reinstatement_processed_at IS '복직 처리 시간';

-- 확인 쿼리
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'users'
AND column_name IN (
    'resignation_processed_by',
    'resignation_processed_at',
    'leave_settlement_days', 
    'leave_settlement_hours',
    'reinstatement_processed_by',
    'reinstatement_processed_at'
)
ORDER BY column_name;
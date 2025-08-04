-- Users 테이블에 퇴사자 및 계약직 분류를 위한 컬럼 추가

-- termination_date: 퇴사 일자 (퇴사자 분류용)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS termination_date DATE;

-- contract_end_date: 계약 종료 일자 (계약직 분류용)  
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- 컬럼 설명 추가
COMMENT ON COLUMN users.termination_date IS '퇴사 일자 - 값이 있으면 퇴사자로 분류';
COMMENT ON COLUMN users.contract_end_date IS '계약 종료 일자 - 값이 있으면 계약직으로 분류';

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_termination_date ON users(termination_date);
CREATE INDEX IF NOT EXISTS idx_users_contract_end_date ON users(contract_end_date);

-- 확인 쿼리
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('termination_date', 'contract_end_date')
ORDER BY column_name;
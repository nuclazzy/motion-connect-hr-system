-- Users 테이블에 퇴사자 및 계약직 분류를 위한 컬럼 추가 및 자동 분류 시스템 구축

-- 1. 필요한 컬럼들 추가
-- termination_date: 퇴사 일자 (퇴사자 분류용)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS termination_date DATE;

-- contract_end_date: 계약 종료 일자 (계약직 분류용)  
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- work_type: 근무 형태 (자동 업데이트됨)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS work_type VARCHAR(20) DEFAULT '정규직';

-- 휴가 관련 컬럼들 데이터 타입 확인 및 수정
-- 모든 휴가 관련 컬럼을 NUMERIC 타입으로 설정 (소수점 허용)

-- 기존 컬럼이 INTEGER인 경우 NUMERIC으로 변경
DO $$
BEGIN
    -- annual_days 컬럼 타입 변경
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'annual_days' AND data_type = 'integer') THEN
        ALTER TABLE users ALTER COLUMN annual_days TYPE NUMERIC(5,1);
    END IF;
    
    -- used_annual_days 컬럼 타입 변경
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'used_annual_days' AND data_type = 'integer') THEN
        ALTER TABLE users ALTER COLUMN used_annual_days TYPE NUMERIC(5,1);
    END IF;
    
    -- sick_days 컬럼 타입 변경
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'sick_days' AND data_type = 'integer') THEN
        ALTER TABLE users ALTER COLUMN sick_days TYPE NUMERIC(5,1);
    END IF;
    
    -- used_sick_days 컬럼 타입 변경
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'used_sick_days' AND data_type = 'integer') THEN
        ALTER TABLE users ALTER COLUMN used_sick_days TYPE NUMERIC(5,1);
    END IF;
END $$;

-- 컬럼이 존재하지 않는 경우 NUMERIC 타입으로 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS annual_days NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS used_annual_days NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sick_days NUMERIC(5,1) DEFAULT 60,
ADD COLUMN IF NOT EXISTS used_sick_days NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS substitute_leave_hours NUMERIC(5,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS compensatory_leave_hours NUMERIC(5,1) DEFAULT 0;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN users.termination_date IS '퇴사 일자 - 값이 있으면 퇴사자로 분류';
COMMENT ON COLUMN users.contract_end_date IS '계약 종료 일자 - 값이 있으면 계약직으로 분류';
COMMENT ON COLUMN users.work_type IS '근무 형태 - termination_date와 contract_end_date에 따라 자동 업데이트';

-- 3. work_type 자동 업데이트 함수 생성
CREATE OR REPLACE FUNCTION update_work_type()
RETURNS TRIGGER AS $$
BEGIN
  -- 퇴사자 우선 체크
  IF NEW.termination_date IS NOT NULL THEN
    NEW.work_type = '퇴사자';
  -- 계약직 체크
  ELSIF NEW.contract_end_date IS NOT NULL THEN
    NEW.work_type = '계약직';
  -- 기본값은 정규직
  ELSE
    NEW.work_type = '정규직';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성 (INSERT, UPDATE 시 자동 실행)
DROP TRIGGER IF EXISTS trigger_update_work_type ON users;
CREATE TRIGGER trigger_update_work_type
  BEFORE INSERT OR UPDATE OF termination_date, contract_end_date
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_work_type();

-- 5. 기존 데이터에 대해 work_type 일괄 업데이트
UPDATE users 
SET work_type = CASE 
  WHEN termination_date IS NOT NULL THEN '퇴사자'
  WHEN contract_end_date IS NOT NULL THEN '계약직'
  ELSE '정규직'
END;

-- 6. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_termination_date ON users(termination_date);
CREATE INDEX IF NOT EXISTS idx_users_contract_end_date ON users(contract_end_date);
CREATE INDEX IF NOT EXISTS idx_users_work_type ON users(work_type);

-- 7. 테스트 및 확인 쿼리
-- 컬럼 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('termination_date', 'contract_end_date', 'work_type')
ORDER BY column_name;

-- 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_update_work_type';

-- 샘플 데이터로 테스트 (필요시 주석 해제)
/*
-- 테스트용 임시 데이터 (실제 운영 시에는 주석 처리)
INSERT INTO users (name, email, department, position, hire_date, contract_end_date) 
VALUES ('테스트계약직', 'test_contract@example.com', '개발팀', '계약직개발자', '2024-01-01', '2024-12-31');

INSERT INTO users (name, email, department, position, hire_date, termination_date) 
VALUES ('테스트퇴사자', 'test_resigned@example.com', '개발팀', '전직원', '2023-01-01', '2024-06-30');

-- work_type이 자동으로 설정되었는지 확인
SELECT name, work_type, termination_date, contract_end_date FROM users WHERE name LIKE '테스트%';

-- 테스트 데이터 정리
DELETE FROM users WHERE name LIKE '테스트%';
*/
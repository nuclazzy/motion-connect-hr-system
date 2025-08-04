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

-- 연봉 관리 컬럼 추가 (기존 단순 연봉)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS salary INTEGER,
ADD COLUMN IF NOT EXISTS salary_updated_at TIMESTAMP WITH TIME ZONE;

-- 상세 급여 정보 컬럼 추가
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS annual_salary INTEGER, -- 연봉 (만원)
ADD COLUMN IF NOT EXISTS monthly_salary INTEGER, -- 월급여 (만원)  
ADD COLUMN IF NOT EXISTS basic_salary INTEGER, -- 기본급 (만원)
ADD COLUMN IF NOT EXISTS bonus INTEGER, -- 상여 (만원)
ADD COLUMN IF NOT EXISTS meal_allowance INTEGER, -- 식대 (만원)
ADD COLUMN IF NOT EXISTS transportation_allowance INTEGER, -- 자가운전 수당 (만원)
ADD COLUMN IF NOT EXISTS hourly_wage INTEGER, -- 통상 시급 (원)
ADD COLUMN IF NOT EXISTS salary_details_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN users.termination_date IS '퇴사 일자 - 값이 있으면 퇴사자로 분류';
COMMENT ON COLUMN users.contract_end_date IS '계약 종료 일자 - 값이 있으면 계약직으로 분류';
COMMENT ON COLUMN users.work_type IS '근무 형태 - termination_date와 contract_end_date에 따라 자동 업데이트';
COMMENT ON COLUMN users.salary IS '연봉 (만원 단위) - 기존 단순 연봉';
COMMENT ON COLUMN users.salary_updated_at IS '연봉 최종 수정 일시';
COMMENT ON COLUMN users.annual_salary IS '연봉 (만원 단위)';
COMMENT ON COLUMN users.monthly_salary IS '월급여 (만원 단위)';
COMMENT ON COLUMN users.basic_salary IS '기본급 (만원 단위)';
COMMENT ON COLUMN users.bonus IS '상여 (만원 단위)';
COMMENT ON COLUMN users.meal_allowance IS '식대 (만원 단위)';
COMMENT ON COLUMN users.transportation_allowance IS '자가운전 수당 (만원 단위)';
COMMENT ON COLUMN users.hourly_wage IS '통상 시급 (원 단위)';
COMMENT ON COLUMN users.salary_details_updated_at IS '급여 상세 정보 최종 수정 일시';

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

-- 초과근무시간 관리 테이블 생성
CREATE TABLE IF NOT EXISTS overtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  overtime_hours NUMERIC(4,2) DEFAULT 0, -- 초과근무시간
  night_hours NUMERIC(4,2) DEFAULT 0, -- 야간근무시간
  overtime_pay INTEGER DEFAULT 0, -- 계산된 초과수당
  night_pay INTEGER DEFAULT 0, -- 계산된 야간수당
  total_pay INTEGER DEFAULT 0, -- 총 추가수당
  notes TEXT, -- 비고
  approved_by UUID REFERENCES users(id), -- 승인자
  approved_at TIMESTAMP WITH TIME ZONE, -- 승인일시
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초과근무 테이블 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_overtime_records_user_id ON overtime_records(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_work_date ON overtime_records(work_date);
CREATE INDEX IF NOT EXISTS idx_overtime_records_status ON overtime_records(status);

-- 초과근무 테이블 코멘트
COMMENT ON TABLE overtime_records IS '초과근무 및 야간근무 시간 관리';
COMMENT ON COLUMN overtime_records.overtime_hours IS '초과근무시간 (소수점 2자리)';
COMMENT ON COLUMN overtime_records.night_hours IS '야간근무시간 (소수점 2자리)';
COMMENT ON COLUMN overtime_records.overtime_pay IS '초과수당 (시급 × 1.5배)';
COMMENT ON COLUMN overtime_records.night_pay IS '야간수당 (시급 × 1.5배)';

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
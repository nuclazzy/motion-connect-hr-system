-- Supabase users 테이블에 급여 관련 데이터 추가
-- AdminEmployeeManagement 컴포넌트의 급여 관리 기능을 위한 스키마 업데이트

-- 연결 확인
SELECT 'Supabase 연결 확인' as status;

-- 1. 기존 급여 관련 컬럼 추가 (없는 경우에만)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS annual_salary INTEGER DEFAULT 0, -- 연봉 (원 단위)
ADD COLUMN IF NOT EXISTS monthly_salary INTEGER DEFAULT 0, -- 월급여 (원 단위)  
ADD COLUMN IF NOT EXISTS basic_salary INTEGER DEFAULT 0, -- 기본급 (원 단위)
ADD COLUMN IF NOT EXISTS bonus INTEGER DEFAULT 0, -- 상여 (원 단위)
ADD COLUMN IF NOT EXISTS meal_allowance INTEGER DEFAULT 0, -- 식대 (원 단위)
ADD COLUMN IF NOT EXISTS transportation_allowance INTEGER DEFAULT 0, -- 자가운전 수당 (원 단위)
ADD COLUMN IF NOT EXISTS hourly_wage INTEGER DEFAULT 0, -- 통상 시급 (원 단위)
ADD COLUMN IF NOT EXISTS salary_details_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. 기존 컬럼이 있지만 단위가 다른 경우를 위한 업데이트
-- (만원 단위로 저장된 데이터가 있다면 원 단위로 변환)

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_users_monthly_salary ON users(monthly_salary);
CREATE INDEX IF NOT EXISTS idx_users_hourly_wage ON users(hourly_wage);
CREATE INDEX IF NOT EXISTS idx_users_salary_updated_at ON users(salary_details_updated_at);

-- 4. 컬럼 설명 추가/업데이트
COMMENT ON COLUMN users.annual_salary IS '연봉 (원 단위) - 월급여 × 12로 자동 계산';
COMMENT ON COLUMN users.monthly_salary IS '월급여 (원 단위) - 기본 월급';
COMMENT ON COLUMN users.basic_salary IS '기본급 (원 단위) - 월급여에서 수당을 제외한 기본급';
COMMENT ON COLUMN users.bonus IS '상여 (원 단위) - 연간 상여금';
COMMENT ON COLUMN users.meal_allowance IS '식대 (원 단위) - 월별 식대 지원';
COMMENT ON COLUMN users.transportation_allowance IS '자가운전 수당 (원 단위) - 월별 교통비 지원';
COMMENT ON COLUMN users.hourly_wage IS '통상 시급 (원 단위) - 초과근무 수당 계산 기준';
COMMENT ON COLUMN users.salary_details_updated_at IS '급여 상세 정보 최종 수정 일시';

-- 5. 급여 자동 계산 함수 생성/업데이트
CREATE OR REPLACE FUNCTION auto_calculate_salary()
RETURNS TRIGGER AS $$
BEGIN
  -- 월급여가 입력되었을 때 자동 계산
  IF NEW.monthly_salary IS NOT NULL AND NEW.monthly_salary > 0 THEN
    -- 연봉 자동 계산 (월급여 × 12)
    NEW.annual_salary = NEW.monthly_salary * 12;
    
    -- 기본급 자동 계산 (월급여 - 식대 - 자가운전 수당)
    NEW.basic_salary = NEW.monthly_salary 
                      - COALESCE(NEW.meal_allowance, 0) 
                      - COALESCE(NEW.transportation_allowance, 0);
    
    -- 통상시급 자동 계산 (월급여 ÷ 208시간)
    -- 208시간 = 주 40시간 × 52주 ÷ 12개월
    NEW.hourly_wage = ROUND(NEW.monthly_salary / 208.0);
    
    -- 급여 상세 정보 수정 시간 업데이트
    NEW.salary_details_updated_at = NOW();
  END IF;
  
  -- 식대나 자가운전 수당이 변경된 경우에도 기본급 재계산
  IF (OLD.meal_allowance IS DISTINCT FROM NEW.meal_allowance OR 
      OLD.transportation_allowance IS DISTINCT FROM NEW.transportation_allowance) AND
      NEW.monthly_salary IS NOT NULL AND NEW.monthly_salary > 0 THEN
    
    NEW.basic_salary = NEW.monthly_salary 
                      - COALESCE(NEW.meal_allowance, 0) 
                      - COALESCE(NEW.transportation_allowance, 0);
    
    NEW.salary_details_updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. 급여 자동 계산 트리거 생성/업데이트
DROP TRIGGER IF EXISTS trigger_auto_calculate_salary ON users;
CREATE TRIGGER trigger_auto_calculate_salary
  BEFORE INSERT OR UPDATE OF monthly_salary, meal_allowance, transportation_allowance
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_salary();

-- 7. 최저임금 체크 함수 (선택사항)
CREATE OR REPLACE FUNCTION check_minimum_wage()
RETURNS TRIGGER AS $$
DECLARE
  current_minimum_wage INTEGER := 10030; -- 2025년 최저시급
BEGIN
  -- 시급이 최저시급보다 낮은 경우 경고 (차단하지는 않음)
  IF NEW.hourly_wage IS NOT NULL AND NEW.hourly_wage > 0 AND NEW.hourly_wage < current_minimum_wage THEN
    -- 로그에 경고 메시지 출력
    RAISE NOTICE '경고: 직원 %의 시급(%)이 최저시급(%)보다 낮습니다.', 
                 NEW.name, NEW.hourly_wage, current_minimum_wage;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 최저임금 체크 트리거 (선택사항 - 필요시 활성화)
-- DROP TRIGGER IF EXISTS trigger_check_minimum_wage ON users;
-- CREATE TRIGGER trigger_check_minimum_wage
--   AFTER INSERT OR UPDATE OF hourly_wage
--   ON users
--   FOR EACH ROW
--   EXECUTE FUNCTION check_minimum_wage();

-- 9. 급여 데이터 검증을 위한 뷰 생성
CREATE OR REPLACE VIEW user_salary_summary AS
SELECT 
  id,
  name,
  department,
  position,
  monthly_salary,
  annual_salary,
  basic_salary,
  hourly_wage,
  meal_allowance,
  transportation_allowance,
  bonus,
  salary_details_updated_at,
  -- 계산 검증
  (monthly_salary * 12) as calculated_annual_salary,
  (monthly_salary - COALESCE(meal_allowance, 0) - COALESCE(transportation_allowance, 0)) as calculated_basic_salary,
  ROUND(monthly_salary / 208.0) as calculated_hourly_wage,
  -- 최저임금 위반 여부
  CASE 
    WHEN hourly_wage > 0 AND hourly_wage < 10030 THEN true 
    ELSE false 
  END as below_minimum_wage
FROM users
WHERE monthly_salary > 0 OR hourly_wage > 0;

-- 10. 테스트 및 검증 쿼리들
-- 컬럼 존재 여부 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN (
    'annual_salary', 'monthly_salary', 'basic_salary', 'bonus',
    'meal_allowance', 'transportation_allowance', 'hourly_wage',
    'salary_details_updated_at'
  )
ORDER BY column_name;

-- 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND trigger_name = 'trigger_auto_calculate_salary';

-- 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'users' 
  AND indexname LIKE '%salary%';

-- 현재 급여 데이터가 있는 직원 수 확인
SELECT 
  COUNT(*) as total_users,
  COUNT(CASE WHEN monthly_salary > 0 THEN 1 END) as users_with_salary,
  COUNT(CASE WHEN hourly_wage > 0 THEN 1 END) as users_with_hourly_wage,
  AVG(CASE WHEN monthly_salary > 0 THEN monthly_salary END) as avg_monthly_salary,
  AVG(CASE WHEN hourly_wage > 0 THEN hourly_wage END) as avg_hourly_wage
FROM users;

-- 사용 방법 및 주의사항:
/*
1. AdminEmployeeManagement 컴포넌트에서 급여 정보 입력/수정 가능
2. 월급여 입력 시 연봉, 기본급, 시급이 자동으로 계산됨
3. 식대, 자가운전 수당 변경 시 기본급이 자동으로 재계산됨
4. 모든 금액은 원 단위로 저장 (콤마는 UI에서만 표시)

자동 계산 공식:
- 연봉 = 월급여 × 12
- 기본급 = 월급여 - 식대 - 자가운전 수당
- 통상시급 = 월급여 ÷ 208시간 (근로기준법 기준)

주의사항:
- 기존 데이터가 만원 단위로 저장되어 있다면 × 10000 변환 필요
- 트리거는 월급여 변경 시에만 작동하므로 초기 데이터는 수동 입력 필요
- 최저임금 체크는 현재 비활성화 상태 (필요시 트리거 활성화)
*/

-- 성공 메시지
SELECT '급여 관련 컬럼 및 기능이 성공적으로 추가되었습니다.' as result;
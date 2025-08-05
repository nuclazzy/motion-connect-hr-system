-- car_allowance 컬럼 추가 (자가운전 보조비)

-- 1. users 테이블에 car_allowance 컬럼 추가
ALTER TABLE users
ADD COLUMN IF NOT EXISTS car_allowance INTEGER DEFAULT 0;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN users.car_allowance IS '자가운전 보조비 (원 단위) - 월별 차량 유지비 지원';

-- 3. 기본급 계산 트리거 함수 업데이트
CREATE OR REPLACE FUNCTION calculate_salary_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT 시 연봉 계산
  IF TG_OP = 'INSERT' AND NEW.monthly_salary IS NOT NULL THEN
    NEW.annual_salary = NEW.monthly_salary * 12;
    NEW.basic_salary = GREATEST(NEW.monthly_salary 
                      - COALESCE(NEW.meal_allowance, 0) 
                      - COALESCE(NEW.transportation_allowance, 0)
                      - COALESCE(NEW.car_allowance, 0), 0);
    IF NEW.basic_salary > 0 THEN
      NEW.hourly_wage = ROUND(NEW.basic_salary / 209);
    END IF;
  END IF;
  
  -- UPDATE 시 기본급 재계산
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.meal_allowance IS DISTINCT FROM NEW.meal_allowance OR 
        OLD.transportation_allowance IS DISTINCT FROM NEW.transportation_allowance OR
        OLD.car_allowance IS DISTINCT FROM NEW.car_allowance OR
        OLD.monthly_salary IS DISTINCT FROM NEW.monthly_salary) THEN
      NEW.basic_salary = GREATEST(NEW.monthly_salary 
                      - COALESCE(NEW.meal_allowance, 0) 
                      - COALESCE(NEW.transportation_allowance, 0)
                      - COALESCE(NEW.car_allowance, 0), 0);
      IF NEW.basic_salary > 0 THEN
        NEW.hourly_wage = ROUND(NEW.basic_salary / 209);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 재생성 (car_allowance 변경 시에도 트리거 실행)
DROP TRIGGER IF EXISTS update_salary_fields ON users;

CREATE TRIGGER update_salary_fields
  BEFORE INSERT OR UPDATE OF monthly_salary, meal_allowance, transportation_allowance, car_allowance
  ON users
  FOR EACH ROW
  EXECUTE FUNCTION calculate_salary_fields();

-- 5. 기존 데이터 업데이트 (기본급 재계산)
UPDATE users
SET basic_salary = GREATEST(monthly_salary 
                  - COALESCE(meal_allowance, 0) 
                  - COALESCE(transportation_allowance, 0)
                  - COALESCE(car_allowance, 0), 0),
    hourly_wage = CASE 
                    WHEN GREATEST(monthly_salary 
                        - COALESCE(meal_allowance, 0) 
                        - COALESCE(transportation_allowance, 0)
                        - COALESCE(car_allowance, 0), 0) > 0 
                    THEN ROUND(GREATEST(monthly_salary 
                        - COALESCE(meal_allowance, 0) 
                        - COALESCE(transportation_allowance, 0)
                        - COALESCE(car_allowance, 0), 0) / 209)
                    ELSE 0
                  END
WHERE monthly_salary IS NOT NULL;

SELECT 'car_allowance 컬럼 추가 완료' as status;
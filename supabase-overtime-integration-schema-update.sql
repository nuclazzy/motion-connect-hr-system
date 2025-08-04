-- 초과근무 관리 통합을 위한 스키마 업데이트
-- AdminEmployeeManagement 컴포넌트의 급여 관리 탭에 초과근무 기능 통합

-- 1. 기존 overtime_records 테이블이 없는 경우 생성
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
  admin_notes TEXT, -- 거절 시 관리자 메모
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 초과근무 테이블 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_overtime_records_user_id ON overtime_records(user_id);
CREATE INDEX IF NOT EXISTS idx_overtime_records_work_date ON overtime_records(work_date);
CREATE INDEX IF NOT EXISTS idx_overtime_records_status ON overtime_records(status);
CREATE INDEX IF NOT EXISTS idx_overtime_records_user_date ON overtime_records(user_id, work_date);

-- 3. 초과근무 테이블 코멘트 추가
COMMENT ON TABLE overtime_records IS '초과근무 및 야간근무 시간 관리 - AdminEmployeeManagement 급여 탭에서 관리';
COMMENT ON COLUMN overtime_records.overtime_hours IS '초과근무시간 (소수점 2자리)';
COMMENT ON COLUMN overtime_records.night_hours IS '야간근무시간 (소수점 2자리)';
COMMENT ON COLUMN overtime_records.overtime_pay IS '초과수당 (시급 × 1.5배)';
COMMENT ON COLUMN overtime_records.night_pay IS '야간수당 (시급 × 1.5배)';
COMMENT ON COLUMN overtime_records.admin_notes IS '거절 시 관리자 메모';

-- 4. 초과근무 자동 수당 계산 함수
CREATE OR REPLACE FUNCTION calculate_overtime_pay()
RETURNS TRIGGER AS $$
DECLARE
  employee_hourly_wage INTEGER;
BEGIN
  -- 직원의 시급 조회
  SELECT hourly_wage INTO employee_hourly_wage
  FROM users 
  WHERE id = NEW.user_id;
  
  -- 시급이 설정되어 있는 경우에만 계산
  IF employee_hourly_wage IS NOT NULL AND employee_hourly_wage > 0 THEN
    -- 초과근무수당 계산 (시급 × 1.5배)
    NEW.overtime_pay = ROUND(employee_hourly_wage * NEW.overtime_hours * 1.5);
    
    -- 야간근로수당 계산 (시급 × 1.5배)
    NEW.night_pay = ROUND(employee_hourly_wage * NEW.night_hours * 1.5);
    
    -- 총 수당 계산
    NEW.total_pay = NEW.overtime_pay + NEW.night_pay;
  ELSE
    -- 시급이 없는 경우 0으로 설정
    NEW.overtime_pay = 0;
    NEW.night_pay = 0;
    NEW.total_pay = 0;
  END IF;
  
  -- 업데이트 시간 설정
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 초과근무 자동 계산 트리거 생성
DROP TRIGGER IF EXISTS trigger_calculate_overtime_pay ON overtime_records;
CREATE TRIGGER trigger_calculate_overtime_pay
  BEFORE INSERT OR UPDATE OF overtime_hours, night_hours, user_id
  ON overtime_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_overtime_pay();

-- 6. 승인 시간 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_overtime_approval_time()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 승인 또는 거절로 변경되었을 때 승인 시간 업데이트
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    NEW.approved_at = NOW();
    
    -- 승인자 ID는 애플리케이션에서 설정하므로 여기서는 처리하지 않음
  END IF;
  
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 승인 시간 자동 업데이트 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_overtime_approval_time ON overtime_records;
CREATE TRIGGER trigger_update_overtime_approval_time
  BEFORE UPDATE OF status
  ON overtime_records
  FOR EACH ROW
  EXECUTE FUNCTION update_overtime_approval_time();

-- 8. API 엔드포인트를 위한 뷰 생성 (성능 최적화)
-- 먼저 hourly_wage 컬럼이 존재하는지 확인하고 뷰 생성
DO $$
BEGIN
  -- hourly_wage 컬럼이 존재하는 경우 포함한 뷰 생성
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hourly_wage') THEN
    EXECUTE 'CREATE OR REPLACE VIEW overtime_records_with_users AS
    SELECT 
      ot.*,
      u.name as user_name,
      u.department as user_department,
      u.position as user_position,
      u.hourly_wage as user_hourly_wage
    FROM overtime_records ot
    JOIN users u ON ot.user_id = u.id';
  ELSE
    -- hourly_wage 컬럼이 없는 경우 NULL로 설정한 뷰 생성
    EXECUTE 'CREATE OR REPLACE VIEW overtime_records_with_users AS
    SELECT 
      ot.*,
      u.name as user_name,
      u.department as user_department,
      u.position as user_position,
      NULL::INTEGER as user_hourly_wage
    FROM overtime_records ot
    JOIN users u ON ot.user_id = u.id';
  END IF;
END $$;

-- 9. 월별 초과근무 통계 뷰
CREATE OR REPLACE VIEW monthly_overtime_stats AS
SELECT 
  user_id,
  u.name as user_name,
  u.department as user_department,
  DATE_TRUNC('month', work_date) as month,
  COUNT(*) as total_records,
  SUM(overtime_hours) as total_overtime_hours,
  SUM(night_hours) as total_night_hours,
  SUM(total_pay) as total_overtime_pay,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_records,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_records,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_records
FROM overtime_records ot
JOIN users u ON ot.user_id = u.id
GROUP BY user_id, u.name, u.department, DATE_TRUNC('month', work_date);

-- 10. 데이터 검증 함수 (선택사항)
CREATE OR REPLACE FUNCTION validate_overtime_record()
RETURNS TRIGGER AS $$
BEGIN
  -- 근무일이 미래 날짜가 아닌지 확인
  IF NEW.work_date > CURRENT_DATE THEN
    RAISE EXCEPTION '근무일은 미래 날짜가 될 수 없습니다.';
  END IF;
  
  -- 초과근무시간과 야간근무시간이 모두 0이 아닌지 확인
  IF NEW.overtime_hours <= 0 AND NEW.night_hours <= 0 THEN
    RAISE EXCEPTION '초과근무시간 또는 야간근무시간 중 하나는 0보다 커야 합니다.';
  END IF;
  
  -- 시간이 너무 크지 않은지 확인 (24시간 이하)
  IF NEW.overtime_hours > 24 OR NEW.night_hours > 24 THEN
    RAISE EXCEPTION '근무시간은 24시간을 초과할 수 없습니다.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. 데이터 검증 트리거 (선택사항 - 필요시 활성화)
-- DROP TRIGGER IF EXISTS trigger_validate_overtime_record ON overtime_records;
-- CREATE TRIGGER trigger_validate_overtime_record
--   BEFORE INSERT OR UPDATE
--   ON overtime_records
--   FOR EACH ROW
--   EXECUTE FUNCTION validate_overtime_record();

-- 12. 테스트 및 확인 쿼리
-- 테이블 구조 확인
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'overtime_records'
ORDER BY ordinal_position;

-- 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'overtime_records'
ORDER BY trigger_name;

-- 뷰 확인
SELECT 
  table_name,
  view_definition
FROM information_schema.views 
WHERE table_name LIKE '%overtime%';

-- 인덱스 확인
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'overtime_records';

-- 사용 예시 및 주의사항:
/*
1. AdminEmployeeManagement 컴포넌트의 급여 관리 탭에서 초과근무를 통합 관리
2. 직원별로 월단위 초과근무 기록 조회 및 관리
3. 시급 기반 자동 수당 계산
4. 승인/거절 워크플로우 지원

주요 API 엔드포인트:
- GET /api/admin/overtime?month=2024-01&user_id=xxx : 특정 직원의 월별 초과근무 조회
- POST /api/admin/overtime : 초과근무 기록 생성
- PATCH /api/admin/overtime/:id : 초과근무 승인/거절

데이터 무결성:
- user_id는 users 테이블의 외래키
- 시급이 설정되지 않은 직원은 수당이 0으로 계산됨
- 승인/거절 시 자동으로 approved_at 시간 기록
*/
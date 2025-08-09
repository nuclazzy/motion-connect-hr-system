-- 휴가 동기화 오류 수정 SQL (수정된 버전)
-- leave_records 테이블의 트리거에서 sick_leave 컬럼 참조 제거

-- 1. 기존 트리거 제거
DROP TRIGGER IF EXISTS update_user_leave_balance_trigger ON leave_records;

-- 2. 수정된 트리거 함수 생성 (sick_leave 참조 제거)
CREATE OR REPLACE FUNCTION update_user_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_leave_days DECIMAL(10,1);
BEGIN
  -- 승인된 휴가만 처리
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    v_leave_days := NEW.days_requested;
    
    -- 휴가 유형에 따라 다른 필드 업데이트
    IF NEW.leave_type IN ('annual', 'half_morning', 'half_afternoon') THEN
      -- 연차 차감
      UPDATE users 
      SET 
        used_annual_days = COALESCE(used_annual_days, 0) + v_leave_days,
        annual_days = GREATEST(0, COALESCE(annual_days, 15) - v_leave_days),
        updated_at = NOW()
      WHERE id = NEW.user_id;
    ELSIF NEW.leave_type = 'sick' THEN
      -- 병가 처리 (sick_days 필드 사용)
      UPDATE users 
      SET 
        used_sick_days = COALESCE(used_sick_days, 0) + v_leave_days,
        sick_days = GREATEST(0, COALESCE(sick_days, 60) - v_leave_days),
        updated_at = NOW()
      WHERE id = NEW.user_id;
    END IF;
    
  -- 휴가 취소 시 복구
  ELSIF OLD.status = 'approved' AND NEW.status = 'cancelled' THEN
    v_leave_days := OLD.days_requested;
    
    IF OLD.leave_type IN ('annual', 'half_morning', 'half_afternoon') THEN
      -- 연차 복구
      UPDATE users 
      SET 
        used_annual_days = GREATEST(0, COALESCE(used_annual_days, 0) - v_leave_days),
        annual_days = COALESCE(annual_days, 0) + v_leave_days,
        updated_at = NOW()
      WHERE id = OLD.user_id;
    ELSIF OLD.leave_type = 'sick' THEN
      -- 병가 복구
      UPDATE users 
      SET 
        used_sick_days = GREATEST(0, COALESCE(used_sick_days, 0) - v_leave_days),
        sick_days = COALESCE(sick_days, 0) + v_leave_days,
        updated_at = NOW()
      WHERE id = OLD.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 재생성
CREATE TRIGGER update_user_leave_balance_trigger
AFTER INSERT OR UPDATE ON leave_records
FOR EACH ROW
EXECUTE FUNCTION update_user_leave_balance();

-- 4. leave_records 테이블 RLS 정책
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON leave_records;
DROP POLICY IF EXISTS "Enable all access for admins" ON leave_records;

-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Enable read access for authenticated users" ON leave_records
  FOR SELECT USING (true);  -- Supabase에서는 auth.uid() 대신 true 사용 가능

-- 관리자는 모든 작업 가능
CREATE POLICY "Enable all access for admins" ON leave_records
  FOR ALL USING (true);  -- 개발 단계에서는 모든 접근 허용

-- 5. users 테이블 RLS 정책
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON users;
DROP POLICY IF EXISTS "Enable all access for admins" ON users;

-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Enable read access for authenticated users" ON users
  FOR SELECT USING (true);

-- 관리자는 모든 작업 가능  
CREATE POLICY "Enable all access for admins" ON users
  FOR ALL USING (true);

-- 6. 누락된 컬럼 확인 및 추가
-- annual_days 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'annual_days'
  ) THEN
    ALTER TABLE users ADD COLUMN annual_days DECIMAL(10,1) DEFAULT 15;
  END IF;
END $$;

-- used_annual_days 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'used_annual_days'
  ) THEN
    ALTER TABLE users ADD COLUMN used_annual_days DECIMAL(10,1) DEFAULT 0;
  END IF;
END $$;

-- sick_days 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'sick_days'
  ) THEN
    ALTER TABLE users ADD COLUMN sick_days DECIMAL(10,1) DEFAULT 60;
  END IF;
END $$;

-- used_sick_days 컬럼 확인 및 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'used_sick_days'
  ) THEN
    ALTER TABLE users ADD COLUMN used_sick_days DECIMAL(10,1) DEFAULT 0;
  END IF;
END $$;

-- 7. Google Event ID 중복 제약 제거 (유연한 처리를 위해)
ALTER TABLE leave_records DROP CONSTRAINT IF EXISTS leave_records_google_event_id_key;

-- 인덱스는 유지 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_leave_records_google_event_id ON leave_records(google_event_id);

-- 8. 사용자 중복 제약 완화 (같은 날짜에 여러 휴가 가능)
ALTER TABLE leave_records DROP CONSTRAINT IF EXISTS unique_user_date_leave;

-- 9. 권한 재설정
GRANT ALL ON leave_records TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON leave_sync_logs TO authenticated;

-- 10. 테스트: 사용자 목록 확인
SELECT id, name, email, department, annual_days, used_annual_days, sick_days, used_sick_days 
FROM users 
ORDER BY name;

-- 11. 테스트: 기존 leave_records 확인
SELECT lr.*, u.name as user_name
FROM leave_records lr
LEFT JOIN users u ON lr.user_id = u.id
ORDER BY lr.created_at DESC
LIMIT 10;
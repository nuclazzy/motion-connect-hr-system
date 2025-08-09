-- 휴가 캘린더 동기화를 위한 테이블 스키마
-- Google Calendar "연차 및 경조사 현황"과 동기화

-- 1. 휴가 기록 테이블 (Google Calendar 동기화용)
CREATE TABLE IF NOT EXISTS leave_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  leave_type VARCHAR(50) NOT NULL, -- 'annual', 'half_morning', 'half_afternoon', 'sick', 'special', 'other'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  days_requested DECIMAL(10,1) NOT NULL, -- 신청일수 (반차는 0.5)
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  
  -- Google Calendar 연동 필드
  google_event_id VARCHAR(255) UNIQUE, -- Google Calendar 이벤트 ID
  calendar_id VARCHAR(255), -- 캘린더 ID
  synced_at TIMESTAMP WITH TIME ZONE, -- 마지막 동기화 시간
  
  -- 승인 정보
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- 메타 정보
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_leave_records_user_id ON leave_records(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_start_date ON leave_records(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_records_end_date ON leave_records(end_date);
CREATE INDEX IF NOT EXISTS idx_leave_records_status ON leave_records(status);
CREATE INDEX IF NOT EXISTS idx_leave_records_google_event_id ON leave_records(google_event_id);
CREATE INDEX IF NOT EXISTS idx_leave_records_leave_type ON leave_records(leave_type);

-- 3. 휴가 동기화 로그 테이블
CREATE TABLE IF NOT EXISTS leave_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'webhook'
  sync_year INTEGER NOT NULL,
  total_events INTEGER DEFAULT 0,
  synced_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  errors JSONB, -- 에러 상세 정보
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id)
);

-- 4. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_leave_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 업데이트 트리거 생성
DROP TRIGGER IF EXISTS update_leave_records_updated_at_trigger ON leave_records;
CREATE TRIGGER update_leave_records_updated_at_trigger
BEFORE UPDATE ON leave_records
FOR EACH ROW
EXECUTE FUNCTION update_leave_records_updated_at();

-- 6. 휴가 사용 후 잔여 휴가 업데이트 함수
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
        used_leave_days = COALESCE(used_leave_days, 0) + v_leave_days,
        remaining_leave_days = COALESCE(annual_leave_days, 15) - (COALESCE(used_leave_days, 0) + v_leave_days)
      WHERE id = NEW.user_id;
    ELSIF NEW.leave_type = 'sick' THEN
      -- 병가 처리 (별도 필드가 있다면)
      UPDATE users 
      SET sick_leave = COALESCE(sick_leave, 0) - v_leave_days
      WHERE id = NEW.user_id AND sick_leave IS NOT NULL;
    END IF;
    
  -- 휴가 취소 시 복구
  ELSIF OLD.status = 'approved' AND NEW.status = 'cancelled' THEN
    v_leave_days := OLD.days_requested;
    
    IF OLD.leave_type IN ('annual', 'half_morning', 'half_afternoon') THEN
      -- 연차 복구
      UPDATE users 
      SET 
        used_leave_days = GREATEST(0, COALESCE(used_leave_days, 0) - v_leave_days),
        remaining_leave_days = COALESCE(annual_leave_days, 15) - GREATEST(0, COALESCE(used_leave_days, 0) - v_leave_days)
      WHERE id = OLD.user_id;
    ELSIF OLD.leave_type = 'sick' THEN
      -- 병가 복구
      UPDATE users 
      SET sick_leave = COALESCE(sick_leave, 0) + v_leave_days
      WHERE id = OLD.user_id AND sick_leave IS NOT NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 휴가 잔여일수 업데이트 트리거
DROP TRIGGER IF EXISTS update_user_leave_balance_trigger ON leave_records;
CREATE TRIGGER update_user_leave_balance_trigger
AFTER INSERT OR UPDATE ON leave_records
FOR EACH ROW
EXECUTE FUNCTION update_user_leave_balance();

-- 8. 중복 동기화 방지를 위한 유니크 제약 추가
ALTER TABLE leave_records 
ADD CONSTRAINT unique_user_date_leave 
UNIQUE (user_id, start_date, end_date, leave_type);

-- 9. 휴가 통계 뷰
CREATE OR REPLACE VIEW leave_statistics AS
SELECT 
  u.id as user_id,
  u.name,
  u.department,
  u.position,
  u.annual_leave_days,
  u.used_leave_days,
  u.remaining_leave_days,
  COUNT(CASE WHEN lr.leave_type = 'annual' AND lr.status = 'approved' THEN 1 END) as annual_count,
  COUNT(CASE WHEN lr.leave_type IN ('half_morning', 'half_afternoon') AND lr.status = 'approved' THEN 1 END) as half_day_count,
  COUNT(CASE WHEN lr.leave_type = 'sick' AND lr.status = 'approved' THEN 1 END) as sick_count,
  COUNT(CASE WHEN lr.leave_type = 'special' AND lr.status = 'approved' THEN 1 END) as special_count,
  SUM(CASE WHEN lr.status = 'approved' THEN lr.days_requested ELSE 0 END) as total_days_used
FROM users u
LEFT JOIN leave_records lr ON u.id = lr.user_id 
  AND EXTRACT(YEAR FROM lr.start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY u.id, u.name, u.department, u.position, u.annual_leave_days, u.used_leave_days, u.remaining_leave_days;

-- 10. 권한 설정
GRANT SELECT, INSERT, UPDATE ON leave_records TO authenticated;
GRANT SELECT ON leave_statistics TO authenticated;
GRANT SELECT, INSERT ON leave_sync_logs TO authenticated;
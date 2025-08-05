-- quarterly_work_summary 테이블 스키마 수정 및 누락된 컬럼 추가

-- 1. 현재 테이블 구조 확인
SELECT 
  '=== quarterly_work_summary 테이블 현재 구조 ===' as status,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'quarterly_work_summary'
ORDER BY ordinal_position;

-- 2. 테이블 존재 여부 확인
SELECT 
  '=== 테이블 존재 확인 ===' as status,
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'quarterly_work_summary'
  ) as table_exists;

-- 3. quarterly_work_summary 테이블 생성 또는 수정
CREATE TABLE IF NOT EXISTS quarterly_work_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  quarter_start_date DATE NOT NULL,
  quarter_end_date DATE NOT NULL,
  total_basic_hours DECIMAL(6,1) DEFAULT 0,
  total_overtime_hours DECIMAL(6,1) DEFAULT 0, -- 누락된 컬럼 추가
  total_night_hours DECIMAL(6,1) DEFAULT 0,
  quarterly_overtime_settlement DECIMAL(6,1) DEFAULT 0,
  is_settled BOOLEAN DEFAULT false,
  settled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quarter_start_date)
);

-- 4. 누락된 컬럼들을 안전하게 추가
DO $$
BEGIN
  -- total_overtime_hours 컬럼 추가
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN total_overtime_hours DECIMAL(6,1) DEFAULT 0;
    
    RAISE NOTICE '✅ total_overtime_hours 컬럼이 추가되었습니다.';
  EXCEPTION WHEN duplicate_column THEN
    RAISE NOTICE 'ℹ️ total_overtime_hours 컬럼이 이미 존재합니다.';
  END;
  
  -- 다른 누락될 수 있는 컬럼들도 확인 및 추가
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN IF NOT EXISTS total_basic_hours DECIMAL(6,1) DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 이미 존재할 경우 무시
  END;
  
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN IF NOT EXISTS total_night_hours DECIMAL(6,1) DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 이미 존재할 경우 무시
  END;
  
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN IF NOT EXISTS quarterly_overtime_settlement DECIMAL(6,1) DEFAULT 0;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 이미 존재할 경우 무시
  END;
  
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 이미 존재할 경우 무시
  END;
  
  BEGIN
    ALTER TABLE quarterly_work_summary 
    ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- 이미 존재할 경우 무시
  END;
END $$;

-- 5. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_quarterly_work_summary_user_quarter 
ON quarterly_work_summary(user_id, quarter_start_date);

CREATE INDEX IF NOT EXISTS idx_quarterly_work_summary_date_range 
ON quarterly_work_summary(quarter_start_date, quarter_end_date);

-- 6. 3개월 분기별 초과근무 정산 함수 재생성 (수정된 스키마 반영)
CREATE OR REPLACE FUNCTION calculate_quarterly_overtime()
RETURNS TRIGGER AS $$
DECLARE
  quarter_start DATE;
  quarter_end DATE;
  total_basic DECIMAL(6,1) := 0;
  total_overtime DECIMAL(6,1) := 0;
  total_night DECIMAL(6,1) := 0;
  settlement_overtime DECIMAL(6,1) := 0;
  standard_hours_per_quarter DECIMAL(6,1) := 520; -- 3개월 기준 근무시간 (65일 * 8시간)
BEGIN
  -- 분기 시작일과 종료일 계산
  quarter_start := DATE_TRUNC('month', NEW.work_date - INTERVAL '2 months')::DATE;
  quarter_end := (DATE_TRUNC('month', NEW.work_date) + INTERVAL '1 month - 1 day')::DATE;
  
  -- 해당 분기의 모든 근무시간 합계 계산
  SELECT 
    COALESCE(SUM(basic_hours), 0),
    COALESCE(SUM(overtime_hours), 0),
    COALESCE(SUM(night_hours), 0)
  INTO total_basic, total_overtime, total_night
  FROM daily_work_summary
  WHERE user_id = NEW.user_id
  AND work_date BETWEEN quarter_start AND quarter_end;
  
  -- 3개월 탄력근무제 초과근무 정산
  -- 전체 근무시간에서 기준시간과 야간시간을 뺀 나머지가 정산 초과근무
  settlement_overtime := GREATEST(0, (total_basic + total_overtime) - standard_hours_per_quarter - total_night);
  
  -- quarterly_work_summary 테이블 업데이트 (수정된 스키마 사용)
  INSERT INTO quarterly_work_summary (
    user_id,
    quarter_start_date,
    quarter_end_date,
    total_basic_hours,
    total_overtime_hours,
    total_night_hours,
    quarterly_overtime_settlement,
    is_settled,
    updated_at
  ) VALUES (
    NEW.user_id,
    quarter_start,
    quarter_end,
    total_basic,
    total_overtime,
    total_night,
    settlement_overtime,
    false,
    NOW()
  )
  ON CONFLICT (user_id, quarter_start_date)
  DO UPDATE SET
    total_basic_hours = EXCLUDED.total_basic_hours,
    total_overtime_hours = EXCLUDED.total_overtime_hours,
    total_night_hours = EXCLUDED.total_night_hours,
    quarterly_overtime_settlement = EXCLUDED.quarterly_overtime_settlement,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. 트리거 재생성 (함수 업데이트 반영)
DROP TRIGGER IF EXISTS trigger_calculate_quarterly_overtime ON daily_work_summary;

CREATE TRIGGER trigger_calculate_quarterly_overtime
  AFTER INSERT OR UPDATE ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quarterly_overtime();

-- 8. 수정 완료 확인
SELECT 
  '=== quarterly_work_summary 스키마 수정 완료 ===' as status,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'quarterly_work_summary'
ORDER BY ordinal_position;

-- 9. 완료 메시지
SELECT 
  '🔧 quarterly_work_summary 테이블 스키마 수정 완료!' as message,
  '✅ total_overtime_hours 컬럼 추가' as column_added,
  '✅ 누락된 모든 컬럼 확인 및 추가' as all_columns_checked,
  '✅ 3개월 분기별 정산 함수 업데이트' as function_updated,
  '✅ 트리거 재생성 완료' as trigger_recreated;
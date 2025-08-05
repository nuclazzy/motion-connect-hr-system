-- 3개월 탄력근무제 초과근무 정산 시스템

-- 1. 3개월 단위 근무시간 집계 테이블 생성
CREATE TABLE IF NOT EXISTS quarterly_work_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quarter_start_date DATE NOT NULL,
  quarter_end_date DATE NOT NULL,
  
  -- 3개월 총 근무시간
  total_work_hours DECIMAL(6,1) DEFAULT 0,        -- 총 실근무시간
  total_basic_hours DECIMAL(6,1) DEFAULT 0,       -- 총 기본근무시간
  total_night_hours DECIMAL(6,1) DEFAULT 0,       -- 총 야간근무시간 (매월 정산됨)
  total_holiday_hours DECIMAL(6,1) DEFAULT 0,     -- 총 휴일근무시간 (별도 정산)
  
  -- 3개월 기준근로시간
  standard_work_hours DECIMAL(6,1) DEFAULT 520,   -- 3개월 기준 (173.33 * 3)
  
  -- 3개월 통합 정산
  quarterly_overtime_hours DECIMAL(6,1) DEFAULT 0, -- 3개월 초과근무시간
  settlement_status VARCHAR(20) DEFAULT 'pending', -- pending, calculated, settled
  
  -- 정산 정보
  calculated_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  settled_by UUID REFERENCES users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, quarter_start_date)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quarterly_work_summary_user_dates 
ON quarterly_work_summary(user_id, quarter_start_date, quarter_end_date);

-- 2. 3개월 단위 집계 함수
CREATE OR REPLACE FUNCTION calculate_quarterly_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_quarter_start DATE;
  v_quarter_end DATE;
  v_total_work_hours DECIMAL(6,1);
  v_total_basic_hours DECIMAL(6,1);
  v_total_night_hours DECIMAL(6,1);
  v_total_holiday_hours DECIMAL(6,1);
  v_standard_hours DECIMAL(6,1);
  v_quarterly_overtime DECIMAL(6,1);
  v_current_month INTEGER;
BEGIN
  -- 현재 월이 분기 마지막 월인지 확인 (3, 6, 9, 12월)
  v_current_month := EXTRACT(MONTH FROM NEW.work_date);
  
  -- 분기 마지막 월이 아니면 종료
  IF v_current_month % 3 != 0 THEN
    RETURN NEW;
  END IF;
  
  -- 분기 시작일과 종료일 계산
  v_quarter_start := DATE_TRUNC('month', NEW.work_date - INTERVAL '2 months');
  v_quarter_end := DATE_TRUNC('month', NEW.work_date) + INTERVAL '1 month' - INTERVAL '1 day';
  
  -- 3개월간 총 근무시간 집계
  SELECT 
    COALESCE(SUM(basic_hours + overtime_hours), 0),
    COALESCE(SUM(basic_hours), 0),
    COALESCE(SUM(night_hours), 0),
    COALESCE(SUM(
      CASE 
        WHEN work_status LIKE '%일요일%' OR work_status LIKE '%공휴일%' 
        THEN basic_hours + overtime_hours 
        ELSE 0 
      END
    ), 0)
  INTO 
    v_total_work_hours,
    v_total_basic_hours,
    v_total_night_hours,
    v_total_holiday_hours
  FROM daily_work_summary
  WHERE user_id = NEW.user_id
  AND work_date BETWEEN v_quarter_start AND v_quarter_end;
  
  -- 3개월 기준근로시간 (탄력근무제 설정 확인)
  SELECT COALESCE(
    (SELECT SUM(
      CASE 
        WHEN fws.weekly_standard_hours IS NOT NULL 
        THEN fws.weekly_standard_hours * 4.33 -- 주당 시간 * 월평균 주수
        ELSE 173.33 -- 기본값
      END
    )
    FROM flex_work_settings fws
    WHERE v_quarter_start BETWEEN fws.start_date AND fws.end_date
    AND fws.is_active = true
    LIMIT 1),
    520 -- 3개월 기본값 (173.33 * 3)
  ) INTO v_standard_hours;
  
  -- 3개월 초과근무시간 계산
  -- 총 실근무시간 - 기준근로시간 - 야간근무시간(이미 정산됨)
  v_quarterly_overtime := GREATEST(
    0, 
    v_total_work_hours - v_standard_hours - v_total_night_hours
  );
  
  -- quarterly_work_summary 테이블 업데이트
  INSERT INTO quarterly_work_summary (
    user_id,
    quarter_start_date,
    quarter_end_date,
    total_work_hours,
    total_basic_hours,
    total_night_hours,
    total_holiday_hours,
    standard_work_hours,
    quarterly_overtime_hours,
    settlement_status,
    calculated_at
  ) VALUES (
    NEW.user_id,
    v_quarter_start,
    v_quarter_end,
    v_total_work_hours,
    v_total_basic_hours,
    v_total_night_hours,
    v_total_holiday_hours,
    v_standard_hours,
    v_quarterly_overtime,
    'calculated',
    NOW()
  )
  ON CONFLICT (user_id, quarter_start_date)
  DO UPDATE SET
    quarter_end_date = EXCLUDED.quarter_end_date,
    total_work_hours = EXCLUDED.total_work_hours,
    total_basic_hours = EXCLUDED.total_basic_hours,
    total_night_hours = EXCLUDED.total_night_hours,
    total_holiday_hours = EXCLUDED.total_holiday_hours,
    standard_work_hours = EXCLUDED.standard_work_hours,
    quarterly_overtime_hours = EXCLUDED.quarterly_overtime_hours,
    settlement_status = 'calculated',
    calculated_at = NOW(),
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. 트리거 생성 (매일 업데이트 시 3개월 집계)
CREATE TRIGGER trigger_calculate_quarterly_overtime
  AFTER INSERT OR UPDATE ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quarterly_overtime();

-- 4. 3개월 정산 조회 뷰
CREATE OR REPLACE VIEW quarterly_overtime_view AS
SELECT 
  u.name as employee_name,
  u.department,
  qws.quarter_start_date,
  qws.quarter_end_date,
  qws.total_work_hours,
  qws.total_basic_hours,
  qws.total_night_hours,
  qws.total_holiday_hours,
  qws.standard_work_hours,
  qws.quarterly_overtime_hours,
  qws.settlement_status,
  qws.calculated_at,
  qws.settled_at,
  su.name as settled_by_name
FROM quarterly_work_summary qws
JOIN users u ON qws.user_id = u.id
LEFT JOIN users su ON qws.settled_by = su.id
ORDER BY qws.quarter_start_date DESC, u.name;

-- 5. 기존 데이터에 대한 3개월 집계 실행 (2025년 1-3월, 4-6월)
-- 2025년 1-3월 집계
INSERT INTO quarterly_work_summary (
  user_id,
  quarter_start_date,
  quarter_end_date,
  total_work_hours,
  total_basic_hours,
  total_night_hours,
  total_holiday_hours,
  standard_work_hours,
  quarterly_overtime_hours,
  settlement_status,
  calculated_at
)
SELECT 
  u.id,
  '2025-01-01'::DATE,
  '2025-03-31'::DATE,
  COALESCE(SUM(dws.basic_hours + dws.overtime_hours), 0),
  COALESCE(SUM(dws.basic_hours), 0),
  COALESCE(SUM(dws.night_hours), 0),
  COALESCE(SUM(
    CASE 
      WHEN dws.work_status LIKE '%일요일%' OR dws.work_status LIKE '%공휴일%' 
      THEN dws.basic_hours + dws.overtime_hours 
      ELSE 0 
    END
  ), 0),
  520, -- 3개월 기준
  GREATEST(
    0, 
    COALESCE(SUM(dws.basic_hours + dws.overtime_hours), 0) - 520 - COALESCE(SUM(dws.night_hours), 0)
  ),
  'calculated',
  NOW()
FROM users u
LEFT JOIN daily_work_summary dws ON u.id = dws.user_id 
  AND dws.work_date BETWEEN '2025-01-01' AND '2025-03-31'
WHERE u.role = 'employee'
GROUP BY u.id
ON CONFLICT (user_id, quarter_start_date) DO NOTHING;

-- 2025년 4-6월 집계
INSERT INTO quarterly_work_summary (
  user_id,
  quarter_start_date,
  quarter_end_date,
  total_work_hours,
  total_basic_hours,
  total_night_hours,
  total_holiday_hours,
  standard_work_hours,
  quarterly_overtime_hours,
  settlement_status,
  calculated_at
)
SELECT 
  u.id,
  '2025-04-01'::DATE,
  '2025-06-30'::DATE,
  COALESCE(SUM(dws.basic_hours + dws.overtime_hours), 0),
  COALESCE(SUM(dws.basic_hours), 0),
  COALESCE(SUM(dws.night_hours), 0),
  COALESCE(SUM(
    CASE 
      WHEN dws.work_status LIKE '%일요일%' OR dws.work_status LIKE '%공휴일%' 
      THEN dws.basic_hours + dws.overtime_hours 
      ELSE 0 
    END
  ), 0),
  520, -- 3개월 기준
  GREATEST(
    0, 
    COALESCE(SUM(dws.basic_hours + dws.overtime_hours), 0) - 520 - COALESCE(SUM(dws.night_hours), 0)
  ),
  'calculated',
  NOW()
FROM users u
LEFT JOIN daily_work_summary dws ON u.id = dws.user_id 
  AND dws.work_date BETWEEN '2025-04-01' AND '2025-06-30'
WHERE u.role = 'employee'
GROUP BY u.id
ON CONFLICT (user_id, quarter_start_date) DO NOTHING;

-- 6. 3개월 초과근무 정산 현황 조회
SELECT * FROM quarterly_overtime_view 
WHERE quarter_start_date >= '2025-01-01'
ORDER BY quarter_start_date DESC, employee_name;
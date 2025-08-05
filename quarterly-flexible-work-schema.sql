-- 분기별 탄력근로제 관리 시스템 스키마
-- 3개월 단위 탄력근로제 기간을 관리하고 정산을 수행하는 테이블들

-- 1. 탄력근로제 기간 관리 테이블
CREATE TABLE IF NOT EXISTS flexible_work_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기간 정보
  period_name VARCHAR(100) NOT NULL, -- 예: "2025년 2분기 탄력근로제"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- 분기 정보
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4), -- 1,2,3,4분기
  year INTEGER NOT NULL,
  
  -- 근로시간 기준
  standard_weekly_hours DECIMAL(4,1) DEFAULT 40.0, -- 주당 기준 근로시간
  max_daily_hours DECIMAL(4,1) DEFAULT 12.0, -- 일일 최대 근로시간
  max_weekly_hours DECIMAL(4,1) DEFAULT 52.0, -- 주간 최대 근로시간
  
  -- 상태
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'cancelled')),
  
  -- 정산 정보
  settlement_completed BOOLEAN DEFAULT false,
  settlement_date TIMESTAMP WITH TIME ZONE,
  settlement_by UUID REFERENCES users(id),
  
  -- 메타데이터
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 중복 방지를 위한 제약조건
  UNIQUE(year, quarter)
);

-- 2. 직원별 탄력근로제 참여 테이블
CREATE TABLE IF NOT EXISTS flexible_work_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  period_id UUID NOT NULL REFERENCES flexible_work_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 참여 정보
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  -- 개별 설정 (필요시)
  custom_weekly_hours DECIMAL(4,1), -- 개별 주당 기준시간 (없으면 기본값 사용)
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(period_id, user_id)
);

-- 3. 월별 근로시간 집계 테이블 (확장)
CREATE TABLE IF NOT EXISTS monthly_flexible_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  period_id UUID NOT NULL REFERENCES flexible_work_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 월 정보
  work_month DATE NOT NULL, -- 해당 월의 첫 번째 날 (예: 2025-06-01)
  month_name VARCHAR(20) NOT NULL, -- 예: "6월", "7월", "8월"
  
  -- 근로시간 통계
  total_work_hours DECIMAL(6,1) DEFAULT 0, -- 총 근무시간
  basic_hours DECIMAL(6,1) DEFAULT 0, -- 기본 근무시간
  overtime_hours DECIMAL(6,1) DEFAULT 0, -- 연장 근무시간
  night_hours DECIMAL(6,1) DEFAULT 0, -- 야간 근무시간 (항상 수당 지급)
  
  -- 주간 평균
  weekly_avg_hours DECIMAL(5,1) DEFAULT 0, -- 주당 평균 근무시간
  
  -- 야간근무 수당 정보
  night_allowance_paid DECIMAL(10,0) DEFAULT 0, -- 이미 지급된 야간근무 수당
  night_allowance_hours DECIMAL(6,1) DEFAULT 0, -- 야간근무 수당 대상 시간
  
  -- 메타데이터
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(period_id, user_id, work_month)
);

-- 4. 분기별 정산 결과 테이블
CREATE TABLE IF NOT EXISTS quarterly_settlement_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  period_id UUID NOT NULL REFERENCES flexible_work_periods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 3개월 집계
  total_work_hours DECIMAL(7,1) DEFAULT 0, -- 3개월 총 근무시간
  total_weeks INTEGER DEFAULT 12, -- 총 주 수 (일반적으로 12주)
  weekly_avg_hours DECIMAL(5,1) DEFAULT 0, -- 3개월 주당 평균
  
  -- 기준시간 대비
  standard_total_hours DECIMAL(7,1) DEFAULT 0, -- 3개월 기준 총시간 (40h * 12주 = 480h)
  excess_hours DECIMAL(6,1) DEFAULT 0, -- 기준 초과 시간
  
  -- 야간근무 관련
  total_night_hours DECIMAL(6,1) DEFAULT 0, -- 3개월 총 야간근무시간
  total_night_allowance_paid DECIMAL(12,0) DEFAULT 0, -- 3개월간 지급된 야간수당
  
  -- 초과근무 수당 계산
  overtime_allowance_hours DECIMAL(6,1) DEFAULT 0, -- 초과근무 수당 대상 시간
  final_overtime_hours DECIMAL(6,1) DEFAULT 0, -- 야간시간 차감 후 최종 초과시간
  overtime_allowance_amount DECIMAL(12,0) DEFAULT 0, -- 지급할 초과근무 수당
  
  -- 정산 정보
  settlement_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settlement_by UUID REFERENCES users(id),
  settlement_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(period_id, user_id)
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_flexible_periods_status ON flexible_work_periods(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_flexible_periods_quarter ON flexible_work_periods(year, quarter);
CREATE INDEX IF NOT EXISTS idx_flexible_participants_period ON flexible_work_participants(period_id, user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_flexible_summary_period ON monthly_flexible_summary(period_id, user_id, work_month);
CREATE INDEX IF NOT EXISTS idx_quarterly_settlement_period ON quarterly_settlement_results(period_id, user_id);

-- 6. 기본 데이터 삽입 (2025년 2분기: 6-7-8월)
INSERT INTO flexible_work_periods (
  period_name, start_date, end_date, quarter, year, 
  standard_weekly_hours, max_daily_hours, max_weekly_hours,
  status, created_by
) VALUES (
  '2025년 2분기 탄력근로제 (6-7-8월)', 
  '2025-06-01', 
  '2025-08-31', 
  2, 
  2025,
  40.0, 
  12.0, 
  52.0,
  'active',
  NULL -- 관리자 ID로 변경 필요
) ON CONFLICT (year, quarter) DO NOTHING;

-- 7. 트리거 함수: 월별 집계 자동 업데이트
CREATE OR REPLACE FUNCTION update_monthly_flexible_summary()
RETURNS TRIGGER AS $$
DECLARE
  v_period_id UUID;
  v_work_month DATE;
  v_user_work_hours DECIMAL(6,1);
  v_user_basic_hours DECIMAL(6,1);
  v_user_overtime_hours DECIMAL(6,1);
  v_user_night_hours DECIMAL(6,1);
BEGIN
  -- 현재 활성화된 탄력근로제 기간 찾기
  SELECT id INTO v_period_id
  FROM flexible_work_periods
  WHERE status = 'active'
  AND NEW.work_date BETWEEN start_date AND end_date
  LIMIT 1;
  
  IF v_period_id IS NULL THEN
    RETURN NEW; -- 탄력근로제 기간이 아니면 종료
  END IF;
  
  -- 해당 월의 첫 번째 날
  v_work_month := DATE_TRUNC('month', NEW.work_date)::DATE;
  
  -- 해당 사용자의 해당 월 총 근무시간 계산
  SELECT 
    COALESCE(SUM(basic_hours + overtime_hours), 0),
    COALESCE(SUM(basic_hours), 0),
    COALESCE(SUM(overtime_hours), 0),
    COALESCE(SUM(night_hours), 0)
  INTO v_user_work_hours, v_user_basic_hours, v_user_overtime_hours, v_user_night_hours
  FROM daily_work_summary
  WHERE user_id = NEW.user_id
  AND work_date >= v_work_month
  AND work_date < v_work_month + INTERVAL '1 month';
  
  -- 월별 집계 업데이트
  INSERT INTO monthly_flexible_summary (
    period_id, user_id, work_month, month_name,
    total_work_hours, basic_hours, overtime_hours, night_hours,
    weekly_avg_hours, calculated_at
  ) VALUES (
    v_period_id, NEW.user_id, v_work_month,
    TO_CHAR(v_work_month, 'MM') || '월',
    v_user_work_hours, v_user_basic_hours, v_user_overtime_hours, v_user_night_hours,
    ROUND(v_user_work_hours / 4.0, 1), -- 주당 평균 (4주 기준)
    NOW()
  )
  ON CONFLICT (period_id, user_id, work_month)
  DO UPDATE SET
    total_work_hours = v_user_work_hours,
    basic_hours = v_user_basic_hours,
    overtime_hours = v_user_overtime_hours,
    night_hours = v_user_night_hours,
    weekly_avg_hours = ROUND(v_user_work_hours / 4.0, 1),
    updated_at = NOW();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
CREATE OR REPLACE TRIGGER trigger_update_monthly_flexible_summary
  AFTER INSERT OR UPDATE ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_flexible_summary();

-- 9. 정산 계산 함수
CREATE OR REPLACE FUNCTION calculate_quarterly_settlement(
  p_period_id UUID,
  p_user_id UUID DEFAULT NULL -- NULL이면 모든 사용자
) RETURNS TABLE (
  user_id UUID,
  user_name VARCHAR,
  total_hours DECIMAL(7,1),
  weekly_avg DECIMAL(5,1),
  excess_hours DECIMAL(6,1),
  night_hours DECIMAL(6,1),
  overtime_allowance DECIMAL(12,0)
) AS $$
DECLARE
  v_period RECORD;
  v_user RECORD;
BEGIN
  -- 기간 정보 조회
  SELECT * INTO v_period
  FROM flexible_work_periods
  WHERE id = p_period_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '탄력근로제 기간을 찾을 수 없습니다: %', p_period_id;
  END IF;
  
  -- 사용자별 정산 계산
  FOR v_user IN 
    SELECT DISTINCT mfs.user_id, u.name
    FROM monthly_flexible_summary mfs
    JOIN users u ON u.id = mfs.user_id
    WHERE mfs.period_id = p_period_id
    AND (p_user_id IS NULL OR mfs.user_id = p_user_id)
  LOOP
    RETURN QUERY
    WITH user_summary AS (
      SELECT 
        SUM(mfs.total_work_hours) as total_work_hours,
        SUM(mfs.night_hours) as total_night_hours,
        ROUND(SUM(mfs.total_work_hours) / 12.0, 1) as weekly_average -- 12주 기준
      FROM monthly_flexible_summary mfs
      WHERE mfs.period_id = p_period_id AND mfs.user_id = v_user.user_id
    )
    SELECT 
      v_user.user_id,
      v_user.name,
      us.total_work_hours,
      us.weekly_average,
      GREATEST(us.total_work_hours - (v_period.standard_weekly_hours * 12), 0) as excess_hours,
      us.total_night_hours,
      -- 초과근무 수당 = (주당 평균 - 40시간) * 12주 * 시급 * 1.5배
      -- 단, 야간근무 시간만큼 차감
      CASE 
        WHEN us.weekly_average > v_period.standard_weekly_hours THEN
          GREATEST(
            (us.weekly_average - v_period.standard_weekly_hours) * 12 - us.total_night_hours,
            0
          ) * 15000 -- 임시 시급, 실제로는 개별 시급 적용 필요
        ELSE 0
      END as overtime_allowance
    FROM user_summary us;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT '분기별 탄력근로제 관리 스키마 생성 완료' as status;
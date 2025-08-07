-- 연말 휴가 소멸 처리 SQL
-- 매년 12월 31일 자정에 실행되어야 함

-- 1. 연말 휴가 소멸 이력 테이블 생성 (없으면 생성)
CREATE TABLE IF NOT EXISTS leave_expiry_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expiry_year INTEGER NOT NULL,
  expiry_type VARCHAR(50) NOT NULL, -- 'annual', 'substitute', 'compensatory'
  expired_amount DECIMAL(10,1) NOT NULL, -- 소멸된 일수 또는 시간
  expired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  notes TEXT
);

-- 2. 연말 휴가 소멸 처리 함수
CREATE OR REPLACE FUNCTION process_year_end_leave_expiry()
RETURNS TABLE(
  processed_users INTEGER,
  annual_expired DECIMAL,
  substitute_expired DECIMAL,
  compensatory_expired DECIMAL
) AS $$
DECLARE
  v_current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  v_processed_users INTEGER := 0;
  v_total_annual_expired DECIMAL := 0;
  v_total_substitute_expired DECIMAL := 0;
  v_total_compensatory_expired DECIMAL := 0;
  v_user RECORD;
BEGIN
  -- 모든 활성 사용자에 대해 처리
  FOR v_user IN 
    SELECT id, name, 
           annual_days - used_annual_days as remaining_annual,
           substitute_leave_hours,
           compensatory_leave_hours
    FROM users
    WHERE is_active = true
  LOOP
    -- 잔여 연차가 있는 경우 소멸 처리
    IF v_user.remaining_annual > 0 THEN
      -- 소멸 이력 기록
      INSERT INTO leave_expiry_history (
        user_id, expiry_year, expiry_type, expired_amount, notes
      ) VALUES (
        v_user.id, v_current_year, 'annual', v_user.remaining_annual,
        '연말 자동 소멸 - ' || v_current_year || '년도 미사용 연차'
      );
      
      v_total_annual_expired := v_total_annual_expired + v_user.remaining_annual;
    END IF;
    
    -- 대체휴가가 있는 경우 소멸 처리
    IF v_user.substitute_leave_hours > 0 THEN
      -- 소멸 이력 기록
      INSERT INTO leave_expiry_history (
        user_id, expiry_year, expiry_type, expired_amount, notes
      ) VALUES (
        v_user.id, v_current_year, 'substitute', v_user.substitute_leave_hours,
        '연말 자동 소멸 - ' || v_current_year || '년도 미사용 대체휴가'
      );
      
      -- 대체휴가 시간 초기화
      UPDATE users 
      SET substitute_leave_hours = 0,
          updated_at = NOW()
      WHERE id = v_user.id;
      
      v_total_substitute_expired := v_total_substitute_expired + v_user.substitute_leave_hours;
    END IF;
    
    -- 보상휴가가 있는 경우 소멸 처리
    IF v_user.compensatory_leave_hours > 0 THEN
      -- 소멸 이력 기록
      INSERT INTO leave_expiry_history (
        user_id, expiry_year, expiry_type, expired_amount, notes
      ) VALUES (
        v_user.id, v_current_year, 'compensatory', v_user.compensatory_leave_hours,
        '연말 자동 소멸 - ' || v_current_year || '년도 미사용 보상휴가'
      );
      
      -- 보상휴가 시간 초기화
      UPDATE users 
      SET compensatory_leave_hours = 0,
          updated_at = NOW()
      WHERE id = v_user.id;
      
      v_total_compensatory_expired := v_total_compensatory_expired + v_user.compensatory_leave_hours;
    END IF;
    
    -- 새해 연차 리셋 (used_annual_days를 0으로)
    UPDATE users
    SET used_annual_days = 0,
        used_sick_days = 0,
        updated_at = NOW()
    WHERE id = v_user.id;
    
    v_processed_users := v_processed_users + 1;
  END LOOP;
  
  RETURN QUERY 
  SELECT v_processed_users, v_total_annual_expired, v_total_substitute_expired, v_total_compensatory_expired;
END;
$$ LANGUAGE plpgsql;

-- 3. 연말 소멸 예정 휴가 조회 함수
CREATE OR REPLACE FUNCTION get_expiring_leaves()
RETURNS TABLE(
  user_id UUID,
  name VARCHAR,
  department VARCHAR,
  annual_remaining DECIMAL,
  substitute_hours DECIMAL,
  compensatory_hours DECIMAL,
  days_until_expiry INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.name,
    u.department,
    (u.annual_days - u.used_annual_days) as annual_remaining,
    u.substitute_leave_hours as substitute_hours,
    u.compensatory_leave_hours as compensatory_hours,
    (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day' - CURRENT_DATE)::INTEGER as days_until_expiry
  FROM users u
  WHERE u.is_active = true
    AND (
      (u.annual_days - u.used_annual_days) > 0 
      OR u.substitute_leave_hours > 0
      OR u.compensatory_leave_hours > 0
    )
  ORDER BY u.department, u.name;
END;
$$ LANGUAGE plpgsql;

-- 4. 연말 소멸 알림을 위한 뷰 (10월부터 표시)
CREATE OR REPLACE VIEW v_year_end_leave_alerts AS
SELECT 
  u.id,
  u.name,
  u.department,
  u.email,
  (u.annual_days - u.used_annual_days) as annual_remaining,
  u.substitute_leave_hours,
  u.compensatory_leave_hours,
  CASE 
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 10 THEN true
    ELSE false
  END as should_alert,
  (DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year' - INTERVAL '1 day')::DATE as expiry_date
FROM users u
WHERE u.is_active = true
  AND (
    (u.annual_days - u.used_annual_days) > 0 
    OR u.substitute_leave_hours > 0
    OR u.compensatory_leave_hours > 0
  );

-- 5. 연말 처리 스케줄러 (pg_cron 사용 시)
-- 매년 12월 31일 23시 59분에 실행
-- SELECT cron.schedule('year-end-leave-expiry', '59 23 31 12 *', 'SELECT process_year_end_leave_expiry();');

-- 주의: pg_cron이 설치되어 있지 않은 경우, 
-- Supabase Edge Function이나 외부 크론잡으로 대체 가능

COMMENT ON FUNCTION process_year_end_leave_expiry IS '연말 휴가 소멸 처리 - 매년 12월 31일 실행';
COMMENT ON FUNCTION get_expiring_leaves IS '연말 소멸 예정 휴가 조회';
COMMENT ON VIEW v_year_end_leave_alerts IS '연말 휴가 소멸 알림용 뷰 (10월부터 활성화)';
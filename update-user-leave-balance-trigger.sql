-- 대체휴가 및 보상휴가 자동 연동 트리거
-- daily_work_summary에서 발생한 대체/보상휴가를 users 테이블의 휴가 잔액에 자동으로 추가

-- 휴가 잔액 업데이트 함수
CREATE OR REPLACE FUNCTION update_user_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_substitute_diff DECIMAL(4,1);
  v_compensatory_diff DECIMAL(4,1);
BEGIN
  -- 대체휴가 차이 계산
  v_substitute_diff := COALESCE(NEW.substitute_hours, 0) - COALESCE(OLD.substitute_hours, 0);
  
  -- 보상휴가 차이 계산
  v_compensatory_diff := COALESCE(NEW.compensatory_hours, 0) - COALESCE(OLD.compensatory_hours, 0);
  
  -- 차이가 있을 때만 업데이트
  IF v_substitute_diff != 0 OR v_compensatory_diff != 0 THEN
    UPDATE users
    SET 
      substitute_leave_hours = COALESCE(substitute_leave_hours, 0) + v_substitute_diff,
      compensatory_leave_hours = COALESCE(compensatory_leave_hours, 0) + v_compensatory_diff,
      updated_at = NOW()
    WHERE id = NEW.user_id;
    
    -- 로그 출력 (디버깅용)
    RAISE NOTICE 'User % leave balance updated: substitute +%, compensatory +%', 
      NEW.user_id, v_substitute_diff, v_compensatory_diff;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 제거
DROP TRIGGER IF EXISTS trigger_update_user_leave_balance ON daily_work_summary;

-- 새 트리거 생성
CREATE TRIGGER trigger_update_user_leave_balance
  AFTER INSERT OR UPDATE OF substitute_hours, compensatory_hours ON daily_work_summary
  FOR EACH ROW
  EXECUTE FUNCTION update_user_leave_balance();

-- 과거 데이터 동기화 (필요시 실행)
-- 이미 기록된 대체/보상휴가 시간을 사용자 잔액에 반영
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN 
    SELECT 
      user_id,
      SUM(substitute_hours) as total_substitute,
      SUM(compensatory_hours) as total_compensatory
    FROM daily_work_summary
    WHERE substitute_hours > 0 OR compensatory_hours > 0
    GROUP BY user_id
  LOOP
    UPDATE users
    SET 
      substitute_leave_hours = COALESCE(v_user_record.total_substitute, 0),
      compensatory_leave_hours = COALESCE(v_user_record.total_compensatory, 0),
      updated_at = NOW()
    WHERE id = v_user_record.user_id;
    
    RAISE NOTICE 'User % leave balance synced: substitute %, compensatory %', 
      v_user_record.user_id, v_user_record.total_substitute, v_user_record.total_compensatory;
  END LOOP;
END $$;

-- 확인 쿼리
SELECT 
  u.name,
  u.substitute_leave_hours as user_substitute,
  u.compensatory_leave_hours as user_compensatory,
  COALESCE(SUM(dws.substitute_hours), 0) as summary_substitute,
  COALESCE(SUM(dws.compensatory_hours), 0) as summary_compensatory
FROM users u
LEFT JOIN daily_work_summary dws ON u.id = dws.user_id
WHERE u.name = '허지현'
GROUP BY u.id, u.name, u.substitute_leave_hours, u.compensatory_leave_hours;
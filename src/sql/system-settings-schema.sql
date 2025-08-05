-- 시스템 설정 테이블
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- 설정 변경 이력 테이블
CREATE TABLE IF NOT EXISTS settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) REFERENCES system_settings(key),
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by UUID REFERENCES users(id),
  change_reason TEXT
);

-- 기본 설정 값 삽입
INSERT INTO system_settings (key, value, description, category) VALUES
  ('monthly_standard_hours', '209', '월 기준 근무시간', 'work_time'),
  ('overtime_rate', '1.5', '초과근무 수당 배율', 'payment'),
  ('night_rate', '1.5', '야간근무 수당 배율', 'payment'),
  ('holiday_rate', '1.5', '휴일근무 수당 배율', 'payment'),
  ('dinner_allowance', '10000', '야식대 금액', 'payment'),
  ('night_work_start', '"22:00"', '야간근무 시작 시간', 'work_time'),
  ('night_work_end', '"06:00"', '야간근무 종료 시간', 'work_time'),
  ('lunch_break_minutes', '60', '점심시간 (분)', 'work_time'),
  ('overtime_threshold_minutes', '10', '초과근무 인정 최소 시간 (분)', 'work_time')
ON CONFLICT (key) DO NOTHING;

-- 설정 변경 시 자동으로 이력 저장하는 트리거
CREATE OR REPLACE FUNCTION log_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO settings_history (
    setting_key, 
    old_value, 
    new_value, 
    changed_by
  ) VALUES (
    NEW.key,
    OLD.value,
    NEW.value,
    NEW.updated_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settings_change_trigger
AFTER UPDATE ON system_settings
FOR EACH ROW
WHEN (OLD.value IS DISTINCT FROM NEW.value)
EXECUTE FUNCTION log_settings_change();

-- 설정 조회 함수
CREATE OR REPLACE FUNCTION get_system_setting(p_key VARCHAR)
RETURNS JSONB AS $$
BEGIN
  RETURN (SELECT value FROM system_settings WHERE key = p_key);
END;
$$ LANGUAGE plpgsql;

-- 모든 설정 조회 함수
CREATE OR REPLACE FUNCTION get_all_system_settings()
RETURNS TABLE(key VARCHAR, value JSONB, category VARCHAR) AS $$
BEGIN
  RETURN QUERY
  SELECT s.key, s.value, s.category
  FROM system_settings s
  ORDER BY s.category, s.key;
END;
$$ LANGUAGE plpgsql;
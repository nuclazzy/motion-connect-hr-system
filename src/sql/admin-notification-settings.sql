-- Motion Connect HR System
-- 관리자 알림 설정 테이블

CREATE TABLE IF NOT EXISTS admin_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  notification_types TEXT[] NOT NULL DEFAULT ARRAY['leave_application', 'form_submission'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- 이메일 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_settings_email 
ON admin_notification_settings(email) WHERE is_active = true;

-- 알림 유형 체크 제약
ALTER TABLE admin_notification_settings 
ADD CONSTRAINT check_notification_types 
CHECK (
  notification_types <@ ARRAY['leave_application', 'form_submission', 'urgent_request', 'system_alert']::TEXT[]
);

-- 이메일 형식 검증
ALTER TABLE admin_notification_settings 
ADD CONSTRAINT check_email_format 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_settings_updated_at
  BEFORE UPDATE ON admin_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();

-- 기본 관리자 알림 설정 삽입
INSERT INTO admin_notification_settings (email, notification_types, is_active)
VALUES 
  ('lewis@motionsense.co.kr', ARRAY['leave_application', 'form_submission', 'urgent_request', 'system_alert'], true),
  ('admin@motionsense.co.kr', ARRAY['leave_application', 'form_submission'], true)
ON CONFLICT (email) DO NOTHING;

-- 알림 설정 조회 함수
CREATE OR REPLACE FUNCTION get_active_notification_emails(p_notification_type TEXT DEFAULT 'leave_application')
RETURNS TEXT[] AS $$
DECLARE
  result TEXT[];
BEGIN
  SELECT ARRAY_AGG(email)
  INTO result
  FROM admin_notification_settings 
  WHERE is_active = true 
    AND p_notification_type = ANY(notification_types);
    
  RETURN COALESCE(result, ARRAY['lewis@motionsense.co.kr']);
END;
$$ LANGUAGE plpgsql;

-- 사용 예시:
-- SELECT get_active_notification_emails('leave_application');
-- SELECT get_active_notification_emails('form_submission');
-- admin_notification_settings 테이블 생성 및 기본 데이터 삽입
-- Supabase SQL Editor에서 실행하세요

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS admin_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  notification_types TEXT[] NOT NULL DEFAULT ARRAY['leave_application', 'form_submission'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 이메일 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_settings_email 
ON admin_notification_settings(email) WHERE is_active = true;

-- 3. 알림 유형 체크 제약
ALTER TABLE admin_notification_settings 
ADD CONSTRAINT IF NOT EXISTS check_notification_types 
CHECK (
  notification_types <@ ARRAY['leave_application', 'form_submission', 'urgent_request', 'system_alert']::TEXT[]
);

-- 4. 이메일 형식 검증
ALTER TABLE admin_notification_settings 
ADD CONSTRAINT IF NOT EXISTS check_email_format 
CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 5. updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_notification_settings_updated_at ON admin_notification_settings;
CREATE TRIGGER trigger_update_notification_settings_updated_at
  BEFORE UPDATE ON admin_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_settings_updated_at();

-- 6. 기본 관리자 알림 설정 삽입
INSERT INTO admin_notification_settings (email, notification_types, is_active)
VALUES 
  ('lewis@motionsense.co.kr', ARRAY['leave_application', 'form_submission', 'urgent_request', 'system_alert'], true),
  ('admin@motionsense.co.kr', ARRAY['leave_application', 'form_submission'], true)
ON CONFLICT (email) DO NOTHING;

-- 7. 결과 확인
SELECT 
  id,
  email,
  notification_types,
  is_active,
  created_at
FROM admin_notification_settings 
ORDER BY created_at DESC;
-- 팀 캘린더 권한 관리 테이블 생성
CREATE TABLE IF NOT EXISTS team_calendar_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  calendar_config_id UUID NOT NULL REFERENCES calendar_configs(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'admin')),
  granted_by UUID NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, calendar_config_id, permission_type)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_team_calendar_permissions_user_id ON team_calendar_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_team_calendar_permissions_calendar_config_id ON team_calendar_permissions(calendar_config_id);
CREATE INDEX IF NOT EXISTS idx_team_calendar_permissions_active ON team_calendar_permissions(is_active);

-- RLS 정책 설정
ALTER TABLE team_calendar_permissions ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 권한을 관리할 수 있음
CREATE POLICY "Admins can manage all permissions" ON team_calendar_permissions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  ));

-- 사용자는 자신의 권한만 조회할 수 있음
CREATE POLICY "Users can view their own permissions" ON team_calendar_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 권한 부여자는 자신이 부여한 권한을 조회할 수 있음
CREATE POLICY "Granters can view permissions they granted" ON team_calendar_permissions
  FOR SELECT TO authenticated
  USING (granted_by = auth.uid());

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_team_calendar_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 업데이트 트리거 생성
CREATE TRIGGER update_team_calendar_permissions_updated_at
  BEFORE UPDATE ON team_calendar_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_team_calendar_permissions_updated_at();
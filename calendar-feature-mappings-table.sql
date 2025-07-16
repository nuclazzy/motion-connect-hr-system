-- 캘린더-기능 매핑 테이블 생성
CREATE TABLE IF NOT EXISTS calendar_feature_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_config_id UUID NOT NULL REFERENCES calendar_configs(id) ON DELETE CASCADE,
  feature_id VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- 같은 캘린더에 같은 기능이 중복 매핑되는 것을 방지
  UNIQUE(calendar_config_id, feature_id)
);

-- 인덱스 생성
CREATE INDEX idx_calendar_feature_mappings_calendar_id ON calendar_feature_mappings(calendar_config_id);
CREATE INDEX idx_calendar_feature_mappings_feature_id ON calendar_feature_mappings(feature_id);
CREATE INDEX idx_calendar_feature_mappings_active ON calendar_feature_mappings(is_active);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE calendar_feature_mappings ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽을 수 있도록 설정 (캘린더 데이터는 공개)
CREATE POLICY "Anyone can view calendar feature mappings" ON calendar_feature_mappings
  FOR SELECT TO authenticated
  USING (true);

-- 관리자만 생성, 수정, 삭제 가능
CREATE POLICY "Admins can manage calendar feature mappings" ON calendar_feature_mappings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 업데이트된 시간 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_calendar_feature_mappings_updated_at
    BEFORE UPDATE ON calendar_feature_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 기본 기능 목록 설명
COMMENT ON TABLE calendar_feature_mappings IS '캘린더와 HR 시스템 기능 간의 매핑 관계를 저장하는 테이블';
COMMENT ON COLUMN calendar_feature_mappings.feature_id IS '기능 식별자 (team-schedule, admin-schedule, leave-management, meeting-rooms, company-events)';
COMMENT ON COLUMN calendar_feature_mappings.feature_name IS '기능 표시 이름';
COMMENT ON COLUMN calendar_feature_mappings.is_active IS '매핑 활성화 상태';
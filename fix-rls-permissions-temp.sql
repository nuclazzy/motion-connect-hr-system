-- 임시 해결책: calendar_feature_mappings 테이블 RLS 정책 수정
-- 모든 인증된 사용자가 읽기/쓰기 가능하도록 임시 변경

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "Anyone can view calendar feature mappings" ON calendar_feature_mappings;
DROP POLICY IF EXISTS "Admins can create calendar feature mappings" ON calendar_feature_mappings;
DROP POLICY IF EXISTS "Admins can update calendar feature mappings" ON calendar_feature_mappings;
DROP POLICY IF EXISTS "Admins can delete calendar feature mappings" ON calendar_feature_mappings;

-- 임시로 모든 인증된 사용자가 접근 가능하도록 설정
CREATE POLICY "Authenticated users can manage calendar feature mappings" ON calendar_feature_mappings
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 또는 RLS를 완전히 비활성화 (임시)
-- ALTER TABLE calendar_feature_mappings DISABLE ROW LEVEL SECURITY;
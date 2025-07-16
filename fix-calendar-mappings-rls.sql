-- 기존 RLS 정책 삭제 및 재생성
DROP POLICY IF EXISTS "Admins can manage calendar feature mappings" ON calendar_feature_mappings;

-- 읽기 정책 (모든 인증된 사용자)
CREATE POLICY "Anyone can view calendar feature mappings" ON calendar_feature_mappings
  FOR SELECT TO authenticated
  USING (true);

-- 생성 정책 (관리자만)
CREATE POLICY "Admins can create calendar feature mappings" ON calendar_feature_mappings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 수정 정책 (관리자만)
CREATE POLICY "Admins can update calendar feature mappings" ON calendar_feature_mappings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 삭제 정책 (관리자만)
CREATE POLICY "Admins can delete calendar feature mappings" ON calendar_feature_mappings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );
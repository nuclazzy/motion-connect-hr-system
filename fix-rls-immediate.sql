-- 즉시 해결: calendar_feature_mappings 테이블 RLS 비활성화
-- Supabase SQL 에디터에서 실행

-- RLS 완전히 비활성화 (임시)
ALTER TABLE calendar_feature_mappings DISABLE ROW LEVEL SECURITY;

-- 또는 모든 사용자 허용 정책으로 변경
-- ALTER TABLE calendar_feature_mappings ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Anyone can view calendar feature mappings" ON calendar_feature_mappings;
-- DROP POLICY IF EXISTS "Admins can create calendar feature mappings" ON calendar_feature_mappings;
-- DROP POLICY IF EXISTS "Admins can update calendar feature mappings" ON calendar_feature_mappings;
-- DROP POLICY IF EXISTS "Admins can delete calendar feature mappings" ON calendar_feature_mappings;
-- 
-- CREATE POLICY "Allow all authenticated users" ON calendar_feature_mappings
--   FOR ALL TO authenticated
--   USING (true)
--   WITH CHECK (true);
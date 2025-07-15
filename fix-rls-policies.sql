-- RLS 정책 임시 수정 - 디버깅용
-- Supabase SQL Editor에서 실행하세요

-- 1. 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Allow all access for development" ON users;
DROP POLICY IF EXISTS "Allow all access for development" ON leave_days;
DROP POLICY IF EXISTS "Allow all access for development" ON form_requests;
DROP POLICY IF EXISTS "Allow all access for development" ON documents;
DROP POLICY IF EXISTS "Allow all access for development" ON meetings;
DROP POLICY IF EXISTS "Allow all access for development" ON calendar_configs;
DROP POLICY IF EXISTS "Allow all access for development" ON leave_promotions;

-- 2. 새로운 모든 접근 허용 정책 생성
CREATE POLICY "Allow all operations" ON users FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON leave_days FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON form_requests FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON documents FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON meetings FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON calendar_configs FOR ALL TO public USING (true);
CREATE POLICY "Allow all operations" ON leave_promotions FOR ALL TO public USING (true);

-- 3. 테스트용 사용자 데이터 확인
SELECT id, email, name, role FROM users WHERE email = 'lewis@motionsense.co.kr';
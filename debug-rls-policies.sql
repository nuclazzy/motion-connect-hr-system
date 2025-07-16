-- RLS 정책 디버깅을 위한 SQL
-- Supabase SQL 에디터에서 실행하여 현재 사용자 정보 및 권한 확인

-- 1. 현재 인증된 사용자 ID 확인
SELECT auth.uid() as current_user_id;

-- 2. 현재 사용자의 정보 확인
SELECT id, email, name, role 
FROM users 
WHERE id = auth.uid();

-- 3. RLS 정책이 올바르게 작동하는지 테스트
SELECT EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() 
  AND users.role = 'admin'
) as is_admin_check;

-- 4. 현재 calendar_feature_mappings 테이블의 RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'calendar_feature_mappings';

-- 5. 테스트: 관리자 권한으로 직접 INSERT 시도 (안전한 테스트)
-- 실제로는 실행하지 말고 권한만 체크
SELECT 
  auth.uid() as user_id,
  (SELECT role FROM users WHERE id = auth.uid()) as user_role,
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  ) as can_insert;
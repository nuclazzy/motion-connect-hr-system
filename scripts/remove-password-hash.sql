-- Supabase Auth 마이그레이션: password_hash 컬럼 제거
-- 실행 전 주의사항:
-- 1. 기존 로컬 인증 시스템에서 Supabase Auth로 완전 전환 후 실행
-- 2. 백업 권장: pg_dump로 users 테이블 백업
-- 3. Supabase Dashboard > SQL Editor에서 실행

-- 1단계: 기존 데이터 확인
SELECT id, email, name, role, employee_id 
FROM users 
ORDER BY created_at;

-- 2단계: password_hash 컬럼 제거
ALTER TABLE users 
DROP COLUMN IF EXISTS password_hash;

-- 3단계: 변경 확인
\d users;

-- 4단계: 컬럼 제거 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 완료 메시지
SELECT 'password_hash 컬럼이 성공적으로 제거되었습니다. 이제 Supabase Auth만 사용합니다.' as message;
/**
 * 기존 users 테이블의 사용자들을 Supabase auth.users에 마이그레이션하는 스크립트
 * 
 * 실행 방법:
 * 1. Supabase Dashboard > SQL Editor에서 실행
 * 2. 또는 node scripts/migrate-users-to-auth.js
 */

// 1. 먼저 Supabase Dashboard의 SQL Editor에서 실행할 SQL

const migrationSQL = `
-- 1단계: 기존 사용자 확인
SELECT id, email, name, role, employee_id, department, position 
FROM users 
ORDER BY created_at;

-- 2단계: auth.users에 사용자 생성 (Supabase Dashboard에서만 가능)
-- 각 사용자별로 수동 실행 필요:

/*
관리자 계정:
email: admin@test.com
password: test123
*/

/*
직원 계정들:
employee1@test.com / test123
employee2@test.com / test123  
employee3@test.com / test123
*/

-- 3단계: auth.users의 ID를 users 테이블에 업데이트
-- (실제 auth user ID로 교체 필요)

/*
-- 예시 (실제 UUID로 교체)
UPDATE users 
SET id = '실제_auth_user_id'
WHERE email = 'admin@test.com';

UPDATE users 
SET id = '실제_auth_user_id'  
WHERE email = 'employee1@test.com';
-- 나머지 사용자들도 동일하게...
*/

-- 4단계: 외래키 제약조건 확인 및 업데이트
-- leave_days, form_requests 등 테이블의 user_id도 업데이트 필요

-- 5단계: password_hash 컬럼 제거 (더 이상 불필요)
-- ALTER TABLE users DROP COLUMN password_hash;
`;

console.log('=== Supabase Auth 마이그레이션 SQL ===');
console.log(migrationSQL);

// Node.js 환경에서 실행하는 경우 (추가 구현 가능)
if (typeof require !== 'undefined') {
  const { createClient } = require('@supabase/supabase-js');
  
  // 환경변수에서 Supabase 설정 읽기
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (supabaseUrl && supabaseServiceKey) {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    async function migrateUsers() {
      try {
        console.log('🔍 기존 사용자 조회 중...');
        
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at');
          
        if (error) {
          console.error('❌ 사용자 조회 실패:', error);
          return;
        }
        
        console.log('📋 기존 사용자 목록:');
        users.forEach(user => {
          console.log(`- ${user.email} (${user.name}, ${user.role})`);
        });
        
        console.log('\n⚠️  다음 단계:');
        console.log('1. Supabase Dashboard > Authentication > Users에서 수동으로 사용자 생성');
        console.log('2. 생성된 auth user ID로 users 테이블 업데이트');
        console.log('3. 관련 테이블의 user_id 외래키도 업데이트');
        
      } catch (err) {
        console.error('❌ 마이그레이션 오류:', err);
      }
    }
    
    // 스크립트 직접 실행 시
    if (require.main === module) {
      migrateUsers();
    }
  }
}

module.exports = { migrationSQL };
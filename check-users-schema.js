require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsersSchema() {
  console.log('🔍 users 테이블 스키마 확인 중...\n');
  
  // 실제 데이터 1개 조회해서 필드 확인
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('❌ 쿼리 오류:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ users 테이블의 모든 필드 목록:');
    const fields = Object.keys(data[0]);
    fields.forEach((field, index) => {
      const value = data[0][field];
      const type = typeof value;
      const sample = value !== null ? String(value).substring(0, 30) : 'null';
      console.log(`  ${String(index + 1).padStart(2, ' ')}. ${field.padEnd(25, ' ')} (${type.padEnd(8, ' ')}) 예시: ${sample}`);
    });
    
    console.log(`\n📊 총 ${fields.length}개 필드 발견\n`);
    
    // 신규 직원 추가 양식과 비교
    const formFields = [
      'name', 'email', 'password', 'department', 'position', 
      'phone', 'dob', 'address', 'work_type', 'hire_date',
      'annual_salary', 'meal_allowance', 'car_allowance', 'role'
    ];
    
    console.log('🔄 신규 직원 추가 폼과 비교 분석:');
    
    const dbFields = new Set(fields);
    const missingInForm = fields.filter(field => 
      !formFields.includes(field) && 
      !['id', 'created_at', 'updated_at', 'password_hash', 'is_active', 'termination_date'].includes(field)
    );
    const missingInDB = formFields.filter(field => !dbFields.has(field) && field !== 'password');
    
    if (missingInForm.length > 0) {
      console.log('⚠️  DB에는 있지만 폼에 누락된 필드들:');
      missingInForm.forEach(field => {
        console.log(`   - ${field}`);
      });
    }
    
    if (missingInDB.length > 0) {
      console.log('❌ 폼에는 있지만 DB에 누락된 필드들:');
      missingInDB.forEach(field => {
        console.log(`   - ${field}`);
      });
    }
    
    if (missingInForm.length === 0 && missingInDB.length === 0) {
      console.log('✅ 모든 중요 필드가 일치합니다! 누락된 필드 없음.');
    }
    
  } else {
    console.log('⚠️ 테이블에 데이터가 없어서 스키마를 확인할 수 없습니다.');
  }
}

checkUsersSchema().catch(console.error);
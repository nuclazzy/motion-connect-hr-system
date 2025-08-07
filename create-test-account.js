/**
 * 임시 테스트 계정 생성 (평문 비밀번호)
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function createTestAccount() {
  console.log('🧪 테스트 계정 생성...')
  
  try {
    // 기존 테스트 계정 제거
    await supabase
      .from('users')
      .delete()
      .eq('email', 'test@motionsense.co.kr')
    
    // 새 테스트 계정 생성 (평문 비밀번호)
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: 'test@motionsense.co.kr',
        name: '테스트 관리자',
        role: 'admin',
        employee_id: 'TEST001',
        department: '개발팀',
        position: '테스트',
        hire_date: '2025-01-01',
        password_hash: 'test123', // 평문 (임시)
        is_active: true
      })
      .select()
      .single()
    
    if (error) {
      console.error('❌ 테스트 계정 생성 실패:', error.message)
      return false
    }
    
    console.log('✅ 테스트 계정 생성 성공:')
    console.log('   - 이메일: test@motionsense.co.kr')
    console.log('   - 비밀번호: test123')
    console.log('   - 역할: admin')
    
    return true
    
  } catch (error) {
    console.error('❌ 오류:', error.message)
    return false
  }
}

createTestAccount()
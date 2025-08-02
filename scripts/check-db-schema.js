/**
 * Supabase 데이터베이스 스키마 확인
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSchema() {
  try {
    console.log('🔍 users 테이블 구조 확인 중...')
    
    // 1. 사용자 한 명 조회하여 컬럼 확인
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (userError) {
      console.error('❌ users 테이블 조회 실패:', userError)
      return
    }
    
    if (users && users.length > 0) {
      console.log('📋 users 테이블 컬럼들:')
      Object.keys(users[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof users[0][key]} = ${users[0][key]}`)
      })
    }
    
    console.log('\n🔍 leave_days 테이블 확인 중...')
    
    // 2. leave_days 테이블 확인
    const { data: leaveDays, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .limit(1)
    
    if (leaveError) {
      console.error('❌ leave_days 테이블 조회 실패:', leaveError)
    } else if (leaveDays && leaveDays.length > 0) {
      console.log('📋 leave_days 테이블 컬럼들:')
      Object.keys(leaveDays[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof leaveDays[0][key]} = ${leaveDays[0][key]}`)
      })
    } else {
      console.log('📋 leave_days 테이블이 비어있습니다.')
    }
    
  } catch (error) {
    console.error('❌ 스키마 확인 중 오류:', error)
  }
}

checkSchema()
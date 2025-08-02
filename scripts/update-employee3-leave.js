/**
 * employee3@test.com 계정의 대체휴가를 9시간(1.125일)으로 업데이트
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

async function updateEmployee3Leave() {
  try {
    console.log('🔍 employee3@test.com 사용자 조회 중...')
    
    // 1. 사용자 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'employee3@test.com')
      .single()
    
    if (userError || !user) {
      console.error('❌ 사용자를 찾을 수 없습니다:', userError)
      return
    }
    
    console.log('👤 찾은 사용자:', {
      id: user.id,
      name: user.name,
      email: user.email,
      현재_대체휴가_시간: user.substitute_leave_hours,
      현재_보상휴가_시간: user.compensatory_leave_hours
    })
    
    // 2. 대체휴가 시간을 9시간으로 업데이트
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        substitute_leave_hours: 9  // 1.125일 = 9시간
      })
      .eq('id', user.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('❌ 업데이트 실패:', updateError)
      return
    }
    
    console.log('✅ 업데이트 완료!')
    console.log('📊 업데이트된 정보:', {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      대체휴가_시간: updatedUser.substitute_leave_hours,
      보상휴가_시간: updatedUser.compensatory_leave_hours
    })
    
    // 대체휴가 9시간 = 1.125일 확인
    const days = updatedUser.substitute_leave_hours / 8
    console.log(`🎯 대체휴가: ${updatedUser.substitute_leave_hours}시간 = ${days}일`)
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error)
  }
}

updateEmployee3Leave()
/**
 * employee3@test.com 계정의 실제 휴가 데이터 확인 및 업데이트
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateEmployee3() {
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
      email: user.email
    })
    
    // 2. 휴가 데이터 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (leaveError) {
      console.log('⚠️ 휴가 데이터가 없습니다. 새로 생성합니다.')
      
      // 새 휴가 데이터 생성
      const newLeaveData = {
        user_id: user.id,
        leave_types: {
          annual_days: 12,
          used_annual_days: 2,
          sick_days: 60,
          used_sick_days: 2,
          substitute_hours: 9,  // 1.125일 = 9시간
          compensatory_hours: 4
        }
      }
      
      const { data: created, error: createError } = await supabase
        .from('leave_days')
        .insert(newLeaveData)
        .select()
        .single()
      
      if (createError) {
        console.error('❌ 휴가 데이터 생성 실패:', createError)
        return
      }
      
      console.log('✅ 새 휴가 데이터 생성 완료!')
      console.log('📊 생성된 데이터:', created)
      
    } else {
      console.log('📋 기존 휴가 데이터:', leaveData)
      
      // 기존 데이터 업데이트
      const updatedLeaveTypes = {
        ...leaveData.leave_types,
        substitute_hours: 9  // 1.125일 = 9시간으로 업데이트
      }
      
      const { data: updated, error: updateError } = await supabase
        .from('leave_days')
        .update({ leave_types: updatedLeaveTypes })
        .eq('user_id', user.id)
        .select()
        .single()
      
      if (updateError) {
        console.error('❌ 휴가 데이터 업데이트 실패:', updateError)
        return
      }
      
      console.log('✅ 휴가 데이터 업데이트 완료!')
      console.log('📊 업데이트된 데이터:', updated)
    }
    
    console.log(`🎯 대체휴가: 9시간 = ${9/8}일 (1.125일)`)
    
  } catch (error) {
    console.error('❌ 스크립트 실행 중 오류:', error)
  }
}

updateEmployee3()
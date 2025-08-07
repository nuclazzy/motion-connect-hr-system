/**
 * Supabase 연결 및 users 테이블 상태 긴급 점검
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Supabase 연결 상태 점검 시작...')
console.log('📊 환경 변수 체크:')
console.log('- SUPABASE_URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음')
console.log('- SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 설정됨' : '❌ 없음')

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSupabaseConnection() {
  console.log('\n🌐 Supabase 연결 테스트...')
  
  try {
    // 1. 기본 연결 테스트
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ Supabase 연결 실패:', connectionError.message)
      return false
    }
    
    console.log('✅ Supabase 연결 성공')
    return true
    
  } catch (error) {
    console.error('❌ 연결 테스트 중 오류:', error.message)
    return false
  }
}

async function checkUsersTable() {
  console.log('\n👥 users 테이블 상태 점검...')
  
  try {
    // 1. 테이블 존재 및 총 사용자 수 확인
    const { data: users, error: usersError, count } = await supabase
      .from('users')
      .select('id, email, name, role, password_hash, is_active', { count: 'exact' })
    
    if (usersError) {
      console.error('❌ users 테이블 조회 실패:', usersError.message)
      return false
    }
    
    console.log(`✅ users 테이블 존재 - 총 ${count}명 사용자`)
    
    // 2. 각 사용자 상세 정보
    console.log('\n📋 사용자 목록:')
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email})`)
      console.log(`   - ID: ${user.id}`)
      console.log(`   - 역할: ${user.role}`)
      console.log(`   - 비밀번호 해시: ${user.password_hash ? '✅ 있음' : '❌ 없음'}`)
      console.log(`   - 활성 상태: ${user.is_active !== false ? '✅ 활성' : '❌ 비활성'}`)
      console.log()
    })
    
    // 3. lewis@motionsense.co.kr 계정 특별 확인
    console.log('\n🎯 lewis@motionsense.co.kr 계정 상세 점검:')
    const { data: lewisUser, error: lewisError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'lewis@motionsense.co.kr')
      .single()
    
    if (lewisError) {
      console.error('❌ lewis 계정 없음:', lewisError.message)
      
      // 유사한 이메일 검색
      console.log('\n🔍 유사한 이메일 검색:')
      const { data: similarUsers } = await supabase
        .from('users')
        .select('email, name')
        .like('email', '%lewis%')
      
      if (similarUsers && similarUsers.length > 0) {
        similarUsers.forEach(user => {
          console.log(`   - ${user.email} (${user.name})`)
        })
      } else {
        console.log('   - 유사한 이메일 없음')
      }
      
    } else {
      console.log('✅ lewis 계정 발견:')
      console.log(`   - 이름: ${lewisUser.name}`)
      console.log(`   - 이메일: ${lewisUser.email}`)
      console.log(`   - 역할: ${lewisUser.role}`)
      console.log(`   - 부서: ${lewisUser.department}`)
      console.log(`   - 직급: ${lewisUser.position}`)
      console.log(`   - 비밀번호 해시: ${lewisUser.password_hash || '없음'}`)
      console.log(`   - 활성 상태: ${lewisUser.is_active !== false ? '활성' : '비활성'}`)
      console.log(`   - 퇴사일: ${lewisUser.termination_date || '없음'}`)
    }
    
    return true
    
  } catch (error) {
    console.error('❌ users 테이블 점검 중 오류:', error.message)
    return false
  }
}

async function checkTableSchema() {
  console.log('\n🏗️ 테이블 스키마 점검...')
  
  try {
    // RLS 정책 확인
    const { data: policies, error: policyError } = await supabase
      .rpc('get_policies', { table_name: 'users' })
      .single()
    
    if (policyError) {
      console.log('⚠️ RLS 정책 확인 불가 (RPC 함수 없음)')
    } else {
      console.log('✅ RLS 정책 확인됨')
    }
    
  } catch (error) {
    console.log('⚠️ 스키마 점검 건너뛰기:', error.message)
  }
}

async function main() {
  console.log('🚨 Motion Connect HR System - Supabase 긴급 진단')
  console.log('=' .repeat(60))
  
  // 1. 연결 테스트
  const isConnected = await checkSupabaseConnection()
  if (!isConnected) return
  
  // 2. users 테이블 점검
  const usersOk = await checkUsersTable()
  if (!usersOk) return
  
  // 3. 스키마 점검
  await checkTableSchema()
  
  console.log('\n' + '='.repeat(60))
  console.log('✅ Supabase 진단 완료')
  console.log('\n💡 다음 단계:')
  console.log('1. lewis@motionsense.co.kr 계정이 있는지 확인')
  console.log('2. password_hash 필드 값 확인')
  console.log('3. 필요시 테스트 계정 생성')
}

main().catch(console.error)
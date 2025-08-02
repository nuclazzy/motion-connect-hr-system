/**
 * 테스트 사용자를 Supabase Auth + users 테이블에 생성하는 스크립트
 * 
 * 실행 방법:
 * node scripts/create-test-users.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// 생성할 테스트 사용자들
const testUsers = [
  {
    email: 'admin@test.com',
    password: 'test123',
    name: '테스트 관리자',
    role: 'admin',
    employee_id: 'ADM001',
    work_type: '정규직',
    department: '경영팀',
    position: '대표',
    hire_date: '2024-01-01',
    phone: '010-1111-1111',
    dob: '1990-01-01',
    address: '서울시 테스트구 테스트로 123'
  },
  {
    email: 'employee1@test.com',
    password: 'test123',
    name: '테스트 직원1',
    role: 'user',
    employee_id: 'EMP001',
    work_type: '정규직',
    department: '편집팀',
    position: '편집자',
    hire_date: '2024-01-15',
    phone: '010-2222-2222',
    dob: '1995-03-15',
    address: '서울시 강남구 테스트로 456'
  },
  {
    email: 'employee2@test.com',
    password: 'test123',
    name: '테스트 직원2',
    role: 'user',
    employee_id: 'EMP002',
    work_type: '정규직',
    department: '촬영팀',
    position: '촬영감독',
    hire_date: '2024-02-01',
    phone: '010-3333-3333',
    dob: '1992-07-20',
    address: '서울시 서초구 테스트로 789'
  },
  {
    email: 'employee3@test.com',
    password: 'test123',
    name: '테스트 직원3',
    role: 'user',
    employee_id: 'EMP003',
    work_type: '계약직',
    department: '마케팅팀',
    position: '마케터',
    hire_date: '2024-03-01',
    phone: '010-4444-4444',
    dob: '1988-11-10',
    address: '경기도 성남시 테스트로 012'
  }
]

async function createUser(userData) {
  try {
    console.log(`👤 사용자 생성 중: ${userData.email}`)

    // 1. 기존 사용자 확인 및 삭제
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find(user => user.email === userData.email)
    
    if (existingUser) {
      console.log(`⚠️  기존 사용자 삭제: ${userData.email}`)
      await supabase.auth.admin.deleteUser(existingUser.id)
      
      // users 테이블에서도 삭제
      await supabase.from('users').delete().eq('email', userData.email)
      await supabase.from('leave_days').delete().eq('user_id', existingUser.id)
    }

    // 2. Supabase Auth에 사용자 생성
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        role: userData.role
      }
    })

    if (authError) {
      throw new Error(`Auth 사용자 생성 실패: ${authError.message}`)
    }

    console.log(`✅ Auth 사용자 생성 완료: ${authUser.user.id}`)

    // 3. users 테이블에 프로필 정보 저장
    const { data: profileUser, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        employee_id: userData.employee_id,
        work_type: userData.work_type,
        department: userData.department,
        position: userData.position,
        hire_date: userData.hire_date,
        dob: userData.dob,
        phone: userData.phone,
        address: userData.address
      })
      .select()
      .single()

    if (profileError) {
      throw new Error(`프로필 생성 실패: ${profileError.message}`)
    }

    console.log(`✅ 프로필 생성 완료: ${profileUser.name}`)

    // 4. leave_days 테이블에 기본 휴가 데이터 생성
    const defaultLeaveTypes = {
      annual_days: userData.role === 'admin' ? 20 : 15,
      used_annual_days: userData.role === 'admin' ? 0 : Math.floor(Math.random() * 3), // 직원들은 랜덤 사용
      sick_days: 60,
      used_sick_days: userData.role === 'admin' ? 0 : Math.floor(Math.random() * 2),
      substitute_hours: userData.role === 'admin' ? 0 : Math.floor(Math.random() * 12) + 2, // 2-14시간
      compensatory_hours: userData.role === 'admin' ? 0 : Math.floor(Math.random() * 8) + 2 // 2-10시간
    }

    const { error: leaveError } = await supabase
      .from('leave_days')
      .insert({
        user_id: authUser.user.id,
        leave_types: defaultLeaveTypes
      })

    if (leaveError) {
      console.log(`⚠️  휴가 데이터 생성 실패: ${leaveError.message}`)
    } else {
      console.log(`✅ 휴가 데이터 생성 완료`)
    }

    return {
      success: true,
      authId: authUser.user.id,
      profile: profileUser,
      leaveData: defaultLeaveTypes
    }

  } catch (error) {
    console.error(`❌ ${userData.email} 생성 실패:`, error.message)
    return { success: false, error: error.message }
  }
}

async function createAllUsers() {
  console.log('🚀 테스트 사용자 생성 시작...\n')

  const results = []
  
  for (const userData of testUsers) {
    const result = await createUser(userData)
    results.push({ email: userData.email, ...result })
    console.log('') // 빈 줄
  }

  console.log('📊 생성 결과 요약:')
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.email}`)
    if (result.leaveData) {
      const leave = result.leaveData
      console.log(`   - 연차: ${leave.annual_days - leave.used_annual_days}일 남음`)
      console.log(`   - 대체휴가: ${leave.substitute_hours}시간`)
      console.log(`   - 보상휴가: ${leave.compensatory_hours}시간`)
    }
  })

  const successCount = results.filter(r => r.success).length
  console.log(`\n🎉 총 ${successCount}/${testUsers.length}명 생성 완료!`)
  
  if (successCount === testUsers.length) {
    console.log('\n✅ 모든 테스트 사용자가 성공적으로 생성되었습니다.')
    console.log('이제 http://localhost:3000에서 로그인 테스트를 진행하세요.')
    console.log('\n📋 로그인 정보:')
    testUsers.forEach(user => {
      console.log(`- ${user.email} / test123 (${user.role})`)
    })
  }
}

// 스크립트 실행
if (require.main === module) {
  createAllUsers().catch(console.error)
}

module.exports = { createAllUsers, testUsers }
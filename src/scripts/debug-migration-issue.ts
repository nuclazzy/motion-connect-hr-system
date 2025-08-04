import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugMigrationIssue() {
  try {
    console.log('🔍 마이그레이션 문제 디버깅 시작...\n')

    // 1. 모든 사용자 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name, hire_date, annual_days, used_annual_days')
      .order('hire_date', { ascending: true })

    if (usersError) {
      console.error('사용자 조회 오류:', usersError)
      return
    }

    // 2. 모든 leave_days 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('user_id, leave_types, created_at')

    if (leaveError) {
      console.error('휴가 데이터 조회 오류:', leaveError)
      return
    }

    console.log(`총 사용자: ${users.length}명`)
    console.log(`총 leave_days: ${leaveData.length}개\n`)

    // 3. leave_days를 Map으로 변환
    const leaveMap = new Map()
    leaveData.forEach(leave => {
      leaveMap.set(leave.user_id, leave.leave_types)
    })

    console.log('=== 사용자별 상태 분석 ===')
    
    for (const user of users) {
      const hasLeaveData = leaveMap.has(user.id)
      const isMigrated = user.annual_days && user.annual_days > 0
      
      console.log(`\n👤 ${user.name} (${user.email})`)
      console.log(`   입사일: ${user.hire_date}`)
      console.log(`   leave_days 존재: ${hasLeaveData ? '✅' : '❌'}`)
      console.log(`   마이그레이션 상태: ${isMigrated ? '✅' : '❌'}`)
      console.log(`   현재 annual_days: ${user.annual_days || 0}`)
      
      if (hasLeaveData) {
        const leaveTypes = leaveMap.get(user.id)
        console.log(`   leave_types:`, JSON.stringify(leaveTypes, null, 4))
      }
      
      if (!hasLeaveData && !isMigrated) {
        console.log(`   ⚠️  leave_days 없음 + 마이그레이션 안됨`)
      }
    }

    // 4. leave_days가 없는 사용자들 찾기
    const usersWithoutLeaveData = users.filter(user => !leaveMap.has(user.id))
    
    console.log(`\n=== leave_days가 없는 사용자: ${usersWithoutLeaveData.length}명 ===`)
    usersWithoutLeaveData.forEach(user => {
      console.log(`- ${user.name} (${user.email})`)
    })

    // 5. 마이그레이션이 안된 사용자들 찾기
    const notMigratedUsers = users.filter(user => !user.annual_days || user.annual_days === 0)
    
    console.log(`\n=== 마이그레이션 안된 사용자: ${notMigratedUsers.length}명 ===`)
    notMigratedUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email})`)
    })

  } catch (error) {
    console.error('디버깅 오류:', error)
  }
}

debugMigrationIssue()
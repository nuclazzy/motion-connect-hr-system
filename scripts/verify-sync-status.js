/**
 * Verify current synchronization status
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

async function verifyCurrentState() {
  try {
    console.log('🔍 현재 동기화 상태 확인 중...')
    console.log('')
    
    // Get all user leave data
    const { data: leaveData, error } = await supabase
      .from('leave_days')
      .select(`
        user_id,
        substitute_leave_hours,
        compensatory_leave_hours,
        leave_types,
        updated_at,
        users!inner(name, email, role)
      `)
      .eq('users.role', 'user')
      .order('users(name)')
    
    if (error) {
      console.error('❌ 데이터 조회 실패:', error)
      return
    }
    
    console.log('📊 전체 사용자 동기화 상태:')
    console.log('='.repeat(80))
    
    let syncedCount = 0
    let outOfSyncCount = 0
    
    leaveData.forEach((item, index) => {
      const jsonSubstitute = parseFloat(item.leave_types?.substitute_leave_hours || 0)
      const jsonCompensatory = parseFloat(item.leave_types?.compensatory_leave_hours || 0)
      const columnSubstitute = parseFloat(item.substitute_leave_hours || 0)
      const columnCompensatory = parseFloat(item.compensatory_leave_hours || 0)
      
      const substituteSynced = Math.abs(columnSubstitute - jsonSubstitute) < 0.001
      const compensatorySynced = Math.abs(columnCompensatory - jsonCompensatory) < 0.001
      const isFullySynced = substituteSynced && compensatorySynced
      
      if (isFullySynced) {
        syncedCount++
      } else {
        outOfSyncCount++
      }
      
      console.log(`${index + 1}. 사용자: ${item.users.name} (${item.users.email})`)
      console.log(`   상태: ${isFullySynced ? '✅ 동기화됨' : '❌ 비동기화됨'}`)
      console.log(`   대체휴가: 컬럼=${columnSubstitute}시간, JSON=${jsonSubstitute}시간 ${substituteSynced ? '✓' : '✗'}`)
      console.log(`   보상휴가: 컬럼=${columnCompensatory}시간, JSON=${jsonCompensatory}시간 ${compensatorySynced ? '✓' : '✗'}`)
      console.log(`   마지막 업데이트: ${new Date(item.updated_at).toLocaleString('ko-KR')}`)
      console.log('')
    })
    
    console.log('=' .repeat(80))
    console.log(`📈 요약:`)
    console.log(`   - 총 사용자 수: ${leaveData.length}명`)
    console.log(`   - 동기화된 사용자: ${syncedCount}명`)
    console.log(`   - 비동기화된 사용자: ${outOfSyncCount}명`)
    console.log(`   - 동기화 비율: ${((syncedCount / leaveData.length) * 100).toFixed(1)}%`)
    
    if (outOfSyncCount === 0) {
      console.log('')
      console.log('🎉 모든 데이터가 완벽하게 동기화되어 있습니다!')
    } else {
      console.log('')
      console.log(`⚠️ ${outOfSyncCount}명의 사용자가 아직 동기화되지 않았습니다.`)
    }
    
  } catch (error) {
    console.error('❌ 검증 중 오류:', error)
  }
}

verifyCurrentState()
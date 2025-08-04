/**
 * Data Synchronization Script
 * Fix inconsistencies between separate columns and JSON fields
 * Priority: Separate columns (substitute_leave_hours, compensatory_leave_hours) are the source of truth
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

async function checkDataInconsistencies() {
  console.log('🔍 데이터 일관성 확인 중...')
  
  const { data, error } = await supabase.rpc('check_inconsistencies_function')
  
  if (error) {
    // Function doesn't exist, let's check manually
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select(`
        user_id,
        substitute_leave_hours,
        compensatory_leave_hours,
        leave_types,
        users!inner(name, email, role)
      `)
      .eq('users.role', 'user')
    
    if (leaveError) {
      console.error('❌ 데이터 조회 실패:', leaveError)
      return []
    }
    
    const inconsistencies = leaveData.filter(item => {
      const jsonSubstitute = parseFloat(item.leave_types?.substitute_leave_hours || 0)
      const jsonCompensatory = parseFloat(item.leave_types?.compensatory_leave_hours || 0)
      const columnSubstitute = parseFloat(item.substitute_leave_hours || 0)
      const columnCompensatory = parseFloat(item.compensatory_leave_hours || 0)
      
      return (
        Math.abs(columnSubstitute - jsonSubstitute) > 0.001 ||
        Math.abs(columnCompensatory - jsonCompensatory) > 0.001
      )
    })
    
    return inconsistencies.map(item => ({
      user_id: item.user_id,
      username: item.users.name,
      email: item.users.email,
      column_substitute: item.substitute_leave_hours,
      json_substitute: parseFloat(item.leave_types?.substitute_leave_hours || 0),
      column_compensatory: item.compensatory_leave_hours,
      json_compensatory: parseFloat(item.leave_types?.compensatory_leave_hours || 0),
      substitute_mismatch: Math.abs(item.substitute_leave_hours - parseFloat(item.leave_types?.substitute_leave_hours || 0)) > 0.001,
      compensatory_mismatch: Math.abs(item.compensatory_leave_hours - parseFloat(item.leave_types?.compensatory_leave_hours || 0)) > 0.001
    }))
  }
  
  return data || []
}

async function displayInconsistencies(inconsistencies, title) {
  console.log(`\n=== ${title} ===`)
  console.log('')
  
  if (inconsistencies.length === 0) {
    console.log('✅ 데이터 불일치가 발견되지 않았습니다. 모든 데이터가 동기화되어 있습니다.')
    return
  }
  
  inconsistencies.forEach(item => {
    console.log(`사용자: ${item.username} (${item.email}) - ID: ${item.user_id}`)
    
    if (item.substitute_mismatch) {
      console.log(`  - 대체휴가: 컬럼=${item.column_substitute}시간, JSON=${item.json_substitute}시간 (불일치)`)
    }
    
    if (item.compensatory_mismatch) {
      console.log(`  - 보상휴가: 컬럼=${item.column_compensatory}시간, JSON=${item.json_compensatory}시간 (불일치)`)
    }
    
    console.log('')
  })
  
  console.log(`총 불일치 사용자 수: ${inconsistencies.length}`)
  console.log(`=== ${title} 끝 ===`)
  console.log('')
}

async function syncData() {
  try {
    console.log('🔄 데이터 동기화를 시작합니다...')
    console.log('')
    
    // Step 1: Check current inconsistencies
    const beforeInconsistencies = await checkDataInconsistencies()
    await displayInconsistencies(beforeInconsistencies, '마이그레이션 전: 데이터 불일치')
    
    if (beforeInconsistencies.length === 0) {
      console.log('✅ 동기화할 데이터가 없습니다.')
      return
    }
    
    console.log(`🔧 ${beforeInconsistencies.length}명의 사용자 데이터를 동기화합니다...`)
    console.log('')
    
    // Step 2: Update JSON fields to match separate column values
    let successCount = 0
    let errorCount = 0
    
    for (const user of beforeInconsistencies) {
      try {
        const updatedLeaveTypes = {
          ...user.leave_types,
          substitute_leave_hours: user.column_substitute,
          compensatory_leave_hours: user.column_compensatory
        }
        
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({
            leave_types: updatedLeaveTypes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.user_id)
        
        if (updateError) {
          console.error(`❌ ${user.username} 업데이트 실패:`, updateError)
          errorCount++
        } else {
          console.log(`✅ ${user.username} 동기화 완료`)
          successCount++
        }
      } catch (error) {
        console.error(`❌ ${user.username} 처리 중 오류:`, error)
        errorCount++
      }
    }
    
    console.log('')
    console.log(`📊 동기화 결과: 성공 ${successCount}명, 실패 ${errorCount}명`)
    console.log('')
    
    // Step 3: Verify synchronization
    const afterInconsistencies = await checkDataInconsistencies()
    await displayInconsistencies(afterInconsistencies, '마이그레이션 후: 검증 결과')
    
    if (afterInconsistencies.length === 0) {
      console.log('🎉 성공: 모든 데이터가 동기화되었습니다!')
      
      // Show current state summary
      console.log('\n=== 현재 데이터 요약 ===')
      const { data: currentData, error: summaryError } = await supabase
        .from('leave_days')
        .select(`
          substitute_leave_hours,
          compensatory_leave_hours,
          leave_types,
          users!inner(name, email, role)
        `)
        .eq('users.role', 'user')
        .or('substitute_leave_hours.gt.0,compensatory_leave_hours.gt.0')
        .order('users(name)')
      
      if (!summaryError && currentData) {
        currentData.forEach(item => {
          if (item.substitute_leave_hours > 0 || item.compensatory_leave_hours > 0) {
            console.log(`사용자: ${item.users.name} (${item.users.email})`)
            console.log(`  - 대체휴가: ${item.substitute_leave_hours}시간 (컬럼 & JSON 일치)`)
            console.log(`  - 보상휴가: ${item.compensatory_leave_hours}시간 (컬럼 & JSON 일치)`)
            console.log('')
          }
        })
      }
    } else {
      console.log(`⚠️ 경고: ${afterInconsistencies.length}개의 불일치가 여전히 남아있습니다!`)
    }
    
  } catch (error) {
    console.error('❌ 동기화 중 오류 발생:', error)
  }
}

async function main() {
  console.log('========================================')
  console.log('데이터 동기화 마이그레이션 시작')
  console.log('========================================')
  console.log('')
  
  await syncData()
  
  console.log('')
  console.log('========================================')
  console.log('데이터 동기화 마이그레이션 완료')
  console.log('========================================')
  console.log('')
  console.log('향후 동기화 상태를 모니터링하려면 다음 쿼리를 사용하세요:')
  console.log('SELECT * FROM leave_data_sync_monitor WHERE sync_status = \'OUT_OF_SYNC\';')
  console.log('')
}

// Run the migration
main().catch(console.error)
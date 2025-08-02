const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrateLeaveFields() {
  console.log('🔄 휴가 필드 마이그레이션 시작...')
  
  try {
    // 모든 leave_days 레코드 가져오기
    const { data: leaveRecords, error: fetchError } = await supabase
      .from('leave_days')
      .select('*')
    
    if (fetchError) {
      console.error('❌ 데이터 조회 실패:', fetchError)
      return
    }
    
    console.log(`📊 총 ${leaveRecords.length}개 레코드 발견`)
    
    for (const record of leaveRecords) {
      const leaveTypes = record.leave_types || {}
      let needsUpdate = false
      let updatedLeaveTypes = { ...leaveTypes }
      
      // substitute_hours가 있고 substitute_leave_hours가 없거나 0인 경우
      if (leaveTypes.substitute_hours && (!leaveTypes.substitute_leave_hours || leaveTypes.substitute_leave_hours === 0)) {
        updatedLeaveTypes.substitute_leave_hours = leaveTypes.substitute_hours
        needsUpdate = true
        console.log(`🔄 ${record.user_id}: substitute_hours ${leaveTypes.substitute_hours} → substitute_leave_hours`)
      }
      
      // compensatory_hours가 있고 compensatory_leave_hours가 없거나 0인 경우
      if (leaveTypes.compensatory_hours && (!leaveTypes.compensatory_leave_hours || leaveTypes.compensatory_leave_hours === 0)) {
        updatedLeaveTypes.compensatory_leave_hours = leaveTypes.compensatory_hours
        needsUpdate = true
        console.log(`🔄 ${record.user_id}: compensatory_hours ${leaveTypes.compensatory_hours} → compensatory_leave_hours`)
      }
      
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({ leave_types: updatedLeaveTypes })
          .eq('id', record.id)
        
        if (updateError) {
          console.error(`❌ ${record.user_id} 업데이트 실패:`, updateError)
        } else {
          console.log(`✅ ${record.user_id} 마이그레이션 완료`)
        }
      } else {
        console.log(`⏭️ ${record.user_id} 마이그레이션 불필요`)
      }
    }
    
    console.log('✅ 휴가 필드 마이그레이션 완료!')
    
  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error)
  }
}

migrateLeaveFields()
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createServiceRoleClient()
    
    console.log('🔧 Starting JSON structure fix...')
    
    // 현재 데이터 확인
    const { data: beforeData, error: beforeError } = await supabase
      .from('leave_days')
      .select(`
        user_id,
        substitute_leave_hours,
        compensatory_leave_hours,
        leave_types,
        users!inner(name, role)
      `)
      .eq('users.role', 'user')
    
    if (beforeError) {
      throw new Error(`데이터 조회 실패: ${beforeError.message}`)
    }
    
    console.log('📋 수정 전 데이터 확인:', beforeData?.length, '건')
    
    // 각 사용자별로 JSON 구조 수정
    let updateCount = 0
    
    for (const record of beforeData || []) {
      const leaveTypes = record.leave_types as any
      const needsUpdate = !leaveTypes.substitute_leave_hours || !leaveTypes.compensatory_leave_hours
      
      if (needsUpdate) {
        const updatedLeaveTypes = {
          ...leaveTypes,
          substitute_leave_hours: record.substitute_leave_hours || 0,
          compensatory_leave_hours: record.compensatory_leave_hours || 0
        }
        
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({
            leave_types: updatedLeaveTypes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', record.user_id)
        
        if (updateError) {
          console.error(`❌ ${(record.users as any).name} 업데이트 실패:`, updateError)
        } else {
          console.log(`✅ ${(record.users as any).name} JSON 구조 수정 완료`)
          updateCount++
        }
      }
    }
    
    // 수정 후 데이터 확인
    const { data: afterData, error: afterError } = await supabase
      .from('leave_days')
      .select(`
        substitute_leave_hours,
        compensatory_leave_hours,
        leave_types,
        users!inner(name)
      `)
      .eq('users.role', 'user')
    
    if (afterError) {
      throw new Error(`수정 후 데이터 조회 실패: ${afterError.message}`)
    }
    
    // 일관성 검증
    const consistencyCheck = afterData?.map(record => {
      const leaveTypes = record.leave_types as any
      return {
        name: (record.users as any).name,
        substitute_consistent: record.substitute_leave_hours === (leaveTypes.substitute_leave_hours || 0),
        compensatory_consistent: record.compensatory_leave_hours === (leaveTypes.compensatory_leave_hours || 0),
        substitute_column: record.substitute_leave_hours,
        substitute_json: leaveTypes.substitute_leave_hours,
        compensatory_column: record.compensatory_leave_hours,
        compensatory_json: leaveTypes.compensatory_leave_hours
      }
    })
    
    const inconsistentCount = consistencyCheck?.filter(
      check => !check.substitute_consistent || !check.compensatory_consistent
    ).length || 0
    
    return NextResponse.json({
      success: true,
      message: `JSON 구조 수정 완료: ${updateCount}건 업데이트`,
      details: {
        totalRecords: beforeData?.length || 0,
        updatedRecords: updateCount,
        inconsistentRecords: inconsistentCount,
        consistencyCheck
      }
    })
    
  } catch (error) {
    console.error('❌ JSON 구조 수정 실패:', error)
    return NextResponse.json({
      success: false,
      error: 'JSON 구조 수정 실패',
      details: (error as Error).message
    }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = await createServiceRoleClient()
    
    console.log('🔧 데이터베이스 스키마 수정 시작...')
    
    // 1. 컬럼 존재 여부 확인
    const { data: columns, error: columnError } = await supabase
      .rpc('check_column_exists', {
        table_name: 'leave_days',
        column_name: 'substitute_leave_hours'
      })
      .single()
    
    if (columnError) {
      // 직접 SQL로 컬럼 추가 시도
      console.log('📋 컬럼 추가 중...')
      
      const { error: alterError } = await supabase.rpc('sql', {
        query: `
          ALTER TABLE leave_days 
          ADD COLUMN IF NOT EXISTS substitute_leave_hours DECIMAL(4,1) DEFAULT 0,
          ADD COLUMN IF NOT EXISTS compensatory_leave_hours DECIMAL(4,1) DEFAULT 0;
        `
      })
      
      if (alterError) {
        console.log('⚠️ 컬럼 추가 실패 (이미 존재할 수 있음):', alterError.message)
      }
    }
    
    // 2. 현재 데이터 확인
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
    
    console.log('📊 수정 전 데이터:', beforeData?.length, '건')
    
    // 3. 각 사용자 데이터 수정
    let updateCount = 0
    const results = []
    
    for (const record of beforeData || []) {
      const leaveTypes = record.leave_types as any
      const userName = (record.users as any).name
      
      // JSON에서 값 추출
      const jsonSubstitute = parseFloat(leaveTypes?.substitute_leave_hours || '0')
      const jsonCompensatory = parseFloat(leaveTypes?.compensatory_leave_hours || '0')
      
      // 현재 컬럼 값
      const currentSubstitute = record.substitute_leave_hours || 0
      const currentCompensatory = record.compensatory_leave_hours || 0
      
      // 최대값 사용 (데이터 손실 방지)
      const finalSubstitute = Math.max(jsonSubstitute, currentSubstitute)
      const finalCompensatory = Math.max(jsonCompensatory, currentCompensatory)
      
      // 업데이트가 필요한 경우
      if (
        currentSubstitute !== finalSubstitute ||
        currentCompensatory !== finalCompensatory
      ) {
        const updatedLeaveTypes = {
          ...leaveTypes,
          substitute_leave_hours: finalSubstitute,
          compensatory_leave_hours: finalCompensatory
        }
        
        const { error: updateError } = await supabase
          .from('leave_days')
          .update({
            substitute_leave_hours: finalSubstitute,
            compensatory_leave_hours: finalCompensatory,
            leave_types: updatedLeaveTypes,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', record.user_id)
        
        if (updateError) {
          console.error(`❌ ${userName} 업데이트 실패:`, updateError)
          results.push({
            name: userName,
            status: 'FAILED',
            error: updateError.message
          })
        } else {
          console.log(`✅ ${userName} 데이터 수정 완료`)
          updateCount++
          results.push({
            name: userName,
            status: 'SUCCESS',
            before: {
              substitute: currentSubstitute,
              compensatory: currentCompensatory
            },
            after: {
              substitute: finalSubstitute,
              compensatory: finalCompensatory
            }
          })
        }
      } else {
        results.push({
          name: userName,
          status: 'NO_CHANGE',
          values: {
            substitute: currentSubstitute,
            compensatory: currentCompensatory
          }
        })
      }
    }
    
    // 4. 최종 일관성 확인
    const { data: finalData, error: finalError } = await supabase
      .from('leave_days')
      .select(`
        substitute_leave_hours,
        compensatory_leave_hours,
        leave_types,
        users!inner(name)
      `)
      .eq('users.role', 'user')
    
    if (finalError) {
      throw new Error(`최종 데이터 확인 실패: ${finalError.message}`)
    }
    
    // 일관성 검증
    const consistencyCheck = finalData?.map(record => {
      const leaveTypes = record.leave_types as any
      const userName = (record.users as any).name
      
      return {
        name: userName,
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
      message: `데이터베이스 스키마 수정 완료: ${updateCount}건 업데이트`,
      details: {
        totalRecords: beforeData?.length || 0,
        updatedRecords: updateCount,
        inconsistentRecords: inconsistentCount,
        results,
        consistencyCheck
      }
    })
    
  } catch (error) {
    console.error('❌ 데이터베이스 스키마 수정 실패:', error)
    return NextResponse.json({
      success: false,
      error: '데이터베이스 스키마 수정 실패',
      details: (error as Error).message
    }, { status: 500 })
  }
}
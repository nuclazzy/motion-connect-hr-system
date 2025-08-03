import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const adminUserId = authorization.replace('Bearer ', '')
    
    const supabase = await createServiceRoleClient()
    
    // 관리자 권한 확인
    const { data: adminUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    console.log('🔧 대체휴가/보상휴가 필드 초기화 시작')

    // 모든 leave_days 레코드 조회
    const { data: allLeaveData, error: fetchError } = await supabase
      .from('leave_days')
      .select('user_id, leave_types')

    if (fetchError) {
      console.error('❌ 휴가 데이터 조회 실패:', fetchError)
      return NextResponse.json({ 
        success: false, 
        error: '휴가 데이터 조회에 실패했습니다.' 
      }, { status: 500 })
    }

    console.log(`📊 총 ${allLeaveData?.length || 0}개의 휴가 데이터 발견`)

    let updatedCount = 0
    let errorCount = 0
    const updateResults = []

    for (const record of allLeaveData || []) {
      try {
        const currentLeaveTypes = record.leave_types || {}
        
        // 필드가 없거나 null인 경우에만 초기화
        let needsUpdate = false
        const updatedLeaveTypes = { ...currentLeaveTypes }

        if (!currentLeaveTypes.hasOwnProperty('substitute_leave_hours') || 
            currentLeaveTypes.substitute_leave_hours === null || 
            currentLeaveTypes.substitute_leave_hours === undefined) {
          updatedLeaveTypes.substitute_leave_hours = 0
          needsUpdate = true
        }

        if (!currentLeaveTypes.hasOwnProperty('compensatory_leave_hours') || 
            currentLeaveTypes.compensatory_leave_hours === null || 
            currentLeaveTypes.compensatory_leave_hours === undefined) {
          updatedLeaveTypes.compensatory_leave_hours = 0
          needsUpdate = true
        }

        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('leave_days')
            .update({ 
              leave_types: updatedLeaveTypes,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', record.user_id)

          if (updateError) {
            console.error(`❌ 사용자 ${record.user_id} 업데이트 실패:`, updateError)
            errorCount++
            updateResults.push({
              user_id: record.user_id,
              status: 'failed',
              error: updateError.message
            })
          } else {
            console.log(`✅ 사용자 ${record.user_id} 필드 초기화 완료`)
            updatedCount++
            updateResults.push({
              user_id: record.user_id,
              status: 'updated',
              added_fields: {
                substitute_leave_hours: updatedLeaveTypes.substitute_leave_hours,
                compensatory_leave_hours: updatedLeaveTypes.compensatory_leave_hours
              }
            })
          }
        } else {
          updateResults.push({
            user_id: record.user_id,
            status: 'skipped',
            reason: 'fields already exist'
          })
        }
      } catch (userError) {
        console.error(`❌ 사용자 ${record.user_id} 처리 중 오류:`, userError)
        errorCount++
        updateResults.push({
          user_id: record.user_id,
          status: 'failed',
          error: (userError as Error).message
        })
      }
    }

    console.log(`🎯 초기화 완료: 업데이트 ${updatedCount}개, 에러 ${errorCount}개`)

    return NextResponse.json({
      success: true,
      message: `대체휴가/보상휴가 필드 초기화 완료`,
      summary: {
        total_records: allLeaveData?.length || 0,
        updated_count: updatedCount,
        error_count: errorCount,
        skipped_count: (allLeaveData?.length || 0) - updatedCount - errorCount
      },
      detailed_results: updateResults
    })

  } catch (error) {
    console.error('❌ 필드 초기화 오류:', error)
    return NextResponse.json({
      success: false,
      error: '필드 초기화 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
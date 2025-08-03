import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 실제 대체휴가 신청 시뮬레이션 테스트
export async function POST(request: NextRequest) {
  try {
    const { userId, leaveType, requestedHours } = await request.json()
    
    console.log('🧪 휴가 신청 테스트 시작:', {
      userId,
      leaveType,
      requestedHours,
      timestamp: new Date().toISOString()
    })
    
    const supabase = await createServiceRoleClient()
    
    // 1. 사용자 데이터 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('id', userId)
      .single()
    
    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.',
        details: userError
      })
    }
    
    console.log('👤 사용자 정보:', userData)
    
    // 2. 현재 휴가 데이터 조회 (원시 데이터)
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (leaveError || !leaveData) {
      return NextResponse.json({
        success: false,
        error: '휴가 데이터를 찾을 수 없습니다.',
        details: leaveError
      })
    }
    
    console.log('📊 원시 휴가 데이터:', {
      substitute_leave_hours_column: leaveData.substitute_leave_hours,
      compensatory_leave_hours_column: leaveData.compensatory_leave_hours,
      leave_types_json: leaveData.leave_types,
      updated_at: leaveData.updated_at
    })
    
    // 3. 휴가 유형별 잔여량 계산 (모든 방법으로)
    const leaveTypes = leaveData.leave_types as any
    
    const availableHours = {
      // 방법 1: 별도 컬럼만
      column_only: leaveType === 'substitute' 
        ? leaveData.substitute_leave_hours 
        : leaveData.compensatory_leave_hours,
      
      // 방법 2: JSON만
      json_only: leaveType === 'substitute'
        ? leaveTypes?.substitute_leave_hours
        : leaveTypes?.compensatory_leave_hours,
      
      // 방법 3: 별도 컬럼 우선, JSON 보조 (현재 로직)
      fallback_current: leaveType === 'substitute'
        ? (leaveData.substitute_leave_hours ?? leaveTypes?.substitute_leave_hours ?? 0)
        : (leaveData.compensatory_leave_hours ?? leaveTypes?.compensatory_leave_hours ?? 0),
      
      // 방법 4: JSON 우선, 별도 컬럼 보조
      json_first: leaveType === 'substitute'
        ? (leaveTypes?.substitute_leave_hours ?? leaveData.substitute_leave_hours ?? 0)
        : (leaveTypes?.compensatory_leave_hours ?? leaveData.compensatory_leave_hours ?? 0)
    }
    
    console.log('🔍 휴가 잔여량 계산 결과:', availableHours)
    
    // 4. 신청 가능 여부 검증
    const validationResults = {
      column_only: (availableHours.column_only || 0) >= requestedHours,
      json_only: (availableHours.json_only || 0) >= requestedHours,
      fallback_current: (availableHours.fallback_current || 0) >= requestedHours,
      json_first: (availableHours.json_first || 0) >= requestedHours
    }
    
    console.log('✅ 신청 가능 여부:', validationResults)
    
    // 5. 실제 form_requests 테스트 삽입 시도
    const testRequestData = {
      user_id: userId,
      form_type: '휴가 신청서',
      request_data: {
        '휴가형태': leaveType === 'substitute' ? '대체휴가' : '보상휴가',
        '시작일': new Date().toISOString().split('T')[0],
        '종료일': new Date().toISOString().split('T')[0],
        '사유': '테스트 신청',
        '신청시간': requestedHours
      },
      status: 'pending',
      submitted_at: new Date().toISOString()
    }
    
    console.log('📝 테스트 신청서 데이터:', testRequestData)
    
    const { data: insertResult, error: insertError } = await supabase
      .from('form_requests')
      .insert(testRequestData)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ 신청서 삽입 실패:', insertError)
      return NextResponse.json({
        success: false,
        error: '신청서 생성 실패',
        details: insertError,
        debug: {
          userData,
          leaveData: {
            substitute_leave_hours: leaveData.substitute_leave_hours,
            compensatory_leave_hours: leaveData.compensatory_leave_hours,
            leave_types: leaveData.leave_types
          },
          availableHours,
          validationResults
        }
      })
    }
    
    console.log('✅ 테스트 신청서 생성 성공:', insertResult.id)
    
    // 6. 생성된 신청서 즉시 삭제 (테스트용)
    await supabase
      .from('form_requests')
      .delete()
      .eq('id', insertResult.id)
    
    return NextResponse.json({
      success: true,
      message: '휴가 신청 테스트 완료',
      debug: {
        user: userData,
        leaveData: {
          substitute_leave_hours: leaveData.substitute_leave_hours,
          compensatory_leave_hours: leaveData.compensatory_leave_hours,
          leave_types: leaveData.leave_types,
          updated_at: leaveData.updated_at
        },
        availableHours,
        validationResults,
        testRequestId: insertResult.id
      }
    })
    
  } catch (error) {
    console.error('🚨 휴가 신청 테스트 오류:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 실행 중 오류 발생',
      details: (error as Error).message
    }, { status: 500 })
  }
}
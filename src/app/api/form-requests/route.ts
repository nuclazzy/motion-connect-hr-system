import { NextRequest, NextResponse } from 'next/server'
import { calculateHoursToDeduct } from '@/lib/hoursToLeaveDay'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

// Helper function to calculate leave days
function calculateLeaveDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5
  }
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const timeDiff = end.getTime() - start.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // 당일 포함
  
  return daysDiff
}


export async function POST(request: NextRequest) {
  try {
    const { formType, requestData } = await request.json()

    const serviceRoleSupabase = await createServiceRoleClient()

    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    
    console.log('🔍 추출된 userId:', userId)

    console.log('📝 로컬 서식 신청:', { formType, requestData, userId })

    // 휴가 신청일 경우, 잔여 일수 확인 로직
    if (formType === '휴가 신청서') {
      console.log('🔍 Supabase 휴가 데이터 조회:', userId)
      
      // Supabase에서 휴가 데이터 조회
      const { data: userLeaveData, error: leaveError } = await serviceRoleSupabase
        .from('leave_days')
        .select('leave_types')
        .eq('user_id', userId)
        .single()

      if (leaveError || !userLeaveData) {
        console.error('❌ 휴가 정보 조회 실패:', leaveError)
        return NextResponse.json({ error: '휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
      }

      const isHalfDay = requestData.휴가형태?.includes('반차')
      const daysToDeduct = calculateLeaveDays(requestData.시작일, requestData.종료일, isHalfDay)
      const leaveTypes = userLeaveData.leave_types
      
      console.log('📊 휴가 데이터 확인:', { userId, leaveTypes, daysToDeduct })
      
      // 휴가 타입별 처리
      if (requestData.휴가형태 === '대체휴가' || requestData.휴가형태 === '보상휴가') {
        // 시간 단위 휴가 처리
        const hoursToDeduct = calculateHoursToDeduct(daysToDeduct)
        const fieldName = requestData.휴가형태 === '대체휴가' ? 'substitute_leave_hours' : 'compensatory_leave_hours'
        const availableHours = leaveTypes[fieldName] || 0
        
        console.log('🔍 시간 단위 휴가 검증:', {
          휴가형태: requestData.휴가형태,
          신청일수: daysToDeduct,
          필요시간: hoursToDeduct,
          잔여시간: availableHours,
          fieldName,
          leaveTypes
        })
        
        if (availableHours < hoursToDeduct) {
          console.error('❌ 시간 부족:', { availableHours, hoursToDeduct })
          return NextResponse.json({ 
            error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${availableHours}시간, 필요: ${hoursToDeduct}시간)` 
          }, { status: 400 })
        }
      } else {
        // 기존 연차/병가 처리
        let leaveTypeKey = 'annual_days'
        let usedTypeKey = 'used_annual_days'
        if (requestData.휴가형태 === '병가') {
          leaveTypeKey = 'sick_days'
          usedTypeKey = 'used_sick_days'
        }

        const totalDays = leaveTypes[leaveTypeKey] || 0
        const usedDays = leaveTypes[usedTypeKey] || 0
        const remainingDays = totalDays - usedDays

        if (remainingDays < daysToDeduct) {
          return NextResponse.json({ 
            error: `잔여 ${requestData.휴가형태}가 부족합니다. (잔여: ${remainingDays}일, 신청: ${daysToDeduct}일)` 
          }, { status: 400 })
        }
      }
    }

    // Supabase에 신청 저장 (Service Role 사용)
    const { data: newRequest, error: saveError } = await serviceRoleSupabase
      .from('form_requests')
      .insert({
        user_id: userId,
        form_type: formType,
        status: 'pending',
        request_data: requestData,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
      console.error('❌ 신청서 저장 실패:', saveError)
      return NextResponse.json({ error: '신청서 저장에 실패했습니다.' }, { status: 500 })
    }

    console.log('✅ Supabase 신청서 저장 완료:', newRequest)

    return NextResponse.json({ success: true, message: 'Request submitted successfully.' })
  } catch (error) {
    console.error('Form request API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }

}

// Supabase 조회 API
export async function GET() {
  try {
    const serviceRoleSupabase = await createServiceRoleClient()
    
    console.log('📋 Supabase 신청 내역 조회 시작')
    
    const { data: requests, error } = await serviceRoleSupabase
      .from('form_requests')
      .select(`
        *,
        users!form_requests_user_id_fkey(name, department, position)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ 신청 내역 조회 실패:', error)
      return NextResponse.json({ error: '신청 내역을 불러오는데 실패했습니다.' }, { status: 500 })
    }

    console.log('✅ Supabase 신청 내역 조회 완료:', requests?.length, '건')

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error('Form requests GET API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}


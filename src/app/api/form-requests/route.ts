import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 휴가 일수 계산 함수
function calculateLeaveDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) {
    return 0.5
  }
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  if (startDate === endDate) {
    return 1
  }
  
  const timeDiff = end.getTime() - start.getTime()
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1
  
  return daysDiff
}

// POST: 최소 기능 휴가 신청 처리
export async function POST(request: NextRequest) {
  console.log('🔍 Minimal form-requests API called')
  
  try {
    // 1. 기본 파라미터 파싱
    const { formType, requestData } = await request.json()
    console.log('📋 Form request:', { formType, requestData })

    // 2. Authorization 검증
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = authorization.replace('Bearer ', '')
    console.log('👤 User ID:', userId)

    // 3. Supabase 연결
    const supabase = await createServiceRoleClient()

    // 4. 휴가 신청서인 경우만 잔여량 확인
    if (formType === '휴가 신청서') {
      console.log('🏖️ 휴가 신청서 처리 시작')
      
      const leaveType = requestData['휴가형태']
      const startDate = requestData['시작일']
      const endDate = requestData['종료일']
      
      console.log('📊 휴가 정보:', { leaveType, startDate, endDate })
      
      // 사용자 휴가 데이터 조회
      const { data: leaveData, error: leaveError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (leaveError || !leaveData) {
        console.error('❌ 휴가 데이터 조회 실패:', leaveError)
        return NextResponse.json({ error: '휴가 정보를 조회할 수 없습니다.' }, { status: 404 })
      }

      console.log('📊 현재 휴가 데이터:', leaveData.leave_types)
      
      // 휴가 일수 계산
      const isHalfDay = leaveType?.includes('반차')
      let daysToRequest = calculateLeaveDays(startDate, endDate, isHalfDay)
      
      console.log('📊 신청할 휴가일수:', daysToRequest)
      
      const leaveTypes = leaveData.leave_types || {}
      
      // 🎯 대체휴가 우선 사용 독려 메시지 (강제 신청이 아닌 경우에만)
      if ((leaveType === '연차' || leaveType?.includes('반차')) && !requestData.forceAnnualLeave) {
        const substituteHours = leaveTypes.substitute_leave_hours || 0
        const substituteDays = substituteHours / 8
        
        if (substituteDays >= daysToRequest) {
          console.log('💡 대체휴가 우선 사용 권장:', { 
            신청일수: daysToRequest, 
            대체휴가잔여: substituteDays 
          })
          
          return NextResponse.json({
            warning: true,
            message: `대체휴가가 ${substituteDays.toFixed(1)}일 있습니다. 연차 대신 대체휴가 사용을 권장합니다.`,
            substituteAvailable: substituteDays,
            requestedDays: daysToRequest,
            suggestion: '대체휴가를 먼저 사용하시겠습니까?'
          }, { status: 200 })
        }
      }
      
      // 강제 연차 신청인 경우 메시지 출력
      if (requestData.forceAnnualLeave) {
        console.log('⚠️ 사용자가 대체휴가 권장을 무시하고 연차 신청을 선택했습니다.')
      }
      
      // 휴가 유형별 잔여량 확인
      if (leaveType === '대체휴가' || leaveType === '대체휴가 반차') {
        const hoursToRequest = daysToRequest * 8
        const availableHours = leaveTypes.substitute_leave_hours || 0
        
        console.log('📊 대체휴가 확인:', { 
          휴가유형: leaveType,
          신청일수: daysToRequest,
          필요시간: hoursToRequest, 
          잔여시간: availableHours 
        })
        
        if (availableHours < hoursToRequest) {
          const leaveTypeName = leaveType === '대체휴가 반차' ? '대체휴가 반차' : '대체휴가'
          return NextResponse.json({ 
            error: `${leaveTypeName} 잔여량이 부족합니다. (신청: ${daysToRequest}일, 잔여: ${(availableHours/8).toFixed(1)}일)` 
          }, { status: 400 })
        }
        
      } else if (leaveType === '보상휴가' || leaveType === '보상휴가 반차') {
        const hoursToRequest = daysToRequest * 8
        const availableHours = leaveTypes.compensatory_leave_hours || 0
        
        console.log('📊 보상휴가 확인:', { 
          휴가유형: leaveType,
          신청일수: daysToRequest,
          필요시간: hoursToRequest, 
          잔여시간: availableHours 
        })
        
        if (availableHours < hoursToRequest) {
          const leaveTypeName = leaveType === '보상휴가 반차' ? '보상휴가 반차' : '보상휴가'
          return NextResponse.json({ 
            error: `${leaveTypeName} 잔여량이 부족합니다. (신청: ${daysToRequest}일, 잔여: ${(availableHours/8).toFixed(1)}일)` 
          }, { status: 400 })
        }
        
      } else if (leaveType === '연차' || leaveType?.includes('반차')) {
        const totalDays = leaveTypes.annual_days || 0
        const usedDays = leaveTypes.used_annual_days || 0
        const remainingDays = totalDays - usedDays
        
        console.log('📊 연차 확인:', { 
          전체: totalDays, 
          사용: usedDays, 
          잔여: remainingDays, 
          신청: daysToRequest 
        })
        
        if (remainingDays < daysToRequest) {
          return NextResponse.json({ 
            error: `연차 잔여량이 부족합니다. (신청: ${daysToRequest}일, 잔여: ${remainingDays}일)` 
          }, { status: 400 })
        }
        
      } else if (leaveType === '병가') {
        const totalDays = leaveTypes.sick_days || 0
        const usedDays = leaveTypes.used_sick_days || 0
        const remainingDays = totalDays - usedDays
        
        console.log('📊 병가 확인:', { 
          전체: totalDays, 
          사용: usedDays, 
          잔여: remainingDays, 
          신청: daysToRequest 
        })
        
        if (remainingDays < daysToRequest) {
          return NextResponse.json({ 
            error: `병가 잔여량이 부족합니다. (신청: ${daysToRequest}일, 잔여: ${remainingDays}일)` 
          }, { status: 400 })
        }
      }
      
      console.log('✅ 휴가 잔여량 확인 통과')
    }

    // 5. 신청서 저장
    const { data: newRequest, error: saveError } = await supabase
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

    console.log('✅ 휴가 신청 완료:', newRequest.id)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Request submitted successfully.',
      requestId: newRequest.id
    })

  } catch (error) {
    console.error('❌ Form request API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// GET: 신청 내역 조회
export async function GET() {
  try {
    const serviceRoleSupabase = await createServiceRoleClient()
    
    console.log('📋 신청 내역 조회 시작')
    
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

    console.log('✅ 신청 내역 조회 완료:', requests?.length, '건')

    return NextResponse.json({ requests: requests || [] })
  } catch (error) {
    console.error('Form requests GET API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
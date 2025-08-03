import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SimpleLeaveSystem } from '@/lib/supabase/simple-leave-system'

export const dynamic = 'force-dynamic'

// 새로운 단순 휴가 신청 API
export async function POST(request: NextRequest) {
  try {
    console.log('🆕 새로운 휴가 신청 API 호출')
    
    const { userId, leaveType, requestedHours, startDate, endDate, reason } = await request.json()
    
    // 필수 파라미터 검증
    if (!userId || !leaveType || !requestedHours || !startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.',
        required: ['userId', 'leaveType', 'requestedHours', 'startDate', 'endDate']
      }, { status: 400 })
    }

    // 휴가 유형 검증
    if (!['substitute', 'compensatory'].includes(leaveType)) {
      return NextResponse.json({
        success: false,
        error: '잘못된 휴가 유형입니다. (substitute 또는 compensatory만 허용)'
      }, { status: 400 })
    }

    console.log('📋 휴가 신청 정보:', {
      userId,
      leaveType,
      requestedHours,
      startDate,
      endDate,
      reason
    })

    const supabase = await createServiceRoleClient()
    const leaveSystem = new SimpleLeaveSystem(supabase)

    // 휴가 신청 처리
    const result = await leaveSystem.createLeaveRequest(userId, {
      leaveType: leaveType as 'substitute' | 'compensatory',
      requestedHours: Number(requestedHours),
      startDate,
      endDate,
      reason: reason || '사유 없음'
    })

    if (result.success) {
      console.log('✅ 휴가 신청 성공:', result.requestId)
      return NextResponse.json({
        success: true,
        message: result.message,
        requestId: result.requestId
      })
    } else {
      console.log('❌ 휴가 신청 실패:', result.message)
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 400 })
    }

  } catch (error) {
    console.error('🚨 휴가 신청 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '휴가 신청 중 서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}
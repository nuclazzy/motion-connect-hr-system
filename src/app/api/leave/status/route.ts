import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SimpleLeaveSystem } from '@/lib/supabase/simple-leave-system'

export const dynamic = 'force-dynamic'

// 새로운 단순 휴가 현황 조회 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId 파라미터가 필요합니다.'
      }, { status: 400 })
    }

    console.log('📊 휴가 현황 조회:', userId)

    const supabase = await createServiceRoleClient()
    const leaveSystem = new SimpleLeaveSystem(supabase)

    // 휴가 현황 조회
    const result = await leaveSystem.getUserLeaveStatus(userId)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 404 })
    }

  } catch (error) {
    console.error('🚨 휴가 현황 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '휴가 현황 조회 중 서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}

// 휴가 신청 가능 여부 확인
export async function POST(request: NextRequest) {
  try {
    const { userId, leaveType, requestedHours } = await request.json()
    
    if (!userId || !leaveType || !requestedHours) {
      return NextResponse.json({
        success: false,
        error: '필수 파라미터가 누락되었습니다.',
        required: ['userId', 'leaveType', 'requestedHours']
      }, { status: 400 })
    }

    console.log('🔍 휴가 신청 가능 여부 확인:', { userId, leaveType, requestedHours })

    const supabase = await createServiceRoleClient()
    const leaveSystem = new SimpleLeaveSystem(supabase)

    // 신청 가능 여부 확인
    const result = await leaveSystem.canApplyForLeave(
      userId,
      leaveType as 'substitute' | 'compensatory',
      Number(requestedHours)
    )

    return NextResponse.json({
      success: true,
      canApply: result.canApply,
      availableHours: result.availableHours,
      message: result.message
    })

  } catch (error) {
    console.error('🚨 신청 가능 여부 확인 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '확인 중 서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}
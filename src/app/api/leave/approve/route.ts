import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { SimpleLeaveSystem } from '@/lib/supabase/simple-leave-system'

export const dynamic = 'force-dynamic'

// 새로운 단순 휴가 승인 API
export async function POST(request: NextRequest) {
  try {
    console.log('🆕 새로운 휴가 승인 API 호출')
    
    const { requestId, adminNote } = await request.json()
    
    // 필수 파라미터 검증
    if (!requestId) {
      return NextResponse.json({
        success: false,
        error: 'requestId가 필요합니다.'
      }, { status: 400 })
    }

    // 인증 확인
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.'
      }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')

    console.log('📋 휴가 승인 정보:', {
      requestId,
      adminUserId,
      adminNote
    })

    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: adminUser, error: adminError } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (adminError || !adminUser || adminUser.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 })
    }

    const leaveSystem = new SimpleLeaveSystem(supabase)

    // 휴가 승인 처리
    const result = await leaveSystem.approveLeaveRequest(
      requestId,
      adminUserId,
      adminNote
    )

    if (result.success) {
      console.log('✅ 휴가 승인 성공:', requestId)
      return NextResponse.json({
        success: true,
        message: result.message
      })
    } else {
      console.log('❌ 휴가 승인 실패:', result.message)
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 400 })
    }

  } catch (error) {
    console.error('🚨 휴가 승인 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '휴가 승인 중 서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 })
  }
}
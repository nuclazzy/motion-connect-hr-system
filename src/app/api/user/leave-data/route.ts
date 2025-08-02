import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    console.log('🏖️ Supabase 휴가 데이터 조회:', userId)

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. 사용자 인증 확인
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 2. 권한 확인 (본인 또는 관리자만)
    const { data: currentUser } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', session.user.id)
      .single()

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인이 아니고 관리자도 아닌 경우 접근 거부
    if (userId !== session.user.id && currentUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 3. 휴가 데이터 조회 (사용자 정보와 함께)
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select(`
        id,
        user_id,
        leave_types,
        created_at,
        updated_at,
        user:users!user_id(
          name,
          department,
          position,
          hire_date
        )
      `)
      .eq('user_id', userId)
      .single()

    if (leaveError || !leaveData) {
      console.log('❌ 휴가 데이터를 찾을 수 없음:', leaveError)
      return NextResponse.json(
        { success: false, error: '휴가 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    console.log('✅ 휴가 데이터 조회 성공:', leaveData.user)

    return NextResponse.json({
      success: true,
      data: leaveData
    })

  } catch (error) {
    console.error('Error fetching leave data:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
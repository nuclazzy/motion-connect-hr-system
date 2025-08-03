import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    console.log('🏖️ 휴가 데이터 조회:', userId)

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 휴가 데이터 조회 (사용자 정보와 함께)
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select(`
        id,
        user_id,
        leave_types,
        substitute_leave_hours,
        compensatory_leave_hours,
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
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authorization header에서 관리자 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')
    
    const supabase = await createServiceRoleClient()
    
    // 관리자 권한 확인
    const { data: adminProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    const { resignation_date } = await request.json()
    const { userId } = await params
    const employeeId = userId

    console.log('📝 퇴사 처리 요청:', { employeeId, resignation_date })

    if (!resignation_date) {
      return NextResponse.json(
        { error: '퇴사일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 퇴사일 유효성 검사 (미래 날짜여야 함)
    const resignationDate = new Date(resignation_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (resignationDate < today) {
      return NextResponse.json(
        { error: '퇴사일은 오늘 이후여야 합니다.' },
        { status: 400 }
      )
    }

    // 현재 직원 정보 조회
    const { data: employee, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', employeeId)
      .single()

    if (fetchError || !employee) {
      console.error('❌ 직원 조회 실패:', fetchError)
      return NextResponse.json(
        { error: '직원을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 퇴사 처리된 직원인지 확인
    if (!employee.is_active) {
      return NextResponse.json(
        { error: '이미 퇴사 처리된 직원입니다.' },
        { status: 400 }
      )
    }

    // 퇴사 처리 (is_active를 false로, resignation_date 설정)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_active: false,
        resignation_date: resignation_date
      })
      .eq('id', employeeId)

    if (updateError) {
      console.error('❌ 퇴사 처리 실패:', updateError)
      return NextResponse.json(
        { error: '퇴사 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    console.log('✅ 퇴사 처리 완료:', {
      employeeId,
      employeeName: employee.name,
      resignation_date
    })

    return NextResponse.json({
      success: true,
      message: `${employee.name} 직원의 퇴사 처리가 완료되었습니다.`,
      data: {
        employeeId,
        employeeName: employee.name,
        resignation_date,
        processedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ 퇴사 처리 예외:', error)
    return NextResponse.json(
      { error: '퇴사 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
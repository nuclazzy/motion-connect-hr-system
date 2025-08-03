import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const { phone, dob, address } = await request.json()

    const supabase = await createClient()
    const serviceRoleSupabase = await createServiceRoleClient()

    // Supabase 세션에서 현재 사용자 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // 직원이 수정 가능한 필드만 업데이트
    const updateData = {
      phone: phone || null,
      dob: dob || null,
      address: address || null
    }

    // 사용자 정보 업데이트 (Service Role 사용)
    const { data: updatedUser, error: updateError } = await serviceRoleSupabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, email, name, role, employee_id, department, position, hire_date, phone, dob, address')
      .single()

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '사용자 정보 업데이트에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: updatedUser
    })

  } catch (error) {
    console.error('사용자 프로필 업데이트 오류:', error)
    return NextResponse.json(
      { success: false, error: '프로필 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 런타임에 Supabase 클라이언트 생성
function getAuthSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(`Missing environment variables: URL=${!!supabaseUrl}, KEY=${!!supabaseServiceKey}`)
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, phone, dob, address } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const authSupabase = getAuthSupabase()

    // 직원이 수정 가능한 필드만 업데이트
    const updateData = {
      phone: phone || null,
      dob: dob || null,
      address: address || null
    }

    // 사용자 정보 업데이트
    const { data: updatedUser, error: updateError } = await authSupabase
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
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

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

// 관리자 권한 확인
async function checkAdminPermission(adminId: string) {
  const authSupabase = getAuthSupabase()
  
  const { data: admin } = await authSupabase
    .from('users')
    .select('role')
    .eq('id', adminId)
    .single()

  return admin?.role === 'admin'
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id } = await context.params
    const userId = id
    const body = await request.json()
    const { 
      adminId,
      name,
      email, 
      employee_id,
      department,
      position,
      phone,
      dob,
      address,
      newPassword
    } = body

    // 관리자 권한 확인
    const isAdmin = await checkAdminPermission(adminId)
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

    const authSupabase = getAuthSupabase()

    // 업데이트할 데이터 준비
    const updateData: Record<string, string | undefined> = {
      name,
      email,
      employee_id,
      department,
      position,
      phone,
      dob,
      address
    }

    // 비밀번호가 제공된 경우 해시 생성
    if (newPassword) {
      updateData.password_hash = await bcrypt.hash(newPassword, 10)
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
    console.error('사용자 업데이트 오류:', error)
    return NextResponse.json(
      { success: false, error: '사용자 정보 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
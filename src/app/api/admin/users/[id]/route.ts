import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const adminUserId = authorization.replace('Bearer ', '')
    
    const { id } = await context.params
    const userId = id
    const body = await request.json()
    const { 
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

    const authSupabase = await createServiceRoleClient()
    
    // 관리자 권한 확인
    const { data: adminUser } = await authSupabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }

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
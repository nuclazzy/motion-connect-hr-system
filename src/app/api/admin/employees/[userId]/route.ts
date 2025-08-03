import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const updatedData = await request.json()

  // Authorization header에서 userId 가져오기
  const authorization = request.headers.get('authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminUserId = authorization.replace('Bearer ', '')
  const supabase = await createServiceRoleClient()

  // 관리자 권한 확인
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminUserId)
    .single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
  }

  // 2. Update the user data
  // Prevent updating sensitive fields like id, role
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, role, password_hash, ...safeUpdateData } = updatedData

  const { data, error } = await supabase
    .from('users')
    .update(safeUpdateData)
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating employee:', error)
    return NextResponse.json({ error: 'Failed to update employee data' }, { status: 500 })
  }

  return NextResponse.json({ success: true, employee: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  console.log('🗑️ 직원 삭제 요청:', { userId })

  // Authorization header에서 userId 가져오기
  const authorization = request.headers.get('authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminUserId = authorization.replace('Bearer ', '')
  const supabase = await createServiceRoleClient()

  // 관리자 권한 확인
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', adminUserId)
    .single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
  }

  // 2. Get employee info before deletion
  const { data: employee, error: fetchError } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', userId)
    .single()

  if (fetchError || !employee) {
    console.error('❌ 직원 조회 실패:', fetchError)
    return NextResponse.json({ error: '직원을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 3. Delete the employee from users table
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (deleteError) {
    console.error('❌ 직원 삭제 실패:', deleteError)
    return NextResponse.json({ error: '직원 삭제에 실패했습니다.' }, { status: 500 })
  }

  console.log('✅ 직원 삭제 완료:', {
    userId,
    employeeName: employee.name,
    employeeEmail: employee.email
  })

  return NextResponse.json({
    success: true,
    message: `${employee.name} 직원이 성공적으로 삭제되었습니다.`,
    data: {
      deletedEmployee: {
        id: userId,
        name: employee.name,
        email: employee.email
      }
    }
  })
}
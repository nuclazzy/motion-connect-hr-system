import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1. Check for admin role
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (userProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
  }

  // 2. Fetch all users
  const { data: employees, error } = await supabase
    .from('users')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }

  // 3. Supabase 휴가 데이터와 합치기
  const employeesWithLeaveData = await Promise.all(
    employees.map(async (employee) => {
      const { data: leaveData } = await supabase
        .from('leave_days')
        .select('leave_types')
        .eq('user_id', employee.id)
        .single()
      
      const leaveTypes = leaveData?.leave_types || {}
      
      
      return {
        ...employee,
        annual_leave: leaveTypes.annual_days || 0,
        sick_leave: leaveTypes.sick_days || 0,
        substitute_leave_hours: leaveTypes.substitute_leave_hours || 0,
        compensatory_leave_hours: leaveTypes.compensatory_leave_hours || 0
      }
    })
  )

  console.log('👥 Supabase 직원 목록 조회 완료:', employeesWithLeaveData.length, '명')

  return NextResponse.json({ success: true, employees: employeesWithLeaveData })
}
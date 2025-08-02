import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  // 1. 쿠키에서 사용자 확인
  const userId = request.cookies.get('motion-connect-user-id')?.value
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 사용자 정보 및 권한 확인
  const { data: userProfile, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (userError || userProfile?.role !== 'admin') {
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
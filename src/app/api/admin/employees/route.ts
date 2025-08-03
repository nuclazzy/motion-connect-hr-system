import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    const supabase = await createClient()

    // 사용자 정보 및 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 3. Fetch all users (입사일 기준으로 정렬 - 연차순)
    const { data: employees, error } = await supabase
    .from('users')
    .select('*')
    .order('hire_date', { ascending: true })

  if (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }

  // 3. Supabase 휴가 데이터와 합치기
  const employeesWithLeaveData = await Promise.all(
    employees.map(async (employee) => {
      const { data: leaveData } = await supabase
        .from('leave_days')
        .select('leave_types, substitute_leave_hours, compensatory_leave_hours')
        .eq('user_id', employee.id)
        .single()
      
      const leaveTypes = leaveData?.leave_types || {}
      
      
      // 연차 잔여 계산 (지급 - 사용)
      const annualRemaining = (leaveTypes.annual_days || 0) - (leaveTypes.used_annual_days || 0)
      const sickRemaining = (leaveTypes.sick_days || 0) - (leaveTypes.used_sick_days || 0)
      
      // 시간 단위 휴가는 새 필드 또는 기존 필드에서 조회
      const substituteHours = leaveData?.substitute_leave_hours || leaveTypes.substitute_leave_hours || 0
      const compensatoryHours = leaveData?.compensatory_leave_hours || leaveTypes.compensatory_leave_hours || 0
      
      return {
        ...employee,
        annual_leave: Math.max(0, annualRemaining),
        sick_leave: Math.max(0, sickRemaining),
        substitute_leave_hours: substituteHours,
        compensatory_leave_hours: compensatoryHours,
        leave_data: {
          ...leaveTypes,
          substitute_leave_hours: substituteHours,
          compensatory_leave_hours: compensatoryHours
        }
      }
    })
  )

    console.log('👥 Supabase 직원 목록 조회 완료:', employeesWithLeaveData.length, '명')

    return NextResponse.json({ success: true, employees: employeesWithLeaveData })
  } catch (error) {
    console.error('직원 목록 조회 오류:', error)
    return NextResponse.json({ error: '직원 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
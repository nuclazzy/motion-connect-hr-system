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

    // 3. 최적화된 단일 쿼리로 직원 및 휴가 데이터 한 번에 조회
    const { data: employeesWithLeave, error } = await supabase
      .from('users')
      .select(`
        *,
        leave_days!leave_days_user_id_fkey(
          leave_types,
          substitute_leave_hours,
          compensatory_leave_hours
        )
      `)
      .order('hire_date', { ascending: true })

    if (error) {
      console.error('Error fetching employees with leave data:', error)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    // 데이터 변환 (N+1 쿼리 없이 처리)
    const employeesWithLeaveData = employeesWithLeave.map(employee => {
      const leaveData = employee.leave_days?.[0] // 첫 번째 휴가 데이터 (사용자당 하나)
      const leaveTypes = leaveData?.leave_types || {}
      
      // 연차 잔여 계산 (지급 - 사용)
      const annualRemaining = (leaveTypes.annual_days || 0) - (leaveTypes.used_annual_days || 0)
      const sickRemaining = (leaveTypes.sick_days || 0) - (leaveTypes.used_sick_days || 0)
      
      // 시간 단위 휴가는 새 필드 또는 기존 필드에서 조회
      const substituteHours = leaveData?.substitute_leave_hours || leaveTypes.substitute_leave_hours || 0
      const compensatoryHours = leaveData?.compensatory_leave_hours || leaveTypes.compensatory_leave_hours || 0
      
      // leave_days 필드 제거하고 변환된 데이터 반환
      const { leave_days, ...employeeWithoutLeaveArray } = employee
      
      return {
        ...employeeWithoutLeaveArray,
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

    console.log('👥 Supabase 직원 목록 조회 완료:', employeesWithLeaveData.length, '명')

    return NextResponse.json({ success: true, employees: employeesWithLeaveData })
  } catch (error) {
    console.error('직원 목록 조회 오류:', error)
    return NextResponse.json({ error: '직원 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
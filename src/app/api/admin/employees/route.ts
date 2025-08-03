import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 사용자 정보 및 권한 확인
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError || userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 3. 직원 목록 조회
    const { data: employees, error: employeeError } = await supabase
      .from('users')
      .select('*')
      .order('hire_date', { ascending: true })

    if (employeeError) {
      console.error('Error fetching employees:', employeeError)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    console.log('👥 조회된 직원 수:', employees?.length)

    // 4. 모든 직원의 휴가 데이터를 한 번에 조회 (배치 쿼리)
    const employeeIds = employees.map(emp => emp.id)
    const { data: allLeaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('user_id, leave_types, substitute_leave_hours, compensatory_leave_hours')
      .in('user_id', employeeIds)

    if (leaveError) {
      console.error('Error fetching leave data:', leaveError)
      return NextResponse.json({ error: 'Failed to fetch leave data' }, { status: 500 })
    }

    console.log('📋 조회된 휴가 데이터 수:', allLeaveData?.length)
    console.log('📋 첫 번째 휴가 데이터 샘플:', allLeaveData?.[0])

    // 5. 휴가 데이터를 맵으로 변환 (빠른 조회를 위해)
    const leaveDataMap = new Map()
    allLeaveData?.forEach(leave => {
      leaveDataMap.set(leave.user_id, leave)
    })

    // 6. 직원과 휴가 데이터 결합
    const employeesWithLeaveData = employees.map(employee => {
      const leaveData = leaveDataMap.get(employee.id)
      const leaveTypes = leaveData?.leave_types || {}
      
      console.log(`👤 ${employee.name} 휴가 데이터:`, {
        hasLeaveData: !!leaveData,
        leaveTypes,
        annual_days: leaveTypes.annual_days,
        used_annual_days: leaveTypes.used_annual_days,
        sick_days: leaveTypes.sick_days,
        used_sick_days: leaveTypes.used_sick_days
      })
      
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

    console.log('👥 Supabase 직원 목록 조회 완료:', employeesWithLeaveData.length, '명')

    return NextResponse.json({ success: true, employees: employeesWithLeaveData })
  } catch (error) {
    console.error('직원 목록 조회 오류:', error)
    return NextResponse.json({ error: '직원 목록 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
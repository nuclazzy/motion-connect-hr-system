import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'

// 기존 직원들의 급여 데이터 초기화 API
export async function POST(request: NextRequest) {
  try {
    // 요청 인증 확인 (실제 운영 시에는 더 엄격한 인증 필요)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes('admin')) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 })
    }

    // 급여 데이터가 없는 직원들 조회
    const { data: usersWithoutSalary, error: queryError } = await supabase
      .from('users')
      .select('id, name, department, position')
      .or('monthly_salary.is.null,monthly_salary.eq.0')
      .neq('role', 'admin')

    if (queryError) {
      console.error('직원 조회 오류:', queryError)
      return NextResponse.json({
        success: false,
        error: '직원 데이터 조회에 실패했습니다.'
      }, { status: 500 })
    }

    if (!usersWithoutSalary || usersWithoutSalary.length === 0) {
      return NextResponse.json({
        success: true,
        message: '급여 데이터 초기화가 필요한 직원이 없습니다.',
        updated_count: 0
      })
    }

    // 부서별 기본 급여 설정 (예시)
    const defaultSalaries: { [key: string]: number } = {
      '개발팀': 4000000,
      '기획팀': 3500000,
      '영업팀': 3500000,
      '마케팅팀': 3200000,
      '인사팀': 3000000,
      '회계팀': 3000000,
      '기타': 3000000
    }

    const updates = usersWithoutSalary.map(user => ({
      id: user.id,
      monthly_salary: defaultSalaries[user.department] || defaultSalaries['기타'],
      meal_allowance: 150000, // 기본 식대 15만원
      transportation_allowance: 100000, // 기본 교통비 10만원
      salary_details_updated_at: new Date().toISOString()
    }))

    // 배치 업데이트 실행
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .upsert(updates)
      .select('id, name, department, monthly_salary')

    if (updateError) {
      console.error('급여 데이터 업데이트 오류:', updateError)
      return NextResponse.json({
        success: false,
        error: '급여 데이터 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${updates.length}명의 직원 급여 데이터가 초기화되었습니다.`,
      updated_count: updates.length,
      updated_users: updatedUsers
    })

  } catch (error) {
    console.error('급여 데이터 초기화 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 급여 데이터 현황 조회
export async function GET(request: NextRequest) {
  try {
    // 전체 직원 수와 급여 데이터가 있는 직원 수 조회
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, name, department, monthly_salary, hourly_wage')
      .neq('role', 'admin')

    if (allUsersError) {
      console.error('직원 조회 오류:', allUsersError)
      return NextResponse.json({
        success: false,
        error: '직원 데이터 조회에 실패했습니다.'
      }, { status: 500 })
    }

    const totalUsers = allUsers?.length || 0
    const usersWithSalary = allUsers?.filter(user => user.monthly_salary && user.monthly_salary > 0).length || 0
    const usersWithHourlyWage = allUsers?.filter(user => user.hourly_wage && user.hourly_wage > 0).length || 0
    
    const usersWithoutSalary = allUsers?.filter(user => !user.monthly_salary || user.monthly_salary === 0) || []
    
    const departmentStats = allUsers?.reduce((acc, user) => {
      const dept = user.department || '미지정'
      if (!acc[dept]) {
        acc[dept] = {
          total: 0,
          withSalary: 0,
          avgSalary: 0,
          salaries: []
        }
      }
      acc[dept].total++
      if (user.monthly_salary && user.monthly_salary > 0) {
        acc[dept].withSalary++
        acc[dept].salaries.push(user.monthly_salary)
      }
      return acc
    }, {} as any)

    // 부서별 평균 급여 계산
    Object.keys(departmentStats || {}).forEach(dept => {
      const salaries = departmentStats[dept].salaries
      if (salaries.length > 0) {
        departmentStats[dept].avgSalary = Math.round(salaries.reduce((sum: number, salary: number) => sum + salary, 0) / salaries.length)
      }
    })

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        usersWithSalary,
        usersWithHourlyWage,
        usersWithoutSalary: usersWithoutSalary.length,
        departmentStats
      },
      usersWithoutSalary: usersWithoutSalary.map(user => ({
        id: user.id,
        name: user.name,
        department: user.department
      }))
    })

  } catch (error) {
    console.error('급여 데이터 현황 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
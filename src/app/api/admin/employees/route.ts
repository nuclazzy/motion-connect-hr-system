import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// 전체 직원 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    console.log('👥 관리자 - 전체 직원 목록 조회 요청')

    const supabase = await createServiceRoleClient()

    // 전체 직원 정보 조회
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        department,
        position,
        phone,
        start_date,
        role,
        salary,
        hourly_rate,
        annual_leave_days,
        used_leave_days,
        remaining_leave_days,
        created_at
      `)
      .order('department', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      console.error('❌ 직원 목록 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '직원 목록 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 직원 목록 조회 성공:', {
      count: employees?.length || 0,
      departments: [...new Set(employees?.map(emp => emp.department))].length
    })

    return NextResponse.json({
      success: true,
      data: employees || [],
      count: employees?.length || 0
    })

  } catch (error) {
    console.error('❌ 직원 목록 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 새 직원 추가 (관리자용)
export async function POST(request: NextRequest) {
  try {
    const {
      name,
      email,
      password_hash,
      department,
      position,
      phone,
      start_date,
      salary,
      hourly_rate,
      annual_leave_days = 15
    } = await request.json()

    console.log('➕ 관리자 - 새 직원 추가 요청:', {
      name,
      email,
      department,
      position
    })

    // 필수 필드 검증
    if (!name || !email || !password_hash || !department || !position) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    // 이메일 중복 확인
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: '이미 등록된 이메일입니다.'
      }, { status: 409 })
    }

    // 새 직원 추가
    const { data: newEmployee, error: insertError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password_hash,
        department,
        position,
        phone,
        start_date,
        salary: salary || null,
        hourly_rate: hourly_rate || null,
        annual_leave_days,
        used_leave_days: 0,
        remaining_leave_days: annual_leave_days,
        role: 'employee'
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ 직원 추가 오류:', insertError)
      return NextResponse.json({
        success: false,
        error: '직원 추가에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 새 직원 추가 성공:', {
      id: newEmployee.id,
      name: newEmployee.name,
      department: newEmployee.department
    })

    return NextResponse.json({
      success: true,
      data: newEmployee,
      message: `새 직원 ${name}님이 추가되었습니다.`
    })

  } catch (error) {
    console.error('❌ 직원 추가 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
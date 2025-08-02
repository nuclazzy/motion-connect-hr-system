import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Creating admin account or updating existing user to admin')

    // 첫 번째 사용자를 관리자로 업데이트하거나 새 관리자 계정 생성
    const adminEmail = 'admin@motionsense.co.kr'
    const adminPassword = 'admin123'

    // 기존 관리자 계정이 있는지 확인
    const { data: existingAdmin, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single()

    if (!checkError && existingAdmin) {
      console.log('✅ Admin account already exists')
      return NextResponse.json({
        success: true,
        message: '관리자 계정이 이미 존재합니다.',
        admin: {
          email: existingAdmin.email,
          name: existingAdmin.name,
          role: existingAdmin.role
        }
      })
    }

    // 새 관리자 계정 생성
    const adminData = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: adminEmail,
      name: '시스템 관리자',
      role: 'admin',
      employee_id: 'ADMIN001',
      work_type: '정규직',
      department: '경영지원팀',
      position: '시스템 관리자',
      dob: '1990-01-01',
      phone: '010-0000-0000',
      address: '서울시 강남구',
      hire_date: '2020-01-01',
      password: adminPassword, // 평문 비밀번호 (테스트용)
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert(adminData)
      .select()
      .single()

    if (createError) {
      console.error('Admin creation error:', createError)
      return NextResponse.json({
        success: false,
        error: '관리자 계정 생성에 실패했습니다.',
        details: createError.message
      })
    }

    // 관리자용 휴가 데이터도 생성
    const { error: leaveError } = await supabase
      .from('leave_days')
      .insert({
        id: '650e8400-e29b-41d4-a716-446655440000',
        user_id: adminData.id,
        leave_types: {
          sick_days: 5,
          annual_days: 19,
          used_sick_days: 0,
          used_annual_days: 0
        },
        substitute_leave_hours: 0,
        compensatory_leave_hours: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (leaveError) {
      console.error('Admin leave data creation error:', leaveError)
    }

    console.log('✅ Admin account created successfully')

    return NextResponse.json({
      success: true,
      message: '관리자 계정이 생성되었습니다.',
      admin: {
        email: newAdmin.email,
        name: newAdmin.name,
        role: newAdmin.role,
        login_info: {
          email: adminEmail,
          password: adminPassword
        }
      }
    })

  } catch (error) {
    console.error('Admin creation error:', error)
    return NextResponse.json({
      success: false,
      error: '관리자 계정 생성 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
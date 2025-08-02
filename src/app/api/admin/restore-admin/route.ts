import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Restoring admin privileges for lewis@motionsense.co.kr')

    const adminEmail = 'lewis@motionsense.co.kr'

    // lewis@motionsense.co.kr 계정 찾기
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', adminEmail)
      .single()

    if (findError || !existingUser) {
      console.log('❌ Lewis account not found, creating new one')
      
      // lewis 계정이 없으면 새로 생성
      const lewisData = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        email: adminEmail,
        name: '이루이스',
        role: 'admin',
        employee_id: 'ADMIN001',
        work_type: '정규직',
        department: '경영지원팀',
        position: '시스템 관리자',
        dob: '1990-01-01',
        phone: '010-0000-0000',
        address: '서울시 강남구',
        hire_date: '2020-01-01',
        password: 'admin123', // 평문 비밀번호 (테스트용)
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert(lewisData)
        .select()
        .single()

      if (createError) {
        console.error('Lewis account creation error:', createError)
        return NextResponse.json({
          success: false,
          error: 'Lewis 계정 생성에 실패했습니다.',
          details: createError.message
        })
      }

      // 휴가 데이터도 생성
      const { error: leaveError } = await supabase
        .from('leave_days')
        .insert({
          id: '650e8400-e29b-41d4-a716-446655440000',
          user_id: lewisData.id,
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
        console.error('Lewis leave data creation error:', leaveError)
      }

      console.log('✅ Lewis admin account created')
      return NextResponse.json({
        success: true,
        message: 'Lewis 관리자 계정이 생성되었습니다.',
        user: newUser,
        login_info: {
          email: adminEmail,
          password: 'admin123'
        }
      })
    }

    // 기존 계정이 있으면 관리자 권한으로 업데이트
    if (existingUser.role !== 'admin') {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          role: 'admin',
          password: 'admin123', // 비밀번호도 재설정
          updated_at: new Date().toISOString()
        })
        .eq('email', adminEmail)
        .select()
        .single()

      if (updateError) {
        console.error('Role update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '관리자 권한 업데이트에 실패했습니다.',
          details: updateError.message
        })
      }

      console.log('✅ Lewis account updated to admin')
      return NextResponse.json({
        success: true,
        message: 'Lewis 계정이 관리자 권한으로 업데이트되었습니다.',
        user: updatedUser,
        login_info: {
          email: adminEmail,
          password: 'admin123'
        }
      })
    }

    // 이미 관리자 권한이 있는 경우
    console.log('✅ Lewis account already has admin privileges')
    return NextResponse.json({
      success: true,
      message: 'Lewis 계정은 이미 관리자 권한을 가지고 있습니다.',
      user: existingUser,
      login_info: {
        email: adminEmail,
        password: 'admin123'
      }
    })

  } catch (error) {
    console.error('Admin restoration error:', error)
    return NextResponse.json({
      success: false,
      error: '관리자 권한 복원 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
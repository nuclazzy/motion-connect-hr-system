import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave'

// 관리자 전용 사용자 생성 API
export async function POST(request: NextRequest) {
  try {
    const userData = await request.json()
    const serviceRoleSupabase = await createServiceRoleClient()

    // 1. Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')

    // 현재 사용자의 role 확인
    const { data: currentUser } = await serviceRoleSupabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 2. 초기 비밀번호 '0000'으로 password_hash 생성
    const initialPassword = '0000'
    const password_hash = await bcrypt.hash(initialPassword, 10)

    // 3. users 테이블에 사용자 정보 저장
    const { data: profileUser, error: profileError } = await serviceRoleSupabase
      .from('users')
      .insert({
        email: userData.email,
        password_hash: password_hash,
        name: userData.name,
        role: userData.role || 'user',
        employee_id: userData.employee_id,
        work_type: userData.work_type,
        department: userData.department,
        position: userData.position,
        hire_date: userData.hire_date,
        dob: userData.dob || null,
        phone: userData.phone || null,
        address: userData.address || null,
        termination_date: userData.termination_date || null,
        contract_end_date: userData.contract_end_date || null
      })
      .select()
      .single()

    if (profileError) {
      console.error('사용자 생성 실패:', profileError)
      return NextResponse.json({ 
        error: '사용자 생성 실패: ' + profileError.message 
      }, { status: 400 })
    }

    // 4. leave_days 테이블에 기본 휴가 데이터 생성 - 입사일 기준으로 계산
    const calculatedAnnualDays = userData.hire_date ? 
      calculateAnnualLeave(userData.hire_date) : 
      15 // 입사일이 없으면 기본값 15일
    
    const defaultLeaveTypes = {
      annual_days: calculatedAnnualDays,
      used_annual_days: 0,
      sick_days: 60, // 회사 정책에 따른 병가 기본값
      used_sick_days: 0,
      substitute_leave_hours: 0,
      compensatory_leave_hours: 0
    }

    const { error: leaveError } = await serviceRoleSupabase
      .from('leave_days')
      .insert({
        user_id: profileUser.id,
        leave_types: defaultLeaveTypes
      })

    if (leaveError) {
      console.error('휴가 데이터 생성 실패:', leaveError)
      // 오류가 있어도 사용자 생성은 완료된 상태로 진행
    }

    console.log('✅ 사용자 생성 완료:', profileUser.email)

    return NextResponse.json({
      success: true,
      user: profileUser,
      initialPassword: initialPassword,
      message: `사용자가 성공적으로 생성되었습니다. 초기 비밀번호: ${initialPassword}`
    })

  } catch (error) {
    console.error('사용자 생성 중 오류:', error)
    return NextResponse.json(
      { error: '사용자 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
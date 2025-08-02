import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// 관리자 전용 사용자 생성 API
export async function POST(request: Request) {
  try {
    const userData = await request.json()
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // 1. 현재 요청자가 관리자인지 확인
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 현재 사용자의 role 확인
    const { data: currentUser } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 2. Supabase Auth에 사용자 생성
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // 이메일 확인 생략
      user_metadata: {
        name: userData.name,
        role: userData.role || 'user'
      }
    })

    if (authError) {
      console.error('Auth 사용자 생성 실패:', authError)
      return NextResponse.json({ 
        error: '사용자 생성 실패: ' + authError.message 
      }, { status: 400 })
    }

    // 3. users 테이블에 프로필 정보 저장
    const { data: profileUser, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: userData.email,
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
      console.error('프로필 생성 실패:', profileError)
      
      // Auth 사용자 삭제 (롤백)
      await supabase.auth.admin.deleteUser(authUser.user.id)
      
      return NextResponse.json({ 
        error: '프로필 생성 실패: ' + profileError.message 
      }, { status: 400 })
    }

    // 4. leave_days 테이블에 기본 휴가 데이터 생성
    const defaultLeaveTypes = {
      annual_days: userData.role === 'admin' ? 20 : 15,
      used_annual_days: 0,
      sick_days: 60,
      used_sick_days: 0,
      substitute_leave_hours: 0,
      compensatory_leave_hours: 0
    }

    const { error: leaveError } = await supabase
      .from('leave_days')
      .insert({
        user_id: authUser.user.id,
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
      authUserId: authUser.user.id,
      message: '사용자가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('사용자 생성 중 오류:', error)
    return NextResponse.json(
      { error: '사용자 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
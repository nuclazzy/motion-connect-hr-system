import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { success: false, error: '새 비밀번호는 최소 4자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const serviceRoleSupabase = await createServiceRoleClient()

    // 1. Supabase 세션에서 현재 사용자 확인
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      return NextResponse.json(
        { success: false, error: '인증이 필요합니다. 다시 로그인해주세요.' },
        { status: 401 }
      )
    }

    const userId = session.user.id

    console.log('🔐 비밀번호 변경 요청:', { 
      userId: userId,
      email: session.user.email
    })

    // 2. 현재 사용자의 비밀번호 해시 조회 (Service Role 사용)
    const { data: user, error: userError } = await serviceRoleSupabase
      .from('users')
      .select('id, email, name, password_hash')
      .eq('id', userId)
      .single()

    console.log('👤 사용자 조회 결과:', { 
      found: !!user, 
      userError: userError?.message,
      userId: user?.id,
      email: user?.email 
    })

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 3. 현재 비밀번호 확인
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 4. 새 비밀번호 해시 생성
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // 5. 비밀번호 업데이트 (Service Role 사용)
    const { error: updateError } = await serviceRoleSupabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json(
        { success: false, error: '비밀번호 변경에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.'
    })

  } catch (error) {
    console.error('비밀번호 변경 오류:', error)
    return NextResponse.json(
      { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
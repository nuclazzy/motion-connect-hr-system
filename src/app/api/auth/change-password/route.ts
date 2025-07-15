import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

// 런타임에 Supabase 클라이언트 생성
function getAuthSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(`Missing environment variables: URL=${!!supabaseUrl}, KEY=${!!supabaseServiceKey}`)
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await request.json()

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    const authSupabase = getAuthSupabase()

    // 1. 현재 사용자 조회
    const { data: user, error: userError } = await authSupabase
      .from('users')
      .select('password_hash')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 2. 현재 비밀번호 확인
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 3. 새 비밀번호 해시 생성
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // 4. 비밀번호 업데이트
    const { error: updateError } = await authSupabase
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
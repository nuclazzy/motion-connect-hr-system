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
    const { email, password } = await request.json()
    const authSupabase = getAuthSupabase()

    // 1. 사용자 조회
    const { data: user, error: userError } = await authSupabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 2. 비밀번호 확인
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 3. 성공 시 사용자 정보 반환
    const userInfo = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee_id: user.employee_id,
      department: user.department,
      position: user.position,
      hire_date: user.hire_date,
      phone: user.phone,
      dob: user.dob,
      address: user.address
    }

    return NextResponse.json({
      success: true,
      user: userInfo
    })

  } catch (error) {
    console.error('로그인 오류:', error)
    return NextResponse.json(
      { success: false, error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
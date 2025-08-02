import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Lewis 계정 조회
    const { data: lewis, error } = await supabase
      .from('users')
      .select('id, email, name, role, password, password_hash, created_at, updated_at')
      .eq('email', 'lewis@motionsense.co.kr')
      .single()

    if (error) {
      console.error('Lewis 계정 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: 'Lewis 계정을 찾을 수 없습니다.',
        details: error.message
      })
    }

    // 다른 관리자 계정도 확인
    const { data: admins, error: adminError } = await supabase
      .from('users')
      .select('id, email, name, role')
      .eq('role', 'admin')

    return NextResponse.json({
      success: true,
      lewis_account: lewis,
      all_admins: admins,
      password_info: {
        has_password: !!lewis?.password,
        has_password_hash: !!lewis?.password_hash,
        password_length: lewis?.password?.length || 0
      }
    })

  } catch (error) {
    console.error('디버그 오류:', error)
    return NextResponse.json({
      success: false,
      error: '디버그 중 오류 발생',
      details: (error as Error).message
    }, { status: 500 })
  }
}
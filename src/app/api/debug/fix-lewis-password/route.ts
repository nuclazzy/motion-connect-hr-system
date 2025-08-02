import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Fixing Lewis account password')

    // Lewis 계정 찾기
    const { data: lewis, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'lewis@motionsense.co.kr')
      .single()

    if (findError || !lewis) {
      return NextResponse.json({
        success: false,
        error: 'Lewis 계정을 찾을 수 없습니다.',
        details: findError?.message
      })
    }

    // 비밀번호 해시 생성
    const newPassword = 'admin123'
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // 비밀번호 업데이트
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        password: newPassword,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq('email', 'lewis@motionsense.co.kr')
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: '비밀번호 업데이트 실패',
        details: updateError.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Lewis 계정 비밀번호가 업데이트되었습니다.',
      email: 'lewis@motionsense.co.kr',
      password: newPassword,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role
      }
    })

  } catch (error) {
    console.error('비밀번호 수정 오류:', error)
    return NextResponse.json({
      success: false,
      error: '비밀번호 수정 중 오류 발생',
      details: (error as Error).message
    }, { status: 500 })
  }
}
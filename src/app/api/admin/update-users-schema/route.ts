import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    console.log('🔄 Adding password_hash column to users table')

    // 1. password_hash 컬럼 추가 (이미 존재할 수 있으므로 IF NOT EXISTS 사용)
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS password_hash TEXT;
      `
    })

    if (alterError) {
      console.log('ℹ️ ALTER TABLE 실행 결과:', alterError.message)
      // 컬럼이 이미 존재하는 경우는 무시
    }

    // 2. 모든 사용자에게 기본 비밀번호 "0000" 설정 (password_hash가 null인 경우만)
    const defaultPassword = '0000'
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds)

    console.log('🔑 Setting default password for users without password_hash')

    // password_hash가 null인 사용자들 찾기
    const { data: usersWithoutPassword, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email')
      .is('password_hash', null)

    if (fetchError) {
      console.error('❌ 사용자 조회 실패:', fetchError)
      return NextResponse.json({ error: '사용자 조회 실패' }, { status: 500 })
    }

    console.log(`📊 password_hash가 없는 사용자: ${usersWithoutPassword?.length || 0}명`)

    // 각 사용자에게 기본 비밀번호 설정
    if (usersWithoutPassword && usersWithoutPassword.length > 0) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: hashedPassword })
        .is('password_hash', null)

      if (updateError) {
        console.error('❌ 비밀번호 설정 실패:', updateError)
        return NextResponse.json({ error: '기본 비밀번호 설정 실패' }, { status: 500 })
      }

      console.log(`✅ ${usersWithoutPassword.length}명의 사용자에게 기본 비밀번호(0000) 설정 완료`)
    }

    // 3. 결과 확인
    const { data: updatedUsers, error: checkError } = await supabase
      .from('users')
      .select('id, name, email, password_hash')
      .limit(3)

    if (checkError) {
      console.error('❌ 결과 확인 실패:', checkError)
    }

    console.log('🔍 스키마 업데이트 결과:', {
      updated_users_count: usersWithoutPassword?.length || 0,
      sample_user: updatedUsers?.[0] ? {
        id: updatedUsers[0].id,
        name: updatedUsers[0].name,
        has_password_hash: !!updatedUsers[0].password_hash
      } : null
    })

    return NextResponse.json({
      success: true,
      message: 'users 테이블 스키마 업데이트 완료',
      data: {
        password_hash_column_added: true,
        users_updated: usersWithoutPassword?.length || 0,
        default_password: '0000'
      }
    })

  } catch (error) {
    console.error('❌ 스키마 업데이트 오류:', error)
    return NextResponse.json({
      success: false,
      error: '스키마 업데이트 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
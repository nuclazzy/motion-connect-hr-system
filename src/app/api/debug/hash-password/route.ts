import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()
    
    if (!password) {
      return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const saltRounds = 10
    const hash = await bcrypt.hash(password, saltRounds)
    
    // 검증 테스트
    const isValid = await bcrypt.compare(password, hash)
    
    return NextResponse.json({
      password: password,
      hash: hash,
      saltRounds: saltRounds,
      verification: isValid ? '✅ 검증 성공' : '❌ 검증 실패'
    })
    
  } catch (error) {
    console.error('해시 생성 오류:', error)
    return NextResponse.json({ error: '해시 생성 중 오류 발생' }, { status: 500 })
  }
}

export async function GET() {
  // 기본적으로 '0000' 해시 생성
  const password = '0000'
  const saltRounds = 10
  const hash = await bcrypt.hash(password, saltRounds)
  
  return NextResponse.json({
    password: password,
    hash: hash,
    saltRounds: saltRounds,
    note: '매번 다른 해시값이 생성됩니다 (Salt 때문)'
  })
}
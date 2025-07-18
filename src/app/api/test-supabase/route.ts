import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    
    // 간단한 테이블 조회 테스트
    const { data: testData, error: testError } = await supabase
      .from('calendar_configs')
      .select('*')
      .limit(1)

    if (testError) {
      console.error('Supabase 테스트 오류:', testError)
      return NextResponse.json({ 
        success: false,
        error: 'Supabase 연결 실패',
        details: testError.message,
        code: testError.code
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Supabase 연결 성공',
      data: testData,
      count: testData?.length || 0
    })

  } catch (error) {
    console.error('Supabase 연결 테스트 오류:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Supabase 연결 테스트 중 오류 발생',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
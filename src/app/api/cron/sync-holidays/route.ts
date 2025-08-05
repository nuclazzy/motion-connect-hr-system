import { NextRequest, NextResponse } from 'next/server'
import { autoSyncHolidays } from '@/lib/actions/holiday-sync'

export const dynamic = 'force-dynamic'

// 월별 공휴일 자동 동기화 Cron 작업
export async function GET(request: NextRequest) {
  try {
    console.log('🤖 월별 공휴일 자동 동기화 Cron 작업 시작')
    
    // Authorization 헤더 확인 (보안을 위해)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || 'motion-connect-cron-2025'
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 자동 공휴일 동기화 실행 (현재년도 + 다음년도)
    const result = await autoSyncHolidays()
    
    if (result.success) {
      console.log('✅ 월별 공휴일 자동 동기화 완료:', result.message)
      
      return NextResponse.json({
        success: true,
        message: 'Holiday sync completed successfully',
        timestamp: new Date().toISOString(),
        results: result.results
      })
    } else {
      console.error('❌ 월별 공휴일 자동 동기화 실패:', result.error)
      
      return NextResponse.json({
        success: false,
        message: 'Holiday sync failed',
        error: result.error,
        timestamp: new Date().toISOString()
      })
    }

  } catch (error) {
    console.error('❌ Cron 작업 실행 중 오류:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// POST 요청도 지원 (수동 트리거용)
export async function POST(request: NextRequest) {
  return GET(request)
}
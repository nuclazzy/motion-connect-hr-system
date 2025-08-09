/**
 * Vercel Cron Job 엔드포인트 - 공휴일 자동 동기화
 * 
 * 설정: vercel.json에서 일정 설정
 * {
 *   "crons": [{
 *     "path": "/api/cron/holiday-sync",
 *     "schedule": "0 2 * * *"  // 매일 오전 2시
 *   }]
 * }
 * 
 * 참고: "개발자는 게을러져야 한다" 철학
 * - 1-2일 내 자동 임시공휴일 반영
 * - 변경 감지 자동화
 * - DB 동기화 완전 자동화
 */

import { NextRequest, NextResponse } from 'next/server'
import { runHolidaySyncScheduler } from '@/lib/holiday-scheduler'

/**
 * Vercel Cron Job 인증 검증
 */
function verifyCronRequest(request: NextRequest): boolean {
  const cronSecret = request.headers.get('authorization')
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`
  
  // 개발 환경에서는 인증 건너뛰기
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Development mode: Skipping cron auth verification')
    return true
  }
  
  if (cronSecret !== expectedSecret) {
    console.log('❌ Invalid cron secret')
    return false
  }
  
  return true
}

/**
 * POST /api/cron/holiday-sync
 * Vercel Cron Jobs에서 호출하는 스케줄된 작업
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Cron Job 인증 검증
    if (!verifyCronRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized cron request' },
        { status: 401 }
      )
    }
    
    console.log('🚀 Holiday sync cron job started')
    
    // 2. 현재 년도와 다음 년도 동기화
    const currentYear = new Date().getFullYear()
    const results = []
    
    // 현재 년도
    const currentYearResult = await runHolidaySyncScheduler(currentYear)
    results.push(currentYearResult)
    
    // 다음 년도 (12월부터 미리 준비)
    const currentMonth = new Date().getMonth() + 1
    if (currentMonth >= 12) {
      const nextYear = currentYear + 1
      const nextYearResult = await runHolidaySyncScheduler(nextYear)
      results.push(nextYearResult)
    }
    
    // 3. 결과 집계
    const totalStats = results.reduce((acc, result) => ({
      inserted: acc.inserted + result.stats.inserted,
      updated: acc.updated + result.stats.updated,
      newTemporary: acc.newTemporary + result.stats.newTemporary,
      newSubstitute: acc.newSubstitute + result.stats.newSubstitute
    }), {
      inserted: 0,
      updated: 0,
      newTemporary: 0,
      newSubstitute: 0
    })
    
    const hasUpdates = totalStats.inserted > 0 || totalStats.updated > 0
    const hasNewTemporary = totalStats.newTemporary > 0
    
    // 4. 중요한 변경사항 로깅
    if (hasNewTemporary) {
      console.log(`🚨 ALERT: ${totalStats.newTemporary} new temporary holidays detected!`)
    }
    
    console.log(`✅ Holiday sync cron job completed: ${JSON.stringify(totalStats)}`)
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      totalStats,
      alerts: {
        hasUpdates,
        hasNewTemporary,
        message: hasNewTemporary ? 
          `🚨 ${totalStats.newTemporary} new temporary holidays detected - immediate attention required!` : 
          'No critical updates'
      }
    })
    
  } catch (error) {
    console.error('❌ Holiday sync cron job failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Holiday sync cron job failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/holiday-sync
 * 수동 테스트 및 상태 확인용
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const testMode = searchParams.get('test') === 'true'
    
    if (testMode) {
      console.log(`🧪 Manual test mode for year ${year}`)
    } else {
      // 수동 실행도 인증 필요
      if (!verifyCronRequest(request)) {
        return NextResponse.json(
          { error: 'Unauthorized manual request' },
          { status: 401 }
        )
      }
    }
    
    const result = await runHolidaySyncScheduler(year)
    
    return NextResponse.json({
      success: true,
      mode: testMode ? 'manual-test' : 'manual-run',
      year,
      result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Manual holiday sync failed:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Manual holiday sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

/**
 * 상태 확인용 헬스체크
 */
export async function HEAD() {
  return new Response(null, { status: 200 })
}
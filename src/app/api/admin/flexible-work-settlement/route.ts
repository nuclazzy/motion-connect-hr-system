import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUserServer, isAdmin } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

// 탄력근무제 정산 및 수당 계산 API
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserServer(request)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ 
        success: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('schedule_id')
    const userId = searchParams.get('user_id')

    if (!scheduleId) {
      return NextResponse.json({ 
        success: false, 
        error: 'schedule_id가 필요합니다.' 
      }, { status: 400 })
    }

    // 정산 데이터 계산 실행
    const { data: settlementData, error } = await supabase
      .rpc('calculate_settlement_period', {
        p_user_id: userId,
        p_schedule_id: scheduleId
      })

    if (error) {
      console.error('정산 계산 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '정산 계산 중 오류가 발생했습니다.' 
      }, { status: 500 })
    }

    // 상세 분석 데이터 추가 조회
    const analysisData = userId ? await getDetailedAnalysis(supabase, scheduleId, userId) : null

    return NextResponse.json({ 
      success: true, 
      data: {
        settlement: settlementData[0],
        analysis: analysisData
      }
    })

  } catch (error) {
    console.error('❌ 탄력근무제 정산 조회 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 정산 확정 처리
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserServer(request)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ 
        success: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 })
    }

    const { schedule_id, user_id, settlement_data } = await request.json()
    const supabase = await createServiceRoleClient()

    // 정산 확정 데이터 저장
    const { data, error } = await supabase
      .from('settlement_period_summary')
      .upsert({
        schedule_id,
        user_id,
        settlement_start_date: settlement_data.settlement_start,
        settlement_end_date: settlement_data.settlement_end,
        planned_total_hours: settlement_data.planned_total_hours,
        actual_total_hours: settlement_data.actual_total_hours,
        planned_weekly_average: settlement_data.planned_weekly_avg,
        actual_weekly_average: settlement_data.actual_weekly_avg,
        excess_hours_over_40: settlement_data.overtime_allowance_hours,
        total_night_hours: settlement_data.night_allowance_hours,
        is_finalized: true,
        finalized_at: new Date().toISOString(),
        finalized_by: user.id
      })
      .select()

    if (error) throw error

    // 수당 계산 결과도 함께 저장
    await saveAllowanceCalculation(supabase, user_id, settlement_data, user.id)

    return NextResponse.json({ 
      success: true, 
      data,
      message: '정산이 확정되었습니다.' 
    })

  } catch (error) {
    console.error('❌ 탄력근무제 정산 확정 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 상세 분석 데이터 조회 함수
async function getDetailedAnalysis(supabase: any, scheduleId: string, userId: string) {
  // 주간별 분석
  const { data: weeklyData } = await supabase
    .from('weekly_schedule_summary')
    .select('*')
    .eq('schedule_id', scheduleId)
    .eq('user_id', userId)
    .order('week_start_date')

  // 일별 상세 분석
  const { data: dailyAnalysis } = await supabase
    .from('daily_scheduled_hours')
    .select(`
      *,
      daily_work_summary!left(
        basic_hours,
        overtime_hours,
        night_hours,
        work_status
      )
    `)
    .eq('schedule_id', scheduleId)
    .eq('user_id', userId)
    .order('work_date')

  // 초과근무/야간근무 분석
  const overtimeAnalysis = dailyAnalysis?.map((day: any) => {
    const planned = day.planned_work_hours
    const actual = (day.daily_work_summary?.basic_hours || 0) + 
                  (day.daily_work_summary?.overtime_hours || 0)
    const night = day.daily_work_summary?.night_hours || 0
    
    return {
      date: day.work_date,
      planned_hours: planned,
      actual_hours: actual,
      variance: actual - planned,
      unplanned_overtime: Math.max(0, actual - planned),
      night_hours: night,
      overtime_allowance: Math.max(0, actual - planned) > 0 ? Math.max(0, actual - planned) : 0,
      night_allowance: night // 야간근무는 항상 수당 지급
    }
  })

  return {
    weekly_summary: weeklyData,
    daily_analysis: dailyAnalysis,
    overtime_analysis: overtimeAnalysis,
    summary: {
      total_unplanned_overtime: overtimeAnalysis?.reduce((sum: number, day: any) => sum + day.unplanned_overtime, 0) || 0,
      total_night_hours: overtimeAnalysis?.reduce((sum: number, day: any) => sum + day.night_hours, 0) || 0,
      total_overtime_allowance: overtimeAnalysis?.reduce((sum: number, day: any) => sum + day.overtime_allowance, 0) || 0,
      total_night_allowance: overtimeAnalysis?.reduce((sum: number, day: any) => sum + day.night_allowance, 0) || 0
    }
  }
}

// 수당 계산 결과 저장 함수
async function saveAllowanceCalculation(
  supabase: any, 
  userId: string, 
  settlementData: any, 
  adminId: string
) {
  // 별도 수당 계산 테이블에 저장 (필요시 구현)
  const allowanceData = {
    user_id: userId,
    settlement_period_start: settlementData.settlement_start,
    settlement_period_end: settlementData.settlement_end,
    overtime_allowance_hours: settlementData.overtime_allowance_hours,
    night_allowance_hours: settlementData.night_allowance_hours,
    calculated_by: adminId,
    calculated_at: new Date().toISOString()
  }

  // 실제로는 급여 시스템과 연동하여 수당 지급 처리
  console.log('💰 수당 계산 완료:', allowanceData)
  
  return allowanceData
}
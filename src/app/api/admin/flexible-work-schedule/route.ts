import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUserServer, isAdmin } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

// 탄력근무제 근무계획표 관리 API
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
    const status = searchParams.get('status') // 'active', 'draft', etc.

    if (scheduleId) {
      // 특정 스케줄 상세 조회
      const { data: schedule, error } = await supabase
        .from('flexible_work_schedules')
        .select(`
          *,
          daily_scheduled_hours(*),
          weekly_schedule_summary(*),
          settlement_period_summary(*)
        `)
        .eq('id', scheduleId)
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, data: schedule })
    }

    // 전체 스케줄 목록 조회
    let query = supabase
      .from('flexible_work_schedules')
      .select('*')
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: schedules, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: schedules })

  } catch (error) {
    console.error('❌ 탄력근무제 스케줄 조회 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 새로운 탄력근무제 계획 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserServer(request)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ 
        success: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 })
    }

    const {
      schedule_name,
      start_date,
      end_date,
      settlement_weeks = 12,
      standard_weekly_hours = 40.0,
      max_daily_hours = 12.0,
      max_weekly_hours = 52.0,
      employee_schedules // 직원별 일별 계획 배열
    } = await request.json()

    const supabase = await createServiceRoleClient()

    // 1. 메인 스케줄 생성
    const { data: schedule, error: scheduleError } = await supabase
      .from('flexible_work_schedules')
      .insert({
        schedule_name,
        start_date,
        end_date,
        settlement_weeks,
        standard_weekly_hours,
        max_daily_hours,
        max_weekly_hours,
        status: 'draft',
        created_by: user.id
      })
      .select()
      .single()

    if (scheduleError) throw scheduleError

    // 2. 직원별 일별 계획 생성
    if (employee_schedules && employee_schedules.length > 0) {
      const dailySchedules = employee_schedules.flatMap((emp: any) => 
        emp.daily_plans.map((plan: any) => ({
          schedule_id: schedule.id,
          user_id: emp.user_id,
          work_date: plan.date,
          planned_start_time: plan.start_time,
          planned_end_time: plan.end_time,
          planned_work_hours: plan.work_hours,
          planned_break_minutes: plan.break_minutes || 60,
          is_holiday: plan.is_holiday || false,
          is_weekend: plan.is_weekend || false,
          work_type: plan.work_type || 'normal',
          notes: plan.notes
        }))
      )

      const { error: dailyError } = await supabase
        .from('daily_scheduled_hours')
        .insert(dailySchedules)

      if (dailyError) throw dailyError
    }

    return NextResponse.json({ 
      success: true, 
      data: schedule,
      message: '탄력근무제 계획이 생성되었습니다.' 
    })

  } catch (error) {
    console.error('❌ 탄력근무제 스케줄 생성 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 스케줄 승인/활성화
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUserServer(request)
    if (!user || !isAdmin(user)) {
      return NextResponse.json({ 
        success: false, 
        error: '관리자 권한이 필요합니다.' 
      }, { status: 403 })
    }

    const { schedule_id, action } = await request.json()
    const supabase = await createServiceRoleClient()

    let updateData: any = { updated_at: new Date().toISOString() }

    switch (action) {
      case 'approve':
        updateData.status = 'approved'
        updateData.approved_by = user.id
        updateData.approved_at = new Date().toISOString()
        break
      case 'activate':
        // 기존 활성화된 스케줄 비활성화
        await supabase
          .from('flexible_work_schedules')
          .update({ status: 'completed' })
          .eq('status', 'active')

        updateData.status = 'active'
        break
      case 'complete':
        updateData.status = 'completed'
        break
      default:
        return NextResponse.json({ 
          success: false, 
          error: '유효하지 않은 액션입니다.' 
        }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('flexible_work_schedules')
      .update(updateData)
      .eq('id', schedule_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      data,
      message: `스케줄이 ${action === 'approve' ? '승인' : action === 'activate' ? '활성화' : '완료'}되었습니다.` 
    })

  } catch (error) {
    console.error('❌ 탄력근무제 스케줄 업데이트 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}
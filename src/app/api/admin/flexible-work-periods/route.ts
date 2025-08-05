import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCurrentUserServer } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface FlexibleWorkPeriod {
  id: string
  period_name: string
  start_date: string
  end_date: string
  quarter: number
  year: number
  standard_weekly_hours: number
  max_daily_hours: number
  max_weekly_hours: number
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  settlement_completed: boolean
  settlement_date?: string
  created_at: string
  updated_at: string
}

// GET: 탄력근로제 기간 목록 조회
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const year = searchParams.get('year')

    let query = supabase
      .from('flexible_work_periods')
      .select(`
        id,
        period_name,
        start_date,
        end_date,
        quarter,
        year,
        standard_weekly_hours,
        max_daily_hours,
        max_weekly_hours,
        status,
        settlement_completed,
        settlement_date,
        created_at,
        updated_at
      `)
      .order('year', { ascending: false })
      .order('quarter', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (year) {
      query = query.eq('year', parseInt(year))
    }

    const { data: periods, error } = await query

    if (error) {
      console.error('탄력근로제 기간 조회 오류:', error)
      return NextResponse.json({ error: '탄력근로제 기간 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      periods: periods || []
    })

  } catch (error) {
    console.error('탄력근로제 기간 조회 API 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: 새로운 탄력근로제 기간 생성
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()
    const body = await request.json()
    
    const {
      period_name,
      start_date,
      end_date,
      quarter,
      year,
      standard_weekly_hours = 40.0,
      max_daily_hours = 12.0,
      max_weekly_hours = 52.0,
      status = 'planned'
    } = body

    // 입력 값 검증
    if (!period_name || !start_date || !end_date || !quarter || !year) {
      return NextResponse.json({ 
        error: '필수 필드가 누락되었습니다.',
        required: ['period_name', 'start_date', 'end_date', 'quarter', 'year']
      }, { status: 400 })
    }

    if (quarter < 1 || quarter > 4) {
      return NextResponse.json({ error: '분기는 1-4 사이의 값이어야 합니다.' }, { status: 400 })
    }

    // 날짜 검증
    const startDate = new Date(start_date)
    const endDate = new Date(end_date)
    if (startDate >= endDate) {
      return NextResponse.json({ error: '시작일은 종료일보다 이전이어야 합니다.' }, { status: 400 })
    }

    // 중복 검사
    const { data: existing } = await supabase
      .from('flexible_work_periods')
      .select('id')
      .eq('year', year)
      .eq('quarter', quarter)
      .single()

    if (existing) {
      return NextResponse.json({ 
        error: `${year}년 ${quarter}분기 탄력근로제 기간이 이미 존재합니다.` 
      }, { status: 409 })
    }

    // 기간 겹침 검사
    const { data: overlapping } = await supabase
      .from('flexible_work_periods')
      .select('id, period_name, start_date, end_date')
      .or(`and(start_date.lte.${end_date},end_date.gte.${start_date})`)

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json({
        error: '다른 탄력근로제 기간과 겹칩니다.',
        overlapping_periods: overlapping
      }, { status: 409 })
    }

    // 새 기간 생성
    const { data: newPeriod, error: insertError } = await supabase
      .from('flexible_work_periods')
      .insert({
        period_name,
        start_date,
        end_date,
        quarter,
        year,
        standard_weekly_hours,
        max_daily_hours,
        max_weekly_hours,
        status,
        created_by: currentUser.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('탄력근로제 기간 생성 오류:', insertError)
      return NextResponse.json({ error: '탄력근로제 기간 생성 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '탄력근로제 기간이 생성되었습니다.',
      period: newPeriod
    })

  } catch (error) {
    console.error('탄력근로제 기간 생성 API 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: 탄력근로제 기간 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUserServer(request)
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const supabase = await createServiceRoleClient()
    const body = await request.json()
    const { period_id, status, settlement_completed } = body

    if (!period_id) {
      return NextResponse.json({ error: 'period_id가 필요합니다.' }, { status: 400 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }

    if (status) {
      if (!['planned', 'active', 'completed', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: '유효하지 않은 상태입니다.' }, { status: 400 })
      }
      updateData.status = status
    }

    if (settlement_completed !== undefined) {
      updateData.settlement_completed = settlement_completed
      if (settlement_completed) {
        updateData.settlement_date = new Date().toISOString()
        updateData.settlement_by = currentUser.id
      }
    }

    // 기존 활성 기간이 있는 경우 비활성화 (하나만 활성화 가능)
    if (status === 'active') {
      await supabase
        .from('flexible_work_periods')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('status', 'active')
        .neq('id', period_id)
    }

    const { data: updatedPeriod, error } = await supabase
      .from('flexible_work_periods')  
      .update(updateData)
      .eq('id', period_id)
      .select()
      .single()

    if (error) {
      console.error('탄력근로제 기간 업데이트 오류:', error)
      return NextResponse.json({ error: '탄력근로제 기간 업데이트 실패' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '탄력근로제 기간이 업데이트되었습니다.',
      period: updatedPeriod
    })

  } catch (error) {
    console.error('탄력근로제 기간 업데이트 API 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 초과근무 기록 생성
export async function POST(request: NextRequest) {
  try {
    const { 
      user_id, 
      work_date, 
      overtime_hours, 
      night_hours, 
      notes 
    } = await request.json()

    // 해당 직원의 시급 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('hourly_wage, name')
      .eq('id', user_id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '직원 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    if (!userData.hourly_wage) {
      return NextResponse.json({
        success: false,
        error: '해당 직원의 시급이 설정되지 않았습니다.'
      }, { status: 400 })
    }

    // 수당 계산
    const overtimePay = Math.round(userData.hourly_wage * (overtime_hours || 0) * 1.5)
    const nightPay = Math.round(userData.hourly_wage * (night_hours || 0) * 1.5)
    const totalPay = overtimePay + nightPay

    // 초과근무 기록 생성
    const { data, error } = await supabase
      .from('overtime_records')
      .insert({
        user_id,
        work_date,
        overtime_hours: overtime_hours || 0,
        night_hours: night_hours || 0,
        overtime_pay: overtimePay,
        night_pay: nightPay,
        total_pay: totalPay,
        notes: notes || null,
        status: 'pending'
      })
      .select(`
        *,
        users(name, department, position)
      `)
      .single()

    if (error) {
      console.error('초과근무 기록 생성 오류:', error)
      return NextResponse.json({
        success: false,
        error: '초과근무 기록 생성에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      message: '초과근무 기록이 생성되었습니다.'
    })

  } catch (error) {
    console.error('초과근무 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 초과근무 기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const month = searchParams.get('month') // YYYY-MM 형식
    const status = searchParams.get('status')

    let query = supabase
      .from('overtime_records')
      .select(`
        *,
        users(name, department, position)
      `)
      .order('work_date', { ascending: false })

    // 필터 적용
    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    if (month) {
      const startDate = `${month}-01`
      const endDate = `${month}-31`
      query = query.gte('work_date', startDate).lte('work_date', endDate)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('초과근무 기록 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '초과근무 기록 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('초과근무 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
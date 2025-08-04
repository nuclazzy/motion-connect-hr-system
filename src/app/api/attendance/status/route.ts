import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// 사용자의 출퇴근 현황 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    console.log('📊 출퇴근 현황 조회 요청:', { user_id, date })

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    // 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, department, position')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 해당 날짜의 출퇴근 기록 조회
    const { data: todayRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('record_date', date)
      .order('record_timestamp', { ascending: true })

    if (recordsError) {
      console.error('❌ 출퇴근 기록 조회 오류:', recordsError)
      return NextResponse.json({
        success: false,
        error: '출퇴근 기록 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 출근/퇴근 기록 분리
    const checkInRecords = todayRecords?.filter(r => r.record_type === '출근') || []
    const checkOutRecords = todayRecords?.filter(r => r.record_type === '퇴근') || []

    const latestCheckIn = checkInRecords.length > 0 ? checkInRecords[checkInRecords.length - 1] : null
    const latestCheckOut = checkOutRecords.length > 0 ? checkOutRecords[checkOutRecords.length - 1] : null

    // 현재 상태 판단
    let currentStatus = '미출근'
    let statusMessage = '아직 출근하지 않았습니다.'
    let canCheckIn = true
    let canCheckOut = false

    if (latestCheckIn && !latestCheckOut) {
      currentStatus = '근무중'
      statusMessage = `${latestCheckIn.record_time}에 출근했습니다.`
      canCheckIn = false
      canCheckOut = true
    } else if (latestCheckIn && latestCheckOut) {
      if (new Date(latestCheckIn.record_timestamp) > new Date(latestCheckOut.record_timestamp)) {
        currentStatus = '근무중'
        statusMessage = `${latestCheckIn.record_time}에 재출근했습니다.`
        canCheckIn = false
        canCheckOut = true
      } else {
        currentStatus = '퇴근완료'
        statusMessage = `${latestCheckOut.record_time}에 퇴근했습니다.`
        canCheckIn = true
        canCheckOut = false
      }
    }

    // 일별 근무시간 요약 조회
    const { data: workSummary } = await supabase
      .from('daily_work_summary')
      .select('*')
      .eq('user_id', user_id)
      .eq('work_date', date)
      .single()

    // 최근 7일간 출퇴근 기록 통계
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { data: recentStats } = await supabase
      .from('daily_work_summary')
      .select('work_date, basic_hours, overtime_hours, work_status')
      .eq('user_id', user_id)
      .gte('work_date', sevenDaysAgo.toISOString().split('T')[0])
      .order('work_date', { ascending: false })
      .limit(7)

    // 이번 달 통계
    const currentMonth = date.substring(0, 7) + '-01'
    const { data: monthlyStats } = await supabase
      .from('monthly_work_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('work_month', currentMonth)
      .single()

    console.log('✅ 출퇴근 현황 조회 성공:', {
      user: user.name,
      date,
      currentStatus,
      recordCount: todayRecords?.length || 0
    })

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          department: user.department,
          position: user.position
        },
        date,
        currentStatus,
        statusMessage,
        canCheckIn,
        canCheckOut,
        todayRecords: {
          checkIn: checkInRecords,
          checkOut: checkOutRecords,
          total: todayRecords?.length || 0
        },
        workSummary: workSummary || {
          basic_hours: 0,
          overtime_hours: 0,
          work_status: currentStatus,
          check_in_time: latestCheckIn?.record_timestamp || null,
          check_out_time: latestCheckOut?.record_timestamp || null
        },
        recentStats: recentStats || [],
        monthlyStats: monthlyStats || {
          total_work_days: 0,
          total_basic_hours: 0,
          total_overtime_hours: 0,
          average_daily_hours: 0
        }
      }
    })

  } catch (error) {
    console.error('❌ 출퇴근 현황 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
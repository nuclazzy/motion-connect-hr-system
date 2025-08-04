import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// 근무시간 요약 조회 (개인용/관리자용)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const month = searchParams.get('month') // YYYY-MM 형식
    const admin_user_id = searchParams.get('admin_user_id')
    const include_details = searchParams.get('include_details') === 'true'

    console.log('📈 근무시간 요약 조회 요청:', {
      user_id,
      month,
      admin_user_id,
      include_details
    })

    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인 (다른 사용자 조회 시)
    if (admin_user_id && user_id !== admin_user_id) {
      const { data: admin, error: adminError } = await supabase
        .from('users')
        .select('role')
        .eq('id', admin_user_id)
        .single()

      if (adminError || !admin || admin.role !== 'admin') {
        return NextResponse.json({
          success: false,
          error: '관리자 권한이 필요합니다.'
        }, { status: 403 })
      }
    }

    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 기본적으로 현재 월 조회
    const targetMonth = month || new Date().toISOString().substring(0, 7)
    const monthStart = `${targetMonth}-01`
    const nextMonth = new Date(targetMonth + '-01')
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthEnd = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0]

    console.log('📅 조회 기간:', { monthStart, monthEnd })

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

    // 월별 통계 조회
    const { data: monthlyStats, error: monthlyError } = await supabase
      .from('monthly_work_stats')
      .select('*')
      .eq('user_id', user_id)
      .eq('work_month', monthStart)
      .single()

    if (monthlyError && monthlyError.code !== 'PGRST116') {
      console.error('❌ 월별 통계 조회 오류:', monthlyError)
    }

    // 일별 근무 데이터 조회
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_work_summary')
      .select('*')
      .eq('user_id', user_id)
      .gte('work_date', monthStart)
      .lte('work_date', monthEnd)
      .order('work_date', { ascending: true })

    if (dailyError) {
      console.error('❌ 일별 데이터 조회 오류:', dailyError)
      return NextResponse.json({
        success: false,
        error: '일별 근무 데이터 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 데이터 집계 (월별 통계가 없는 경우 일별 데이터로 계산)
    const workDays = dailyData?.filter(d => d.check_in_time && d.check_out_time).length || 0
    const totalBasicHours = dailyData?.reduce((sum, d) => sum + (d.basic_hours || 0), 0) || 0
    const totalOvertimeHours = dailyData?.reduce((sum, d) => sum + (d.overtime_hours || 0), 0) || 0
    const totalNightHours = dailyData?.reduce((sum, d) => sum + (d.night_hours || 0), 0) || 0
    const totalWorkHours = totalBasicHours + totalOvertimeHours
    const averageDailyHours = workDays > 0 ? totalWorkHours / workDays : 0
    const dinnerCount = dailyData?.filter(d => d.had_dinner).length || 0

    // 출근/지각/조퇴/결근 통계
    let onTimeCount = 0
    let lateCount = 0
    let earlyLeaveCount = 0
    let absentCount = 0

    const workingDays = new Date(nextMonth.getTime() - 1).getDate()
    
    for (let day = 1; day <= workingDays; day++) {
      const dateStr = `${targetMonth}-${day.toString().padStart(2, '0')}`
      const dayData = dailyData?.find(d => d.work_date === dateStr)
      
      if (!dayData || (!dayData.check_in_time && !dayData.check_out_time)) {
        // 주말/공휴일인지 확인 필요 (여기서는 단순화)
        const dayOfWeek = new Date(dateStr).getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 평일만 결근으로 계산
          absentCount++
        }
      } else {
        if (dayData.check_in_time) {
          const checkInHour = new Date(dayData.check_in_time).getHours()
          if (checkInHour > 9) {
            lateCount++
          } else {
            onTimeCount++
          }
        }
        
        if (dayData.check_out_time) {
          const checkOutHour = new Date(dayData.check_out_time).getHours()
          if (checkOutHour < 17) { // 17시 이전 퇴근을 조퇴로 간주
            earlyLeaveCount++
          }
        }
      }
    }

    // 상세 정보 (요청 시에만)
    let detailData = null
    if (include_details) {
      // 각 일별 기록에 누락된 기록 정보 추가
      const enhancedDailyData = dailyData?.map(day => {
        const missing_records: string[] = []
        
        // 출근 기록이 없는 경우
        if (!day.check_in_time && day.work_status !== '휴가' && day.work_status !== '결근') {
          missing_records.push('출근기록누락')
        }
        
        // 퇴근 기록이 없는 경우 (출근은 했지만 퇴근이 없는 경우)
        if (day.check_in_time && !day.check_out_time) {
          missing_records.push('퇴근기록누락')
        }

        return {
          ...day,
          missing_records: missing_records.length > 0 ? missing_records : undefined
        }
      }) || []

      // 누락된 기록 찾기
      const missingRecords: any[] = []
      enhancedDailyData.forEach(day => {
        if (day.missing_records && day.missing_records.length > 0) {
          missingRecords.push({
            date: day.work_date,
            type: day.missing_records.join(', '),
            status: day.work_status
          })
        }
      })

      // 최근 출퇴근 기록
      const { data: recentRecords } = await supabase
        .from('attendance_records')
        .select('record_date, record_time, record_type, reason, had_dinner')
        .eq('user_id', user_id)
        .gte('record_date', monthStart)
        .lte('record_date', monthEnd)
        .order('record_timestamp', { ascending: false })
        .limit(10)

      detailData = {
        dailyRecords: enhancedDailyData,
        missingRecords,
        recentAttendance: recentRecords || []
      }
    }

    const summaryData: any = {
      user: {
        id: user.id,
        name: user.name,
        department: user.department,
        position: user.position
      },
      period: {
        month: targetMonth,
        startDate: monthStart,
        endDate: monthEnd,
        totalDays: workingDays
      },
      workStats: {
        totalWorkDays: workDays,
        totalBasicHours: Math.round(totalBasicHours * 10) / 10,
        totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
        totalNightHours: Math.round(totalNightHours * 10) / 10,
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        averageDailyHours: Math.round(averageDailyHours * 10) / 10,
        dinnerCount
      },
      attendanceStats: {
        onTimeCount,
        lateCount,
        earlyLeaveCount,
        absentCount,
        attendanceRate: workingDays > 0 ? Math.round((workDays / workingDays) * 100) : 0
      },
      monthlyStats: monthlyStats || null,
      lastUpdated: dailyData && dailyData.length > 0 
        ? dailyData[dailyData.length - 1].updated_at 
        : null
    }

    if (detailData) {
      summaryData.dailyRecords = detailData.dailyRecords
      summaryData.missingRecords = detailData.missingRecords
      summaryData.recentAttendance = detailData.recentAttendance
    }

    console.log('✅ 근무시간 요약 조회 성공:', {
      user: user.name,
      month: targetMonth,
      workDays,
      totalHours: totalWorkHours
    })

    return NextResponse.json({
      success: true,
      data: summaryData
    })

  } catch (error) {
    console.error('❌ 근무시간 요약 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 근무시간 수동 조정 (관리자용)
export async function PATCH(request: NextRequest) {
  try {
    const {
      user_id,
      work_date,
      admin_user_id,
      basic_hours,
      overtime_hours,
      night_hours,
      work_status,
      notes
    } = await request.json()

    console.log('✏️ 근무시간 수동 조정 요청:', {
      user_id,
      work_date,
      admin_user_id,
      basic_hours,
      overtime_hours
    })

    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', admin_user_id)
      .single()

    if (adminError || !admin || admin.role !== 'admin') {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.'
      }, { status: 403 })
    }

    // 대상 사용자 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '대상 사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 근무시간 데이터 업데이트
    const updateData: any = {
      auto_calculated: false,
      calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (basic_hours !== undefined) updateData.basic_hours = basic_hours
    if (overtime_hours !== undefined) updateData.overtime_hours = overtime_hours
    if (night_hours !== undefined) updateData.night_hours = night_hours
    if (work_status) updateData.work_status = work_status
    if (notes) updateData.notes = notes

    const { data: updatedRecord, error: updateError } = await supabase
      .from('daily_work_summary')
      .upsert({
        user_id,
        work_date,
        ...updateData
      })
      .select()
      .single()

    if (updateError) {
      console.error('❌ 근무시간 조정 오류:', updateError)
      return NextResponse.json({
        success: false,
        error: '근무시간 조정에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 근무시간 수동 조정 성공:', {
      user: user.name,
      date: work_date,
      admin: admin.name
    })

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `${user.name}님의 ${work_date} 근무시간이 조정되었습니다.`
    })

  } catch (error) {
    console.error('❌ 근무시간 조정 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
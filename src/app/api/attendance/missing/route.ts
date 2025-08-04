import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 누락된 출퇴근 기록 추가
export async function POST(request: NextRequest) {
  try {
    const {
      user_id,
      date_string, // YYYY-MM-DD 형식
      time_string, // HH:MM 형식
      record_type, // '출근' | '퇴근'
      reason,
      admin_user_id
    } = await request.json()

    console.log('➕ 누락 기록 추가 요청:', {
      user_id,
      date_string,
      time_string,
      record_type,
      admin_user_id
    })

    // 필수 필드 검증
    if (!user_id || !date_string || !time_string || !record_type) {
      return NextResponse.json({
        success: false,
        error: '모든 필수 필드를 입력해주세요.'
      }, { status: 400 })
    }

    if (!['출근', '퇴근'].includes(record_type)) {
      return NextResponse.json({
        success: false,
        error: '기록 유형이 올바르지 않습니다.'
      }, { status: 400 })
    }

    // 관리자 권한 확인 (다른 사용자의 기록 추가 시)
    if (admin_user_id && user_id !== admin_user_id) {
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
    }

    // 대상 사용자 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, department')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '사용자를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 날짜와 시간 파싱
    const [year, month, day] = date_string.split('-').map(Number)
    const [hours, minutes] = time_string.split(':').map(Number)
    
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      return NextResponse.json({
        success: false,
        error: '날짜 또는 시간 형식이 올바르지 않습니다.'
      }, { status: 400 })
    }

    const timestamp = new Date(year, month - 1, day, hours, minutes)
    
    // 미래 시간 검증
    if (timestamp > new Date()) {
      return NextResponse.json({
        success: false,
        error: '미래 시간으로는 기록할 수 없습니다.'
      }, { status: 400 })
    }

    // 중복 기록 검사
    const { data: existingRecord } = await supabase
      .from('attendance_records')
      .select('id, record_time')
      .eq('user_id', user_id)
      .eq('record_date', date_string)
      .eq('record_type', record_type)
      .single()

    if (existingRecord) {
      return NextResponse.json({
        success: false,
        error: `${record_type} 기록이 이미 존재합니다. (${existingRecord.record_time})`
      }, { status: 409 })
    }

    // 누락 기록 추가
    const { data: newRecord, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        user_id,
        record_date: date_string,
        record_time: time_string,
        record_timestamp: timestamp.toISOString(),
        record_type,
        reason: reason?.trim() || '누락 기록 보충',
        source: 'manual',
        is_manual: true,
        approved_by: admin_user_id || user_id,
        approved_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ 누락 기록 추가 오류:', insertError)
      return NextResponse.json({
        success: false,
        error: '누락 기록 추가에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 누락 기록 추가 성공:', {
      user: user.name,
      type: record_type,
      date: date_string,
      time: time_string
    })

    return NextResponse.json({
      success: true,
      data: newRecord,
      message: `✅ ${user.name}님의 ${record_type} 기록이 추가되었습니다. (${date_string} ${time_string})`
    })

  } catch (error) {
    console.error('❌ 누락 기록 추가 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 저녁식사 기록 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const {
      user_id,
      date_string,
      had_dinner, // boolean
      admin_user_id
    } = await request.json()

    console.log('🍽️ 저녁식사 기록 업데이트 요청:', {
      user_id,
      date_string,
      had_dinner,
      admin_user_id
    })

    // 필수 필드 검증
    if (!user_id || !date_string || had_dinner === undefined) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID, 날짜, 저녁식사 여부는 필수입니다.'
      }, { status: 400 })
    }

    // 관리자 권한 확인 (다른 사용자의 기록 수정 시)
    if (admin_user_id && user_id !== admin_user_id) {
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
    }

    // 해당 날짜의 퇴근 기록 찾기 (가장 최근 것)
    const { data: checkoutRecord, error: checkoutError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('record_date', date_string)
      .eq('record_type', '퇴근')
      .order('record_timestamp', { ascending: false })
      .limit(1)
      .single()

    if (checkoutError || !checkoutRecord) {
      return NextResponse.json({
        success: false,
        error: '해당 날짜의 퇴근 기록을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 저녁식사 기록 업데이트
    const { data: updatedRecord, error: updateError } = await supabase
      .from('attendance_records')
      .update({
        had_dinner,
        updated_at: new Date().toISOString()
      })
      .eq('id', checkoutRecord.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ 저녁식사 기록 업데이트 오류:', updateError)
      return NextResponse.json({
        success: false,
        error: '저녁식사 기록 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    // daily_work_summary도 업데이트
    await supabase
      .from('daily_work_summary')
      .update({
        had_dinner,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .eq('work_date', date_string)

    console.log('✅ 저녁식사 기록 업데이트 성공:', {
      user_id,
      date: date_string,
      had_dinner
    })

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: `✅ 저녁식사 기록이 ${had_dinner ? '추가' : '제거'}되었습니다.`
    })

  } catch (error) {
    console.error('❌ 저녁식사 기록 업데이트 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 누락된 기록 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const admin_user_id = searchParams.get('admin_user_id')

    console.log('🔍 누락 기록 조회 요청:', {
      user_id,
      start_date,
      end_date,
      admin_user_id
    })

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

    // 기본 조회 기간 설정 (최근 30일)
    const endDate = end_date || new Date().toISOString().split('T')[0]
    const startDate = start_date || (() => {
      const date = new Date()
      date.setDate(date.getDate() - 30)
      return date.toISOString().split('T')[0]
    })()

    // 누락 기록이 있는 일별 요약 조회
    const { data: missingSummaries, error: summaryError } = await supabase
      .from('daily_work_summary')
      .select(`
        work_date,
        check_in_time,
        check_out_time,
        work_status,
        basic_hours,
        overtime_hours,
        had_dinner,
        users(name, department)
      `)
      .eq('user_id', user_id)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .or('work_status.ilike.%누락%,check_in_time.is.null,check_out_time.is.null')
      .order('work_date', { ascending: false })

    if (summaryError) {
      console.error('❌ 누락 기록 조회 오류:', summaryError)
      return NextResponse.json({
        success: false,
        error: '누락 기록 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 저녁식사 누락 기록 찾기 (8시간 이상 근무했지만 저녁식사 기록 없음)
    const dinnerMissingRecords: any[] = []
    if (missingSummaries) {
      for (const summary of missingSummaries) {
        const totalHours = (summary.basic_hours || 0) + (summary.overtime_hours || 0)
        if (totalHours >= 8 && !summary.had_dinner && summary.check_out_time) {
          const checkOutHour = new Date(summary.check_out_time).getHours()
          if (checkOutHour >= 19) { // 19시 이후 퇴근
            dinnerMissingRecords.push({
              ...summary,
              missing_type: '저녁식사기록누락',
              total_work_hours: totalHours
            })
          }
        }
      }
    }

    // 결과 정리
    const missingRecords: any[] = []
    
    if (missingSummaries) {
      missingSummaries.forEach(summary => {
        const missingTypes: string[] = []
        
        if (!summary.check_in_time) {
          missingTypes.push('출근기록누락')
        }
        
        if (!summary.check_out_time) {
          missingTypes.push('퇴근기록누락')
        }
        
        if (summary.work_status?.includes('누락')) {
          const statusType = summary.work_status.includes('출근') ? '출근기록누락' : '퇴근기록누락'
          if (!missingTypes.includes(statusType)) {
            missingTypes.push(statusType)
          }
        }

        if (missingTypes.length > 0) {
          missingRecords.push({
            ...summary,
            missing_types: missingTypes
          })
        }
      })
    }

    console.log('✅ 누락 기록 조회 성공:', {
      user_id,
      period: `${startDate} ~ ${endDate}`,
      missingCount: missingRecords.length,
      dinnerMissingCount: dinnerMissingRecords.length
    })

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate,
          endDate
        },
        missingRecords,
        dinnerMissingRecords,
        summary: {
          totalMissing: missingRecords.length,
          dinnerMissing: dinnerMissingRecords.length,
          totalChecked: (missingSummaries?.length || 0) + dinnerMissingRecords.length
        }
      }
    })

  } catch (error) {
    console.error('❌ 누락 기록 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
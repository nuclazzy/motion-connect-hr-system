import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// 출퇴근 기록 생성
export async function POST(request: NextRequest) {
  try {
    const { 
      user_id,
      record_type, // '출근' | '퇴근'
      reason,
      manual_date,
      manual_time,
      location_lat,
      location_lng,
      location_accuracy,
      had_dinner
    } = await request.json()

    console.log('📍 출퇴근 기록 요청:', {
      user_id,
      record_type,
      reason: reason?.substring(0, 50) + '...',
      manual_date,
      manual_time,
      location_provided: !!location_lat,
      had_dinner
    })

    // 필수 필드 검증
    if (!user_id || !record_type) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID와 기록 유형은 필수입니다.'
      }, { status: 400 })
    }

    if (!['출근', '퇴근'].includes(record_type)) {
      return NextResponse.json({
        success: false,
        error: '기록 유형이 올바르지 않습니다.'
      }, { status: 400 })
    }

    const supabase = await createServiceRoleClient()

    // 사용자 존재 여부 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, department')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      console.error('❌ 사용자 조회 오류:', userError)
      return NextResponse.json({
        success: false,
        error: '등록되지 않은 사용자입니다.'
      }, { status: 404 })
    }

    // 시간 설정 (수동 입력 또는 현재 시간)
    let record_timestamp: Date
    let record_date: string
    let record_time: string
    let is_manual = false

    if (manual_date && manual_time) {
      // 수동 입력 시간 사용
      const [year, month, day] = manual_date.split('-').map(Number)
      const [hours, minutes] = manual_time.split(':').map(Number)
      record_timestamp = new Date(year, month - 1, day, hours, minutes)
      is_manual = true
    } else {
      // 현재 시간 사용
      record_timestamp = new Date()
    }

    record_date = record_timestamp.toISOString().split('T')[0]
    record_time = record_timestamp.toTimeString().split(' ')[0].substring(0, 5)

    console.log('⏰ 기록 시간:', {
      timestamp: record_timestamp.toISOString(),
      date: record_date,
      time: record_time,
      is_manual
    })

    // 중복 기록 검사 (같은 날짜, 같은 유형, 5분 이내)
    const fiveMinutesAgo = new Date(record_timestamp.getTime() - 5 * 60 * 1000)
    const fiveMinutesLater = new Date(record_timestamp.getTime() + 5 * 60 * 1000)

    const { data: duplicateCheck } = await supabase
      .from('attendance_records')
      .select('id, record_timestamp')
      .eq('user_id', user_id)
      .eq('record_date', record_date)
      .eq('record_type', record_type)
      .gte('record_timestamp', fiveMinutesAgo.toISOString())
      .lte('record_timestamp', fiveMinutesLater.toISOString())
      .limit(1)

    if (duplicateCheck && duplicateCheck.length > 0) {
      console.log('⚠️ 중복 기록 감지:', duplicateCheck[0])
      return NextResponse.json({
        success: false,
        error: `${record_type} 기록이 이미 존재합니다. (${record_time})`
      }, { status: 409 })
    }

    // 출근 시 사유 필수 검증
    if (record_type === '출근' && (!reason || reason.trim() === '')) {
      return NextResponse.json({
        success: false,
        error: '출근 시에는 업무 사유를 반드시 입력해주세요.'
      }, { status: 400 })
    }

    // 출퇴근 기록 저장
    const { data: attendanceRecord, error: insertError } = await supabase
      .from('attendance_records')
      .insert({
        user_id,
        record_date,
        record_time,
        record_timestamp: record_timestamp.toISOString(),
        record_type,
        reason: reason?.trim() || null,
        location_lat: location_lat || null,
        location_lng: location_lng || null,
        location_accuracy: location_accuracy || null,
        source: 'web',
        had_dinner: record_type === '퇴근' ? (had_dinner || false) : false,
        is_manual
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ 출퇴근 기록 저장 오류:', insertError)
      return NextResponse.json({
        success: false,
        error: '출퇴근 기록 저장에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 출퇴근 기록 저장 성공:', {
      id: attendanceRecord.id,
      user: user.name,
      type: record_type,
      time: record_time
    })

    return NextResponse.json({
      success: true,
      data: attendanceRecord,
      message: `✅ ${record_type} 기록이 완료되었습니다. (${user.name}님, ${record_time})`
    })

  } catch (error) {
    console.error('❌ 출퇴근 기록 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 출퇴근 기록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const record_type = searchParams.get('record_type')
    const limit = parseInt(searchParams.get('limit') || '50')

    console.log('📋 출퇴근 기록 조회 요청:', {
      user_id,
      start_date,
      end_date,
      record_type,
      limit
    })

    const supabase = await createServiceRoleClient()

    let query = supabase
      .from('attendance_records')
      .select(`
        id,
        user_id,
        record_date,
        record_time,
        record_timestamp,
        record_type,
        reason,
        location_lat,
        location_lng,
        source,
        had_dinner,
        is_manual,
        created_at,
        users(name, department, position)
      `)
      .order('record_timestamp', { ascending: false })
      .limit(limit)

    // 필터 적용
    if (user_id) {
      query = query.eq('user_id', user_id)
    }

    if (start_date) {
      query = query.gte('record_date', start_date)
    }

    if (end_date) {
      query = query.lte('record_date', end_date)
    }

    if (record_type && ['출근', '퇴근'].includes(record_type)) {
      query = query.eq('record_type', record_type)
    }

    const { data, error } = await query

    if (error) {
      console.error('❌ 출퇴근 기록 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '출퇴근 기록 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 출퇴근 기록 조회 성공:', {
      count: data?.length || 0,
      user_id,
      date_range: start_date && end_date ? `${start_date} ~ ${end_date}` : 'all'
    })

    return NextResponse.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    console.error('❌ 출퇴근 기록 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 출퇴근 기록 수정 (관리자용)
export async function PATCH(request: NextRequest) {
  try {
    const { 
      record_id,
      admin_user_id,
      reason,
      record_time,
      had_dinner,
      notes
    } = await request.json()

    console.log('✏️ 출퇴근 기록 수정 요청:', {
      record_id,
      admin_user_id,
      has_reason: !!reason,
      record_time,
      had_dinner
    })

    // 필수 필드 검증
    if (!record_id || !admin_user_id) {
      return NextResponse.json({
        success: false,
        error: '기록 ID와 관리자 ID는 필수입니다.'
      }, { status: 400 })
    }

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

    // 기존 기록 조회
    const { data: existingRecord, error: recordError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('id', record_id)
      .single()

    if (recordError || !existingRecord) {
      return NextResponse.json({
        success: false,
        error: '수정할 기록을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 수정 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (reason !== undefined) {
      updateData.reason = reason?.trim() || null
    }

    if (record_time) {
      // 시간 업데이트 시 timestamp도 함께 업데이트
      const [hours, minutes] = record_time.split(':').map(Number)
      const recordDate = new Date(existingRecord.record_date)
      recordDate.setHours(hours, minutes, 0, 0)
      
      updateData.record_time = record_time
      updateData.record_timestamp = recordDate.toISOString()
    }

    if (had_dinner !== undefined) {
      updateData.had_dinner = had_dinner
    }

    if (notes !== undefined) {
      updateData.notes = notes?.trim() || null
    }

    // 기록 업데이트
    const { data: updatedRecord, error: updateError } = await supabase
      .from('attendance_records')
      .update(updateData)
      .eq('id', record_id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ 출퇴근 기록 수정 오류:', updateError)
      return NextResponse.json({
        success: false,
        error: '출퇴근 기록 수정에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ 출퇴근 기록 수정 성공:', {
      record_id,
      admin: admin.name,
      changes: Object.keys(updateData)
    })

    return NextResponse.json({
      success: true,
      data: updatedRecord,
      message: '출퇴근 기록이 수정되었습니다.'
    })

  } catch (error) {
    console.error('❌ 출퇴근 기록 수정 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
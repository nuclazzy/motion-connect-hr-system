import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface CapsRecord {
  발생일자: string
  발생시각: string
  단말기ID: string
  사용자ID: string
  이름: string
  사원번호: string
  직급: string
  구분: string
  모드: string
  인증: string
  결과: string
}

interface ProcessedRecord {
  user_id: string
  record_date: string
  record_time: string
  record_timestamp: string
  record_type: '출근' | '퇴근'
  source: string
  device_id: string
  reason: string
  is_manual: boolean
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const admin_user_id = formData.get('admin_user_id') as string

    console.log('📁 CAPS CSV 업로드 요청:', {
      fileName: file?.name,
      fileSize: file?.size,
      admin_user_id
    })

    // 관리자 권한 확인
    if (!admin_user_id) {
      return NextResponse.json({
        success: false,
        error: '관리자 인증이 필요합니다.'
      }, { status: 401 })
    }

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

    // 파일 검증
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'CSV 파일이 필요합니다.'
      }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'CSV 파일만 업로드 가능합니다.'
      }, { status: 400 })
    }

    // CSV 파일 읽기
    const csvText = await file.text()
    const lines = csvText.split('\n')
    
    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'CSV 파일에 데이터가 없습니다.'
      }, { status: 400 })
    }

    // 헤더 검증
    const header = lines[0].trim()
    const expectedHeader = '발생일자,발생시각,단말기ID,사용자ID,이름,사원번호,직급,구분,모드,인증,결과'
    
    if (header !== expectedHeader) {
      console.log('헤더 불일치:', { expected: expectedHeader, actual: header })
      return NextResponse.json({
        success: false,
        error: 'CAPS CSV 형식이 올바르지 않습니다. 헤더를 확인해주세요.'
      }, { status: 400 })
    }

    // 모든 사용자 정보 미리 조회 (성능 최적화)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name')

    if (usersError) {
      console.error('사용자 조회 오류:', usersError)
      return NextResponse.json({
        success: false,
        error: '사용자 정보 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 이름 → user_id 매핑 생성
    const userMap = new Map<string, string>()
    users?.forEach(user => {
      userMap.set(user.name, user.id)
    })

    // CSV 데이터 파싱 및 변환
    const processedRecords: ProcessedRecord[] = []
    const errors: string[] = []
    let duplicateCount = 0
    let invalidUserCount = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = line.split(',')
        if (values.length < 11) continue

        const record: CapsRecord = {
          발생일자: values[0]?.trim(),
          발생시각: values[1]?.trim(),
          단말기ID: values[2]?.trim(),
          사용자ID: values[3]?.trim(),
          이름: values[4]?.trim(),
          사원번호: values[5]?.trim(),
          직급: values[6]?.trim(),
          구분: values[7]?.trim(),
          모드: values[8]?.trim(),
          인증: values[9]?.trim(),
          결과: values[10]?.trim()
        }

        // 출퇴근 기록만 처리 (출입, 해제, 세트 등은 제외)
        if (record.구분 !== '출근' && record.구분 !== '퇴근') {
          continue
        }

        // 사용자 매핑 확인
        const userId = userMap.get(record.이름)
        if (!userId) {
          invalidUserCount++
          errors.push(`${i + 1}행: 사용자 "${record.이름}"을 찾을 수 없습니다.`)
          continue
        }

        // 날짜/시간 파싱
        const recordDate = record.발생일자
        const recordTime = record.발생시각
        const recordTimestamp = new Date(`${recordDate}T${recordTime}+09:00`) // KST

        // 중복 체크
        const { data: existingRecord } = await supabase
          .from('attendance_records')
          .select('id')
          .eq('user_id', userId)
          .eq('record_date', recordDate)
          .eq('record_time', recordTime)
          .eq('record_type', record.구분)
          .eq('source', 'CAPS')
          .single()

        if (existingRecord) {
          duplicateCount++
          continue
        }

        // 처리된 기록 추가
        processedRecords.push({
          user_id: userId,
          record_date: recordDate,
          record_time: recordTime,
          record_timestamp: recordTimestamp.toISOString(),
          record_type: record.구분 as '출근' | '퇴근',
          source: 'CAPS',
          device_id: record.단말기ID,
          reason: `CAPS 지문인식 (${record.인증})`,
          is_manual: false
        })

      } catch (error) {
        errors.push(`${i + 1}행: 데이터 파싱 오류 - ${error}`)
      }
    }

    console.log('📊 CSV 파싱 결과:', {
      totalRecords: processedRecords.length,
      duplicateCount,
      invalidUserCount,
      errorCount: errors.length
    })

    // 데이터베이스에 일괄 삽입
    let insertedCount = 0
    if (processedRecords.length > 0) {
      const { data: insertedRecords, error: insertError } = await supabase
        .from('attendance_records')
        .insert(processedRecords.map(record => ({
          user_id: record.user_id,
          record_date: record.record_date,
          record_time: record.record_time,
          record_timestamp: record.record_timestamp,
          record_type: record.record_type,
          reason: record.reason,
          source: record.source,
          is_manual: record.is_manual
        })))
        .select('id')

      if (insertError) {
        console.error('❌ 데이터 삽입 오류:', insertError)
        return NextResponse.json({
          success: false,
          error: '데이터베이스 저장에 실패했습니다.',
          details: insertError.message
        }, { status: 500 })
      }

      insertedCount = insertedRecords?.length || 0
    }

    console.log('✅ CAPS CSV 업로드 완료:', {
      admin: admin.name,
      fileName: file.name,
      insertedCount,
      duplicateCount,
      invalidUserCount
    })

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        totalProcessed: processedRecords.length,
        inserted: insertedCount,
        duplicates: duplicateCount,
        invalidUsers: invalidUserCount,
        errors: errors.slice(0, 10) // 최대 10개 에러만 반환
      },
      message: `✅ CAPS 데이터 업로드 완료: ${insertedCount}건 추가, ${duplicateCount}건 중복 스킵`
    })

  } catch (error) {
    console.error('❌ CAPS CSV 업로드 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
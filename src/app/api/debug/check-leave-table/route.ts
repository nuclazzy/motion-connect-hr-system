import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient()

    // 1. leave_days 테이블의 모든 데이터 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .limit(5) // 처음 5개만 조회

    if (leaveError) {
      console.error('❌ leave_days 테이블 조회 실패:', leaveError)
      return NextResponse.json({ 
        success: false, 
        error: 'leave_days 테이블 조회 실패',
        details: leaveError 
      }, { status: 500 })
    }

    // 2. 테이블 스키마 정보 확인 (첫 번째 레코드로 컬럼 확인)
    const sampleRecord = leaveData?.[0]
    const columns = sampleRecord ? Object.keys(sampleRecord) : []

    // 3. users 테이블과의 연결 확인
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name')
      .limit(3)

    console.log('🔍 Supabase 테이블 구조 확인:', {
      leave_days_count: leaveData?.length || 0,
      leave_days_columns: columns,
      sample_leave_data: sampleRecord,
      users_count: usersData?.length || 0,
      users_sample: usersData?.[0]
    })

    return NextResponse.json({
      success: true,
      data: {
        leave_days: {
          count: leaveData?.length || 0,
          columns: columns,
          sample: sampleRecord,
          all_records: leaveData
        },
        users: {
          count: usersData?.length || 0,
          sample: usersData?.[0]
        }
      }
    })

  } catch (error) {
    console.error('❌ 디버그 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '디버그 API 실행 중 오류 발생',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
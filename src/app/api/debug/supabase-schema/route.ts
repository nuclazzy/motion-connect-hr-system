import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    const results: any = {}

    // 1. users 테이블 스키마 및 샘플 데이터
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
      .limit(5)

    if (!usersError) {
      results.users = {
        sample_data: usersData,
        count: usersData?.length || 0,
        schema_info: "Users table with authentication and profile data"
      }
    }

    // 2. leave_days 테이블 스키마 및 샘플 데이터  
    const { data: leaveDaysData, error: leaveDaysError } = await supabase
      .from('leave_days')
      .select('*')
      .limit(5)

    if (!leaveDaysError) {
      results.leave_days = {
        sample_data: leaveDaysData,
        count: leaveDaysData?.length || 0,
        schema_info: "Leave days allocation and usage tracking"
      }
    }

    // 3. form_requests 테이블 스키마 및 샘플 데이터
    const { data: formRequestsData, error: formRequestsError } = await supabase
      .from('form_requests')
      .select('*')
      .limit(5)

    if (!formRequestsError) {
      results.form_requests = {
        sample_data: formRequestsData,
        count: formRequestsData?.length || 0,
        schema_info: "Form and leave requests submitted by users"
      }
    }

    // 4. 기타 가능한 테이블들 확인
    const otherTables = ['form_templates', 'calendar_events', 'notifications']
    const additionalData: any = {}
    
    for (const tableName of otherTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(3)
        
        if (!error && data) {
          additionalData[tableName] = {
            sample_data: data,
            count: data.length,
            exists: true
          }
        }
      } catch (e) {
        additionalData[tableName] = { exists: false, error: 'Table not found or no access' }
      }
    }

    // 5. 각 테이블의 컬럼 정보 (가능한 경우)
    const tableStructures: any = {}
    
    if (usersData && usersData.length > 0) {
      tableStructures.users_columns = Object.keys(usersData[0])
    }
    
    if (leaveDaysData && leaveDaysData.length > 0) {
      tableStructures.leave_days_columns = Object.keys(leaveDaysData[0])
    }
    
    if (formRequestsData && formRequestsData.length > 0) {
      tableStructures.form_requests_columns = Object.keys(formRequestsData[0])
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      database_info: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        project_id: process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]
      },
      table_structures: tableStructures,
      table_data: results,
      additional_tables: additionalData,
      notes: {
        message: "이 데이터는 현재 Supabase 데이터베이스의 구조와 샘플 데이터입니다.",
        privacy: "민감한 정보는 마스킹되어 표시됩니다."
      }
    })

  } catch (error) {
    console.error('Supabase schema 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '데이터베이스 스키마 조회 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
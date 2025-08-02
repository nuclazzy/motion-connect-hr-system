import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 모든 사용자의 휴가 데이터 확인
    const { data: leaveData, error } = await supabase
      .from('leave_days')
      .select(`
        *,
        users!inner(name, email, hire_date, role)
      `)
      .eq('users.role', 'user')

    if (error) {
      console.error('휴가 데이터 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '휴가 데이터 조회 실패',
        details: error.message
      })
    }

    // 데이터 포맷팅
    const formattedData = leaveData?.map(record => ({
      name: record.users.name,
      email: record.users.email,
      hire_date: record.users.hire_date,
      leave_types: record.leave_types,
      substitute_leave_hours: record.substitute_leave_hours,
      compensatory_leave_hours: record.compensatory_leave_hours,
      created_at: record.created_at,
      updated_at: record.updated_at
    }))

    return NextResponse.json({
      success: true,
      total_records: leaveData?.length || 0,
      data: formattedData
    })

  } catch (error) {
    console.error('디버그 오류:', error)
    return NextResponse.json({
      success: false,
      error: '디버그 중 오류 발생',
      details: (error as Error).message
    }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  console.log('🚀 Simple employees API called')
  
  try {
    // 기본 환경 변수 체크
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ 
        error: 'Missing environment variables',
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }, { status: 500 })
    }

    // 인증 헤더 체크
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 직접 fetch로 Supabase API 호출 (복잡한 클라이언트 없이)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    console.log('📡 Fetching from Supabase REST API...')
    
    // 사용자 목록 조회
    const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=hire_date.asc`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    })

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text()
      console.error('❌ Users fetch failed:', errorText)
      return NextResponse.json({ 
        error: 'Failed to fetch users',
        status: usersResponse.status,
        details: errorText
      }, { status: 500 })
    }

    const users = await usersResponse.json()
    console.log('✅ Users fetched:', users.length)

    // 휴가 데이터 조회
    const leaveResponse = await fetch(`${supabaseUrl}/rest/v1/leave_days?select=user_id,leave_types`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!leaveResponse.ok) {
      const errorText = await leaveResponse.text()
      console.error('❌ Leave data fetch failed:', errorText)
      return NextResponse.json({ 
        error: 'Failed to fetch leave data',
        status: leaveResponse.status,
        details: errorText
      }, { status: 500 })
    }

    const leaveData = await leaveResponse.json()
    console.log('✅ Leave data fetched:', leaveData.length)

    // 데이터 결합
    const leaveMap = new Map()
    leaveData.forEach((leave: any) => {
      leaveMap.set(leave.user_id, leave.leave_types)
    })

    const result = users.map((user: any) => {
      const leave = leaveMap.get(user.id) || {}
      return {
        ...user,
        annual_leave: Math.max(0, (leave.annual_days || 0) - (leave.used_annual_days || 0)),
        sick_leave: Math.max(0, (leave.sick_days || 0) - (leave.used_sick_days || 0)),
        substitute_leave_hours: leave.substitute_leave_hours || 0,
        compensatory_leave_hours: leave.compensatory_leave_hours || 0,
        leave_data: leave
      }
    })

    console.log('✅ Simple API completed successfully')
    return NextResponse.json({ success: true, employees: result })

  } catch (error) {
    console.error('❌ Simple API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
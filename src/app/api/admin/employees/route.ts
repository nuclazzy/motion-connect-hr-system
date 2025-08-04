import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting admin employees API request')
    console.log('🔧 Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
      vercelRegion: process.env.VERCEL_REGION || 'local'
    })
    
    // 환경 변수 필수 체크
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing required environment variables')
      return NextResponse.json({ 
        error: 'Server configuration error: Missing Supabase credentials' 
      }, { status: 500 })
    }
    
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    console.log('🔑 Authorization header:', authorization ? 'Present' : 'Missing')
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      console.log('❌ No valid authorization header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = authorization.replace('Bearer ', '')
    console.log('👤 User ID:', userId)
    
    console.log('🔌 Creating Supabase client...')
    let supabase
    try {
      supabase = await createServiceRoleClient()
      console.log('✅ Supabase client created')
    } catch (supabaseError) {
      console.error('❌ Failed to create Supabase client:', supabaseError)
      return NextResponse.json({ 
        error: 'Database connection failed',
        details: supabaseError instanceof Error ? supabaseError.message : 'Unknown error'
      }, { status: 500 })
    }

    // 사용자 정보 및 권한 확인
    console.log('🔍 Checking user permissions...')
    const { data: userProfile, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('❌ User lookup error:', userError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('👤 User profile:', { role: userProfile?.role })

    if (userProfile?.role !== 'admin') {
      console.log('❌ Access denied: not admin')
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 3. 직원 목록 조회
    console.log('📋 Fetching employees...')
    const { data: employees, error: employeeError } = await supabase
      .from('users')
      .select('*')
      .order('hire_date', { ascending: true })

    if (employeeError) {
      console.error('❌ Error fetching employees:', employeeError)
      return NextResponse.json({ 
        error: 'Failed to fetch employees', 
        details: employeeError.message 
      }, { status: 500 })
    }

    console.log('👥 조회된 직원 수:', employees?.length)

    // 4. 모든 직원의 휴가 데이터를 한 번에 조회 (배치 쿼리)
    console.log('🏖️ Fetching leave data...')
    const employeeIds = employees.map(emp => emp.id)
    const { data: allLeaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('user_id, leave_types')
      .in('user_id', employeeIds)

    if (leaveError) {
      console.error('❌ Error fetching leave data:', leaveError)
      return NextResponse.json({ 
        error: 'Failed to fetch leave data', 
        details: leaveError.message 
      }, { status: 500 })
    }

    console.log('📋 조회된 휴가 데이터 수:', allLeaveData?.length)
    console.log('📋 첫 번째 휴가 데이터 샘플:', allLeaveData?.[0])

    // 5. 휴가 데이터를 맵으로 변환 (빠른 조회를 위해)
    const leaveDataMap = new Map()
    allLeaveData?.forEach(leave => {
      leaveDataMap.set(leave.user_id, leave)
    })

    // 6. 직원과 휴가 데이터 결합 (성능 최적화)
    console.log('🔄 Processing employee leave data...')
    const employeesWithLeaveData = employees.map(employee => {
      const leaveData = leaveDataMap.get(employee.id)
      const leaveTypes = leaveData?.leave_types || {}
      
      // 디버깅 로그는 처음 3명만 (Vercel 로그 제한 고려)
      if (employees.indexOf(employee) < 3) {
        console.log(`👤 ${employee.name} 휴가 데이터:`, {
          hasLeaveData: !!leaveData,
          leaveTypes,
          annual_days: leaveTypes.annual_days,
          used_annual_days: leaveTypes.used_annual_days,
          sick_days: leaveTypes.sick_days,
          used_sick_days: leaveTypes.used_sick_days
        })
      }
      
      // 연차 잔여 계산 (지급 - 사용) - null/undefined 안전 처리
      const annualDays = leaveTypes.annual_days ?? 0
      const usedAnnualDays = leaveTypes.used_annual_days ?? 0
      const sickDays = leaveTypes.sick_days ?? 0
      const usedSickDays = leaveTypes.used_sick_days ?? 0
      
      const annualRemaining = Math.max(0, annualDays - usedAnnualDays)
      const sickRemaining = Math.max(0, sickDays - usedSickDays)
      
      // 시간 단위 휴가는 JSON 필드에서만 조회 (직원 대시보드와 일관성 유지)
      const substituteHours = leaveTypes.substitute_leave_hours ?? 0
      const compensatoryHours = leaveTypes.compensatory_leave_hours ?? 0
      
      console.log(`👤 ${employee.name} 처리된 휴가 데이터:`, {
        annualDays, usedAnnualDays, annualRemaining,
        sickDays, usedSickDays, sickRemaining,
        substituteHours, compensatoryHours
      })
      
      return {
        ...employee,
        annual_leave: annualRemaining,
        sick_leave: sickRemaining,
        substitute_leave_hours: substituteHours,
        compensatory_leave_hours: compensatoryHours,
        leave_data: {
          annual_days: annualDays,
          used_annual_days: usedAnnualDays,
          sick_days: sickDays,
          used_sick_days: usedSickDays,
          substitute_leave_hours: substituteHours,
          compensatory_leave_hours: compensatoryHours
        }
      }
    })

    console.log('👥 Supabase 직원 목록 조회 완료:', employeesWithLeaveData.length, '명')
    console.log('✅ API request completed successfully')

    return NextResponse.json({ success: true, employees: employeesWithLeaveData })
  } catch (error) {
    console.error('❌ 직원 목록 조회 오류:', error)
    
    // 에러 세부 정보 로깅
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json({ 
      error: '직원 목록 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
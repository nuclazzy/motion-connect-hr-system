import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 2025년 기준 연차 일수 계산
function calculateAnnualLeave(hireDate: string): number {
  const hire = new Date(hireDate)
  const now = new Date('2025-01-01') // 2025년 기준
  const yearsOfService = Math.floor((now.getTime() - hire.getTime()) / (365 * 24 * 60 * 60 * 1000))
  
  // 근속연수에 따른 연차 일수
  if (yearsOfService < 1) return 11 // 1년 미만
  if (yearsOfService === 1) return 15 // 1년차
  if (yearsOfService === 2) return 16 // 2년차
  
  // 3년차부터 2년마다 1일씩 추가 (최대 25일)
  const additionalDays = Math.floor((yearsOfService - 1) / 2)
  return Math.min(15 + additionalDays, 25)
}

export async function POST() {
  try {
    console.log('🔧 연차 데이터 복구 시작')

    // 1. 모든 직원 조회
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'user')
      .order('name')

    if (usersError) throw usersError

    const results = []

    // 2. 각 직원의 연차 데이터 확인 및 복구
    for (const user of users || []) {
      // 현재 leave_days 데이터 확인
      const { data: existingLeave, error: checkError } = await supabase
        .from('leave_days')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error(`❌ ${user.name} 휴가 데이터 확인 오류:`, checkError)
        continue
      }

      // 연차 계산
      const annualDays = calculateAnnualLeave(user.hire_date)
      const sickDays = 5 // 병가 기본 5일

      if (!existingLeave) {
        // leave_days 레코드가 없으면 새로 생성
        const { data: newLeave, error: insertError } = await supabase
          .from('leave_days')
          .insert({
            user_id: user.id,
            leave_types: {
              annual_days: annualDays,
              sick_days: sickDays,
              used_annual_days: 0,
              used_sick_days: 0
            },
            substitute_leave_hours: 0,
            compensatory_leave_hours: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error(`❌ ${user.name} 휴가 데이터 생성 실패:`, insertError)
          results.push({
            name: user.name,
            status: 'failed',
            error: insertError.message
          })
        } else {
          console.log(`✅ ${user.name} 휴가 데이터 생성 완료`)
          results.push({
            name: user.name,
            status: 'created',
            annual_days: annualDays,
            sick_days: sickDays
          })
        }
      } else {
        // 기존 데이터가 있지만 연차가 0이거나 잘못된 경우 업데이트
        const currentAnnual = existingLeave.leave_types?.annual_days || 0
        const currentSick = existingLeave.leave_types?.sick_days || 0
        
        if (currentAnnual === 0 || currentAnnual !== annualDays) {
          const { error: updateError } = await supabase
            .from('leave_days')
            .update({
              leave_types: {
                ...existingLeave.leave_types,
                annual_days: annualDays,
                sick_days: sickDays
              },
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

          if (updateError) {
            console.error(`❌ ${user.name} 휴가 데이터 업데이트 실패:`, updateError)
            results.push({
              name: user.name,
              status: 'failed',
              error: updateError.message
            })
          } else {
            console.log(`✅ ${user.name} 휴가 데이터 업데이트 완료`)
            results.push({
              name: user.name,
              status: 'updated',
              previous_annual: currentAnnual,
              new_annual: annualDays,
              sick_days: sickDays
            })
          }
        } else {
          results.push({
            name: user.name,
            status: 'unchanged',
            annual_days: currentAnnual,
            sick_days: currentSick
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '연차 데이터 복구 완료',
      total_users: users?.length || 0,
      results
    })

  } catch (error) {
    console.error('연차 데이터 복구 오류:', error)
    return NextResponse.json({
      success: false,
      error: '연차 데이터 복구 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}

// 현재 연차 데이터 상태 확인
export async function GET() {
  try {
    const { data: leaveData, error } = await supabase
      .from('leave_days')
      .select(`
        *,
        users!inner(name, email, hire_date, role)
      `)
      .eq('users.role', 'user')

    if (error) throw error

    const summary = leaveData?.map(record => ({
      name: record.users.name,
      email: record.users.email,
      hire_date: record.users.hire_date,
      annual_days: record.leave_types?.annual_days || 0,
      used_annual_days: record.leave_types?.used_annual_days || 0,
      sick_days: record.leave_types?.sick_days || 0,
      used_sick_days: record.leave_types?.used_sick_days || 0,
      substitute_leave_hours: record.substitute_leave_hours || 0,
      compensatory_leave_hours: record.compensatory_leave_hours || 0
    }))

    return NextResponse.json({
      success: true,
      total_records: leaveData?.length || 0,
      data: summary
    })

  } catch (error) {
    console.error('연차 데이터 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '연차 데이터 조회 중 오류가 발생했습니다.',
      details: (error as Error).message
    }, { status: 500 })
  }
}
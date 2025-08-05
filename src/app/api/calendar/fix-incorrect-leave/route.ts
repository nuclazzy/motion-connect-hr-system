import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// 잘못 추가된 연차 데이터 정리 API
export async function POST(request: NextRequest) {
  console.log('🔧 잘못된 연차 데이터 정리 시작')
  
  try {
    const supabase = await createServiceRoleClient()
    
    // Google Calendar end 날짜 exclusive 처리 오류로 인해 잘못 추가된 데이터 목록
    const incorrectLeaveRecords = [
      // 한종운 8월 15일 (실제로는 8월 11-14일만 연차)
      { user_name: '한종운', work_date: '2025-08-15' },
      // 한종운 8월 27일 (실제로는 8월 26일만 연차)  
      { user_name: '한종운', work_date: '2025-08-27' }
    ]

    console.log(`📋 정리할 잘못된 연차 기록: ${incorrectLeaveRecords.length}건`)

    let fixedCount = 0
    let errorCount = 0

    for (const record of incorrectLeaveRecords) {
      try {
        // 1. 해당 사용자 ID 조회
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, name')
          .eq('name', record.user_name)
          .single()

        if (userError || !user) {
          console.error(`❌ 사용자를 찾을 수 없음: ${record.user_name}`)
          errorCount++
          continue
        }

        // 2. daily_work_summary에서 해당 날짜의 연차 기록 삭제
        const { error: deleteError } = await supabase
          .from('daily_work_summary')
          .delete()
          .eq('user_id', user.id)
          .eq('work_date', record.work_date)
          .in('work_status', ['연차(유급)', '반차(유급)', '병가(유급)', '대체휴가(유급)', '보상휴가(유급)'])

        if (deleteError) {
          console.error(`❌ ${record.user_name} ${record.work_date} 삭제 실패:`, deleteError)
          errorCount++
        } else {
          console.log(`✅ ${record.user_name} ${record.work_date} 잘못된 연차 기록 삭제 완료`)
          fixedCount++
        }

      } catch (error) {
        console.error(`❌ ${record.user_name} ${record.work_date} 처리 중 오류:`, error)
        errorCount++
      }
    }

    // 3. 월별 통계도 재계산 (해당 월의 데이터가 변경되었으므로)
    console.log('📊 월별 통계 재계산 중...')
    
    const affectedMonths = ['2025-08']
    const affectedUsers = ['한종운']

    for (const userName of affectedUsers) {
      // 사용자 ID 조회
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('name', userName)
        .single()

      if (user) {
        for (const month of affectedMonths) {
          // 해당 월의 통계 재계산을 위해 트리거 호출
          const { error: statsError } = await supabase.rpc('recalculate_monthly_stats', {
            p_user_id: user.id,
            p_work_month: month + '-01'
          })

          if (statsError) {
            console.error(`❌ ${userName} ${month} 월별 통계 재계산 실패:`, statsError)
          } else {
            console.log(`✅ ${userName} ${month} 월별 통계 재계산 완료`)
          }
        }
      }
    }

    console.log('🎉 잘못된 연차 데이터 정리 완료!')
    console.log(`📊 처리 결과: 수정 ${fixedCount}건, 오류 ${errorCount}건`)

    return NextResponse.json({
      success: true,
      message: '잘못된 연차 데이터 정리 완료',
      results: {
        fixedCount,
        errorCount,
        totalProcessed: incorrectLeaveRecords.length
      }
    })

  } catch (error) {
    console.error('❌ 연차 데이터 정리 오류:', error)
    return NextResponse.json({ 
      error: '연차 데이터 정리 실패',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createServiceRoleClient()
    
    // 현재 시스템에 있는 한종운의 8월 연차 기록 조회
    const { data: leaveRecords, error } = await supabase
      .from('daily_work_summary')
      .select(`
        work_date,
        work_status,
        basic_hours,
        users!inner(name)
      `)
      .eq('users.name', '한종운')
      .gte('work_date', '2025-08-01')
      .lte('work_date', '2025-08-31')
      .in('work_status', ['연차(유급)', '반차(유급)', '병가(유급)', '대체휴가(유급)', '보상휴가(유급)'])
      .order('work_date')

    if (error) {
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }

    return NextResponse.json({
      message: '한종운의 8월 연차 기록',
      records: leaveRecords || [],
      totalCount: leaveRecords?.length || 0
    })

  } catch (error) {
    console.error('❌ 연차 기록 조회 오류:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
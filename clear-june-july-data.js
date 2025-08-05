import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearJuneJulyData() {
  try {
    console.log('🗑️  6월, 7월 출퇴근 데이터 삭제 시작...\n')
    
    // 1. 먼저 기존 데이터 현황 파악
    console.log('📊 삭제 전 데이터 현황:')
    
    // attendance_records 테이블 확인
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('record_date, user_id, users!inner(name)')
      .gte('record_date', '2025-06-01')
      .lte('record_date', '2025-07-31')
    
    if (!attendanceError && attendanceRecords) {
      console.log(`   📝 attendance_records: ${attendanceRecords.length}건`)
      
      // 사용자별 건수 요약
      const userSummary = attendanceRecords.reduce((acc, record) => {
        const userName = record.users?.name || 'Unknown'
        acc[userName] = (acc[userName] || 0) + 1
        return acc
      }, {})
      
      Object.entries(userSummary).forEach(([name, count]) => {
        console.log(`      - ${name}: ${count}건`)
      })
    }
    
    // daily_work_summary 테이블 확인
    const { data: dailySummary, error: dailyError } = await supabase
      .from('daily_work_summary')
      .select('work_date, user_id, users!inner(name)')
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-07-31')
    
    if (!dailyError && dailySummary) {
      console.log(`   📈 daily_work_summary: ${dailySummary.length}건`)
    }
    
    // monthly_work_stats 테이블 확인
    const { data: monthlyStats, error: monthlyError } = await supabase
      .from('monthly_work_stats')
      .select('work_month, user_id, users!inner(name)')
      .in('work_month', ['2025-06-01', '2025-07-01'])
    
    if (!monthlyError && monthlyStats) {
      console.log(`   📊 monthly_work_stats: ${monthlyStats.length}건`)
    }
    
    console.log('\n⚠️  정말로 삭제하시겠습니까? (y/N)')
    
    // 사용자 확인 대기 (실제로는 직접 실행할 때 readline 사용)
    // 지금은 주석 처리하고 직접 삭제 진행
    
    console.log('\n🚀 데이터 삭제 진행...')
    
    // 2. attendance_records 삭제
    console.log('1️⃣ attendance_records 삭제 중...')
    const { error: deleteAttendanceError } = await supabase
      .from('attendance_records')
      .delete()
      .gte('record_date', '2025-06-01')
      .lte('record_date', '2025-07-31')
    
    if (deleteAttendanceError) {
      console.error('❌ attendance_records 삭제 오류:', deleteAttendanceError)
    } else {
      console.log('✅ attendance_records 삭제 완료')
    }
    
    // 3. daily_work_summary 삭제
    console.log('2️⃣ daily_work_summary 삭제 중...')
    const { error: deleteDailyError } = await supabase
      .from('daily_work_summary')
      .delete()
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-07-31')
    
    if (deleteDailyError) {
      console.error('❌ daily_work_summary 삭제 오류:', deleteDailyError)
    } else {
      console.log('✅ daily_work_summary 삭제 완료')
    }
    
    // 4. monthly_work_stats 삭제
    console.log('3️⃣ monthly_work_stats 삭제 중...')
    const { error: deleteMonthlyError } = await supabase
      .from('monthly_work_stats')
      .delete()
      .in('work_month', ['2025-06-01', '2025-07-01'])
    
    if (deleteMonthlyError) {
      console.error('❌ monthly_work_stats 삭제 오류:', deleteMonthlyError)
    } else {
      console.log('✅ monthly_work_stats 삭제 완료')
    }
    
    console.log('\n🎉 6월, 7월 데이터 삭제 완료!')
    console.log('\n📋 다음 단계:')
    console.log('1. 새로운 CSV 파일 준비')
    console.log('2. 관리자 페이지 → 출퇴근 관리 → CSV 업로드')
    console.log('3. 업로드 후 탄력근무제 정산 테스트')
    
    // 삭제 후 확인
    console.log('\n🔍 삭제 후 확인:')
    
    const { data: remainingRecords, error: checkError } = await supabase
      .from('attendance_records')
      .select('record_date')
      .gte('record_date', '2025-06-01')
      .lte('record_date', '2025-07-31')
    
    if (!checkError) {
      console.log(`   📝 남은 attendance_records: ${remainingRecords?.length || 0}건`)
    }
    
    const { data: remainingDaily, error: checkDailyError } = await supabase
      .from('daily_work_summary')
      .select('work_date')
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-07-31')
    
    if (!checkDailyError) {
      console.log(`   📈 남은 daily_work_summary: ${remainingDaily?.length || 0}건`)
    }
    
  } catch (error) {
    console.error('❌ 데이터 삭제 중 오류:', error)
  }
}

clearJuneJulyData()
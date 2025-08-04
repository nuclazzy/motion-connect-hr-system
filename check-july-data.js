const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수를 확인해주세요')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkJulyData() {
  try {
    console.log('📊 7월 출퇴근 데이터 확인 중...')
    
    // 7월 전체 데이터 조회
    const { data: julyRecords, error } = await supabase
      .from('attendance_records')
      .select('*')
      .gte('record_date', '2025-07-01')
      .lte('record_date', '2025-07-31')
      .eq('source', 'MIGRATION_JULY')
      .order('record_date', { ascending: true })
      .order('record_time', { ascending: true })
    
    if (error) {
      console.error('❌ 조회 오류:', error)
      return
    }
    
    console.log(`📈 총 ${julyRecords?.length || 0}건의 7월 데이터 발견`)
    
    if (julyRecords && julyRecords.length > 0) {
      // 사용자별 집계
      const userStats = {}
      julyRecords.forEach(record => {
        if (!userStats[record.user_id]) {
          userStats[record.user_id] = { 출근: 0, 퇴근: 0 }
        }
        userStats[record.user_id][record.record_type]++
      })
      
      console.log('\n👥 사용자별 통계:')
      for (const [userId, stats] of Object.entries(userStats)) {
        console.log(`  ${userId}: 출근 ${stats.출근}회, 퇴근 ${stats.퇴근}회`)
      }
      
      // 날짜별 집계
      const dateStats = {}
      julyRecords.forEach(record => {
        const date = record.record_date
        if (!dateStats[date]) {
          dateStats[date] = { 출근: 0, 퇴근: 0 }
        }
        dateStats[date][record.record_type]++
      })
      
      console.log('\n📅 날짜별 통계 (처음 5일):')
      Object.entries(dateStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 5)
        .forEach(([date, stats]) => {
          console.log(`  ${date}: 출근 ${stats.출근}회, 퇴근 ${stats.퇴근}회`)
        })
      
      // 샘플 데이터
      console.log('\n📋 샘플 데이터 (처음 3건):')
      julyRecords.slice(0, 3).forEach((record, index) => {
        console.log(`  ${index + 1}. ${record.record_date} ${record.record_time} - ${record.record_type} (${record.reason})`)
      })
    }
    
  } catch (error) {
    console.error('❌ 확인 실패:', error)
  }
}

checkJulyData()
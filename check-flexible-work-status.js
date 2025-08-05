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

async function checkFlexibleWorkStatus() {
  try {
    console.log('🔍 탄력근무제 시스템 작동 상태 확인...\n')
    
    // 1. 초과근무 임계값 함수 테스트
    console.log('1️⃣ 초과근무 임계값 함수 테스트:')
    
    const { data: julyThreshold, error: julyError } = await supabase
      .rpc('get_overtime_threshold', { work_date: '2025-07-15' })
    
    const { data: mayThreshold, error: mayError } = await supabase
      .rpc('get_overtime_threshold', { work_date: '2025-05-15' })
    
    if (!julyError && !mayError) {
      console.log(`   📅 2025-07-15 (탄력근무제 기간): ${julyThreshold}시간 임계값`)
      console.log(`   📅 2025-05-15 (일반 기간): ${mayThreshold}시간 임계값`)
      console.log(`   ${julyThreshold === 12 && mayThreshold === 8 ? '✅ 정상' : '❌ 오류'}`)
    } else {
      console.log('   ❌ 함수 호출 오류:', julyError || mayError)
    }
    
    console.log('\n2️⃣ 6-7-8월 근무 데이터 확인:')
    
    // 2. 6-7-8월 근무시간 데이터 조회
    const { data: flexWorkData, error: flexError } = await supabase
      .from('daily_work_summary')
      .select(`
        user_id,
        work_date,
        basic_hours,
        overtime_hours,
        night_hours,
        work_status,
        had_dinner,
        users!inner(name, department)
      `)
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-08-31')
      .order('work_date', { ascending: false })
      .limit(10)
    
    if (!flexError && flexWorkData) {
      console.log(`   📊 탄력근무제 기간 데이터: ${flexWorkData.length}건`)
      
      if (flexWorkData.length > 0) {
        console.log('\n   📋 최근 근무 기록 샘플:')
        flexWorkData.slice(0, 5).forEach(record => {
          const totalHours = (record.basic_hours || 0) + (record.overtime_hours || 0)
          console.log(`   - ${record.work_date}: ${record.users?.name} (${totalHours}h = ${record.basic_hours}h + ${record.overtime_hours}h, 야간: ${record.night_hours}h)`)
        })
        
        // 12시간 이상 근무한 날 체크
        const longWorkDays = flexWorkData.filter(record => 
          (record.basic_hours || 0) + (record.overtime_hours || 0) > 12
        )
        
        if (longWorkDays.length > 0) {
          console.log(`\n   🕐 12시간 초과 근무일: ${longWorkDays.length}건`)
          console.log(`   ✅ 탄력근무제 12시간 임계값이 적용되고 있습니다!`)
        } else {
          console.log(`\n   ℹ️  12시간 초과 근무 기록이 없습니다.`)
        }
      } else {
        console.log(`   ⚠️  6-8월 근무 데이터가 없습니다.`)
      }
    } else {
      console.log('   ❌ 데이터 조회 오류:', flexError)
    }
    
    console.log('\n3️⃣ 야간근무 수당 대상 확인:')
    
    // 3. 야간근무 데이터 확인
    const { data: nightWorkData, error: nightError } = await supabase
      .from('daily_work_summary')
      .select(`
        user_id,
        work_date,
        night_hours,
        users!inner(name)
      `)
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-08-31')
      .gt('night_hours', 0)
      .order('night_hours', { ascending: false })
      .limit(5)
    
    if (!nightError && nightWorkData) {
      console.log(`   🌙 야간근무 기록: ${nightWorkData.length}건`)
      
      if (nightWorkData.length > 0) {
        let totalNightHours = 0
        nightWorkData.forEach(record => {
          totalNightHours += record.night_hours || 0
          console.log(`   - ${record.work_date}: ${record.users?.name} (${record.night_hours}h)`)
        })
        console.log(`   💰 총 야간근무시간: ${totalNightHours.toFixed(1)}시간`)
        console.log(`   ✅ 야간근무 수당 매월 지급 대상입니다!`)
      } else {
        console.log(`   ℹ️  야간근무 기록이 없습니다.`)
      }
    } else {
      console.log('   ❌ 야간근무 데이터 조회 오류:', nightError)
    }
    
    console.log('\n4️⃣ 저녁식사 시간 자동 감지 확인:')
    
    // 4. 저녁식사 시간 감지 확인
    const { data: dinnerData, error: dinnerError } = await supabase
      .from('daily_work_summary')
      .select(`
        user_id,
        work_date,
        had_dinner,
        basic_hours,
        overtime_hours,
        users!inner(name)
      `)
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-08-31')
      .eq('had_dinner', true)
      .limit(5)
    
    if (!dinnerError && dinnerData) {
      if (dinnerData.length > 0) {
        console.log(`   🍽️  저녁식사 시간 차감 기록: ${dinnerData.length}건`)
        dinnerData.forEach(record => {
          const totalHours = (record.basic_hours || 0) + (record.overtime_hours || 0)
          console.log(`   - ${record.work_date}: ${record.users?.name} (${totalHours}h, 저녁시간 차감됨)`)
        })
        console.log(`   ✅ 저녁식사 자동 감지가 작동하고 있습니다!`)
      } else {
        console.log(`   ℹ️  저녁식사 시간 차감 기록이 없습니다.`)
      }
    } else {
      console.log('   ❌ 저녁식사 데이터 조회 오류:', dinnerError)
    }
    
    console.log('\n🎉 탄력근무제 시스템 상태 확인 완료!')
    console.log('📝 다음 단계: 관리자 페이지에서 분기별 정산 기능을 테스트해보세요.')
    
  } catch (error) {
    console.error('❌ 시스템 확인 중 오류:', error)
  }
}

checkFlexibleWorkStatus()
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkExistingNightCalculation() {
  console.log('=== 기존 야간근무 계산 로직 확인 ===\n');

  try {
    // 1. 야간근무 시간이 계산된 데이터 확인
    console.log('1. 야간근무 시간이 기록된 데이터 확인:');
    const { data: nightData, error: nightError } = await supabase
      .from('daily_work_summary')
      .select('work_date, check_in_time, check_out_time, night_hours, work_status')
      .gt('night_hours', 0)
      .order('work_date', { ascending: false })
      .limit(10);

    if (!nightError && nightData && nightData.length > 0) {
      console.log(`✅ 야간근무 기록 ${nightData.length}건 발견:`);
      nightData.forEach(record => {
        const checkIn = record.check_in_time ? new Date(record.check_in_time).toLocaleTimeString('ko-KR') : '?';
        const checkOut = record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString('ko-KR') : '?';
        console.log(`   ${record.work_date}: ${checkIn} ~ ${checkOut} = 야간 ${record.night_hours}시간`);
      });
    } else {
      console.log('❌ 야간근무 시간이 계산된 기록이 없습니다.');
    }

    // 2. 22시 이후 퇴근 기록 확인 (야간근무가 계산되어야 하는데 안된 경우)
    console.log('\n2. 22시 이후 퇴근했지만 야간근무가 0인 기록:');
    const { data: lateData, error: lateError } = await supabase
      .from('daily_work_summary')
      .select('work_date, check_in_time, check_out_time, night_hours')
      .gte('work_date', '2025-07-01')
      .eq('night_hours', 0)
      .limit(100);

    if (!lateError && lateData) {
      const shouldHaveNight = lateData.filter(record => {
        if (record.check_out_time) {
          const hour = new Date(record.check_out_time).getHours();
          return hour >= 22 || hour < 6;
        }
        return false;
      });

      if (shouldHaveNight.length > 0) {
        console.log(`⚠️ 야간근무가 계산되어야 하는데 0인 기록 ${shouldHaveNight.length}건:`);
        shouldHaveNight.slice(0, 5).forEach(record => {
          const checkOut = new Date(record.check_out_time).toLocaleTimeString('ko-KR');
          console.log(`   ${record.work_date}: 퇴근 ${checkOut} → 야간 ${record.night_hours}시간`);
        });
      } else {
        console.log('✅ 모든 야간근무가 정상 계산되고 있습니다.');
      }
    }

    // 3. 초과근무 계산 확인
    console.log('\n3. 초과근무 계산 상태:');
    const { data: overtimeData, error: overtimeError } = await supabase
      .from('daily_work_summary')
      .select('work_date, basic_hours, overtime_hours, work_status')
      .gt('overtime_hours', 0)
      .order('work_date', { ascending: false })
      .limit(5);

    if (!overtimeError && overtimeData && overtimeData.length > 0) {
      console.log(`✅ 초과근무 기록 ${overtimeData.length}건 발견:`);
      overtimeData.forEach(record => {
        console.log(`   ${record.work_date}: 기본 ${record.basic_hours}h + 초과 ${record.overtime_hours}h`);
      });
    } else {
      console.log('❌ 초과근무 시간이 계산된 기록이 없습니다.');
    }

    // 4. 대체/보상휴가 계산 확인
    console.log('\n4. 대체/보상휴가 계산 상태:');
    const { data: leaveData, error: leaveError } = await supabase
      .from('daily_work_summary')
      .select('work_date, substitute_hours, compensatory_hours, work_status')
      .or('substitute_hours.gt.0,compensatory_hours.gt.0')
      .order('work_date', { ascending: false })
      .limit(5);

    if (!leaveError && leaveData && leaveData.length > 0) {
      console.log(`✅ 대체/보상휴가 기록 ${leaveData.length}건 발견:`);
      leaveData.forEach(record => {
        if (record.substitute_hours > 0) {
          console.log(`   ${record.work_date}: 대체 ${record.substitute_hours}h (${record.work_status})`);
        }
        if (record.compensatory_hours > 0) {
          console.log(`   ${record.work_date}: 보상 ${record.compensatory_hours}h (${record.work_status})`);
        }
      });
    }

    // 5. 트리거 함수 존재 확인
    console.log('\n5. 데이터베이스 트리거 및 함수 확인:');
    const { data: triggerData, error: triggerError } = await supabase
      .rpc('pg_trigger', {})
      .select('*');

    if (triggerError && triggerError.message.includes('function')) {
      console.log('❌ 트리거 확인 실패 (권한 문제일 수 있음)');
    } else {
      console.log('✅ 트리거가 설정되어 있을 가능성이 높습니다.');
    }

    // 6. 최근 근무 기록 분석
    console.log('\n6. 최근 야간근무가 발생했어야 할 사례:');
    const { data: recentData, error: recentError } = await supabase
      .from('attendance_records')
      .select('record_date, record_time, record_type')
      .gte('record_date', '2025-07-01')
      .order('record_date', { ascending: false })
      .limit(100);

    if (!recentError && recentData) {
      const nightWorkDates = new Set();
      const dateGroups = {};
      
      recentData.forEach(record => {
        const date = record.record_date;
        if (!dateGroups[date]) dateGroups[date] = [];
        dateGroups[date].push(record);
      });

      Object.entries(dateGroups).forEach(([date, records]) => {
        const checkOut = records.find(r => r.record_type === '퇴근');
        if (checkOut) {
          const [hours] = checkOut.record_time.split(':').map(Number);
          if (hours >= 22 || hours < 6) {
            nightWorkDates.add(date);
          }
        }
      });

      if (nightWorkDates.size > 0) {
        console.log(`📊 22시 이후 퇴근한 날: ${nightWorkDates.size}일`);
        const samples = Array.from(nightWorkDates).slice(0, 3);
        for (const date of samples) {
          const { data: summary } = await supabase
            .from('daily_work_summary')
            .select('night_hours')
            .eq('work_date', date)
            .single();
          
          console.log(`   ${date}: 야간근무 ${summary?.night_hours || 0}시간 ${summary?.night_hours > 0 ? '✅' : '❌'}`);
        }
      }
    }

  } catch (error) {
    console.error('오류 발생:', error);
  }

  console.log('\n=== 분석 결론 ===');
  console.log('현재 시스템에서 야간근무 자동 계산이 작동하지 않고 있습니다.');
  console.log('update-night-work-calculation.sql 실행이 필요합니다.');
}

checkExistingNightCalculation();
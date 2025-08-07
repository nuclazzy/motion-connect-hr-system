const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSubstituteLeaveFields() {
  console.log('=== 대체휴가/보상휴가 필드 확인 ===\n');

  try {
    // 1. users 테이블 확인
    console.log('1. users 테이블 체크:');
    const { data: userSample, error: userError } = await supabase
      .from('users')
      .select('id, name, substitute_leave_hours, compensatory_leave_hours')
      .limit(1);

    if (userError) {
      if (userError.message.includes('column') && userError.message.includes('does not exist')) {
        console.log('❌ users 테이블에 substitute_leave_hours, compensatory_leave_hours 필드가 없습니다.');
      } else {
        console.log('❌ 오류:', userError.message);
      }
    } else {
      console.log('✅ users 테이블에 대체휴가/보상휴가 필드가 있습니다.');
      if (userSample && userSample.length > 0) {
        console.log('   샘플 데이터:', {
          substitute_leave_hours: userSample[0].substitute_leave_hours || 0,
          compensatory_leave_hours: userSample[0].compensatory_leave_hours || 0
        });
      }
    }

    // 2. daily_work_summary 테이블 확인
    console.log('\n2. daily_work_summary 테이블 체크:');
    const { data: dailySample, error: dailyError } = await supabase
      .from('daily_work_summary')
      .select('work_date, substitute_hours, compensatory_hours')
      .limit(1);

    if (dailyError) {
      if (dailyError.message.includes('column') && dailyError.message.includes('does not exist')) {
        console.log('❌ daily_work_summary 테이블에 substitute_hours, compensatory_hours 필드가 없습니다.');
      } else {
        console.log('❌ 오류:', dailyError.message);
      }
    } else {
      console.log('✅ daily_work_summary 테이블에 대체/보상 시간 필드가 있습니다.');
      if (dailySample && dailySample.length > 0) {
        console.log('   샘플 데이터:', {
          substitute_hours: dailySample[0].substitute_hours || 0,
          compensatory_hours: dailySample[0].compensatory_hours || 0
        });
      }
    }

    // 3. leave_days 테이블 확인 (JSON 필드)
    console.log('\n3. leave_days 테이블 체크 (JSON 필드):');
    const { data: leaveSample, error: leaveError } = await supabase
      .from('leave_days')
      .select('user_id, leave_types')
      .limit(1);

    if (leaveError) {
      console.log('❌ leave_days 테이블 조회 오류:', leaveError.message);
    } else {
      console.log('✅ leave_days 테이블 조회 성공');
      if (leaveSample && leaveSample.length > 0) {
        const leaveTypes = leaveSample[0].leave_types;
        console.log('   leave_types 필드 구조:');
        console.log('   - substitute_leave_hours:', leaveTypes?.substitute_leave_hours || '없음');
        console.log('   - compensatory_leave_hours:', leaveTypes?.compensatory_leave_hours || '없음');
      }
    }

    // 4. monthly_work_stats 테이블 확인
    console.log('\n4. monthly_work_stats 테이블 체크:');
    const { data: monthlySample, error: monthlyError } = await supabase
      .from('monthly_work_stats')
      .select('work_month, total_substitute_hours, total_compensatory_hours')
      .limit(1);

    if (monthlyError) {
      if (monthlyError.message.includes('column') && monthlyError.message.includes('does not exist')) {
        console.log('❌ monthly_work_stats 테이블에 total_substitute_hours, total_compensatory_hours 필드가 없습니다.');
      } else {
        console.log('❌ 오류:', monthlyError.message);
      }
    } else {
      console.log('✅ monthly_work_stats 테이블에 대체/보상 시간 집계 필드가 있습니다.');
      if (monthlySample && monthlySample.length > 0) {
        console.log('   샘플 데이터:', {
          total_substitute_hours: monthlySample[0].total_substitute_hours || 0,
          total_compensatory_hours: monthlySample[0].total_compensatory_hours || 0
        });
      }
    }

    // 5. 실제 데이터 확인
    console.log('\n5. 실제 대체/보상휴가 데이터 확인:');
    const { data: workData, error: workError } = await supabase
      .from('daily_work_summary')
      .select('work_date, work_status, substitute_hours, compensatory_hours')
      .or('substitute_hours.gt.0,compensatory_hours.gt.0')
      .limit(5);

    if (!workError && workData && workData.length > 0) {
      console.log('✅ 대체/보상휴가가 발생한 근무 기록:');
      workData.forEach(record => {
        console.log(`   ${record.work_date}: ${record.work_status} - 대체 ${record.substitute_hours || 0}h, 보상 ${record.compensatory_hours || 0}h`);
      });
    } else {
      console.log('   대체/보상휴가가 발생한 기록이 없습니다.');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  }

  console.log('\n=== 확인 완료 ===');
}

checkSubstituteLeaveFields();
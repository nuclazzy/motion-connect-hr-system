const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function checkCalendarSetup() {
  console.log('📅 캘린더 설정 확인 중...');
  
  // 1. 모든 캘린더 설정 조회
  const { data: allCalendars, error: getAllError } = await supabase
    .from('calendar_configs')
    .select('*')
    .order('created_at', { ascending: false });

  if (getAllError) {
    console.error('❌ 캘린더 설정 조회 오류:', getAllError);
    return;
  }

  console.log(`📊 총 ${allCalendars?.length || 0}개의 캘린더 설정이 있습니다:`);
  
  if (allCalendars && allCalendars.length > 0) {
    allCalendars.forEach((config, index) => {
      console.log(`${index + 1}. ${config.target_name} (${config.config_type})`);
      console.log(`   - Calendar ID: ${config.calendar_id}`);
      console.log(`   - Alias: ${config.calendar_alias || 'N/A'}`);
      console.log(`   - Active: ${config.is_active}`);
      console.log('');
    });
  }

  // 2. 연차 관련 캘린더 찾기
  const { data: leaveCalendars, error: getLeaveError } = await supabase
    .from('calendar_configs')
    .select('*')
    .eq('config_type', 'function')
    .ilike('target_name', '%연차%')
    .eq('is_active', true);

  if (getLeaveError) {
    console.error('❌ 연차 캘린더 조회 오류:', getLeaveError);
    return;
  }

  console.log(`🏖️ 연차 캘린더: ${leaveCalendars?.length || 0}개`);
  
  if (leaveCalendars && leaveCalendars.length > 0) {
    leaveCalendars.forEach((config, index) => {
      console.log(`${index + 1}. ${config.target_name}`);
      console.log(`   - Calendar ID: ${config.calendar_id}`);
    });
  } else {
    console.log('⚠️ 연차 캘린더가 설정되지 않았습니다.');
    console.log('📝 연차 캘린더를 설정하려면:');
    console.log('1. calendar_configs 테이블에 다음과 같이 추가하세요:');
    console.log(`   INSERT INTO calendar_configs (config_type, target_name, calendar_id, is_active)`);
    console.log(`   VALUES ('function', '연차관리', 'YOUR_CALENDAR_ID', true);`);
  }

  // 3. 직원 정보도 확인
  const { data: employees, error: employeesError } = await supabase
    .from('users')
    .select('id, name, email, department')
    .limit(5);

  if (employeesError) {
    console.error('❌ 직원 정보 조회 오류:', employeesError);
    return;
  }

  console.log(`👥 직원 정보 (처음 5명):`);
  employees?.forEach((emp, index) => {
    console.log(`${index + 1}. ${emp.name} (${emp.department}) - ${emp.email}`);
  });
}

checkCalendarSetup().catch(console.error);
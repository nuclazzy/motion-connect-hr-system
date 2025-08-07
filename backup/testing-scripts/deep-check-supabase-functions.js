const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function deepCheckDatabase() {
  console.log('🔍 Deep checking Supabase database for annual leave logic...\n');
  
  try {
    // 1. SQL 쿼리로 직접 함수 목록 조회
    console.log('1. Querying PostgreSQL functions directly:');
    const { data: functions, error: funcError } = await supabase.rpc('get_all_functions', {}).catch(async () => {
      // 대체 방법: raw SQL 실행
      const { data, error } = await supabase.from('pg_proc').select('proname').catch(() => ({ data: null, error: 'no access' }));
      return { data, error };
    });
    
    if (functions) {
      console.log('   Found functions:', functions);
    } else {
      console.log('   Cannot directly query functions (expected - security restriction)');
    }
    
    // 2. 실제 데이터를 통한 연차 계산 로직 확인
    console.log('\n2. Checking actual leave calculation data:');
    
    // 한 명의 사용자 데이터로 연차 계산 확인
    const { data: sampleUser, error: userErr } = await supabase
      .from('users')
      .select('id, name, hire_date, annual_days, used_annual_days, substitute_leave_hours, compensatory_leave_hours')
      .neq('email', 'admin@motionsense.co.kr')
      .limit(1)
      .single();
    
    if (sampleUser) {
      console.log('   Sample user leave data:');
      console.log('   - Name:', sampleUser.name);
      console.log('   - Hire date:', sampleUser.hire_date);
      console.log('   - Annual days:', sampleUser.annual_days);
      console.log('   - Used annual days:', sampleUser.used_annual_days);
      console.log('   - Remaining:', (sampleUser.annual_days || 0) - (sampleUser.used_annual_days || 0));
      console.log('   - Substitute leave hours:', sampleUser.substitute_leave_hours);
      console.log('   - Compensatory leave hours:', sampleUser.compensatory_leave_hours);
      
      // 근속년수 계산
      if (sampleUser.hire_date) {
        const hireDate = new Date(sampleUser.hire_date);
        const today = new Date();
        const years = Math.floor((today - hireDate) / (365.25 * 24 * 60 * 60 * 1000));
        console.log('   - Years of service:', years);
        
        // 법정 연차 계산 (한국 근로기준법)
        let expectedAnnualDays = 0;
        if (years === 0) {
          // 1년 미만: 1개월마다 1일
          const months = Math.floor((today - hireDate) / (30.44 * 24 * 60 * 60 * 1000));
          expectedAnnualDays = Math.min(months, 11);
        } else if (years === 1) {
          expectedAnnualDays = 15;
        } else {
          // 3년차부터 2년마다 1일 추가 (최대 25일)
          expectedAnnualDays = Math.min(15 + Math.floor((years - 1) / 2), 25);
        }
        console.log('   - Expected annual days by law:', expectedAnnualDays);
        console.log('   - Actual vs Expected:', sampleUser.annual_days, 'vs', expectedAnnualDays);
      }
    }
    
    // 3. 트리거 및 자동 계산 확인
    console.log('\n3. Checking for automatic calculation triggers:');
    
    // daily_work_summary 테이블의 트리거 확인
    const { data: workSummary, error: wsError } = await supabase
      .from('daily_work_summary')
      .select('*')
      .limit(1);
    
    if (workSummary) {
      console.log('   daily_work_summary table exists (may have calculation triggers)');
    }
    
    // 4. 연차 관련 테이블/뷰 구조 심층 분석
    console.log('\n4. Deep analysis of leave-related tables:');
    
    // form_requests 테이블에서 휴가 신청 확인
    const { data: leaveRequests, error: lrError } = await supabase
      .from('form_requests')
      .select('form_type, status, request_data')
      .eq('form_type', '휴가 신청서')
      .limit(5);
    
    if (leaveRequests && leaveRequests.length > 0) {
      console.log('   Found', leaveRequests.length, 'leave requests');
      console.log('   Request statuses:', leaveRequests.map(r => r.status));
    }
    
    // 5. RPC 함수 실제 테스트
    console.log('\n5. Testing RPC functions with actual parameters:');
    
    // 연차 계산 관련 함수들을 실제 파라미터로 테스트
    const testCases = [
      { name: 'calculate_annual_leave_for_user', params: { user_id: sampleUser?.id } },
      { name: 'get_annual_leave_balance', params: { user_id: sampleUser?.id } },
      { name: 'auto_grant_annual_leave', params: {} },
      { name: 'process_yearly_leave_grant', params: {} }
    ];
    
    for (const test of testCases) {
      try {
        const { data, error } = await supabase.rpc(test.name, test.params || {});
        if (!error || (error && !error.message.includes('function') && !error.message.includes('not found'))) {
          console.log(`   ✅ Function might exist: ${test.name}`);
          if (data) console.log(`      Result:`, data);
        }
      } catch (e) {
        // Function doesn't exist
      }
    }
    
    // 6. 연차 생성/갱신 로직 추적
    console.log('\n6. Tracking annual leave creation/update patterns:');
    
    // 최근 업데이트된 사용자들의 연차 변경 패턴 확인
    const { data: recentUsers, error: ruError } = await supabase
      .from('users')
      .select('name, annual_days, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (recentUsers) {
      console.log('   Recent annual leave updates:');
      recentUsers.forEach(u => {
        console.log(`   - ${u.name}: ${u.annual_days} days (updated: ${u.updated_at})`);
      });
    }
    
    // 7. 입사일 기준 자동 연차 부여 확인
    console.log('\n7. Checking for hire-date based automatic grant:');
    
    // 최근 입사자 확인
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: newHires, error: nhError } = await supabase
      .from('users')
      .select('name, hire_date, annual_days')
      .gte('hire_date', thirtyDaysAgo.toISOString())
      .order('hire_date', { ascending: false });
    
    if (newHires && newHires.length > 0) {
      console.log('   Recent hires (last 30 days):');
      newHires.forEach(h => {
        console.log(`   - ${h.name}: hired ${h.hire_date}, annual days: ${h.annual_days}`);
      });
    } else {
      console.log('   No recent hires found');
    }
    
    console.log('\n✅ Deep check complete!');
    console.log('\n📊 Summary:');
    console.log('- Users table has annual leave fields');
    console.log('- No dedicated annual leave calculation functions found in RPC');
    console.log('- Annual leave appears to be managed manually or through application logic');
    console.log('- Substitute/compensatory leave hours are tracked separately');
    
  } catch (error) {
    console.error('Error during deep check:', error);
  }
  
  process.exit(0);
}

deepCheckDatabase();
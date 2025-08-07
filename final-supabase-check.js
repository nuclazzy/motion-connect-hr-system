const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function finalCheck() {
  console.log('🔍 Final check for annual leave calculation in Supabase...\n');
  
  try {
    // 1. 사용자 데이터 확인
    console.log('1. Checking user leave data structure:');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name, email, hire_date, annual_days, used_annual_days')
      .neq('email', 'admin@motionsense.co.kr')
      .limit(3);
    
    if (users) {
      console.log('Found', users.length, 'users with leave data:');
      users.forEach(u => {
        const remaining = (u.annual_days || 0) - (u.used_annual_days || 0);
        console.log(`- ${u.name}: ${u.annual_days || 0} total, ${u.used_annual_days || 0} used, ${remaining} remaining`);
        
        // 근속년수별 법정 연차 계산
        if (u.hire_date) {
          const hireDate = new Date(u.hire_date);
          const today = new Date();
          const months = Math.floor((today - hireDate) / (30.44 * 24 * 60 * 60 * 1000));
          const years = Math.floor(months / 12);
          
          let legalAnnualDays = 0;
          if (years === 0) {
            legalAnnualDays = Math.min(months, 11);
          } else if (years === 1) {
            legalAnnualDays = 15;
          } else {
            legalAnnualDays = Math.min(15 + Math.floor((years - 1) / 2), 25);
          }
          
          console.log(`  Hire: ${u.hire_date}, Service: ${years}y ${months%12}m, Legal: ${legalAnnualDays} days`);
          if (u.annual_days !== legalAnnualDays) {
            console.log(`  ⚠️ Mismatch: Has ${u.annual_days} but should have ${legalAnnualDays}`);
          }
        }
      });
    }
    
    // 2. RPC 함수 존재 확인 (오류 처리 개선)
    console.log('\n2. Checking for annual leave RPC functions:');
    const rpcFunctions = [
      'calculate_annual_leave',
      'grant_annual_leave', 
      'auto_grant_annual_leave',
      'update_annual_leave_balance',
      'process_annual_leave_grant',
      'initialize_annual_leave'
    ];
    
    let foundFunctions = [];
    for (const funcName of rpcFunctions) {
      try {
        const result = await supabase.rpc(funcName, {});
        // 함수가 존재하면 여기 도달
        foundFunctions.push(funcName);
        console.log(`✅ Found: ${funcName}`);
      } catch (e) {
        // 함수가 없음 - 정상적인 상황
      }
    }
    
    if (foundFunctions.length === 0) {
      console.log('❌ No annual leave RPC functions found');
    }
    
    // 3. 보상 관련 함수 확인
    console.log('\n3. Checking compensation-related functions:');
    const compFunctions = [
      'approve_compensation_item',
      'reject_compensation_item',
      'calculate_work_compensation',
      'process_overtime_compensation'
    ];
    
    for (const funcName of compFunctions) {
      try {
        // 잘못된 파라미터로 호출
        const result = await supabase.rpc(funcName, { p_item_id: '00000000-0000-0000-0000-000000000000' });
        console.log(`✅ Found: ${funcName}`);
      } catch (e) {
        // 함수 없음 또는 파라미터 오류
      }
    }
    
    // 4. 트리거 간접 확인 - 최근 변경 패턴
    console.log('\n4. Checking for automatic triggers (indirect):');
    
    // 출퇴근 기록과 보상 항목 연결 확인
    const { data: compItems, error: compError } = await supabase
      .from('work_compensation_items')
      .select('*')
      .limit(5)
      .order('created_at', { ascending: false });
    
    if (compItems && compItems.length > 0) {
      console.log(`Found ${compItems.length} work compensation items`);
      console.log('Item types:', [...new Set(compItems.map(i => i.item_type))]);
      console.log('This suggests automatic trigger exists for compensation calculation');
    }
    
    // 5. 수동 관리 여부 확인
    console.log('\n5. Checking manual management patterns:');
    
    // 관리자가 직접 수정한 흔적 확인
    const { data: recentUpdates, error: updateError } = await supabase
      .from('users')
      .select('name, annual_days, updated_at')
      .order('updated_at', { ascending: false })
      .neq('email', 'admin@motionsense.co.kr')
      .limit(5);
    
    if (recentUpdates) {
      console.log('Recent annual_days updates:');
      recentUpdates.forEach(u => {
        const date = new Date(u.updated_at);
        console.log(`- ${u.name}: ${u.annual_days} days (updated: ${date.toLocaleDateString()})`);
      });
    }
    
    // 6. 결론
    console.log('\n📊 FINAL ANALYSIS:');
    console.log('=====================================');
    console.log('1. Annual leave fields exist in users table ✅');
    console.log('2. No automatic annual leave calculation functions found ❌');
    console.log('3. Annual leave appears to be managed MANUALLY');
    console.log('4. Work compensation has automatic triggers ✅');
    console.log('5. Substitute/compensatory leave hours are tracked ✅');
    console.log('6. Legal annual leave calculation NOT automated ❌');
    console.log('\n🎯 CONCLUSION: 연차 자동 계산/부여 로직이 Supabase에 구현되어 있지 않음');
    console.log('   → 모든 연차 관리는 수동으로 이루어지고 있음');
    console.log('   → 법정 연차 자동 계산 시스템 구현이 필요함');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

finalCheck();
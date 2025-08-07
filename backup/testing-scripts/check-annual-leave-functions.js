const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function checkAnnualLeaveFunctions() {
  console.log('🔍 Checking for annual leave calculation functions in Supabase...\n');
  
  try {
    // 1. 모든 RPC 함수 목록 조회 시도
    console.log('1. Checking all available RPC functions:');
    const functionNames = [
      'calculate_annual_leave',
      'grant_annual_leave',
      'update_annual_leave',
      'initialize_annual_leave',
      'auto_grant_leave',
      'calculate_leave_days',
      'process_annual_leave',
      'refresh_leave_data'
    ];
    
    for (const funcName of functionNames) {
      try {
        const { data, error } = await supabase.rpc(funcName, {});
        if (!error) {
          console.log(`   ✅ Found function: ${funcName}`);
        }
      } catch (e) {
        // Function doesn't exist - expected for most
      }
    }
    
    // 2. 사용자 테이블에서 연차 관련 필드 확인
    console.log('\n2. Checking users table for annual leave fields:');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (userData && userData[0]) {
      const user = userData[0];
      const annualLeaveFields = Object.keys(user).filter(key => 
        key.includes('annual') || key.includes('leave') || key.includes('연차')
      );
      console.log('   Annual leave related fields:', annualLeaveFields);
    }
    
    // 3. leave_days 테이블 구조 확인
    console.log('\n3. Checking leave_days table structure:');
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .limit(1);
    
    if (leaveData && leaveData[0]) {
      console.log('   leave_days table exists');
      console.log('   Sample data structure:', Object.keys(leaveData[0]));
      if (leaveData[0].leave_types) {
        console.log('   leave_types JSON structure:', Object.keys(leaveData[0].leave_types));
      }
    }
    
    // 4. 트리거 존재 여부 확인 (간접적으로)
    console.log('\n4. Testing for automatic triggers:');
    
    // work_compensation_items 테이블 확인 (자동 생성 트리거가 있을 수 있음)
    const { data: compData, error: compError } = await supabase
      .from('work_compensation_items')
      .select('*')
      .limit(1);
    
    if (compData) {
      console.log('   work_compensation_items table exists (may have triggers)');
    }
    
    // 5. 특정 RPC 함수들 테스트
    console.log('\n5. Testing specific leave-related RPC functions:');
    
    const testFunctions = [
      'submit_leave_request_safe',
      'approve_leave_request_safe',
      'approve_compensation_item',
      'reject_compensation_item'
    ];
    
    for (const funcName of testFunctions) {
      try {
        // 잘못된 파라미터로 호출하여 함수 존재 여부만 확인
        const { data, error } = await supabase.rpc(funcName, { test: true });
        if (error && !error.message.includes('function') && !error.message.includes('not found')) {
          console.log(`   ✅ Function exists: ${funcName}`);
        }
      } catch (e) {
        // Expected errors
      }
    }
    
    // 6. 연차 계산 관련 뷰 확인
    console.log('\n6. Checking for annual leave related views:');
    const viewNames = [
      'admin_work_compensation_view',
      'leave_summary_view',
      'annual_leave_view'
    ];
    
    for (const viewName of viewNames) {
      try {
        const { data, error } = await supabase.from(viewName).select('*').limit(1);
        if (!error) {
          console.log(`   ✅ View exists: ${viewName}`);
        }
      } catch (e) {
        // View doesn't exist
      }
    }
    
    console.log('\n✅ Check complete!');
    
  } catch (error) {
    console.error('Error during check:', error);
  }
  
  process.exit(0);
}

checkAnnualLeaveFunctions();
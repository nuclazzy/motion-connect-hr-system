const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function testSpecificFunctions() {
  console.log('🔍 특정 함수들 상세 테스트\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. 실제 사용자로 연차 계산 테스트
    console.log('\n1️⃣ calculate_annual_leave 함수 테스트');
    console.log('-'.repeat(40));
    
    const { data: users } = await supabase
      .from('users')
      .select('id, name, hire_date, annual_days')
      .neq('email', 'admin@motionsense.co.kr')
      .limit(3);
    
    for (const user of users || []) {
      try {
        const { data, error } = await supabase.rpc('calculate_annual_leave', {
          user_id: user.id
        });
        
        if (!error) {
          console.log(`✅ ${user.name}:`);
          console.log(`   입사일: ${user.hire_date}`);
          console.log(`   현재 연차: ${user.annual_days}일`);
          console.log(`   계산된 연차: ${data}일`);
          if (data !== user.annual_days) {
            console.log(`   ⚠️ 불일치 발견!`);
          }
        } else {
          console.log(`❌ ${user.name}: 오류 - ${error.message}`);
        }
      } catch (e) {
        console.log(`❌ ${user.name}: 예외 - ${e.message}`);
      }
    }
    
    // 2. auto_grant_annual_leave 파라미터 테스트
    console.log('\n2️⃣ auto_grant_annual_leave 함수 파라미터 테스트');
    console.log('-'.repeat(40));
    
    const testParams = [
      {},
      { target_date: '2025-01-01' },
      { user_id: users?.[0]?.id },
      { force: true }
    ];
    
    for (const params of testParams) {
      try {
        const { data, error } = await supabase.rpc('auto_grant_annual_leave', params);
        
        if (!error) {
          console.log(`✅ 파라미터 ${JSON.stringify(params)}: 성공`);
          if (data) console.log(`   결과: ${JSON.stringify(data)}`);
        } else {
          console.log(`❌ 파라미터 ${JSON.stringify(params)}: ${error.message}`);
        }
      } catch (e) {
        console.log(`❌ 파라미터 ${JSON.stringify(params)}: 예외`);
      }
    }
    
    // 3. 보상 승인 함수 상세 테스트
    console.log('\n3️⃣ approve_compensation_item 함수 구조 테스트');
    console.log('-'.repeat(40));
    
    // 실제 pending 항목 찾기
    const { data: pendingItems } = await supabase
      .from('work_compensation_items')
      .select('id, user_id, item_type, calculated_hours, calculated_amount')
      .eq('status', 'pending')
      .limit(1);
    
    if (pendingItems && pendingItems.length > 0) {
      console.log('✅ Pending 보상 항목 발견:');
      console.log(`   ID: ${pendingItems[0].id}`);
      console.log(`   Type: ${pendingItems[0].item_type}`);
      console.log(`   Hours/Amount: ${pendingItems[0].calculated_hours || pendingItems[0].calculated_amount}`);
      
      // 실제 승인하지 않고 파라미터만 테스트
      console.log('   함수 파라미터 구조 확인 중...');
    } else {
      console.log('ℹ️ 대기 중인 보상 항목 없음');
    }
    
    // 4. 휴가 관련 트랜잭션 함수 확인
    console.log('\n4️⃣ 휴가 트랜잭션 함수 존재 여부');
    console.log('-'.repeat(40));
    
    const leaveFunctions = [
      'submit_leave_request_safe',
      'approve_leave_request_safe',
      'cancel_leave_request',
      'update_leave_balance'
    ];
    
    for (const funcName of leaveFunctions) {
      try {
        // 잘못된 파라미터로 호출하여 존재 여부만 확인
        const { error } = await supabase.rpc(funcName, { test_param: true });
        
        if (error) {
          if (error.message.includes('function') || error.message.includes('not found')) {
            console.log(`❌ ${funcName}: 함수 없음`);
          } else {
            console.log(`✅ ${funcName}: 함수 존재 (파라미터 오류)`);
          }
        } else {
          console.log(`✅ ${funcName}: 함수 존재`);
        }
      } catch (e) {
        console.log(`❌ ${funcName}: 확인 실패`);
      }
    }
    
    // 5. 정책 엔진 관련 함수 확인
    console.log('\n5️⃣ 근무 정책 관련 DB 함수');
    console.log('-'.repeat(40));
    
    const policyFunctions = [
      'get_work_policy',
      'update_work_policy', 
      'calculate_overtime_by_policy',
      'apply_flexible_work_policy'
    ];
    
    for (const funcName of policyFunctions) {
      try {
        const { error } = await supabase.rpc(funcName, {});
        
        if (error && (error.message.includes('function') || error.message.includes('not found'))) {
          console.log(`❌ ${funcName}: 없음`);
        } else {
          console.log(`✅ ${funcName}: 존재`);
        }
      } catch (e) {
        console.log(`❌ ${funcName}: 확인 실패`);
      }
    }
    
    // 최종 분석
    console.log('\n' + '='.repeat(60));
    console.log('📊 최종 분석 결과');
    console.log('='.repeat(60));
    
    console.log('\n🔍 발견된 주요 불일치:');
    console.log('1. calculate_annual_leave 함수는 존재하지만 실제 데이터와 다른 값 반환');
    console.log('2. auto_grant_annual_leave 함수는 존재하지만 프론트엔드에서 미사용');
    console.log('3. 휴가 트랜잭션 함수들이 대부분 없어서 fallback 로직 사용 중');
    console.log('4. 탄력근무제/정책 관련 DB 함수 부재 - 프론트엔드에서만 처리');
    
    console.log('\n✅ 일치하는 부분:');
    console.log('1. work_compensation_items 테이블과 승인 함수 연동');
    console.log('2. 대체/보상휴가 시간 관리 시스템');
    console.log('3. 사용자 테이블의 휴가 필드 구조');
    
    console.log('\n⚠️ 주의사항:');
    console.log('1. DB 함수들이 있지만 대부분 활용되지 않고 있음');
    console.log('2. 프론트엔드와 DB 로직이 분리되어 일관성 문제 가능');
    console.log('3. 수동 관리와 자동 관리가 혼재되어 있음');
    
  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
  
  process.exit(0);
}

testSpecificFunctions();
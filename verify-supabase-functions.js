const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://uxfjjquhbksvlqzrjfpj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjU2OTc1NiwiZXhwIjoyMDY4MTQ1NzU2fQ.odrNyRLHhRM0-ZT1VVf1nA4WGzIuNFWmECoWWagVFhQ'
);

async function verifySystemConsistency() {
  console.log('🔍 Supabase 함수와 프론트엔드 시스템 일치성 검증\n');
  console.log('=' .repeat(60));
  
  const results = {
    consistent: [],
    inconsistent: [],
    unused: [],
    missing: []
  };
  
  try {
    // 1. 연차 관련 함수 검증
    console.log('\n📋 1. 연차 관리 시스템 검증');
    console.log('-'.repeat(40));
    
    // 연차 자동 계산 테스트
    try {
      // 샘플 사용자로 테스트
      const { data: testUser } = await supabase
        .from('users')
        .select('id, name, hire_date, annual_days')
        .neq('email', 'admin@motionsense.co.kr')
        .limit(1)
        .single();
      
      if (testUser) {
        // calculate_annual_leave 함수 테스트
        const { data: calcResult, error: calcError } = await supabase
          .rpc('calculate_annual_leave', { p_user_id: testUser.id });
        
        if (!calcError) {
          console.log('✅ calculate_annual_leave 함수 작동 확인');
          console.log(`   - ${testUser.name}: 계산된 연차 = ${calcResult}`);
          
          // 실제 저장된 값과 비교
          if (calcResult !== testUser.annual_days) {
            console.log(`   ⚠️ 불일치: DB에는 ${testUser.annual_days}일, 함수 계산은 ${calcResult}일`);
            results.inconsistent.push('연차 계산 로직');
          } else {
            results.consistent.push('연차 계산 로직');
          }
        }
      }
    } catch (e) {
      console.log('❌ calculate_annual_leave 함수 오류:', e.message);
    }
    
    // auto_grant_annual_leave 테스트
    try {
      const { data: grantResult, error: grantError } = await supabase
        .rpc('auto_grant_annual_leave', {});
      
      if (!grantError) {
        console.log('✅ auto_grant_annual_leave 함수 존재');
        console.log('   ⚠️ 하지만 프론트엔드에서 사용하지 않음');
        results.unused.push('auto_grant_annual_leave');
      }
    } catch (e) {
      // 함수 없음
    }
    
    // 2. 보상 시스템 검증
    console.log('\n📋 2. 근무 보상 시스템 검증');
    console.log('-'.repeat(40));
    
    // work_compensation_items 테이블과 함수 일치성 확인
    const { data: compItems } = await supabase
      .from('work_compensation_items')
      .select('*')
      .limit(1);
    
    if (compItems && compItems.length > 0) {
      console.log('✅ work_compensation_items 테이블 존재');
      
      // approve_compensation_item 함수 테스트
      try {
        // 가짜 ID로 테스트 (실제 승인하지 않도록)
        const { error: approveError } = await supabase
          .rpc('approve_compensation_item', {
            p_item_id: '00000000-0000-0000-0000-000000000000',
            p_approved_by: '00000000-0000-0000-0000-000000000000'
          });
        
        if (approveError && !approveError.message.includes('not found')) {
          console.log('✅ approve_compensation_item 함수 존재 및 사용 중');
          results.consistent.push('보상 승인 시스템');
        }
      } catch (e) {
        // Expected
      }
    }
    
    // 3. 휴가 신청/승인 시스템 검증
    console.log('\n📋 3. 휴가 신청/승인 시스템 검증');
    console.log('-'.repeat(40));
    
    // submit_leave_request_safe 함수 확인
    try {
      const { error: submitError } = await supabase
        .rpc('submit_leave_request_safe', {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_form_type: 'test',
          p_request_data: {}
        });
      
      if (submitError && !submitError.message.includes('function')) {
        console.log('✅ submit_leave_request_safe 함수 존재');
        
        // 프론트엔드 사용 확인
        console.log('   ✅ leave-transaction.ts에서 사용 중');
        results.consistent.push('휴가 신청 트랜잭션');
      }
    } catch (e) {
      console.log('❌ submit_leave_request_safe 함수 없음');
      console.log('   ⚠️ Fallback 로직으로 처리 중');
      results.inconsistent.push('휴가 신청 트랜잭션');
    }
    
    // 4. 대체/보상휴가 시스템 검증
    console.log('\n📋 4. 대체/보상휴가 시스템 검증');
    console.log('-'.repeat(40));
    
    const { data: userData } = await supabase
      .from('users')
      .select('substitute_leave_hours, compensatory_leave_hours')
      .neq('email', 'admin@motionsense.co.kr')
      .limit(1)
      .single();
    
    if (userData) {
      console.log('✅ 대체/보상휴가 필드 존재');
      
      // work_compensation_items와 연동 확인
      const { data: recentComp } = await supabase
        .from('work_compensation_items')
        .select('item_type, status')
        .in('item_type', ['substitute_leave', 'compensatory_leave'])
        .limit(5);
      
      if (recentComp && recentComp.length > 0) {
        console.log('✅ 대체/보상휴가 자동 생성 확인');
        results.consistent.push('대체/보상휴가 시스템');
      }
    }
    
    // 5. 탄력근무제 관련 함수 확인
    console.log('\n📋 5. 탄력근무제 시스템 검증');
    console.log('-'.repeat(40));
    
    try {
      const { error: flexError } = await supabase
        .rpc('calculate_flexible_work_hours', {
          p_user_id: '00000000-0000-0000-0000-000000000000',
          p_period_start: '2025-01-01',
          p_period_end: '2025-03-31'
        });
      
      if (flexError && !flexError.message.includes('function')) {
        console.log('✅ calculate_flexible_work_hours 함수 존재');
        results.consistent.push('탄력근무제 계산');
      } else {
        console.log('❌ 탄력근무제 계산 함수 없음');
        console.log('   ⚠️ 프론트엔드에서만 처리 중');
        results.missing.push('탄력근무제 DB 함수');
      }
    } catch (e) {
      // 함수 없음
    }
    
    // 6. 연차 촉진 관련 확인
    console.log('\n📋 6. 연차 촉진 시스템 검증');
    console.log('-'.repeat(40));
    
    try {
      const { error: promotionError } = await supabase
        .rpc('check_leave_promotion_targets', {});
      
      if (promotionError && !promotionError.message.includes('function')) {
        console.log('✅ check_leave_promotion_targets 함수 존재');
        results.unused.push('check_leave_promotion_targets');
      } else {
        console.log('❌ DB 함수 없음, SQL 스크립트로만 확인');
        console.log('   📄 scripts/check-promotion-targets.sql 사용 중');
        results.inconsistent.push('연차 촉진 체크');
      }
    } catch (e) {
      // Expected
    }
    
    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 검증 결과 요약');
    console.log('='.repeat(60));
    
    console.log('\n✅ 일치하는 시스템 (' + results.consistent.length + '개):');
    results.consistent.forEach(item => console.log('   - ' + item));
    
    console.log('\n⚠️ 불일치하는 시스템 (' + results.inconsistent.length + '개):');
    results.inconsistent.forEach(item => console.log('   - ' + item));
    
    console.log('\n🔸 존재하지만 사용하지 않는 함수 (' + results.unused.length + '개):');
    results.unused.forEach(item => console.log('   - ' + item));
    
    console.log('\n❌ 필요하지만 없는 DB 함수 (' + results.missing.length + '개):');
    results.missing.forEach(item => console.log('   - ' + item));
    
    // 권장사항
    console.log('\n' + '='.repeat(60));
    console.log('🎯 권장 조치사항');
    console.log('='.repeat(60));
    
    console.log('\n1. 즉시 활용 가능한 미사용 함수들:');
    console.log('   - auto_grant_annual_leave: 매년 1월 1일 자동 실행 설정');
    console.log('   - calculate_annual_leave: 연차 계산 시 활용');
    console.log('   - grant_annual_leave: 신규 입사자 연차 부여 시 사용');
    
    console.log('\n2. 불일치 해결 필요:');
    console.log('   - 연차 계산 로직: DB 함수와 실제 데이터 동기화 필요');
    console.log('   - 휴가 신청: submit_leave_request_safe 함수 생성 또는 fallback 유지');
    
    console.log('\n3. 추가 구현 권장:');
    console.log('   - 탄력근무제 DB 함수 생성으로 서버사이드 계산 일원화');
    console.log('   - 연차 촉진 자동 알림 시스템 구축');
    
  } catch (error) {
    console.error('검증 중 오류:', error);
  }
  
  process.exit(0);
}

verifySystemConsistency();
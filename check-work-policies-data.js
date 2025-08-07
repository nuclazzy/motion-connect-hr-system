const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWorkPoliciesData() {
  console.log('=== Work Policies 데이터 확인 ===\n');

  try {
    // 1. work_policies 테이블 확인
    console.log('1. work_policies 테이블 데이터:');
    const { data: policies, error: policiesError } = await supabase
      .from('work_policies')
      .select('*')
      .order('created_at', { ascending: false });

    if (policiesError) {
      console.log('❌ work_policies 테이블 조회 오류:', policiesError.message);
    } else if (policies && policies.length > 0) {
      console.log(`✅ ${policies.length}개의 정책 발견:`);
      policies.forEach(policy => {
        console.log(`   - ${policy.policy_name} (${policy.policy_type}) - 활성: ${policy.is_active}`);
      });
    } else {
      console.log('⚠️ work_policies 테이블에 데이터가 없습니다.');
    }

    // 2. flexible_work_settings 확인
    console.log('\n2. flexible_work_settings 테이블 데이터:');
    const { data: flexSettings, error: flexError } = await supabase
      .from('flexible_work_settings')
      .select('*')
      .order('created_at', { ascending: false });

    if (flexError) {
      console.log('❌ flexible_work_settings 테이블 조회 오류:', flexError.message);
    } else if (flexSettings && flexSettings.length > 0) {
      console.log(`✅ ${flexSettings.length}개의 탄력근무제 설정 발견:`);
      flexSettings.forEach(setting => {
        console.log(`   - ${setting.period_name}: ${setting.start_date} ~ ${setting.end_date}`);
        console.log(`     주당 기준: ${setting.weekly_standard_hours}시간, 활성: ${setting.is_active}`);
      });
    } else {
      console.log('⚠️ flexible_work_settings 테이블에 데이터가 없습니다.');
    }

    // 3. 활성화된 탄력근무제 확인
    console.log('\n3. 현재 활성화된 탄력근무제 (2025-08-06 기준):');
    const { data: activeFlexible, error: activeError } = await supabase
      .from('work_policies')
      .select(`
        *,
        flexible_work_settings(*)
      `)
      .eq('policy_type', 'flexible_work')
      .eq('is_active', true);

    if (!activeError && activeFlexible && activeFlexible.length > 0) {
      console.log('✅ 활성화된 탄력근무제 정책:');
      activeFlexible.forEach(policy => {
        console.log(`   정책: ${policy.policy_name}`);
        if (policy.flexible_work_settings && policy.flexible_work_settings.length > 0) {
          policy.flexible_work_settings.forEach(setting => {
            const today = new Date('2025-08-06');
            const start = new Date(setting.start_date);
            const end = new Date(setting.end_date);
            
            if (today >= start && today <= end) {
              console.log(`   ✅ 현재 적용 중: ${setting.start_date} ~ ${setting.end_date}`);
            } else {
              console.log(`   ⚠️ 기간 외: ${setting.start_date} ~ ${setting.end_date}`);
            }
          });
        }
      });
    } else {
      console.log('❌ 활성화된 탄력근무제 정책이 없습니다.');
      console.log('   → flexible-work-utils.ts의 fallback 기본값 사용 중 (2025-06-01 ~ 2025-08-31)');
    }

    // 4. 샘플 데이터 생성 제안
    if (!policies || policies.length === 0) {
      console.log('\n=== 샘플 데이터 생성 제안 ===');
      console.log('WorkPolicyManagement 컴포넌트에서 다음 정책을 생성하세요:');
      console.log('1. 정책 이름: "2025년 2분기 탄력근무제"');
      console.log('2. 정책 타입: flexible_work');
      console.log('3. 기간: 2025-06-01 ~ 2025-08-31');
      console.log('4. 주당 기준시간: 40시간');
      console.log('5. 활성화 상태: true');
    }

  } catch (error) {
    console.error('오류 발생:', error);
  }

  console.log('\n=== 확인 완료 ===');
}

checkWorkPoliciesData();
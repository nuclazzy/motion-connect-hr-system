// 브라우저 콘솔에서 실행할 코드
// 1. 먼저 로그인한 상태에서 /admin 페이지로 이동
// 2. 브라우저 개발자 도구 콘솔을 열고 아래 코드 실행

async function checkUserTableColumns() {
  // window.supabase가 있는지 확인 (없으면 수동으로 import 필요)
  let supabase;
  
  // SupabaseProvider에서 제공하는 supabase 인스턴스 사용 시도
  if (window.supabase) {
    supabase = window.supabase;
  } else {
    // 수동으로 생성
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(
      'https://xkkoabavettyvrdrobtz.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhra29hYmF2ZXR0eXZyZHJvYnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAzMTY0MDIsImV4cCI6MjAzNTg5MjQwMn0.-_z4oxoQb4TboWrq6tAaFVVPAMapTfLPWddrNmRhBTc'
    );
  }
  
  console.log('🔍 Users 테이블 컬럼 확인 중...\n');
  
  try {
    // users 테이블에서 1개 행만 가져와서 컬럼 확인
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ 오류 발생:', error);
      return;
    }
    
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('📋 Users 테이블 전체 컬럼 목록:');
      console.log('=' .repeat(50));
      columns.forEach(col => {
        console.log(`  - ${col}`);
      });
      console.log('=' .repeat(50));
      console.log(`\n총 ${columns.length}개 컬럼\n`);
      
      // 필요한 컬럼들 체크
      const requiredColumns = [
        'resignation_processed_by',
        'resignation_processed_at', 
        'leave_settlement_days',
        'leave_settlement_hours',
        'reinstatement_processed_by',
        'reinstatement_processed_at'
      ];
      
      console.log('🔍 필요한 컬럼 존재 여부 확인:');
      console.log('-' .repeat(50));
      
      const missingColumns = [];
      requiredColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? '존재함' : '없음'}`);
        if (!exists) {
          missingColumns.push(col);
        }
      });
      
      if (missingColumns.length > 0) {
        console.log('\n⚠️  추가가 필요한 컬럼:');
        console.log('-' .repeat(50));
        missingColumns.forEach(col => {
          console.log(`  - ${col}`);
        });
        
        console.log('\n💡 Supabase SQL Editor에서 실행할 명령어:');
        console.log('=' .repeat(50));
        console.log(`
-- add-missing-columns.sql 파일의 내용을 
-- Supabase Dashboard > SQL Editor에서 실행하세요

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS resignation_processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS resignation_processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS leave_settlement_days DECIMAL(5,1),
ADD COLUMN IF NOT EXISTS leave_settlement_hours INTEGER,
ADD COLUMN IF NOT EXISTS reinstatement_processed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reinstatement_processed_at TIMESTAMP WITH TIME ZONE;
        `);
        console.log('=' .repeat(50));
      } else {
        console.log('\n✅ 모든 필요한 컬럼이 이미 존재합니다!');
      }
      
      // 기존 퇴사 관련 컬럼 확인
      console.log('\n📌 기존 퇴사 관련 컬럼:');
      console.log('-' .repeat(50));
      const resignationColumns = [
        'resignation_date',
        'termination_date',
        'is_active'
      ];
      
      resignationColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? '존재함' : '없음'}`);
      });
      
    } else {
      console.log('⚠️  users 테이블에 데이터가 없습니다.');
    }
    
  } catch (err) {
    console.error('❌ 예상치 못한 오류:', err);
  }
}

// 함수 실행
checkUserTableColumns();
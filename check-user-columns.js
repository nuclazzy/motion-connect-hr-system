const { createClient } = require('@supabase/supabase-js')

// Supabase 연결 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xkkoabavettyvrdrobtz.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhra29hYmF2ZXR0eXZyZHJvYnR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAzMTY0MDIsImV4cCI6MjAzNTg5MjQwMn0.-_z4oxoQb4TboWrq6tAaFVVPAMapTfLPWddrNmRhBTc'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUserColumns() {
  console.log('🔍 Users 테이블 컬럼 확인 중...\n')
  
  try {
    // users 테이블에서 1개 행만 가져와서 컬럼 확인
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ 오류 발생:', error)
      return
    }
    
    if (data && data.length > 0) {
      const columns = Object.keys(data[0])
      console.log('📋 Users 테이블 전체 컬럼 목록:')
      console.log('=' .repeat(50))
      columns.forEach(col => {
        console.log(`  - ${col}`)
      })
      console.log('=' .repeat(50))
      console.log(`\n총 ${columns.length}개 컬럼\n`)
      
      // 필요한 컬럼들 체크
      const requiredColumns = [
        'resignation_processed_by',
        'resignation_processed_at', 
        'leave_settlement_days',
        'leave_settlement_hours',
        'reinstatement_processed_by',
        'reinstatement_processed_at'
      ]
      
      console.log('🔍 필요한 컬럼 존재 여부 확인:')
      console.log('-' .repeat(50))
      
      const missingColumns = []
      requiredColumns.forEach(col => {
        const exists = columns.includes(col)
        console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? '존재함' : '없음'}`)
        if (!exists) {
          missingColumns.push(col)
        }
      })
      
      if (missingColumns.length > 0) {
        console.log('\n⚠️  추가가 필요한 컬럼:')
        console.log('-' .repeat(50))
        missingColumns.forEach(col => {
          console.log(`  - ${col}`)
        })
        
        console.log('\n📝 SQL 추가 명령어:')
        console.log('=' .repeat(50))
        console.log('ALTER TABLE users')
        missingColumns.forEach((col, index) => {
          let dataType = 'VARCHAR(255)'
          if (col.includes('_at')) dataType = 'TIMESTAMP WITH TIME ZONE'
          else if (col.includes('_by')) dataType = 'UUID'
          else if (col === 'leave_settlement_days') dataType = 'DECIMAL(5,1)'
          else if (col === 'leave_settlement_hours') dataType = 'INTEGER'
          
          const comma = index < missingColumns.length - 1 ? ',' : ';'
          console.log(`ADD COLUMN ${col} ${dataType}${comma}`)
        })
        console.log('=' .repeat(50))
      } else {
        console.log('\n✅ 모든 필요한 컬럼이 이미 존재합니다!')
      }
      
      // 기존 퇴사 관련 컬럼 확인
      console.log('\n📌 기존 퇴사 관련 컬럼:')
      console.log('-' .repeat(50))
      const resignationColumns = [
        'resignation_date',
        'termination_date',
        'is_active'
      ]
      
      resignationColumns.forEach(col => {
        const exists = columns.includes(col)
        console.log(`  ${exists ? '✅' : '❌'} ${col}: ${exists ? '존재함' : '없음'}`)
      })
      
    } else {
      console.log('⚠️  users 테이블에 데이터가 없습니다.')
    }
    
  } catch (err) {
    console.error('❌ 예상치 못한 오류:', err)
  }
}

// 실행
checkUserColumns()
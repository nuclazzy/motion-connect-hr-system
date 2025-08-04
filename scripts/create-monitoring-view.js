/**
 * Create monitoring view for leave data synchronization
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createMonitoringView() {
  try {
    console.log('🔧 모니터링 뷰를 생성하는 중...')
    
    const createViewSQL = `
      CREATE OR REPLACE VIEW leave_data_sync_monitor AS
      SELECT 
          u.name as username,
          u.email,
          u.id as user_id,
          ld.substitute_leave_hours as column_substitute,
          (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1) as json_substitute,
          ld.compensatory_leave_hours as column_compensatory,
          (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1) as json_compensatory,
          CASE 
              WHEN ld.substitute_leave_hours = (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1)
              AND ld.compensatory_leave_hours = (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1)
              THEN 'SYNCHRONIZED'
              ELSE 'OUT_OF_SYNC'
          END as sync_status,
          ld.updated_at as last_updated
      FROM leave_days ld
      JOIN users u ON ld.user_id = u.id
      WHERE u.role = 'user'
      ORDER BY sync_status DESC, u.name;
    `
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: createViewSQL })
    
    if (error) {
      console.error('❌ 뷰 생성 실패:', error)
      // Try alternative approach
      console.log('🔄 다른 방법으로 시도 중...')
      
      // Create a function instead of view if direct SQL execution fails
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION get_leave_sync_status()
        RETURNS TABLE(
            username TEXT,
            email TEXT,
            user_id UUID,
            column_substitute DECIMAL(4,1),
            json_substitute DECIMAL(4,1),
            column_compensatory DECIMAL(4,1),
            json_compensatory DECIMAL(4,1),
            sync_status TEXT,
            last_updated TIMESTAMPTZ
        ) AS $$
        BEGIN
            RETURN QUERY
            SELECT 
                u.name as username,
                u.email,
                u.id as user_id,
                ld.substitute_leave_hours as column_substitute,
                (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1) as json_substitute,
                ld.compensatory_leave_hours as column_compensatory,
                (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1) as json_compensatory,
                CASE 
                    WHEN ld.substitute_leave_hours = (ld.leave_types->>'substitute_leave_hours')::DECIMAL(4,1)
                    AND ld.compensatory_leave_hours = (ld.leave_types->>'compensatory_leave_hours')::DECIMAL(4,1)
                    THEN 'SYNCHRONIZED'
                    ELSE 'OUT_OF_SYNC'
                END as sync_status,
                ld.updated_at as last_updated
            FROM leave_days ld
            JOIN users u ON ld.user_id = u.id
            WHERE u.role = 'user'
            ORDER BY sync_status DESC, u.name;
        END;
        $$ LANGUAGE plpgsql;
      `
      
      const { error: funcError } = await supabase.rpc('exec_sql', { sql_query: createFunctionSQL })
      
      if (funcError) {
        console.error('❌ 함수 생성도 실패:', funcError)
        console.log('⚠️ 수동으로 뷰를 생성해야 합니다.')
      } else {
        console.log('✅ 모니터링 함수가 생성되었습니다!')
        console.log('사용법: SELECT * FROM get_leave_sync_status() WHERE sync_status = \'OUT_OF_SYNC\';')
      }
    } else {
      console.log('✅ 모니터링 뷰가 성공적으로 생성되었습니다!')
      console.log('사용법: SELECT * FROM leave_data_sync_monitor WHERE sync_status = \'OUT_OF_SYNC\';')
    }
    
  } catch (error) {
    console.error('❌ 모니터링 뷰 생성 중 오류:', error)
  }
}

createMonitoringView()
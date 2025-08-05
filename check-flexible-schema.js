import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkFlexibleWorkSchema() {
  try {
    console.log('🔍 Checking flexible work schema...')
    
    // Check if flexible_work_periods table exists
    const { data: periods, error: periodsError } = await supabase
      .from('flexible_work_periods')
      .select('id, period_name, status')
      .limit(1)
    
    if (periodsError) {
      console.log('❌ flexible_work_periods table does not exist:', periodsError.message)
      console.log('📝 Need to apply quarterly-flexible-work-schema.sql')
      return false
    } else {
      console.log('✅ flexible_work_periods table exists')
      console.log('📊 Sample data:', periods)
    }
    
    // Check other tables
    const tables = [
      'flexible_work_participants',
      'monthly_flexible_summary', 
      'quarterly_settlement_results'
    ]
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1)
      
      if (error) {
        console.log(`❌ ${table} table does not exist:`, error.message)
      } else {
        console.log(`✅ ${table} table exists`)
      }
    }
    
    return true
    
  } catch (error) {
    console.error('Error checking schema:', error)
    return false
  }
}

checkFlexibleWorkSchema()
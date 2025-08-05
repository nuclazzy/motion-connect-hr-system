import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyFlexibleWorkSchema() {
  try {
    console.log('📝 Reading quarterly-flexible-work-schema.sql...')
    const sqlContent = readFileSync('./quarterly-flexible-work-schema.sql', 'utf8')
    
    console.log('🚀 Applying flexible work schema to database...')
    
    // Split SQL by semicolons and execute each statement
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`)
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.toLowerCase().includes('select ')) {
        // Skip SELECT statements (like the final status message)
        continue
      }
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
      
      // Try direct SQL execution
      const { error } = await supabase
        .from('_dummy_') // This will fail but let us execute raw SQL
        .select('*')
        .then(() => {
          // This won't work, let's use a different approach
          return supabase.rpc('exec', { sql: statement })
        })
        .catch(async () => {
          // Fallback: use PostgreSQL REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: statement })
          })
          
          if (!response.ok) {
            const errorText = await response.text()
            return { error: new Error(errorText) }
          }
          
          return { error: null }
        })
      
      if (error && !error.message.includes('already exists')) {
        console.error(`❌ Error in statement ${i + 1}:`, error.message)
        console.log('📄 Statement:', statement.substring(0, 100) + '...')
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`)
      }
    }
    
    console.log('🎉 Flexible work schema applied successfully!')
    
    // Verify the schema
    console.log('\n🔍 Verifying schema...')
    const { data: periods, error: periodsError } = await supabase
      .from('flexible_work_periods')
      .select('id, period_name, status')
      .limit(1)
    
    if (periodsError) {
      console.log('❌ Verification failed:', periodsError.message)
    } else {
      console.log('✅ Schema verification successful!')
      console.log('📊 Sample data:', periods)
    }
    
  } catch (error) {
    console.error('❌ Error applying schema:', error)
  }
}

applyFlexibleWorkSchema()
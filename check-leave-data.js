const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function checkLeaveData() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  try {
    console.log('🔍 Checking leave data in database...')
    
    // Get all leave data with user information
    const { data, error } = await supabase
      .from('leave_days')
      .select(`
        id,
        user_id,
        leave_types,
        substitute_leave_hours,
        compensatory_leave_hours,
        users!inner(name, email, role)
      `)
      .eq('users.role', 'user')

    if (error) {
      console.error('❌ Error querying database:', error)
      return
    }

    console.log(`📊 Found ${data?.length || 0} user records`)
    console.log('')

    data?.forEach((record, index) => {
      console.log(`👤 User ${index + 1}: ${record.users.name} (${record.users.email})`)
      console.log('   💼 Leave Types (JSON field):')
      console.log('     ', JSON.stringify(record.leave_types, null, 6))
      console.log('   🔄 Separate Columns:')
      console.log('     substitute_leave_hours:', record.substitute_leave_hours)
      console.log('     compensatory_leave_hours:', record.compensatory_leave_hours)
      
      // Check if they have any substitute or compensatory hours
      const jsonSubstitute = record.leave_types?.substitute_leave_hours || 0
      const jsonCompensatory = record.leave_types?.compensatory_leave_hours || 0
      const colSubstitute = record.substitute_leave_hours || 0
      const colCompensatory = record.compensatory_leave_hours || 0
      
      const finalSubstitute = colSubstitute || jsonSubstitute
      const finalCompensatory = colCompensatory || jsonCompensatory
      
      console.log('   📝 Final Values (what UI should show):')
      console.log('     substitute_leave_hours:', finalSubstitute)
      console.log('     compensatory_leave_hours:', finalCompensatory)
      console.log('   🎯 Card Display Status:')
      console.log('     Substitute card visible:', finalSubstitute > 0 ? '✅ YES' : '❌ NO')
      console.log('     Compensatory card visible:', finalCompensatory > 0 ? '✅ YES' : '❌ NO')
      console.log('')
    })

  } catch (err) {
    console.error('❌ Script error:', err)
  }
}

checkLeaveData()
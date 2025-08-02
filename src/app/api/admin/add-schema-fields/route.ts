import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Adding missing schema fields to leave_days table')

    // Add missing columns using SQL
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add missing columns if they don't exist
        ALTER TABLE public.leave_days 
        ADD COLUMN IF NOT EXISTS substitute_leave_hours numeric DEFAULT 0;

        ALTER TABLE public.leave_days 
        ADD COLUMN IF NOT EXISTS compensatory_leave_hours numeric DEFAULT 0;
      `
    })

    if (alterError) {
      console.error('Schema alteration error:', alterError)
      // Try alternative approach using direct column addition
      const { error: subError } = await supabase
        .from('leave_days')
        .select('substitute_leave_hours')
        .limit(1)
      
      if (subError && subError.message.includes('column') && subError.message.includes('does not exist')) {
        console.log('✨ Columns need to be added manually through Supabase dashboard')
        return NextResponse.json({
          success: false,
          error: 'Schema fields need to be added manually',
          instructions: 'Please add substitute_leave_hours and compensatory_leave_hours columns to leave_days table in Supabase dashboard'
        })
      }
    }

    // Update existing records to have default values
    const { data: existingRecords, error: selectError } = await supabase
      .from('leave_days')
      .select('id, substitute_leave_hours, compensatory_leave_hours')

    if (selectError) {
      console.error('Select error:', selectError)
      return NextResponse.json({
        success: false,
        error: 'Could not check existing records',
        details: selectError.message
      })
    }

    // Update records that don't have the new fields
    for (const record of existingRecords || []) {
      const updates: any = {}
      
      if (record.substitute_leave_hours === null || record.substitute_leave_hours === undefined) {
        updates.substitute_leave_hours = 0
      }
      
      if (record.compensatory_leave_hours === null || record.compensatory_leave_hours === undefined) {
        updates.compensatory_leave_hours = 0
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('leave_days')
          .update(updates)
          .eq('id', record.id)

        if (updateError) {
          console.error(`Update error for record ${record.id}:`, updateError)
        }
      }
    }

    console.log('✅ Schema fields added and updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Schema fields added successfully',
      updated_records: existingRecords?.length || 0
    })

  } catch (error) {
    console.error('Schema update error:', error)
    return NextResponse.json({
      success: false,
      error: 'Error updating schema',
      details: (error as Error).message
    }, { status: 500 })
  }
}
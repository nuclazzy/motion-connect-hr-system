import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function createClient() {
  // Basic client for regular operations
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createServiceRoleClient() {
  try {
    // Simple service role client without cookies dependency
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    return client
  } catch (error) {
    console.error('❌ Failed to create Supabase service role client:', error)
    throw new Error(`Supabase client creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
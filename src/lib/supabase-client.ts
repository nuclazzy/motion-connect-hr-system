import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton pattern to prevent multiple instances
let supabaseInstance: SupabaseClient | null = null

// 406 에러 해결을 위한 개선된 Supabase 클라이언트
export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      },
      db: {
        schema: 'public'
      }
    })
  }
  return supabaseInstance
})()

// Database 타입은 기존 supabase.ts에서 import
export type { Database } from './supabase'
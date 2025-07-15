import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 클라이언트용 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  }
})

// Database 타입 정의
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string
          name: string
          role: 'admin' | 'user'
          employee_id: string
          work_type: string
          department: string
          position: string
          dob: string | null
          phone: string | null
          address: string | null
          hire_date: string
          termination_date: string | null
          contract_end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          password_hash: string
          name: string
          role?: 'admin' | 'user'
          employee_id: string
          work_type: string
          department: string
          position: string
          dob?: string | null
          phone?: string | null
          address?: string | null
          hire_date: string
          termination_date?: string | null
          contract_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string
          name?: string
          role?: 'admin' | 'user'
          employee_id?: string
          work_type?: string
          department?: string
          position?: string
          dob?: string | null
          phone?: string | null
          address?: string | null
          hire_date?: string
          termination_date?: string | null
          contract_end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leave_days: {
        Row: {
          id: string
          user_id: string
          leave_types: Record<string, unknown> // JSONB
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          leave_types: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          leave_types?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      form_requests: {
        Row: {
          id: string
          user_id: string
          form_type: string
          status: 'pending' | 'approved' | 'rejected'
          request_data: Record<string, unknown> | null
          submitted_at: string
          processed_at: string | null
          processed_by: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          form_type: string
          status?: 'pending' | 'approved' | 'rejected'
          request_data?: Record<string, unknown> | null
          submitted_at?: string
          processed_at?: string | null
          processed_by?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          form_type?: string
          status?: 'pending' | 'approved' | 'rejected'
          request_data?: Record<string, unknown> | null
          submitted_at?: string
          processed_at?: string | null
          processed_by?: string | null
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          name: string
          link: string
          uploaded_by: string | null
          upload_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          link: string
          uploaded_by?: string | null
          upload_date?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          link?: string
          uploaded_by?: string | null
          upload_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      meetings: {
        Row: {
          id: string
          meeting_type: 'external' | 'internal'
          title: string
          date: string
          time: string
          location: string | null
          description: string | null
          client: string | null
          participants: string | null
          created_by: string
          calendar_id: string | null
          google_event_id: string | null
          calendar_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_type: 'external' | 'internal'
          title: string
          date: string
          time: string
          location?: string | null
          description?: string | null
          client?: string | null
          participants?: string | null
          created_by: string
          calendar_id?: string | null
          google_event_id?: string | null
          calendar_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_type?: 'external' | 'internal'
          title?: string
          date?: string
          time?: string
          location?: string | null
          description?: string | null
          client?: string | null
          participants?: string | null
          created_by?: string
          calendar_id?: string | null
          google_event_id?: string | null
          calendar_link?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      leave_promotions: {
        Row: {
          id: string
          employee_id: string
          promotion_type: string
          target_year: number
          promotion_stage: 'first' | 'second' | 'hire_based'
          remaining_days: number
          promotion_date: string
          deadline: string
          status: 'pending' | 'responded' | 'completed' | 'expired'
          employee_response: Record<string, unknown>
          company_designation: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          promotion_type: string
          target_year: number
          promotion_stage: 'first' | 'second' | 'hire_based'
          remaining_days: number
          promotion_date: string
          deadline: string
          status?: 'pending' | 'responded' | 'completed' | 'expired'
          employee_response?: Record<string, unknown>
          company_designation?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          promotion_type?: string
          target_year?: number
          promotion_stage?: 'first' | 'second' | 'hire_based'
          remaining_days?: number
          promotion_date?: string
          deadline?: string
          status?: 'pending' | 'responded' | 'completed' | 'expired'
          employee_response?: Record<string, unknown>
          company_designation?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      calendar_configs: {
        Row: {
          id: string
          config_type: 'team' | 'function'
          target_name: string
          calendar_id: string
          calendar_alias: string | null
          description: string | null
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          config_type: 'team' | 'function'
          target_name: string
          calendar_id: string
          calendar_alias?: string | null
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          config_type?: 'team' | 'function'
          target_name?: string
          calendar_id?: string
          calendar_alias?: string | null
          description?: string | null
          color?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
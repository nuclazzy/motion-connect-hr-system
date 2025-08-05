// 🔄 업데이트된 Supabase 타입 정의
// Motion Connect HR 시스템 - 확장된 데이터베이스 스키마 지원

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ====================================================================
// 확장된 데이터베이스 타입 정의
// ====================================================================

export interface Database {
  public: {
    Tables: {
      // 기존 테이블들 (수정 없음)
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

      // ====================================================================
      // 출퇴근 관리 테이블들
      // ====================================================================
      
      attendance_records: {
        Row: {
          id: string
          user_id: string
          record_date: string
          record_time: string
          record_timestamp: string
          record_type: '출근' | '퇴근'
          reason: string | null
          location_lat: number | null
          location_lng: number | null
          location_accuracy: number | null
          source: string
          had_dinner: boolean
          is_manual: boolean
          approved_by: string | null
          approved_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          record_date: string
          record_time: string
          record_timestamp: string
          record_type: '출근' | '퇴근'
          reason?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_accuracy?: number | null
          source?: string
          had_dinner?: boolean
          is_manual?: boolean
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          record_date?: string
          record_time?: string
          record_timestamp?: string
          record_type?: '출근' | '퇴근'
          reason?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_accuracy?: number | null
          source?: string
          had_dinner?: boolean
          is_manual?: boolean
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      daily_work_summary: {
        Row: {
          id: string
          user_id: string
          work_date: string
          check_in_time: string | null
          check_out_time: string | null
          basic_hours: number
          overtime_hours: number
          night_hours: number
          substitute_hours: number
          compensatory_hours: number
          break_minutes: number
          work_status: string | null
          work_type: string | null
          had_dinner: boolean
          notes: string | null
          is_holiday: boolean
          flex_work_applied: boolean
          auto_calculated: boolean
          calculated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          work_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          basic_hours?: number
          overtime_hours?: number
          night_hours?: number
          substitute_hours?: number
          compensatory_hours?: number
          break_minutes?: number
          work_status?: string | null
          work_type?: string | null
          had_dinner?: boolean
          notes?: string | null
          is_holiday?: boolean
          flex_work_applied?: boolean
          auto_calculated?: boolean
          calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          work_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          basic_hours?: number
          overtime_hours?: number
          night_hours?: number
          substitute_hours?: number
          compensatory_hours?: number
          break_minutes?: number
          work_status?: string | null
          work_type?: string | null
          had_dinner?: boolean
          notes?: string | null
          is_holiday?: boolean
          flex_work_applied?: boolean
          auto_calculated?: boolean
          calculated_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      monthly_work_stats: {
        Row: {
          id: string
          user_id: string
          work_month: string
          total_work_days: number
          total_basic_hours: number
          total_overtime_hours: number
          total_night_hours: number
          total_substitute_hours: number
          total_compensatory_hours: number
          average_daily_hours: number
          standard_work_hours: number
          actual_work_hours: number
          recognized_hours: number
          dinner_count: number
          late_count: number
          early_leave_count: number
          absent_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          work_month: string
          total_work_days?: number
          total_basic_hours?: number
          total_overtime_hours?: number
          total_night_hours?: number
          total_substitute_hours?: number
          total_compensatory_hours?: number
          average_daily_hours?: number
          standard_work_hours?: number
          actual_work_hours?: number
          recognized_hours?: number
          dinner_count?: number
          late_count?: number
          early_leave_count?: number
          absent_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          work_month?: string
          total_work_days?: number
          total_basic_hours?: number
          total_overtime_hours?: number
          total_night_hours?: number
          total_substitute_hours?: number
          total_compensatory_hours?: number
          average_daily_hours?: number
          standard_work_hours?: number
          actual_work_hours?: number
          recognized_hours?: number
          dinner_count?: number
          late_count?: number
          early_leave_count?: number
          absent_count?: number
          created_at?: string
          updated_at?: string
        }
      }

      // ====================================================================
      // 캘린더 연동 테이블들 (새로 추가)
      // ====================================================================

      calendar_leave_events: {
        Row: {
          id: string
          calendar_event_id: string
          calendar_id: string
          event_title: string
          event_description: string | null
          start_date: string
          end_date: string
          all_day: boolean
          matched_user_id: string | null
          matched_user_name: string | null
          leave_type: string | null
          leave_hours: number | null
          matching_confidence: number
          is_processed: boolean
          processed_at: string | null
          sync_batch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          calendar_event_id: string
          calendar_id: string
          event_title: string
          event_description?: string | null
          start_date: string
          end_date: string
          all_day?: boolean
          matched_user_id?: string | null
          matched_user_name?: string | null
          leave_type?: string | null
          leave_hours?: number | null
          matching_confidence?: number
          is_processed?: boolean
          processed_at?: string | null
          sync_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          calendar_event_id?: string
          calendar_id?: string
          event_title?: string
          event_description?: string | null
          start_date?: string
          end_date?: string
          all_day?: boolean
          matched_user_id?: string | null
          matched_user_name?: string | null
          leave_type?: string | null
          leave_hours?: number | null
          matching_confidence?: number
          is_processed?: boolean
          processed_at?: string | null
          sync_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      calendar_sync_logs: {
        Row: {
          id: string
          sync_batch_id: string
          calendar_id: string
          calendar_type: 'leave' | 'event' | 'meeting'
          sync_start_date: string
          sync_end_date: string
          total_events: number
          matched_events: number
          created_events: number
          updated_events: number
          error_count: number
          status: 'running' | 'completed' | 'failed'
          error_message: string | null
          sync_duration_ms: number | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          sync_batch_id?: string
          calendar_id: string
          calendar_type: 'leave' | 'event' | 'meeting'
          sync_start_date: string
          sync_end_date: string
          total_events?: number
          matched_events?: number
          created_events?: number
          updated_events?: number
          error_count?: number
          status?: 'running' | 'completed' | 'failed'
          error_message?: string | null
          sync_duration_ms?: number | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          sync_batch_id?: string
          calendar_id?: string
          calendar_type?: 'leave' | 'event' | 'meeting'
          sync_start_date?: string
          sync_end_date?: string
          total_events?: number
          matched_events?: number
          created_events?: number
          updated_events?: number
          error_count?: number
          status?: 'running' | 'completed' | 'failed'
          error_message?: string | null
          sync_duration_ms?: number | null
          created_at?: string
          completed_at?: string | null
        }
      }

      employee_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          event_date: string
          event_end_date: string | null
          description: string | null
          calendar_event_id: string | null
          calendar_id: string | null
          is_from_calendar: boolean
          leave_days: number
          is_paid: boolean
          sync_batch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          event_date: string
          event_end_date?: string | null
          description?: string | null
          calendar_event_id?: string | null
          calendar_id?: string | null
          is_from_calendar?: boolean
          leave_days?: number
          is_paid?: boolean
          sync_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          event_date?: string
          event_end_date?: string | null
          description?: string | null
          calendar_event_id?: string | null
          calendar_id?: string | null
          is_from_calendar?: boolean
          leave_days?: number
          is_paid?: boolean
          sync_batch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ====================================================================
      // 기존 테이블들 (확장된 calendar_configs)
      // ====================================================================

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
          last_sync_at: string | null
          auto_sync_enabled: boolean
          sync_interval_hours: number
          sync_error_count: number
          last_error_message: string | null
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
          last_sync_at?: string | null
          auto_sync_enabled?: boolean
          sync_interval_hours?: number
          sync_error_count?: number
          last_error_message?: string | null
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
          last_sync_at?: string | null
          auto_sync_enabled?: boolean
          sync_interval_hours?: number
          sync_error_count?: number
          last_error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // 기타 기존 테이블들 (변경 없음)
      leave_days: {
        Row: {
          id: string
          user_id: string
          leave_types: {
            annual_days: number
            used_annual_days: number
            sick_days: number
            used_sick_days: number
            substitute_leave_hours: number
            compensatory_leave_hours: number
            special_days?: number
            used_special_days?: number
            maternity_days?: number
            used_maternity_days?: number
            paternity_days?: number
            used_paternity_days?: number
            family_care_days?: number
            used_family_care_days?: number
          }
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          leave_types: {
            annual_days: number
            used_annual_days: number
            sick_days: number
            used_sick_days: number
            substitute_leave_hours: number
            compensatory_leave_hours: number
            special_days?: number
            used_special_days?: number
            maternity_days?: number
            used_maternity_days?: number
            paternity_days?: number
            used_paternity_days?: number
            family_care_days?: number
            used_family_care_days?: number
          }
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          leave_types?: {
            annual_days?: number
            used_annual_days?: number
            sick_days?: number
            used_sick_days?: number
            substitute_leave_hours?: number
            compensatory_leave_hours?: number
            special_days?: number
            used_special_days?: number
            maternity_days?: number
            used_maternity_days?: number
            paternity_days?: number
            used_paternity_days?: number
            family_care_days?: number
            used_family_care_days?: number
          }
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
    }

    // ====================================================================
    // 뷰 정의
    // ====================================================================
    Views: {
      recent_attendance_view: {
        Row: {
          id: string
          user_id: string
          user_name: string
          department: string
          record_date: string
          record_time: string
          record_type: '출근' | '퇴근'
          reason: string | null
          source: string
          had_dinner: boolean
          created_at: string
        }
      }

      daily_work_status_view: {
        Row: {
          id: string
          user_id: string
          user_name: string
          department: string
          work_date: string
          check_in_time: string | null
          check_out_time: string | null
          basic_hours: number
          overtime_hours: number
          work_status: string | null
          had_dinner: boolean
          is_holiday: boolean
          attendance_status: string
        }
      }

      calendar_events_unified_view: {
        Row: {
          event_category: 'leave' | 'calendar_leave' | 'employee_event'
          employee_name: string
          department: string | null
          event_date: string
          end_date: string
          event_type: string
          hours: number | null
          source_table: string
          source_id: string
          calendar_event_id: string | null
          created_at: string
        }
      }

      calendar_sync_status: {
        Row: {
          calendar_name: string
          calendar_id: string
          last_sync_at: string | null
          sync_status: '동기화 안됨' | '동기화 필요' | '오류 발생' | '최신'
          auto_sync_enabled: boolean
          sync_interval_hours: number
          last_sync_events: number
          last_sync_errors: number
          error_message: string | null
        }
      }
    }

    // ====================================================================
    // RPC 함수 정의
    // ====================================================================
    Functions: {
      safe_upsert_caps_attendance: {
        Args: {
          p_user_id: string
          p_record_date: string
          p_record_time: string
          p_record_timestamp: string
          p_record_type: '출근' | '퇴근'
          p_reason?: string
          p_device_id?: string
        }
        Returns: Array<{
          success: boolean
          record_id: string | null
          action_taken: 'inserted' | 'updated' | 'error'
          message: string
        }>
      }

      process_calendar_leave_events: {
        Args: {
          p_sync_batch_id?: string
        }
        Returns: Array<{
          batch_id: string
          processed_count: number
          matched_count: number
          created_leave_count: number
          error_count: number
          processing_details: Record<string, unknown>
        }>
      }

      get_calendar_sync_status: {
        Args: Record<string, never>
        Returns: Array<{
          calendar_name: string
          calendar_id: string
          last_sync_at: string | null
          sync_status: '동기화 안됨' | '동기화 필요' | '오류 발생' | '최신'
          auto_sync_enabled: boolean
          sync_interval_hours: number
          last_sync_events: number
          last_sync_errors: number
          error_message: string | null
        }>
      }

      validate_database_integrity: {
        Args: Record<string, never>
        Returns: Array<{
          check_name: string
          status: '정상' | '문제있음' | '확인필요'
          issue_count: number
          details: string
        }>
      }
    }
  }
}

// ====================================================================
// 타입별 헬퍼 함수들
// ====================================================================

export type AttendanceRecord = Database['public']['Tables']['attendance_records']['Row']
export type AttendanceRecordInsert = Database['public']['Tables']['attendance_records']['Insert']
export type AttendanceRecordUpdate = Database['public']['Tables']['attendance_records']['Update']

export type CalendarLeaveEvent = Database['public']['Tables']['calendar_leave_events']['Row']
export type CalendarLeaveEventInsert = Database['public']['Tables']['calendar_leave_events']['Insert']
export type CalendarLeaveEventUpdate = Database['public']['Tables']['calendar_leave_events']['Update']

export type CalendarSyncLog = Database['public']['Tables']['calendar_sync_logs']['Row']
export type CalendarSyncLogInsert = Database['public']['Tables']['calendar_sync_logs']['Insert']
export type CalendarSyncLogUpdate = Database['public']['Tables']['calendar_sync_logs']['Update']

export type EmployeeEvent = Database['public']['Tables']['employee_events']['Row']
export type EmployeeEventInsert = Database['public']['Tables']['employee_events']['Insert']
export type EmployeeEventUpdate = Database['public']['Tables']['employee_events']['Update']

export type DailyWorkSummary = Database['public']['Tables']['daily_work_summary']['Row']
export type DailyWorkSummaryInsert = Database['public']['Tables']['daily_work_summary']['Insert']
export type DailyWorkSummaryUpdate = Database['public']['Tables']['daily_work_summary']['Update']

export type MonthlyWorkStats = Database['public']['Tables']['monthly_work_stats']['Row']
export type MonthlyWorkStatsInsert = Database['public']['Tables']['monthly_work_stats']['Insert']
export type MonthlyWorkStatsUpdate = Database['public']['Tables']['monthly_work_stats']['Update']

// RPC 함수 반환 타입들
export type CapsUploadResult = Database['public']['Functions']['safe_upsert_caps_attendance']['Returns'][0]
export type LeaveProcessingResult = Database['public']['Functions']['process_calendar_leave_events']['Returns'][0]
export type CalendarSyncStatus = Database['public']['Functions']['get_calendar_sync_status']['Returns'][0]
export type DatabaseIntegrityCheck = Database['public']['Functions']['validate_database_integrity']['Returns'][0]

// 뷰 타입들
export type RecentAttendanceView = Database['public']['Views']['recent_attendance_view']['Row']
export type DailyWorkStatusView = Database['public']['Views']['daily_work_status_view']['Row']
export type UnifiedCalendarEvent = Database['public']['Views']['calendar_events_unified_view']['Row']

// ====================================================================
// Supabase 클라이언트 생성 (타입 지정)
// ====================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// 타입 안전한 클라이언트 타입
export type TypedSupabaseClient = SupabaseClient<Database>
// 🚀 Supabase RPC 함수 통합 가이드
// Motion Connect HR 시스템 - 안전한 데이터 처리를 위한 RPC 활용

import { supabase } from '@/lib/supabase'

// ====================================================================
// 1. CAPS 업로드 안전한 처리
// ====================================================================

export interface CapsUploadRecord {
  user_id: string
  record_date: string
  record_time: string
  record_timestamp: string
  record_type: '출근' | '퇴근'
  reason?: string
  device_id?: string
}

export interface CapsUploadResult {
  success: boolean
  record_id: string | null
  action_taken: 'inserted' | 'updated' | 'error'
  message: string
}

/**
 * CAPS 데이터 안전한 업로드
 * - 기존 UPSERT 충돌 문제 해결
 * - Supabase RPC 함수 활용
 */
export async function safeCapsUpload(
  records: CapsUploadRecord[]
): Promise<{
  success: boolean
  results: CapsUploadResult[]
  summary: {
    total: number
    inserted: number
    updated: number
    errors: number
  }
}> {
  const results: CapsUploadResult[] = []
  let inserted = 0
  let updated = 0
  let errors = 0

  for (const record of records) {
    try {
      const { data, error } = await supabase.rpc('safe_upsert_caps_attendance', {
        p_user_id: record.user_id,
        p_record_date: record.record_date,
        p_record_time: record.record_time,
        p_record_timestamp: record.record_timestamp,
        p_record_type: record.record_type,
        p_reason: record.reason || null,
        p_device_id: record.device_id || null
      })

      if (error) {
        console.error('CAPS 업로드 RPC 오류:', error)
        results.push({
          success: false,
          record_id: null,
          action_taken: 'error',
          message: `RPC 호출 실패: ${error.message}`
        })
        errors++
      } else if (data && data.length > 0) {
        const result = data[0] as CapsUploadResult
        results.push(result)
        
        if (result.action_taken === 'inserted') inserted++
        else if (result.action_taken === 'updated') updated++
        else errors++
      }
    } catch (err) {
      console.error('CAPS 업로드 예외:', err)
      results.push({
        success: false,
        record_id: null,
        action_taken: 'error',
        message: `예외 발생: ${err}`
      })
      errors++
    }
  }

  return {
    success: errors === 0,
    results,
    summary: {
      total: records.length,
      inserted,
      updated,
      errors
    }
  }
}

// ====================================================================
// 2. 캘린더 휴가 이벤트 처리
// ====================================================================

export interface CalendarLeaveEvent {
  calendar_event_id: string
  calendar_id: string
  event_title: string
  event_description?: string
  start_date: string
  end_date: string
  all_day: boolean
}

export interface LeaveProcessingResult {
  batch_id: string
  processed_count: number
  matched_count: number
  created_leave_count: number
  error_count: number
  processing_details: Array<{
    event_id: string
    event_title: string
    matched_user?: string
    leave_type?: string
    leave_hours?: number
    status: 'matched' | 'no_match' | 'error'
    reason?: string
    error_message?: string
  }>
}

/**
 * 캘린더 휴가 이벤트 자동 처리
 * - 직원 이름 매칭
 * - 휴가 유형 자동 분류
 * - daily_work_summary 자동 생성
 */
export async function processCalendarLeaveEvents(
  batchId?: string
): Promise<{
  success: boolean
  result: LeaveProcessingResult | null
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('process_calendar_leave_events', {
      p_sync_batch_id: batchId || null
    })

    if (error) {
      console.error('캘린더 휴가 처리 RPC 오류:', error)
      return {
        success: false,
        result: null,
        error: error.message
      }
    }

    if (data && data.length > 0) {
      return {
        success: true,
        result: data[0] as LeaveProcessingResult
      }
    }

    return {
      success: false,
      result: null,
      error: '처리 결과 없음'
    }
  } catch (err) {
    console.error('캘린더 휴가 처리 예외:', err)
    return {
      success: false,
      result: null,
      error: `예외 발생: ${err}`
    }
  }
}

// ====================================================================
// 3. 캘린더 동기화 상태 관리
// ====================================================================

export interface CalendarSyncStatus {
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

/**
 * 캘린더 동기화 상태 조회
 */
export async function getCalendarSyncStatus(): Promise<{
  success: boolean
  statuses: CalendarSyncStatus[]
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('get_calendar_sync_status')

    if (error) {
      console.error('캘린더 동기화 상태 조회 오류:', error)
      return {
        success: false,
        statuses: [],
        error: error.message
      }
    }

    return {
      success: true,
      statuses: data as CalendarSyncStatus[]
    }
  } catch (err) {
    console.error('캘린더 동기화 상태 조회 예외:', err)
    return {
      success: false,
      statuses: [],
      error: `예외 발생: ${err}`
    }
  }
}

// ====================================================================
// 4. 데이터 정합성 검증
// ====================================================================

export interface DatabaseIntegrityCheck {
  check_name: string
  status: '정상' | '문제있음' | '확인필요'
  issue_count: number
  details: string
}

/**
 * 데이터베이스 정합성 검증
 */
export async function validateDatabaseIntegrity(): Promise<{
  success: boolean
  checks: DatabaseIntegrityCheck[]
  error?: string
}> {
  try {
    const { data, error } = await supabase.rpc('validate_database_integrity')

    if (error) {
      console.error('데이터 정합성 검증 오류:', error)
      return {
        success: false,
        checks: [],
        error: error.message
      }
    }

    return {
      success: true,
      checks: data as DatabaseIntegrityCheck[]
    }
  } catch (err) {
    console.error('데이터 정합성 검증 예외:', err)
    return {
      success: false,
      checks: [],
      error: `예외 발생: ${err}`
    }
  }
}

// ====================================================================
// 5. 통합 캘린더 이벤트 조회
// ====================================================================

export interface UnifiedCalendarEvent {
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

/**
 * 통합 캘린더 이벤트 조회
 */
export async function getUnifiedCalendarEvents(
  startDate?: string,
  endDate?: string,
  employeeName?: string
): Promise<{
  success: boolean
  events: UnifiedCalendarEvent[]
  error?: string
}> {
  try {
    let query = supabase
      .from('calendar_events_unified_view')
      .select('*')
      .order('event_date', { ascending: false })

    if (startDate) {
      query = query.gte('event_date', startDate)
    }
    
    if (endDate) {
      query = query.lte('event_date', endDate)
    }
    
    if (employeeName) {
      query = query.ilike('employee_name', `%${employeeName}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('통합 캘린더 이벤트 조회 오류:', error)
      return {
        success: false,
        events: [],
        error: error.message
      }
    }

    return {
      success: true,
      events: data as UnifiedCalendarEvent[]
    }
  } catch (err) {
    console.error('통합 캘린더 이벤트 조회 예외:', err)
    return {
      success: false,
      events: [],
      error: `예외 발생: ${err}`
    }
  }
}

// ====================================================================
// 6. Real-time 기능과의 호환성
// ====================================================================

/**
 * 출퇴근 기록 실시간 구독
 */
export function subscribeToAttendanceRecords(
  userId: string,
  onUpdate: (payload: any) => void
) {
  return supabase
    .channel('attendance-records')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'attendance_records',
        filter: `user_id=eq.${userId}`
      },
      onUpdate
    )
    .subscribe()
}

/**
 * 캘린더 동기화 상태 실시간 구독
 */
export function subscribeToCalendarSyncStatus(
  onUpdate: (payload: any) => void
) {
  return supabase
    .channel('calendar-sync')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calendar_sync_logs'
      },
      onUpdate
    )
    .subscribe()
}

// ====================================================================
// 7. 성능 최적화된 인덱스 활용
// ====================================================================

/**
 * 사용자별 최근 출퇴근 기록 조회 (인덱스 최적화)
 */
export async function getRecentAttendanceRecords(
  userId: string,
  days: number = 30
): Promise<{
  success: boolean
  records: any[]
  error?: string
}> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        id,
        record_date,
        record_time,
        record_timestamp,
        record_type,
        reason,
        source,
        had_dinner,
        is_manual,
        created_at
      `)
      .eq('user_id', userId)
      .gte('record_date', startDate.toISOString().split('T')[0])
      .order('record_timestamp', { ascending: false })

    if (error) {
      return {
        success: false,
        records: [],
        error: error.message
      }
    }

    return {
      success: true,
      records: data || []
    }
  } catch (err) {
    return {
      success: false,
      records: [],
      error: `예외 발생: ${err}`
    }
  }
}

// ====================================================================
// 사용 예시
// ====================================================================

/*
// CAPS 업로드 사용 예시
const capsRecords = [
  {
    user_id: '550e8400-e29b-41d4-a716-446655440001',
    record_date: '2025-08-05',
    record_time: '09:00:00',
    record_timestamp: '2025-08-05T09:00:00+09:00',
    record_type: '출근' as const,
    reason: '정시 출근'
  }
]

const uploadResult = await safeCapsUpload(capsRecords)
console.log('CAPS 업로드 결과:', uploadResult)

// 캘린더 휴가 처리 예시
const leaveResult = await processCalendarLeaveEvents()
console.log('휴가 처리 결과:', leaveResult)

// 동기화 상태 확인 예시
const syncStatus = await getCalendarSyncStatus()
console.log('동기화 상태:', syncStatus)

// 데이터 정합성 검증 예시
const integrityCheck = await validateDatabaseIntegrity()
console.log('정합성 검증:', integrityCheck)
*/
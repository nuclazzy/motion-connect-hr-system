/**
 * 출퇴근 기록 중복 제거 및 통합 관리 시스템
 * Critical Issue 해결: CAPS + 웹 기록 충돌 방지
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface AttendanceRecord {
  id?: string
  user_id: string
  record_date: string
  record_time: string
  record_type: '출근' | '퇴근' | '해제' | '세트'
  source: 'WEB' | 'CAPS' | 'MANUAL'
  created_at?: string
  // 확장 필드들 (선택적)
  employee_number?: string
  record_timestamp?: string
  reason?: string
  location_lat?: number
  location_lng?: number
  location_accuracy?: number
  had_dinner?: boolean
  is_manual?: boolean
  notes?: string
  [key: string]: any // 추가 확장성을 위한 인덱스 시그니처
}

export interface DeduplicationResult {
  success: boolean
  action: 'inserted' | 'duplicate_detected' | 'merged' | 'error'
  message: string
  conflicting_record?: AttendanceRecord
}

/**
 * 출퇴근 타입 정규화 (CAPS ↔ WEB 통합)
 */
export function normalizeRecordType(recordType: string, source: string): '출근' | '퇴근' {
  // CAPS 타입 → 웹 타입 매핑
  const typeMapping: { [key: string]: '출근' | '퇴근' } = {
    '출근': '출근',
    '해제': '출근',  // CAPS 해제 = 웹 출근
    '퇴근': '퇴근', 
    '세트': '퇴근'   // CAPS 세트 = 웹 퇴근
  }
  
  return typeMapping[recordType] || (recordType as '출근' | '퇴근')
}

/**
 * 동일 사용자/날짜의 기존 기록 조회 (모든 소스 통합)
 */
export async function getExistingRecords(
  supabase: SupabaseClient,
  userId: string,
  recordDate: string,
  normalizedType: '출근' | '퇴근'
): Promise<AttendanceRecord[]> {
  
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('record_date', recordDate)
    .in('record_type', 
      normalizedType === '출근' ? ['출근', '해제'] : ['퇴근', '세트']
    )
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('기존 기록 조회 오류:', error)
    return []
  }
  
  return data || []
}

/**
 * 중복 기록 감지 및 충돌 해결
 */
export async function handleDuplicateRecord(
  supabase: SupabaseClient,
  newRecord: AttendanceRecord
): Promise<DeduplicationResult> {
  
  const normalizedType = normalizeRecordType(newRecord.record_type, newRecord.source)
  const existingRecords = await getExistingRecords(
    supabase,
    newRecord.user_id,
    newRecord.record_date,
    normalizedType
  )
  
  if (existingRecords.length === 0) {
    // 중복 없음 - 정상 삽입
    return {
      success: true,
      action: 'inserted',
      message: '정상적으로 기록되었습니다'
    }
  }
  
  // 중복 기록 발견 - 우선순위 기반 처리
  const latestExisting = existingRecords[0]
  const sourcePriority = { 'CAPS': 3, 'WEB': 2, 'MANUAL': 1 }
  
  const newPriority = sourcePriority[newRecord.source] || 0
  const existingPriority = sourcePriority[latestExisting.source as keyof typeof sourcePriority] || 0
  
  if (newPriority > existingPriority) {
    // 새 기록이 우선순위 높음 - 기존 기록 업데이트
    const { error } = await supabase
      .from('attendance_records')
      .update({
        record_time: newRecord.record_time,
        record_type: normalizedType,  // 정규화된 타입 사용
        source: newRecord.source,
        updated_at: new Date().toISOString()
      })
      .eq('id', latestExisting.id)
    
    if (error) {
      return {
        success: false,
        action: 'error',
        message: '기록 업데이트 중 오류가 발생했습니다'
      }
    }
    
    return {
      success: true,
      action: 'merged',
      message: `${newRecord.source} 기록으로 업데이트되었습니다`,
      conflicting_record: latestExisting
    }
    
  } else {
    // 기존 기록이 우선순위 높음 - 중복 감지
    const timeDiff = Math.abs(
      new Date(`${newRecord.record_date}T${newRecord.record_time}`).getTime() -
      new Date(`${latestExisting.record_date}T${latestExisting.record_time}`).getTime()
    ) / 1000 / 60  // 분 단위
    
    if (timeDiff <= 5) {  // 5분 이내면 같은 기록으로 판단
      return {
        success: false,
        action: 'duplicate_detected',
        message: `이미 ${latestExisting.source}에서 기록되었습니다 (${timeDiff.toFixed(0)}분 차이)`,
        conflicting_record: latestExisting
      }
    } else {
      // 시간 차이가 크면 별도 기록으로 처리 (수정 기록 등)
      return {
        success: true,
        action: 'inserted',
        message: '시간 차이가 커서 별도 기록으로 처리되었습니다'
      }
    }
  }
}

/**
 * 출퇴근 기록 안전 삽입 (중복 검사 포함)
 */
export async function safeInsertAttendanceRecord(
  supabase: SupabaseClient,
  record: AttendanceRecord
): Promise<{ success: boolean, data?: any, deduplication: DeduplicationResult }> {
  
  try {
    // 1. 중복 검사 및 충돌 해결
    const deduplication = await handleDuplicateRecord(supabase, record)
    
    if (deduplication.action === 'duplicate_detected') {
      return {
        success: false,
        deduplication
      }
    }
    
    if (deduplication.action === 'merged') {
      return {
        success: true,
        deduplication
      }
    }
    
    // 2. 새 기록 삽입
    const { data, error } = await supabase
      .from('attendance_records')
      .insert({
        ...record,
        record_type: normalizeRecordType(record.record_type, record.source)
      })
      .select()
    
    if (error) {
      return {
        success: false,
        deduplication: {
          success: false,
          action: 'error',
          message: `기록 삽입 중 오류: ${error.message}`
        }
      }
    }
    
    return {
      success: true,
      data,
      deduplication: {
        success: true,
        action: 'inserted',
        message: '정상적으로 기록되었습니다'
      }
    }
    
  } catch (error) {
    console.error('출퇴근 기록 삽입 오류:', error)
    return {
      success: false,
      deduplication: {
        success: false,
        action: 'error',
        message: '예상치 못한 오류가 발생했습니다'
      }
    }
  }
}

/**
 * 일별 출퇴근 기록 정합성 검증
 */
export async function validateDailyRecords(
  supabase: SupabaseClient,
  userId: string,
  recordDate: string
): Promise<{
  isValid: boolean
  issues: string[]
  summary: {
    checkIn: AttendanceRecord | null
    checkOut: AttendanceRecord | null
    duplicates: AttendanceRecord[]
  }
}> {
  
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('user_id', userId)
    .eq('record_date', recordDate)
    .order('created_at', { ascending: false })
  
  if (error || !data) {
    return {
      isValid: false,
      issues: ['기록 조회 실패'],
      summary: { checkIn: null, checkOut: null, duplicates: [] }
    }
  }
  
  const issues: string[] = []
  const checkInRecords = data.filter(r => ['출근', '해제'].includes(r.record_type))
  const checkOutRecords = data.filter(r => ['퇴근', '세트'].includes(r.record_type))
  
  // 중복 기록 감지
  if (checkInRecords.length > 1) {
    issues.push(`출근 기록이 ${checkInRecords.length}개 있습니다`)
  }
  if (checkOutRecords.length > 1) {
    issues.push(`퇴근 기록이 ${checkOutRecords.length}개 있습니다`)
  }
  
  // 불완전한 기록 감지
  if (checkInRecords.length === 0) {
    issues.push('출근 기록이 없습니다')
  }
  if (checkOutRecords.length === 0) {
    issues.push('퇴근 기록이 없습니다')
  }
  
  const duplicates = [...checkInRecords.slice(1), ...checkOutRecords.slice(1)]
  
  return {
    isValid: issues.length === 0,
    issues,
    summary: {
      checkIn: checkInRecords[0] || null,
      checkOut: checkOutRecords[0] || null,
      duplicates
    }
  }
}
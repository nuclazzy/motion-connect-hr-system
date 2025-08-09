/**
 * 휴가 캘린더 동기화 유틸리티
 * Google Calendar의 "연차 및 경조사 현황" 캘린더와 동기화
 */

import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { fetchCalendarEventsFromServer } from '@/lib/googleCalendarClient'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface LeaveEvent {
  id: string
  summary: string // 이벤트 제목 (예: "홍길동 - 연차", "김철수 - 경조사")
  start: {
    date?: string // 종일 이벤트
    dateTime?: string // 시간 지정 이벤트
  }
  end: {
    date?: string
    dateTime?: string
  }
  description?: string // 설명 (사유 등)
}

interface ParsedLeaveData {
  employeeName: string
  leaveType: 'annual' | 'half_morning' | 'half_afternoon' | 'sick' | 'special' | 'other'
  startDate: string
  endDate: string
  description?: string
  isHalfDay: boolean
  googleEventId: string
}

/**
 * 이벤트 제목에서 직원 이름과 휴가 유형 파싱
 */
function parseEventTitle(title: string): { name: string; type: string } | null {
  // 생일, 재택근무 등 휴가가 아닌 이벤트 필터링
  const excludePatterns = ['생일', '재택근무', '회의', '미팅', '출장']
  if (excludePatterns.some(pattern => title.includes(pattern))) {
    return null
  }

  // 패턴: "이름 - 휴가유형" 또는 "이름 휴가유형"
  const patterns = [
    /^(.+?)\s*[-–]\s*(.+)$/,  // 이름 - 휴가유형
    /^(.+?)\s+(연차|반차|오전반차|오후반차|병가|경조사|특별휴가|보상휴가|공가|휴가)(\s*\(.+\))?$/,  // 이름 휴가유형 (세부사항)
    /^(.+?)\s+(보상휴가|공가)$/,  // 보상휴가, 공가 추가
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      // 괄호 안 내용 제거 (예: "보상휴가 (오후 반차)" -> "보상휴가")
      let type = match[2].trim()
      
      // 괄호 안에 오전/오후 정보가 있으면 추출
      const detailMatch = title.match(/\((오전|오후)\s*반차\)/)
      if (detailMatch) {
        type = `${detailMatch[1]}반차`
      }
      
      return {
        name: match[1].trim(),
        type: type
      }
    }
  }

  return null
}

/**
 * 휴가 유형 정규화
 */
function normalizeLeaveType(type: string): ParsedLeaveData['leaveType'] {
  const lowerType = type.toLowerCase()
  
  // 오전/오후 반차 먼저 체크
  if (lowerType.includes('오전') || lowerType.includes('am')) {
    return 'half_morning'
  }
  if (lowerType.includes('오후') || lowerType.includes('pm')) {
    return 'half_afternoon'
  }
  if (lowerType.includes('반차') || lowerType.includes('half')) {
    return 'half_morning' // 기본 반차는 오전반차로 처리
  }
  
  // 휴가 유형 체크
  if (lowerType.includes('병가') || lowerType.includes('sick')) {
    return 'sick'
  }
  if (lowerType.includes('경조사')) {
    return 'special'
  }
  if (lowerType.includes('특별') || lowerType.includes('공가')) {
    return 'special'
  }
  if (lowerType.includes('보상')) {
    return 'special' // 보상휴가도 특별휴가로 분류
  }
  if (lowerType.includes('연차') || lowerType.includes('annual')) {
    return 'annual'
  }
  if (lowerType === '휴가') {
    return 'annual' // 단순 '휴가'는 연차로 분류
  }
  
  return 'other'
}

/**
 * Google Calendar 이벤트를 파싱하여 휴가 데이터로 변환
 */
function parseLeaveEvent(event: LeaveEvent): ParsedLeaveData | null {
  const parsed = parseEventTitle(event.summary)
  if (!parsed) {
    // 파싱 실패한 이벤트는 조용히 건너뛰기 (생일, 재택근무 등)
    return null
  }

  const leaveType = normalizeLeaveType(parsed.type)
  const isHalfDay = ['half_morning', 'half_afternoon'].includes(leaveType)
  
  // 날짜 처리
  const startDate = event.start.date || event.start.dateTime?.split('T')[0]
  const endDate = event.end.date || event.end.dateTime?.split('T')[0]
  
  if (!startDate || !endDate) {
    console.warn(`Invalid date for event: ${event.summary}`)
    return null
  }

  // 종일 이벤트의 경우 Google Calendar는 end date를 다음날로 설정하므로 조정
  let adjustedEndDate = endDate
  if (event.end.date && !isHalfDay) {
    const end = new Date(endDate)
    end.setDate(end.getDate() - 1)
    adjustedEndDate = end.toISOString().split('T')[0]
  }

  return {
    employeeName: parsed.name,
    leaveType,
    startDate,
    endDate: adjustedEndDate,
    description: event.description || parsed.type,
    isHalfDay,
    googleEventId: event.id
  }
}

/**
 * 직원 이름으로 사용자 ID 조회 (유연한 매칭)
 */
async function getUserIdByName(supabase: any, name: string): Promise<string | null> {
  try {
    // 먼저 정확한 이름으로 검색
    let { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('name', name)
      .maybeSingle()
    
    // 정확한 매칭이 없으면 부분 매칭 시도
    if (!data) {
      const result = await supabase
        .from('users')
        .select('id, name')
        .ilike('name', `%${name}%`)
        .limit(1)
      
      data = result.data?.[0] || null
      error = result.error
    }
    
    if (error || !data) {
      console.warn(`User not found: ${name}`)
      return null
    }
    
    console.log(`Found user: ${data.name} (ID: ${data.id})`)
    return data.id
  } catch (error) {
    console.error(`Error fetching user ${name}:`, error)
    return null
  }
}

/**
 * 휴가 데이터를 데이터베이스에 저장
 */
async function saveLeaveData(
  supabase: any,
  leaveData: ParsedLeaveData,
  userId: string
): Promise<boolean> {
  try {
    // 중복 체크 (Google Event ID 기준)
    if (leaveData.googleEventId) {
      const { data: existing } = await supabase
        .from('leave_records')
        .select('id')
        .eq('google_event_id', leaveData.googleEventId)
        .maybeSingle()

      if (existing) {
        console.log(`Leave record already exists for event: ${leaveData.googleEventId}`)
        // 기존 레코드 업데이트
        const { error } = await supabase
          .from('leave_records')
          .update({
            leave_type: leaveData.leaveType,
            start_date: leaveData.startDate,
            end_date: leaveData.endDate,
            reason: leaveData.description,
            synced_at: new Date().toISOString()
          })
          .eq('id', existing.id)
        
        if (error) {
          console.error(`Failed to update leave record:`, error)
          return false
        }
        return true
      }
    }

    // 휴가 일수 계산
    const start = new Date(leaveData.startDate)
    const end = new Date(leaveData.endDate)
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const leaveDays = leaveData.isHalfDay ? 0.5 : daysDiff

    // 휴가 기록 저장 (insert or update)
    const { error } = await supabase
      .from('leave_records')
      .insert({
        user_id: userId,
        leave_type: leaveData.leaveType,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        reason: leaveData.description,
        days_requested: leaveDays,
        status: 'approved', // 캘린더에 있는 것은 이미 승인된 것으로 간주
        google_event_id: leaveData.googleEventId || null,
        synced_at: new Date().toISOString()
      })

    if (error) {
      // 중복 키 오류는 무시
      if (error.code === '23505') {
        console.log(`Duplicate leave record skipped for ${leaveData.employeeName}`)
        return true
      }
      console.error(`Failed to save leave record:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`Error saving leave data:`, error)
    return false
  }
}

/**
 * Google Calendar에서 휴가 데이터 동기화
 */
export async function syncLeaveCalendar(
  year?: number
): Promise<{
  success: boolean
  message: string
  syncedCount?: number
  errors?: string[]
}> {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // 기간 설정 (기본: 현재 연도)
    const targetYear = year || new Date().getFullYear()
    const timeMin = `${targetYear}-01-01T00:00:00+09:00`
    const timeMax = `${targetYear}-12-31T23:59:59+09:00`
    
    console.log(`🔄 Syncing leave calendar for year ${targetYear}...`)
    
    // Google Calendar에서 이벤트 가져오기
    const events = await fetchCalendarEventsFromServer(
      CALENDAR_IDS.LEAVE_MANAGEMENT,
      timeMin,
      timeMax
    )
    
    if (!events || events.length === 0) {
      return {
        success: true,
        message: `${targetYear}년도 휴가 데이터가 없습니다.`,
        syncedCount: 0
      }
    }
    
    console.log(`📅 Found ${events.length} leave events`)
    
    // 이벤트 처리
    let syncedCount = 0
    const errors: string[] = []
    
    for (const event of events) {
      try {
        // 이벤트 파싱
        const leaveData = parseLeaveEvent(event)
        if (!leaveData) {
          // 휴가가 아닌 이벤트는 조용히 건너뛰기
          continue
        }
        
        // 사용자 ID 조회
        const userId = await getUserIdByName(supabase, leaveData.employeeName)
        if (!userId) {
          errors.push(`User not found: ${leaveData.employeeName}`)
          continue
        }
        
        // 데이터 저장
        const saved = await saveLeaveData(supabase, leaveData, userId)
        if (saved) {
          syncedCount++
        }
      } catch (error) {
        console.error(`Error processing event ${event.summary}:`, error)
        errors.push(`Error processing: ${event.summary}`)
      }
    }
    
    return {
      success: true,
      message: `${targetYear}년 휴가 데이터 동기화 완료: ${syncedCount}건 추가`,
      syncedCount,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    console.error('Leave calendar sync error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '휴가 캘린더 동기화 실패',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * 여러 연도의 휴가 데이터 동기화
 */
export async function syncMultipleYears(
  years: number[]
): Promise<{
  success: boolean
  message: string
  details: { [year: number]: { syncedCount: number; errors?: string[] } }
}> {
  const details: { [year: number]: { syncedCount: number; errors?: string[] } } = {}
  let totalSynced = 0
  
  for (const year of years) {
    const result = await syncLeaveCalendar(year)
    details[year] = {
      syncedCount: result.syncedCount || 0,
      errors: result.errors
    }
    totalSynced += result.syncedCount || 0
  }
  
  return {
    success: true,
    message: `총 ${totalSynced}건의 휴가 데이터가 동기화되었습니다.`,
    details
  }
}
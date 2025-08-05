'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { googleCalendarService } from '@/lib/googleCalendar'

interface CalendarLeaveEvent {
  calendar_event_id: string
  calendar_id: string
  event_title: string
  event_description?: string
  start_date: string
  end_date: string
  all_day: boolean
  matched_user_id?: string
  matched_user_name?: string
  leave_type?: string
  leave_hours?: number
  matching_confidence?: number
}

// 새로운 고도화된 연차 캘린더 동기화 함수
export async function syncLeaveCalendarWithMatching(
  calendarId: string = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
  startDate?: string,
  endDate?: string
) {
  console.log('🔄 고도화된 연차 캘린더 동기화 시작')
  console.log('📅 캘린더 ID:', calendarId)
  
  const supabase = await createServiceRoleClient()
  
  try {
    // 1. Google Calendar에서 이벤트 가져오기
    const now = new Date()
    const defaultStartDate = startDate || new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0]
    const defaultEndDate = endDate || new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString().split('T')[0]
    
    console.log('📆 동기화 기간:', defaultStartDate, '~', defaultEndDate)
    
    const startDateISO = new Date(defaultStartDate).toISOString()
    const endDateISO = new Date(defaultEndDate + 'T23:59:59').toISOString()
    const events = await googleCalendarService.getEventsFromCalendar(calendarId, 250, startDateISO, endDateISO)
    
    console.log('📊 가져온 이벤트 수:', events?.length || 0)
    
    if (!events || events.length === 0) {
      return {
        success: true,
        message: '동기화할 이벤트가 없습니다.',
        results: {
          totalEvents: 0,
          matchedEvents: 0,
          processedEvents: 0,
          errors: 0
        }
      }
    }
    
    // 2. 연차/휴가 관련 이벤트만 필터링
    const leaveEvents = events.filter(event => {
      const title = event.title || ''
      const description = event.description || ''
      const combinedText = (title + ' ' + description).toLowerCase()
      
      return (
        combinedText.includes('연차') ||
        combinedText.includes('휴가') ||
        combinedText.includes('반차') ||
        combinedText.includes('시간차') ||
        combinedText.includes('병가') ||
        combinedText.includes('경조사') ||
        combinedText.includes('leave') ||
        combinedText.includes('vacation')
      )
    })
    
    console.log('🏖️ 연차/휴가 관련 이벤트:', leaveEvents.length, '개')
    
    // 3. calendar_leave_events 테이블에 저장
    const calendarLeaveEvents: CalendarLeaveEvent[] = leaveEvents.map(event => ({
      calendar_event_id: event.id || '',
      calendar_id: calendarId,
      event_title: event.title || '',
      event_description: event.description || '',
      start_date: event.start || '',
      end_date: event.end || '',
      all_day: true // 기본값으로 설정
    }))
    
    // 4. 데이터베이스에 저장 (UPSERT)
    let insertedCount = 0
    let errors: string[] = []
    
    for (const leaveEvent of calendarLeaveEvents) {
      try {
        const { error } = await supabase
          .from('calendar_leave_events')
          .upsert(leaveEvent, { 
            onConflict: 'calendar_event_id',
            ignoreDuplicates: false 
          })
        
        if (error) {
          console.error('❌ 이벤트 저장 실패:', error)
          errors.push(`${leaveEvent.event_title}: ${error.message}`)
        } else {
          insertedCount++
          console.log('✅ 이벤트 저장 성공:', leaveEvent.event_title)
        }
      } catch (err) {
        console.error('❌ 예외 발생:', err)
        errors.push(`${leaveEvent.event_title}: ${err}`)
      }
    }
    
    // 5. 저장된 이벤트들 자동 처리 (매칭 및 근무시간 연동)
    console.log('🔍 저장된 이벤트 자동 처리 시작...')
    
    const { data: processResult, error: processError } = await supabase
      .rpc('process_calendar_leave_events')
    
    if (processError) {
      console.error('❌ 이벤트 처리 실패:', processError)
      return {
        success: false,
        error: `이벤트 처리 실패: ${processError.message}`,
        results: {
          totalEvents: leaveEvents.length,
          savedEvents: insertedCount,
          errors: errors.length,
          errorDetails: errors
        }
      }
    }
    
    const result = processResult?.[0] || { 
      processed_count: 0, 
      matched_count: 0, 
      created_leave_count: 0, 
      error_count: 0 
    }
    
    console.log('✅ 처리 결과:', result)
    
    // 6. 동기화 로그 기록
    await supabase
      .from('calendar_sync_logs')
      .insert({
        calendar_id: calendarId,
        calendar_type: 'leave',
        sync_start_date: defaultStartDate,
        sync_end_date: defaultEndDate,
        total_events: leaveEvents.length,
        matched_events: result.matched_count,
        created_events: result.created_leave_count,
        error_count: result.error_count + errors.length,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
    
    return {
      success: true,
      message: `연차 캘린더 동기화 완료! 총 ${leaveEvents.length}개 이벤트 중 ${result.matched_count}개 매칭 성공`,
      results: {
        totalEvents: leaveEvents.length,
        savedEvents: insertedCount,
        processedEvents: result.processed_count,
        matchedEvents: result.matched_count,
        createdLeaveRecords: result.created_leave_count,
        errors: result.error_count + errors.length,
        errorDetails: errors
      }
    }
    
  } catch (error) {
    console.error('❌ 연차 캘린더 동기화 실패:', error)
    
    // 실패 로그 기록
    await supabase
      .from('calendar_sync_logs')
      .insert({
        calendar_id: calendarId,
        calendar_type: 'leave',
        sync_start_date: startDate || new Date().toISOString().split('T')[0],
        sync_end_date: endDate || new Date().toISOString().split('T')[0],
        total_events: 0,
        matched_events: 0,
        created_events: 0,
        error_count: 1,
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString()
      })
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
      results: {
        totalEvents: 0,
        errors: 1,
        errorDetails: [error instanceof Error ? error.message : String(error)]
      }
    }
  }
}

// 매칭 결과 조회 함수
export async function getLeaveMatchingResults(limit: number = 50) {
  const supabase = await createServiceRoleClient()
  
  const { data, error } = await supabase
    .from('calendar_leave_matching_view')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('❌ 매칭 결과 조회 실패:', error)
    throw error
  }
  
  return data || []
}

// 수동 매칭 함수 (관리자가 직접 매칭할 때 사용)
export async function manualMatchLeaveEvent(
  eventId: string, 
  userId: string, 
  leaveType: string,
  leaveHours: number
) {
  const supabase = await createServiceRoleClient()
  
  try {
    // 1. calendar_leave_events 테이블 업데이트
    const { error: updateError } = await supabase
      .from('calendar_leave_events')
      .update({
        matched_user_id: userId,
        leave_type: leaveType,
        leave_hours: leaveHours,
        matching_confidence: 1.0, // 수동 매칭은 100% 신뢰도
        is_processed: true,
        processed_at: new Date().toISOString()
      })
      .eq('id', eventId)
    
    if (updateError) {
      throw updateError
    }
    
    // 2. 해당 이벤트만 다시 처리
    const { data: processResult, error: processError } = await supabase
      .rpc('process_calendar_leave_events')
    
    if (processError) {
      throw processError
    }
    
    return {
      success: true,
      message: '수동 매칭이 완료되었습니다.',
      result: processResult?.[0]
    }
    
  } catch (error) {
    console.error('❌ 수동 매칭 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '수동 매칭 실패'
    }
  }
}

// 전체 자동 동기화 함수 (스케줄러에서 호출)
export async function autoSyncAllLeaveCalendars() {
  console.log('🔄 전체 연차 캘린더 자동 동기화 시작')
  
  const supabase = await createServiceRoleClient()
  
  // 활성화된 연차 캘린더 설정 조회
  const { data: calendarsToSync, error: configError } = await supabase
    .from('calendar_configs')
    .select('*')
    .eq('config_type', 'function')
    .eq('is_active', true)
    .eq('auto_sync_enabled', true)
    .or('target_name.ilike.%연차%,target_name.ilike.%leave%,calendar_alias.ilike.%연차%')
  
  if (configError) {
    console.error('❌ 캘린더 설정 조회 실패:', configError)
    return {
      success: false,
      error: '캘린더 설정 조회 실패',
      results: {}
    }
  }
  
  if (!calendarsToSync || calendarsToSync.length === 0) {
    return {
      success: true,
      message: '자동 동기화가 활성화된 연차 캘린더가 없습니다.',
      results: {
        syncedCalendars: 0
      }
    }
  }
  
  const results = []
  
  for (const calendar of calendarsToSync) {
    try {
      console.log('🔄 캘린더 동기화:', calendar.target_name)
      
      const result = await syncLeaveCalendarWithMatching(calendar.calendar_id)
      results.push({
        calendarName: calendar.target_name,
        calendarId: calendar.calendar_id,
        ...result
      })
      
      // 마지막 동기화 시간 업데이트
      await supabase
        .from('calendar_configs')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', calendar.id)
        
    } catch (error) {
      console.error(`❌ ${calendar.target_name} 동기화 실패:`, error)
      results.push({
        calendarName: calendar.target_name,
        calendarId: calendar.calendar_id,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  
  return {
    success: true,
    message: `${calendarsToSync.length}개 캘린더 동기화 완료`,
    results: {
      syncedCalendars: calendarsToSync.length,
      totalEvents: results.reduce((sum, r) => sum + ((r as any).results?.totalEvents || 0), 0),
      totalMatched: results.reduce((sum, r) => sum + ((r as any).results?.matchedEvents || 0), 0),
      errors: results.reduce((sum, r) => sum + ((r as any).results?.errors || 0), 0),
      details: results
    }
  }
}
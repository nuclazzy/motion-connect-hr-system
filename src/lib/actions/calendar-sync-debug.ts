'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { googleCalendarService } from '@/lib/googleCalendar'

interface CalendarDebugResult {
  step: string
  success: boolean
  data?: any
  error?: string
  message: string
}

// 연차 캘린더 동기화 문제 진단 함수
export async function debugCalendarSyncIssue(
  calendarId: string = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
): Promise<CalendarDebugResult[]> {
  const results: CalendarDebugResult[] = []
  const supabase = await createServiceRoleClient()
  
  // 1단계: Supabase 연결 테스트
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1)
    
    results.push({
      step: '1. Supabase 연결',
      success: !error,
      data: data,
      message: error ? `Supabase 연결 실패: ${error.message}` : 'Supabase 연결 성공'
    })
  } catch (error) {
    results.push({
      step: '1. Supabase 연결',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Supabase 연결 중 예외 발생'
    })
  }
  
  // 2단계: 캘린더 설정 확인
  try {
    const { data: calendarConfigs, error } = await supabase
      .from('calendar_configs')
      .select('*')
      .eq('calendar_id', calendarId)
    
    results.push({
      step: '2. 캘린더 설정',
      success: !error && calendarConfigs && calendarConfigs.length > 0,
      data: calendarConfigs,
      message: error 
        ? `캘린더 설정 조회 실패: ${error.message}`
        : calendarConfigs && calendarConfigs.length > 0
        ? `캘린더 설정 발견: ${calendarConfigs.length}개`
        : '캘린더 설정이 없습니다'
    })
  } catch (error) {
    results.push({
      step: '2. 캘린더 설정',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: '캘린더 설정 확인 중 예외 발생'
    })
  }
  
  // 3단계: Google Calendar API 테스트
  try {
    console.log('🔍 Google Calendar API 테스트 시작...')
    
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()
    
    const events = await googleCalendarService.getEventsFromCalendar(calendarId, 50, startDate, endDate)
    
    console.log('📊 Google Calendar 응답:', events?.length || 0, '개 이벤트')
    
    // 연차/휴가 관련 이벤트만 필터링해서 확인
    const leaveEvents = events?.filter(event => {
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
    }) || []
    
    results.push({
      step: '3. Google Calendar API',
      success: true,
      data: {
        totalEvents: events?.length || 0,
        leaveEvents: leaveEvents.length,
        sampleEvents: leaveEvents.slice(0, 5).map(event => ({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end
        }))
      },
      message: `Google Calendar 접근 성공: 전체 ${events?.length || 0}개, 연차관련 ${leaveEvents.length}개`
    })
    
  } catch (error) {
    console.error('❌ Google Calendar API 오류:', error)
    results.push({
      step: '3. Google Calendar API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Google Calendar API 접근 실패'
    })
  }
  
  // 4단계: 직원 목록 확인
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select('id, name, department, role')
      .eq('role', 'employee')
      .order('name')
    
    results.push({
      step: '4. 직원 목록',
      success: !error,
      data: {
        totalEmployees: employees?.length || 0,
        employees: employees?.slice(0, 10) || []
      },
      message: error 
        ? `직원 목록 조회 실패: ${error.message}`
        : `직원 ${employees?.length || 0}명 확인`
    })
  } catch (error) {
    results.push({
      step: '4. 직원 목록',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: '직원 목록 확인 중 예외 발생'
    })
  }
  
  // 5단계: 기존 캘린더 이벤트 데이터 확인
  try {
    const { data: existingEvents, error } = await supabase
      .from('calendar_leave_events')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('created_at', { ascending: false })
      .limit(10)
    
    results.push({
      step: '5. 기존 캘린더 이벤트',
      success: !error,
      data: {
        totalSavedEvents: existingEvents?.length || 0,
        recentEvents: existingEvents || []
      },
      message: error 
        ? `기존 이벤트 조회 실패: ${error.message}`
        : `저장된 이벤트 ${existingEvents?.length || 0}개 확인`
    })
  } catch (error) {
    results.push({
      step: '5. 기존 캘린더 이벤트',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: '기존 이벤트 확인 중 예외 발생'
    })
  }
  
  // 6단계: 동기화 로그 확인
  try {
    const { data: syncLogs, error } = await supabase
      .from('calendar_sync_logs')
      .select('*')
      .eq('calendar_id', calendarId)
      .order('created_at', { ascending: false })
      .limit(5)
    
    results.push({
      step: '6. 동기화 로그',
      success: !error,
      data: syncLogs || [],
      message: error 
        ? `동기화 로그 조회 실패: ${error.message}`
        : `동기화 로그 ${syncLogs?.length || 0}개 확인`
    })
  } catch (error) {
    results.push({
      step: '6. 동기화 로그',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: '동기화 로그 확인 중 예외 발생'
    })
  }
  
  return results
}

// 테스트용 간단한 캘린더 동기화 함수
export async function testCalendarSync(
  calendarId: string = 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com'
) {
  console.log('🧪 테스트 동기화 시작...')
  
  try {
    const debugResults = await debugCalendarSyncIssue(calendarId)
    
    // 모든 단계가 성공했는지 확인
    const allSuccess = debugResults.every(result => result.success)
    
    if (allSuccess) {
      console.log('✅ 모든 진단 단계 성공 - 실제 동기화 시도')
      
      // 실제 동기화 시도 (간단한 버전)
      const supabase = await createServiceRoleClient()
      
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
      const events = await googleCalendarService.getEventsFromCalendar(calendarId, 10, startDate, endDate)
      
      return {
        success: true,
        message: '테스트 동기화 성공',
        debugResults,
        testSyncResult: {
          eventsFound: events?.length || 0,
          sampleEvents: events?.slice(0, 3).map(e => e.title) || []
        }
      }
    } else {
      const failedSteps = debugResults.filter(r => !r.success)
      return {
        success: false,
        message: `진단 실패: ${failedSteps.map(s => s.step).join(', ')}`,
        debugResults,
        failedSteps
      }
    }
    
  } catch (error) {
    console.error('❌ 테스트 동기화 실패:', error)
    return {
      success: false,
      message: '테스트 동기화 중 오류 발생',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
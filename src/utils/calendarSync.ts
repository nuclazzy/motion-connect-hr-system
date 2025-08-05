// 간단한 캘린더 및 공휴일 연동 유틸리티

import { supabase } from '@/lib/supabase'

// 개별 직원 휴가 추가
export async function addLeaveToEmployee(
  userName: string,
  leaveDate: string,
  leaveType: string,
  hours: number = 8.0
) {
  const { data, error } = await supabase.rpc('add_leave_to_daily_summary', {
    p_user_name: userName,
    p_leave_date: leaveDate,
    p_leave_type: leaveType,
    p_hours: hours
  })

  if (error) {
    console.error('휴가 추가 오류:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data?.[0] }
}

// 공휴일 전체 직원 일괄 적용
export async function addHolidayForAllUsers(
  holidayDate: string,
  holidayName: string = '공휴일'
) {
  const { data, error } = await supabase.rpc('add_holiday_for_all_users', {
    p_holiday_date: holidayDate,
    p_holiday_name: holidayName
  })

  if (error) {
    console.error('공휴일 적용 오류:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data?.[0] }
}

// Google Calendar에서 휴가 데이터 파싱 후 적용
export async function syncGoogleCalendarLeave(calendarEvents: any[]) {
  const results = []
  
  for (const event of calendarEvents) {
    // 이벤트 제목에서 직원 이름 추출
    const userName = extractUserNameFromTitle(event.summary || event.title)
    if (!userName) continue

    // 휴가 유형 결정
    const leaveType = determineLeaveType(event.summary || event.title)
    const hours = calculateLeaveHours(event.summary || event.title, event.start?.date, event.end?.date)

    // 날짜 범위 처리
    const startDate = new Date(event.start?.date || event.start?.dateTime)
    const endDate = new Date(event.end?.date || event.end?.dateTime)
    
    // 하루 전으로 조정 (Google Calendar end date는 다음날)
    if (event.start?.date) {
      endDate.setDate(endDate.getDate() - 1)
    }

    // 날짜별로 휴가 적용
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      // 주말 제외
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        const result = await addLeaveToEmployee(
          userName,
          currentDate.toISOString().split('T')[0],
          leaveType,
          hours
        )
        results.push(result)
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }
  }

  return results
}

// 네이버 공휴일 API 데이터 적용
export async function syncNaverHolidays(year: number, month: number) {
  try {
    // 네이버 공휴일 API 호출
    const response = await fetch(`/api/holidays/naver?year=${year}`)
    const data = await response.json()

    if (!data.success || !data.holidays) {
      throw new Error('공휴일 데이터를 가져올 수 없습니다')
    }

    const results = []
    // data.holidays는 객체 형태: { "2025-01-01": "신정", "2025-03-01": "삼일절" }
    for (const [dateStr, holidayName] of Object.entries(data.holidays)) {
      // 해당 월의 공휴일만 필터링
      const holidayDate = new Date(dateStr)
      if (holidayDate.getMonth() + 1 === month) {
        const result = await addHolidayForAllUsers(dateStr, String(holidayName))
        results.push(result)
      }
    }

    return { success: true, holidayResults: results }
  } catch (error) {
    console.error('네이버 공휴일 동기화 오류:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

// 이벤트 제목에서 직원 이름 추출
function extractUserNameFromTitle(title: string): string | null {
  // "김철수 연차", "이영희 반차" 등의 패턴에서 이름 추출
  const nameMatch = title.match(/^([가-힣]{2,4})\s/)
  if (nameMatch) {
    return nameMatch[1]
  }

  // "연차: 김철수" 등의 패턴
  const nameMatch2 = title.match(/:\s*([가-힣]{2,4})/)
  if (nameMatch2) {
    return nameMatch2[1]
  }

  return null
}

// 휴가 유형 결정
function determineLeaveType(title: string): string {
  const lowerTitle = title.toLowerCase()
  
  if (lowerTitle.includes('반차')) {
    if (lowerTitle.includes('오전')) return '오전 반차'
    if (lowerTitle.includes('오후')) return '오후 반차'
    return '반차'
  }
  
  if (lowerTitle.includes('시간차') || lowerTitle.includes('1시간')) return '시간차'
  if (lowerTitle.includes('병가')) return '병가'
  if (lowerTitle.includes('경조') || lowerTitle.includes('결혼') || lowerTitle.includes('장례')) return '경조사'
  if (lowerTitle.includes('출산') || lowerTitle.includes('육아')) return '출산/육아'
  
  return '연차'
}

// 휴가 시간 계산
function calculateLeaveHours(title: string, startDate?: string, endDate?: string): number {
  const leaveType = determineLeaveType(title)
  
  if (leaveType.includes('반차')) return 4.0
  if (leaveType === '시간차') return 1.0
  
  // 연차나 경조사의 경우 날짜 범위 계산
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return days > 1 ? days * 8.0 : 8.0
  }
  
  return 8.0
}

// 월별 휴가 및 공휴일 자동 동기화
export async function autoSyncMonthlyData(year: number, month: number) {
  console.log(`${year}년 ${month}월 자동 동기화 시작`)
  
  try {
    // 1. 네이버 공휴일 동기화
    const holidayResults = await syncNaverHolidays(year, month)
    
    // 2. Google Calendar 휴가 동기화 (필요한 경우)
    // const calendarResults = await syncGoogleCalendarLeave(calendarEvents)
    
    return {
      success: true,
      holidayResults,
      message: `${year}년 ${month}월 데이터 동기화 완료`
    }
  } catch (error) {
    console.error('월별 동기화 오류:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
/**
 * 공휴일 API 직접 연동 유틸리티
 * 한국 공공데이터포털 API만 사용
 */

// 한국 공공데이터포털 API 설정 (Supabase Edge Function 활용)
const SUPABASE_URL = 'https://uxfjjquhbksvlqzrjfpj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Njk3NTYsImV4cCI6MjA2ODE0NTc1Nn0.6AcbiyzXHczbCF2Mv3lt5Qck7FQ_Gf4i6eMqiLAmDWA'

// 공휴일 데이터 캐시
let holidayCache: { [key: string]: string } = {}
let lastCacheUpdate: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24시간


/**
 * 캐시 초기화 함수
 */
export const initializeHolidayCache = async (year?: number) => {
  const currentYear = year || new Date().getFullYear()
  await updateHolidayCache(currentYear)
  // 내년 데이터도 미리 로드
  if (!year) {
    await updateHolidayCache(currentYear + 1)
  }
}

/**
 * 공공데이터포털 API를 통해 공휴일 정보 가져오기 (Supabase Edge Function 사용)
 */
export const fetchHolidaysFromAPI = async (year: number): Promise<{ [key: string]: string }> => {
  try {
    console.log(`📅 Fetching holidays for ${year} from 공공데이터포털 API...`)
    
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/swift-service?year=${year}`
    console.log(`📅 Calling Edge Function: ${edgeFunctionUrl}`)
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    }
    
    if (SUPABASE_ANON_KEY) {
      headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`
    }
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'GET',
      headers
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log(`📅 Fetched ${Object.keys(data.holidays || {}).length} holidays for ${year} via Edge Function`)
      return data.holidays || {}
    } else {
      const errorText = await response.text()
      throw new Error(`Edge Function failed with status ${response.status}: ${errorText}`)
    }
    
  } catch (error) {
    console.error('공공데이터포털 API 공휴일 조회 오류:', error)
    throw error // 오류를 상위로 전달
  }
}



/**
 * 공휴일 캐시 업데이트
 */
export const updateHolidayCache = async (year: number) => {
  const now = Date.now()
  const yearCacheKey = `holidays_cache_${year}`
  
  // localStorage 캐시 확인
  const cachedData = localStorage.getItem(yearCacheKey)
  if (cachedData) {
    const parsed = JSON.parse(cachedData)
    if (now - parsed.timestamp < CACHE_DURATION) {
      holidayCache = { ...holidayCache, ...parsed.holidays }
      console.log(`📅 Using cached holiday data for ${year}`)
      return
    }
  }
  
  try {
    // 공공데이터포털 API 호출
    const holidays = await fetchHolidaysFromAPI(year)
    
    // 캐시 업데이트
    holidayCache = { ...holidayCache, ...holidays }
    lastCacheUpdate = now
    
    // localStorage에 저장
    localStorage.setItem(yearCacheKey, JSON.stringify({
      holidays,
      timestamp: now
    }))
    
    console.log(`📅 Successfully cached ${Object.keys(holidays).length} holidays for ${year}`)
  } catch (error) {
    console.error(`❌ Failed to update holiday cache for ${year}:`, error)
    throw error // 오류를 상위로 전달
  }
}

/**
 * 공휴일 체크 함수
 */
export const isHoliday = async (dateString: string): Promise<string | undefined> => {
  const year = parseInt(dateString.split('-')[0])
  await updateHolidayCache(year)
  return holidayCache[dateString]
}

/**
 * 동기 버전 (캐시된 데이터만 사용)
 */
export const isHolidaySync = (dateString: string): string | undefined => {
  return holidayCache[dateString]
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환 (타임존 문제 해결)
 */
export const formatDateForHoliday = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 공휴일인지 확인하고 공휴일 이름 반환 (비동기)
 */
export const getHolidayInfo = async (date: Date) => {
  const dateString = formatDateForHoliday(date)
  const holidayName = await isHoliday(dateString)
  
  return {
    isHoliday: !!holidayName,
    name: holidayName
  }
}

/**
 * 공휴일인지 확인하고 공휴일 이름 반환 (동기 - 캐시된 데이터만 사용)
 */
export const getHolidayInfoSync = (date: Date) => {
  const dateString = formatDateForHoliday(date)
  const holidayName = isHolidaySync(dateString)
  
  return {
    isHoliday: !!holidayName,
    name: holidayName
  }
}

/**
 * 주말인지 확인
 */
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6 // 일요일(0) 또는 토요일(6)
}

/**
 * 주말 또는 공휴일인지 확인 (비동기)
 */
export const isWeekendOrHoliday = async (date: Date) => {
  const holidayInfo = await getHolidayInfo(date)
  const weekend = isWeekend(date)
  
  if (holidayInfo.isHoliday) {
    return {
      isWeekendOrHoliday: true,
      reason: 'holiday',
      name: holidayInfo.name
    }
  }
  
  if (weekend) {
    return {
      isWeekendOrHoliday: true,
      reason: 'weekend',
      name: date.getDay() === 0 ? '일요일' : '토요일'
    }
  }
  
  return {
    isWeekendOrHoliday: false,
    reason: 'weekday'
  }
}

/**
 * 주말 또는 공휴일인지 확인 (동기 - 캐시된 데이터만 사용)
 */
export const isWeekendOrHolidaySync = (date: Date) => {
  const holidayInfo = getHolidayInfoSync(date)
  const weekend = isWeekend(date)
  
  if (holidayInfo.isHoliday) {
    return {
      isWeekendOrHoliday: true,
      reason: 'holiday',
      name: holidayInfo.name
    }
  }
  
  if (weekend) {
    return {
      isWeekendOrHoliday: true,
      reason: 'weekend',
      name: date.getDay() === 0 ? '일요일' : '토요일'
    }
  }
  
  return {
    isWeekendOrHoliday: false,
    reason: 'weekday'
  }
}

/**
 * 특정 월의 공휴일 목록 가져오기
 */
export const getMonthlyHolidays = async (year: number, month: number): Promise<{ [date: string]: string }> => {
  await updateHolidayCache(year)
  
  const monthStr = String(month).padStart(2, '0')
  const monthHolidays: { [date: string]: string } = {}
  
  for (const [date, name] of Object.entries(holidayCache)) {
    if (date.startsWith(`${year}-${monthStr}`)) {
      monthHolidays[date] = name
    }
  }
  
  return monthHolidays
}
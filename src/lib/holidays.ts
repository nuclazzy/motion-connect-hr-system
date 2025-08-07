/**
 * 공휴일 API 직접 연동 유틸리티
 * 한국 공공데이터포털 API만 사용
 */

// 한국 공공데이터포털 API 설정 (Supabase Edge Function 활용)
const SUPABASE_URL = 'https://uxfjjquhbksvlqzrjfpj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4ZmpqcXVoYmtzdmxxenJqZnBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1Njk3NTYsImV4cCI6MjA2ODE0NTc1Nn0.6AcbiyzXHczbCF2Mv3lt5Qck7FQ_Gf4i6eMqiLAmDWA'

// 하드코딩된 한국 공휴일 데이터 (2024-2026)
const KOREAN_HOLIDAYS: { [key: string]: string } = {
  // 2024년
  '2024-01-01': '신정',
  '2024-02-09': '설날 연휴',
  '2024-02-10': '설날',
  '2024-02-11': '설날 연휴',
  '2024-02-12': '대체휴일',
  '2024-03-01': '삼일절',
  '2024-04-10': '국회의원선거',
  '2024-05-05': '어린이날',
  '2024-05-06': '대체휴일',
  '2024-05-15': '부처님 오신 날',
  '2024-06-06': '현충일',
  '2024-08-15': '광복절',
  '2024-09-16': '추석 연휴',
  '2024-09-17': '추석',
  '2024-09-18': '추석 연휴',
  '2024-10-03': '개천절',
  '2024-10-09': '한글날',
  '2024-12-25': '성탄절',
  // 2025년
  '2025-01-01': '신정',
  '2025-01-28': '설날 연휴',
  '2025-01-29': '설날',
  '2025-01-30': '설날 연휴',
  '2025-03-01': '삼일절',
  '2025-03-03': '대체휴일',
  '2025-05-05': '어린이날',
  '2025-05-06': '대체휴일',
  '2025-06-06': '현충일',
  '2025-08-15': '광복절',
  '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴',
  '2025-10-06': '추석',
  '2025-10-07': '추석 연휴',
  '2025-10-08': '대체휴일',
  '2025-10-09': '한글날',
  '2025-12-25': '성탄절',
  // 2026년
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴',
  '2026-02-17': '설날',
  '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절',
  '2026-03-02': '대체휴일',
  '2026-05-05': '어린이날',
  '2026-05-25': '부처님 오신 날',
  '2026-06-06': '현충일',
  '2026-08-15': '광복절',
  '2026-08-17': '대체휴일',
  '2026-09-24': '추석 연휴',
  '2026-09-25': '추석',
  '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절',
  '2026-10-05': '대체휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절'
}

// 공휴일 데이터 캐시
let holidayCache: { [key: string]: string } = { ...KOREAN_HOLIDAYS }
let lastCacheUpdate: number = Date.now()
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
 * 공공데이터포털 API를 통해 공휴일 정보 가져오기 (CORS 문제로 인해 하드코딩 데이터 사용)
 */
export const fetchHolidaysFromAPI = async (year: number): Promise<{ [key: string]: string }> => {
  try {
    console.log(`📅 Using hardcoded holidays for ${year} (CORS issue with Edge Function)`)
    
    // 하드코딩된 데이터에서 해당 연도 공휴일 필터링
    const yearHolidays: { [key: string]: string } = {}
    Object.keys(KOREAN_HOLIDAYS).forEach(date => {
      if (date.startsWith(`${year}-`)) {
        yearHolidays[date] = KOREAN_HOLIDAYS[date]
      }
    })
    
    console.log(`📅 Found ${Object.keys(yearHolidays).length} holidays for ${year}`)
    return yearHolidays
    
    // Edge Function CORS 문제가 해결되면 아래 코드 활성화
    /*
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
    */
    
  } catch (error) {
    console.error('공휴일 조회 오류:', error)
    // 에러 발생 시 하드코딩된 데이터 반환
    const yearHolidays: { [key: string]: string } = {}
    Object.keys(KOREAN_HOLIDAYS).forEach(date => {
      if (date.startsWith(`${year}-`)) {
        yearHolidays[date] = KOREAN_HOLIDAYS[date]
      }
    })
    return yearHolidays
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
    // 에러 발생 시 하드코딩된 데이터 사용
    const yearHolidays: { [key: string]: string } = {}
    Object.keys(KOREAN_HOLIDAYS).forEach(date => {
      if (date.startsWith(`${year}-`)) {
        yearHolidays[date] = KOREAN_HOLIDAYS[date]
      }
    })
    holidayCache = { ...holidayCache, ...yearHolidays }
    console.log(`📅 Using fallback hardcoded data for ${year}`)
  }
}

/**
 * 공휴일 체크 함수
 */
export const isHoliday = async (dateString: string): Promise<string | undefined> => {
  const year = parseInt(dateString.split('-')[0])
  try {
    await updateHolidayCache(year)
  } catch (error) {
    console.log(`📅 Using cached data for holiday check`)
  }
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
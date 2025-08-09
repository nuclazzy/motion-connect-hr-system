/**
 * 한국천문연구원(KASI) 공휴일 API 통합 시스템 🏛️
 * 공식 특일정보 API 사용
 * Fallback: 최소 기본 공휴일 데이터 📅
 */

// API 설정
const API_ENDPOINTS = {
  holidays: '/api/holidays',
  fullYear: '/api/holidays' // POST 요청으로 전체 연도 데이터
}

// 🗑️ 하드코딩 데이터 제거됨!
// 이제 한국천문연구원 API + Fallback (route.ts)에서 모든 데이터 처리

// 공휴일 데이터 캐시 (API에서 동적으로 채워짐)
let holidayCache: { [key: string]: string } = {}
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
 * 내부 API 엔드포인트를 통해 공휴일 정보 가져오기 (실시간 연동)
 * Source: /api/holidays → KASI API → enhanced fallback
 */
export const fetchHolidaysFromAPI = async (year: number): Promise<{ [key: string]: string }> => {
  try {
    console.log(`🌟 Fetching holidays for ${year} from internal API`)
    
    // 내부 API 엔드포인트 호출 (POST)
    const response = await fetch('/api/holidays', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ year })
    })
    
    if (!response.ok) {
      throw new Error(`Internal API request failed with status ${response.status}`)
    }
    
    const data = await response.json()
    
    // API 응답 형식 처리
    if (data.holidays && Object.keys(data.holidays).length > 0) {
      console.log(`✅ Successfully fetched ${data.count} holidays for ${year} from source: ${data.source}`)
      console.log(`📊 API Source: ${data.source}, Timestamp: ${data.timestamp}`)
      return data.holidays
    } else if (data.error) {
      throw new Error(data.error)
    } else {
      throw new Error('API returned empty or invalid response')
    }
    
  } catch (error) {
    console.warn(`⚠️ Internal API fetch failed for ${year}, using emergency fallback:`, error)
    
    // 🚨 긴급 복구: 최소한의 핵심 공휴일 보장
    const emergencyHolidays: { [key: string]: string } = {}
    
    // 고정 공휴일 (매년 동일)
    emergencyHolidays[`${year}-01-01`] = '신정'
    emergencyHolidays[`${year}-03-01`] = '삼일절'
    emergencyHolidays[`${year}-05-05`] = '어린이날'
    emergencyHolidays[`${year}-06-06`] = '현충일'
    emergencyHolidays[`${year}-08-15`] = '광복절'
    emergencyHolidays[`${year}-10-03`] = '개천절'
    emergencyHolidays[`${year}-10-09`] = '한글날'
    emergencyHolidays[`${year}-12-25`] = '성탄절'
    
    // 🎯 2025년 모든 공휴일 보장 (정부 발표 포함)
    if (year === 2025) {
      // 설 연휴
      emergencyHolidays['2025-01-27'] = '임시공휴일(설 연휴)'
      emergencyHolidays['2025-01-28'] = '설날'
      emergencyHolidays['2025-01-29'] = '설날'
      emergencyHolidays['2025-01-30'] = '설날'
      
      // 삼일절 대체공휴일
      emergencyHolidays['2025-03-03'] = '대체공휴일'
      
      // 어린이날 대체공휴일
      emergencyHolidays['2025-05-06'] = '대체공휴일'
      
      // 🚨 대통령 선거일 임시공휴일
      emergencyHolidays['2025-06-03'] = '임시공휴일(대통령 선거일)'
      
      // 추석 연휴
      emergencyHolidays['2025-10-05'] = '추석'
      emergencyHolidays['2025-10-06'] = '추석'
      emergencyHolidays['2025-10-07'] = '추석'
      emergencyHolidays['2025-10-08'] = '대체공휴일'
    }
    
    console.log(`🚨 Using emergency fallback: ${Object.keys(emergencyHolidays).length} core holidays for ${year}`)
    return emergencyHolidays
  }
}

/**
 * 특정 월의 공휴일 정보 가져오기 (내부 API 월별 요청)
 */
export const fetchMonthlyHolidays = async (year: number, month: number): Promise<{ [key: string]: string }> => {
  try {
    console.log(`🌟 Fetching holidays for ${year}/${month} from internal API`)
    
    const url = `/api/holidays?year=${year}&month=${month}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Internal monthly API request failed with status ${response.status}`)
    }
    
    const data = await response.json()
    
    // API 응답 형식 처리
    if (data.holidays && typeof data.holidays === 'object') {
      console.log(`✅ Fetched ${data.count} holidays for ${year}/${month} from source: ${data.source}`)
      return data.holidays
    } else if (data.error) {
      throw new Error(data.error)
    } else {
      throw new Error('Monthly API returned empty or invalid response')
    }
    
  } catch (error) {
    console.warn(`⚠️ Internal monthly API failed for ${year}/${month}, no local fallback available:`, error)
    
    // 월별 API 실패 시 빈 객체 반환
    console.log(`📅 Monthly API failed for ${year}/${month}, using fallback system`)
    return {}
  }
}



/**
 * 공휴일 캐시 업데이트 (향상된 로직)
 */
export const updateHolidayCache = async (year: number) => {
  const now = Date.now()
  const yearCacheKey = `holidays_cache_${year}`
  
  // 브라우저 환경에서만 localStorage 사용
  if (typeof window !== 'undefined') {
    const cachedData = localStorage.getItem(yearCacheKey)
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData)
        if (parsed.timestamp && now - parsed.timestamp < CACHE_DURATION) {
          holidayCache = { ...holidayCache, ...parsed.holidays }
          console.log(`📅 Using cached holiday data for ${year} (${Object.keys(parsed.holidays).length} holidays)`)
          return
        }
      } catch (cacheError) {
        console.warn(`⚠️ Invalid cache data for ${year}:`, cacheError)
        localStorage.removeItem(yearCacheKey)
      }
    }
  }
  
  try {
    console.log(`🔄 Updating holiday cache for ${year}...`)
    
    // 한국천문연구원 API 호출
    const holidays = await fetchHolidaysFromAPI(year)
    
    // 캐시 업데이트
    holidayCache = { ...holidayCache, ...holidays }
    lastCacheUpdate = now
    
    // 브라우저 환경에서 localStorage에 저장
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(yearCacheKey, JSON.stringify({
          holidays,
          timestamp: now,
          apiSource: 'kasi-api'
        }))
      } catch (storageError) {
        console.warn(`⚠️ Failed to save to localStorage:`, storageError)
      }
    }
    
    console.log(`✅ Successfully cached ${Object.keys(holidays).length} holidays for ${year}`)
  } catch (error) {
    console.error(`❌ Failed to update holiday cache for ${year}:`, error)
    console.warn(`⚠️ No local fallback data available, relying on route.ts Enhanced Fallback system`)
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
 * 특정 월의 공휴일 목록 가져오기 (향상된 버전)
 */
export const getMonthlyHolidays = async (year: number, month: number): Promise<{ [date: string]: string }> => {
  try {
    // 먼저 API에서 월별 데이터 시도
    const monthlyData = await fetchMonthlyHolidays(year, month)
    
    if (Object.keys(monthlyData).length > 0) {
      // 성공하면 캐시에도 업데이트
      holidayCache = { ...holidayCache, ...monthlyData }
      return monthlyData
    }
  } catch (error) {
    console.warn(`⚠️ Monthly API failed for ${year}/${month}:`, error)
  }
  
  // API 실패 시 캐시에서 찾기
  await updateHolidayCache(year)
  
  const monthStr = String(month).padStart(2, '0')
  const monthHolidays: { [date: string]: string } = {}
  
  for (const [date, name] of Object.entries(holidayCache)) {
    if (date.startsWith(`${year}-${monthStr}`)) {
      monthHolidays[date] = name
    }
  }
  
  console.log(`📅 Found ${Object.keys(monthHolidays).length} holidays for ${year}/${month}`)
  return monthHolidays
}

/**
 * 캐시 상태 확인 및 디버깅 정보
 */
export const getCacheInfo = () => {
  const cacheKeys = Object.keys(holidayCache)
  const years = [...new Set(cacheKeys.map(key => key.split('-')[0]))]
  
  return {
    totalHolidays: cacheKeys.length,
    availableYears: years.sort(),
    lastUpdate: new Date(lastCacheUpdate).toISOString(),
    cacheAge: Date.now() - lastCacheUpdate
  }
}

/**
 * 전체 캐시 초기화 (디버깅/문제 해결용)
 */
export const clearHolidayCache = () => {
  holidayCache = {}
  lastCacheUpdate = Date.now()
  
  if (typeof window !== 'undefined') {
    // localStorage에서 공휴일 캐시 모두 제거
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('holidays_cache_')) {
        localStorage.removeItem(key)
      }
    })
  }
  
  console.log('📅 Holiday cache cleared - will be repopulated from hybrid API')
}
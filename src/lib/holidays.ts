// 공휴일 데이터 캐시
let holidayCache: { [key: string]: string } = {}
let lastCacheUpdate: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24시간

// 캐시 초기화 함수
export const initializeHolidayCache = async (year?: number) => {
  const currentYear = year || new Date().getFullYear()
  await updateHolidayCache(currentYear)
  // 내년 데이터도 미리 로드
  if (!year) {
    await updateHolidayCache(currentYear + 1)
  }
}

// 네이버 검색 API를 통해 공휴일 정보 가져오기
export const fetchHolidaysFromNaver = async (year: number): Promise<{ [key: string]: string }> => {
  try {
    const response = await fetch(`/api/holidays/naver?year=${year}`)
    if (!response.ok) {
      throw new Error('공휴일 정보를 가져오는데 실패했습니다.')
    }
    const data = await response.json()
    return data.holidays || {}
  } catch (error) {
    console.error('네이버 API 공휴일 조회 오류:', error)
    // 네이버 API 실패시 기본 공휴일 데이터 반환
    return getDefaultHolidays(year)
  }
}

// 기본 공휴일 데이터 (네이버 API 실패시 백업용)
const getDefaultHolidays = (year: number): { [key: string]: string } => {
  const baseHolidays: { [key: string]: string } = {}
  
  // 고정 공휴일
  baseHolidays[`${year}-01-01`] = '신정'
  baseHolidays[`${year}-03-01`] = '삼일절'
  baseHolidays[`${year}-05-05`] = '어린이날'
  baseHolidays[`${year}-06-06`] = '현충일'
  baseHolidays[`${year}-08-15`] = '광복절'
  baseHolidays[`${year}-10-03`] = '개천절'
  baseHolidays[`${year}-10-09`] = '한글날'
  baseHolidays[`${year}-12-25`] = '성탄절'
  
  return baseHolidays
}

// 공휴일 캐시 업데이트
export const updateHolidayCache = async (year: number) => {
  const now = Date.now()
  if (now - lastCacheUpdate > CACHE_DURATION) {
    const holidays = await fetchHolidaysFromNaver(year)
    holidayCache = { ...holidayCache, ...holidays }
    lastCacheUpdate = now
  }
}

// 공휴일 체크 함수
export const isHoliday = async (dateString: string): Promise<string | undefined> => {
  const year = parseInt(dateString.split('-')[0])
  await updateHolidayCache(year)
  return holidayCache[dateString]
}

// 동기 버전 (캐시된 데이터만 사용)
export const isHolidaySync = (dateString: string): string | undefined => {
  return holidayCache[dateString]
}

// 날짜를 YYYY-MM-DD 형식으로 변환
export const formatDateForHoliday = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// 공휴일인지 확인하고 공휴일 이름 반환 (비동기)
export const getHolidayInfo = async (date: Date) => {
  const dateString = formatDateForHoliday(date)
  const holidayName = await isHoliday(dateString)
  
  return {
    isHoliday: !!holidayName,
    name: holidayName
  }
}

// 공휴일인지 확인하고 공휴일 이름 반환 (동기 - 캐시된 데이터만 사용)
export const getHolidayInfoSync = (date: Date) => {
  const dateString = formatDateForHoliday(date)
  const holidayName = isHolidaySync(dateString)
  
  return {
    isHoliday: !!holidayName,
    name: holidayName
  }
}

// 주말인지 확인
export const isWeekend = (date: Date): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6 // 일요일(0) 또는 토요일(6)
}

// 주말 또는 공휴일인지 확인 (비동기)
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

// 주말 또는 공휴일인지 확인 (동기 - 캐시된 데이터만 사용)
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
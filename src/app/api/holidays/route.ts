/**
 * 실시간 공휴일 정보 API 프록시 엔드포인트
 * Multi-Source 하이브리드 접근법
 * Primary: distbe/holidays (GitHub 오픈소스)
 * Fallback: 한국천문연구원 API, 최소 fallback 데이터
 */

import { NextRequest, NextResponse } from 'next/server'

// Primary: distbe/holidays (GitHub 오픈소스 데이터)
const DISTBE_API_BASE = 'https://holidays.dist.be'

// Secondary: 한국천문연구원 API (백업용)
const KASI_API_BASE = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService'
const SERVICE_KEY = process.env.HOLIDAY_API_KEY

// distbe/holidays API 인터페이스
interface DistbeHolidayItem {
  date: string        // YYYY-MM-DD
  name: string        // 공휴일 이름
  holiday: boolean    // 공휴일 여부
  kind: number        // 공휴일 종류 (1: 법정공휴일, 2: 기념일)
}

// 한국천문연구원 API 인터페이스 (백업용)
interface HolidayApiResponse {
  response: {
    header: {
      resultCode: string
      resultMsg: string
    }
    body: {
      items?: {
        item?: HolidayItem[]
      }
      totalCount: number
    }
  }
}

interface HolidayItem {
  dateKind: string    // 특일 분류
  dateName: string    // 특일 명
  isHoliday: 'Y' | 'N' // 공휴일 여부
  locdate: number     // 날짜 (YYYYMMDD)
}

/**
 * Primary: distbe/holidays API를 통한 실시간 공휴일 데이터 조회
 */
async function fetchHolidaysFromDistbe(year: number): Promise<{ [key: string]: string }> {
  try {
    console.log(`🌟 Fetching holidays from distbe for year ${year}`)
    
    const apiUrl = `${DISTBE_API_BASE}/${year}.json`
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Motion-Connect-HR-System'
      },
      // 5초 타임아웃 (GitHub CDN이므로 빠름)
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) {
      throw new Error(`distbe API failed with status ${response.status}: ${response.statusText}`)
    }

    const data: DistbeHolidayItem[] = await response.json()
    console.log(`✅ distbe API returned ${data.length} items for ${year}`)

    // 공휴일만 필터링하고 YYYY-MM-DD: name 형식으로 변환
    const holidays: { [key: string]: string } = {}
    
    data.forEach(item => {
      if (item.holiday === true) {  // 공휴일만 선택
        holidays[item.date] = item.name
      }
    })

    console.log(`📅 Processed ${Object.keys(holidays).length} actual holidays for ${year}`)
    return holidays

  } catch (error) {
    console.error(`❌ distbe API failed for ${year}:`, error)
    throw error
  }
}

/**
 * 백업: 한국천문연구원 API 호출
 */
async function fetchHolidaysFromKASI(year: number): Promise<{ [key: string]: string }> {
  if (!SERVICE_KEY) {
    throw new Error('KASI API key not available')
  }

  const params = new URLSearchParams({
    ServiceKey: SERVICE_KEY,
    pageNo: '1',
    numOfRows: '100',
    solYear: year.toString()
  })

  const apiUrl = `${KASI_API_BASE}/getRestDeInfo?${params.toString()}`
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: { 'Accept': 'application/xml' },
    signal: AbortSignal.timeout(10000)
  })

  if (!response.ok) {
    throw new Error(`KASI API failed with status ${response.status}`)
  }

  const xml = await response.text()
  
  // 간단한 XML 파싱 (정규식 사용 - ES2015 호환)
  const holidays: { [key: string]: string } = {}
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const itemMatches = xml.match(itemRegex) || []
  
  for (const itemMatch of itemMatches) {
    // Extract the content inside <item> tags
    const itemContentMatch = itemMatch.match(/<item>([\s\S]*?)<\/item>/)
    if (!itemContentMatch) continue
    
    const itemXml = itemContentMatch[1]
    const dateNameMatch = itemXml.match(/<dateName>([^<]+)<\/dateName>/)
    const isHolidayMatch = itemXml.match(/<isHoliday>([^<]+)<\/isHoliday>/)
    const locdateMatch = itemXml.match(/<locdate>([^<]+)<\/locdate>/)
    
    if (dateNameMatch && isHolidayMatch && locdateMatch && isHolidayMatch[1] === 'Y') {
      const dateStr = locdateMatch[1]
      const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`
      holidays[formattedDate] = dateNameMatch[1]
    }
  }

  return holidays
}

/**
 * 최소한의 fallback 데이터 + 최신 정부발표 보완
 * (현재년도 ±2년, 고정 공휴일 + 확정된 임시공휴일)
 */
function getMinimalFallbackHolidays(year: number): { [key: string]: string } {
  const holidays: { [key: string]: string } = {}
  
  // 고정 공휴일만 추가 (변동 가능한 설날, 추석 제외)
  holidays[`${year}-01-01`] = '신정'
  holidays[`${year}-03-01`] = '삼일절'
  holidays[`${year}-05-05`] = '어린이날'
  holidays[`${year}-06-06`] = '현충일'
  holidays[`${year}-08-15`] = '광복절'
  holidays[`${year}-10-03`] = '개천절'
  holidays[`${year}-10-09`] = '한글날'
  holidays[`${year}-12-25`] = '성탄절'
  
  // 🎯 2025년 특별 임시공휴일 (정부 공식 발표 기준)
  if (year === 2025) {
    // 설 연휴 임시공휴일 (2025.1.8 지정)
    holidays[`${year}-01-27`] = '임시공휴일(설 연휴)'
    
    // 🚨 제21대 대통령 선거일 임시공휴일 (2025.4.8 지정)
    holidays[`${year}-06-03`] = '임시공휴일(대통령 선거일)'
  }
  
  const totalCount = Object.keys(holidays).length
  console.log(`📋 Using enhanced fallback holidays for ${year} (${totalCount} holidays including confirmed temporary holidays)`)
  return holidays
}

/**
 * Multi-Source 하이브리드 공휴일 데이터 조회 (정부발표 보완 포함)
 * 1순위: distbe/holidays (실시간) + 정부발표 보완
 * 2순위: 한국천문연구원 API (백업) + 정부발표 보완
 * 3순위: Enhanced fallback (정부발표 확정 임시공휴일 포함)
 */
async function fetchHolidaysHybrid(year: number): Promise<{ holidays: { [key: string]: string }, source: string }> {
  // 1순위: distbe/holidays 시도 + 정부발표 보완
  try {
    const holidays = await fetchHolidaysFromDistbe(year)
    
    // 🎯 정부 공식 발표 누락 데이터 보완 (2025년)
    if (year === 2025) {
      // 6월 3일 대통령 선거일 임시공휴일 강제 추가 (2025.4.8 정부 발표)
      if (!holidays['2025-06-03']) {
        holidays['2025-06-03'] = '임시공휴일(대통령 선거일)'
        console.log('🎯 Added missing June 3, 2025 presidential election holiday')
      }
      
      // 1월 27일 설 연휴 임시공휴일 확인
      if (!holidays['2025-01-27']) {
        holidays['2025-01-27'] = '임시공휴일(설 연휴)'
        console.log('🎯 Added missing January 27, 2025 Lunar New Year holiday')
      }
    }
    
    return { holidays, source: 'distbe-github-enhanced' }
  } catch (error) {
    console.warn(`⚠️ distbe API failed for ${year}, trying fallback...`)
  }

  // 2순위: 한국천문연구원 API 시도 + 정부발표 보완
  try {
    const holidays = await fetchHolidaysFromKASI(year)
    
    // 🎯 정부 공식 발표 누락 데이터 보완 (2025년)
    if (year === 2025) {
      if (!holidays['2025-06-03']) {
        holidays['2025-06-03'] = '임시공휴일(대통령 선거일)'
        console.log('🎯 Enhanced KASI data with June 3 election holiday')
      }
      if (!holidays['2025-01-27']) {
        holidays['2025-01-27'] = '임시공휴일(설 연휴)'
        console.log('🎯 Enhanced KASI data with January 27 Lunar New Year holiday')
      }
    }
    
    return { holidays, source: 'kasi-api-enhanced' }
  } catch (error) {
    console.warn(`⚠️ KASI API also failed for ${year}, using enhanced fallback...`)
  }

  // 3순위: Enhanced fallback (정부발표 확정 임시공휴일 포함)
  const currentYear = new Date().getFullYear()
  if (Math.abs(year - currentYear) <= 2) {
    const holidays = getMinimalFallbackHolidays(year)
    return { holidays, source: 'enhanced-fallback' }
  }

  // 완전 실패
  console.error(`❌ All holiday sources failed for year ${year}`)
  return { holidays: {}, source: 'none' }
}

/**
 * GET /api/holidays - 실시간 하이브리드 공휴일 정보 조회
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')

    if (!yearParam) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      )
    }

    const year = parseInt(yearParam)
    console.log(`🌟 GET request for ${year}${monthParam ? `/${monthParam}` : ''}`)

    // 하이브리드 방식으로 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysHybrid(year)
    
    // 월별 필터링 (요청된 경우)
    let filteredHolidays = holidays
    if (monthParam) {
      const month = monthParam.padStart(2, '0')
      filteredHolidays = Object.fromEntries(
        Object.entries(holidays).filter(([date]) => 
          date.startsWith(`${year}-${month}-`)
        )
      )
    }

    console.log(`✅ Returning ${Object.keys(filteredHolidays).length} holidays from source: ${source}`)

    return NextResponse.json({
      holidays: filteredHolidays,
      source,
      year,
      month: monthParam || 'all',
      count: Object.keys(filteredHolidays).length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Holiday API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch holiday data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/holidays - 특정 년도의 모든 공휴일 조회
 */
export async function POST(request: NextRequest) {
  try {
    const { year } = await request.json()

    if (!year) {
      return NextResponse.json(
        { error: 'Year is required' },
        { status: 400 }
      )
    }

    console.log(`🌟 POST request for full year ${year}`)

    // 하이브리드 방식으로 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysHybrid(year)

    console.log(`✅ Returning ${Object.keys(holidays).length} holidays from source: ${source}`)

    return NextResponse.json({
      holidays,
      source,
      year,
      count: Object.keys(holidays).length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Holiday POST API Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch holiday data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
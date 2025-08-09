/**
 * 공휴일 정보 API 프록시 엔드포인트
 * 한국천문연구원(KASI) 특일정보 공식 API 사용
 * Fallback: 최소 기본 공휴일 데이터
 */

import { NextRequest, NextResponse } from 'next/server'

// 한국천문연구원 API (Primary)
const KASI_API_BASE = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService'
// 환경변수에서 가져오고, 없으면 제공된 키 사용 (Decoding 버전)
const SERVICE_KEY = process.env.HOLIDAY_API_KEY || 'VP255KCShsGZZNThSWhAt2qS05vMjkWlRbd1ebmhbizf7D7qLOEO4fu+sehXFLEAs97lyd8FlFjB3oVyNWzNjw=='

// 한국천문연구원 API 인터페이스
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
 * 한국천문연구원 API 호출 (Primary)
 */
async function fetchHolidaysFromKASI(year: number): Promise<{ [key: string]: string }> {
  try {
    console.log(`🔍 Attempting KASI API for year ${year}`)
    
    // API 키 확인
    if (!SERVICE_KEY) {
      throw new Error('KASI API key not available')
    }

    // API 파라미터 설정
    const params = new URLSearchParams({
      ServiceKey: SERVICE_KEY,
      pageNo: '1',
      numOfRows: '100',
      solYear: year.toString(),
      _type: 'json'  // JSON 응답 시도
    })

    const apiUrl = `${KASI_API_BASE}/getRestDeInfo?${params.toString()}`
    console.log(`📡 KASI API URL: ${apiUrl.replace(SERVICE_KEY, 'API_KEY_HIDDEN')}`)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json, application/xml',
        'User-Agent': 'Motion-Connect-HR-System'
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`KASI API failed with status ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    console.log(`🔍 KASI API Content-Type: ${contentType}`)
    
    const responseText = await response.text()
    console.log(`📦 KASI API Response preview: ${responseText.substring(0, 200)}...`)
    
    const holidays: { [key: string]: string } = {}
    
    // JSON 응답인지 확인 (Content-Type이 정확하지 않을 수 있으므로 내용으로 판단)
    let data
    try {
      data = JSON.parse(responseText)
      console.log('📊 KASI API returned JSON response (parsed successfully)')
      
      // JSON 응답 구조 처리
      const items = data?.response?.body?.items?.item || []
      console.log(`🔍 Found ${Array.isArray(items) ? items.length : (items ? 1 : 0)} items in response`)
      
      for (const item of Array.isArray(items) ? items : [items]) {
        if (item && item.isHoliday === 'Y') {
          const dateStr = String(item.locdate)
          const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`
          holidays[formattedDate] = item.dateName
          console.log(`✅ Added holiday: ${formattedDate} - ${item.dateName}`)
        }
      }
    } catch (jsonError) {
      console.log('📄 KASI API returned XML response (JSON parsing failed)')
      
      // 개선된 XML 파싱
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      const itemMatches = responseText.match(itemRegex) || []
      console.log(`🔍 Found ${itemMatches.length} XML items`)
      
      for (const itemMatch of itemMatches) {
        const itemXml = itemMatch
        const dateNameMatch = itemXml.match(/<dateName>([^<]+)<\/dateName>/)
        const isHolidayMatch = itemXml.match(/<isHoliday>([^<]+)<\/isHoliday>/)
        const locdateMatch = itemXml.match(/<locdate>([^<]+)<\/locdate>/)
        
        if (dateNameMatch && isHolidayMatch && locdateMatch && isHolidayMatch[1] === 'Y') {
          const dateStr = locdateMatch[1]
          const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`
          holidays[formattedDate] = dateNameMatch[1]
          console.log(`✅ Added holiday: ${formattedDate} - ${dateNameMatch[1]}`)
        }
      }
    }

    console.log(`✅ KASI API returned ${Object.keys(holidays).length} holidays for ${year}`)
    return holidays
    
  } catch (error) {
    console.error(`❌ KASI API error for ${year}:`, error)
    throw error
  }
}

/**
 * 최소한의 fallback 데이터 + 최신 정부발표 보완
 * (현재년도 ±2년, 고정 공휴일 + 확정된 임시공휴일)
 */
function getMinimalFallbackHolidays(year: number): { [key: string]: string } {
  const holidays: { [key: string]: string } = {}
  
  // 고정 공휴일 추가
  holidays[`${year}-01-01`] = '1월1일'
  holidays[`${year}-03-01`] = '삼일절'
  holidays[`${year}-05-05`] = '어린이날'
  holidays[`${year}-06-06`] = '현충일'
  holidays[`${year}-08-15`] = '광복절'
  holidays[`${year}-10-03`] = '개천절'
  holidays[`${year}-10-09`] = '한글날'
  holidays[`${year}-12-25`] = '기독탄신일'
  
  // 🎯 2025년 특별 공휴일 (정부 공식 발표 + 일반 공휴일)
  if (year === 2025) {
    // 설 연휴
    holidays[`${year}-01-27`] = '임시공휴일'
    holidays[`${year}-01-28`] = '설날'
    holidays[`${year}-01-29`] = '설날'
    holidays[`${year}-01-30`] = '설날'
    
    // 삼일절 대체공휴일
    holidays[`${year}-03-03`] = '대체공휴일'
    
    // 어린이날/부처님오신날 (5월 5일 중복)
    holidays[`${year}-05-06`] = '대체공휴일'
    
    // 🚨 제21대 대통령 선거일 임시공휴일
    holidays[`${year}-06-03`] = '임시공휴일(제21대 대통령 선거)'
    
    // 추석 연휴
    holidays[`${year}-10-05`] = '추석'
    holidays[`${year}-10-06`] = '추석'
    holidays[`${year}-10-07`] = '추석'
    holidays[`${year}-10-08`] = '대체공휴일'
  }
  
  const totalCount = Object.keys(holidays).length
  console.log(`📋 Enhanced fallback: ${totalCount}개 공휴일 (${year}년)`)
  return holidays
}

/**
 * 한국천문연구원 공휴일 데이터 조회 (정부발표 보완 포함)
 * 1순위: 한국천문연구원 API (공식 데이터) + 정부발표 보완
 * 2순위: Enhanced fallback (정부발표 확정 임시공휴일 포함)
 */
async function fetchHolidaysKASI(year: number): Promise<{ holidays: { [key: string]: string }, source: string }> {
  // 1순위: 한국천문연구원 API 시도
  try {
    const holidays = await fetchHolidaysFromKASI(year)
    
    // API가 실제 공휴일을 반환했는지 확인 (5개 이상이면 성공으로 간주)
    if (Object.keys(holidays).length >= 5) {
      console.log(`✅ KASI API 성공: ${Object.keys(holidays).length}개 공휴일 조회`)
      
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
      
      return { holidays, source: 'kasi-api' }
    } else {
      console.warn(`⚠️ KASI API 응답 부족: ${Object.keys(holidays).length}개만 조회됨, fallback 사용`)
      throw new Error('Insufficient KASI API response')
    }
  } catch (error) {
    console.warn(`⚠️ KASI API 실패 for ${year}, enhanced fallback 사용...`)
  }

  // 2순위: Enhanced fallback (전체 공휴일 포함)
  console.log(`📋 Enhanced fallback 사용 for ${year}`)
  const holidays = getMinimalFallbackHolidays(year)
  return { holidays, source: 'enhanced-fallback' }
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

    // 한국천문연구원 API로 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysKASI(year)
    
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

    // 한국천문연구원 API로 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysKASI(year)

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
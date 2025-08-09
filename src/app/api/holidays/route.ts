/**
 * 공휴일 정보 API 프록시 엔드포인트
 * 한국천문연구원(KASI) 특일정보 공식 API 사용
 * Fallback: 최소 기본 공휴일 데이터
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchHolidaysFromMultipleSources, validateHolidayData } from '@/lib/holiday-sources'

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
 * Supabase custom_holidays 테이블에서 임시공휴일 조회
 */
async function fetchCustomHolidays(year: number): Promise<{ [key: string]: string }> {
  try {
    const { data, error } = await supabase
      .from('custom_holidays')
      .select('date, name')
      .eq('year', year)
      .eq('is_active', true)
      .order('date')
    
    if (error) {
      console.warn(`⚠️ Custom holidays fetch error:`, error)
      return {}
    }
    
    const holidays: { [key: string]: string } = {}
    if (data) {
      data.forEach(holiday => {
        const dateStr = holiday.date
        holidays[dateStr] = holiday.name
      })
      console.log(`📅 Found ${data.length} custom holidays for ${year}`)
    }
    
    return holidays
  } catch (error) {
    console.warn(`⚠️ Failed to fetch custom holidays:`, error)
    return {}
  }
}

/**
 * 공휴일 데이터 조회 (멀티소스 통합 시스템)
 * 1. Google Calendar API (가장 신뢰할 수 있음)
 * 2. 한국천문연구원 API (정규 공휴일)
 * 3. Supabase custom_holidays 테이블 (임시공휴일)
 * 모든 데이터를 병합하여 완전한 공휴일 목록 제공
 */
async function fetchHolidaysRealtime(year: number): Promise<{ holidays: { [key: string]: string }, source: string }> {
  try {
    // 멀티소스 시스템 사용
    const { holidays: holidayMap, sources, conflicts } = await fetchHolidaysFromMultipleSources(year)
    
    // Map을 객체로 변환
    const holidays: { [key: string]: string } = {}
    for (const [date, holiday] of holidayMap) {
      holidays[date] = holiday.name
    }
    
    // 충돌이 있을 경우 로그
    if (conflicts.length > 0) {
      console.warn(`⚠️ ${conflicts.length}개의 데이터 충돌 감지:`)
      conflicts.forEach(conflict => {
        console.warn(`  - ${conflict.date}: ${conflict.sources.map(h => `${h.name}(${h.source})`).join(', ')}`)
      })
    }
    
    // 데이터 검증
    const validation = await validateHolidayData(year)
    if (!validation.isValid) {
      console.warn(`⚠️ 공휴일 데이터 검증 경고:`)
      validation.recommendations.forEach(rec => console.warn(`  - ${rec}`))
    }
    
    const sourceStr = sources.length > 0 ? sources.join('+') : 'none'
    console.log(`✅ ${Object.keys(holidays).length}개 공휴일 조회 완료 (소스: ${sourceStr})`)
    
    return { 
      holidays, 
      source: sourceStr 
    }
  } catch (error) {
    console.error(`❌ 멀티소스 공휴일 조회 실패:`, error)
    
    // 폴백: 기존 시스템 사용
    console.log('📊 폴백: 기존 KASI + Custom 시스템 사용')
    return fetchHolidaysLegacy(year)
  }
}

/**
 * 기존 공휴일 조회 시스템 (폴백용)
 */
async function fetchHolidaysLegacy(year: number): Promise<{ holidays: { [key: string]: string }, source: string }> {
  let holidays: { [key: string]: string } = {}
  let source = 'none'
  
  // 1. 한국천문연구원 API에서 정규 공휴일 조회
  try {
    const kasiHolidays = await fetchHolidaysFromKASI(year)
    
    if (Object.keys(kasiHolidays).length > 0) {
      holidays = { ...kasiHolidays }
      source = 'kasi-api'
      console.log(`✅ KASI API: ${Object.keys(kasiHolidays).length}개 정규 공휴일 조회`)
    }
  } catch (error) {
    console.error(`❌ KASI API 실패:`, error)
  }
  
  // 2. Supabase custom_holidays 테이블에서 임시공휴일 조회
  try {
    const customHolidays = await fetchCustomHolidays(year)
    
    if (Object.keys(customHolidays).length > 0) {
      Object.assign(holidays, customHolidays)
      source = source === 'kasi-api' ? 'kasi-api+custom' : 'custom-only'
      console.log(`✅ Custom holidays: ${Object.keys(customHolidays).length}개 임시공휴일 추가`)
    }
  } catch (error) {
    console.error(`❌ Custom holidays 조회 실패:`, error)
  }
  
  if (Object.keys(holidays).length === 0) {
    return { holidays: {}, source: 'error' }
  }
  
  return { holidays, source }
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

    // 실시간 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysRealtime(year)
    
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

    // 실시간 공휴일 데이터 조회
    const { holidays, source } = await fetchHolidaysRealtime(year)

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
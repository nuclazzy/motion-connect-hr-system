import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// 공공데이터포털 공휴일 API 키 (무료)
const HOLIDAY_API_KEY = process.env.HOLIDAY_API_KEY

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // 한국천문연구원 특일정보 API 또는 공공데이터포털 API 사용
    let holidays: { [key: string]: string } = {}

    if (HOLIDAY_API_KEY) {
      try {
        holidays = await fetchHolidaysFromKoreanAPI(parseInt(year))
      } catch (error) {
        console.error('한국 공휴일 API 오류:', error)
        holidays = getDefaultHolidays(parseInt(year))
      }
    } else {
      // API 키가 없으면 기본 데이터 사용
      holidays = getDefaultHolidays(parseInt(year))
    }

    return NextResponse.json({
      success: true,
      holidays,
      source: HOLIDAY_API_KEY ? 'korean_api' : 'default'
    })

  } catch (error) {
    console.error('공휴일 API 오류:', error)
    
    // 오류 발생시 기본 공휴일 데이터 반환
    const year = parseInt(new URL(request.url).searchParams.get('year') || new Date().getFullYear().toString())
    return NextResponse.json({
      success: true,
      holidays: getDefaultHolidays(year),
      source: 'default',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// 한국 공공데이터포털에서 공휴일 정보 가져오기
async function fetchHolidaysFromKoreanAPI(year: number): Promise<{ [key: string]: string }> {
  const holidays: { [key: string]: string } = {}
  
  // 공공데이터포털 특일정보 API
  const apiUrl = `http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo`
  const params = new URLSearchParams({
    serviceKey: HOLIDAY_API_KEY!,
    solYear: year.toString(),
    numOfRows: '100',
    _type: 'json'
  })

  const response = await fetch(`${apiUrl}?${params}`)
  
  if (!response.ok) {
    throw new Error('공휴일 API 호출 실패')
  }

  const data = await response.json()
  
  if (data.response?.body?.items?.item) {
    const items = Array.isArray(data.response.body.items.item) 
      ? data.response.body.items.item 
      : [data.response.body.items.item]
    
    items.forEach((item: { locdate?: number; dateName?: string }) => {
      if (item.locdate && item.dateName) {
        const dateStr = item.locdate.toString()
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
        holidays[formattedDate] = item.dateName
      }
    })
  }
  
  // API에서 데이터를 가져오지 못한 경우 기본 데이터로 보완
  if (Object.keys(holidays).length === 0) {
    return getDefaultHolidays(year)
  }
  
  return holidays
}

// 기본 공휴일 데이터 (네이버 API 실패시 또는 파싱 실패시)
function getDefaultHolidays(year: number): { [key: string]: string } {
  const holidays: { [key: string]: string } = {}
  
  // 고정 공휴일들
  holidays[`${year}-01-01`] = '신정'
  holidays[`${year}-03-01`] = '삼일절'
  holidays[`${year}-05-05`] = '어린이날'
  holidays[`${year}-06-06`] = '현충일'
  holidays[`${year}-08-15`] = '광복절'
  holidays[`${year}-10-03`] = '개천절'
  holidays[`${year}-10-09`] = '한글날'
  holidays[`${year}-12-25`] = '성탄절'

  // 년도별 변동 공휴일들 (수동 업데이트 필요)
  if (year === 2024) {
    holidays[`${year}-02-09`] = '설날 연휴'
    holidays[`${year}-02-10`] = '설날'
    holidays[`${year}-02-11`] = '설날 연휴'
    holidays[`${year}-02-12`] = '대체휴일'
    holidays[`${year}-04-10`] = '국회의원선거'
    holidays[`${year}-05-06`] = '대체휴일'
    holidays[`${year}-05-15`] = '부처님 오신 날'
    holidays[`${year}-09-16`] = '추석 연휴'
    holidays[`${year}-09-17`] = '추석'
    holidays[`${year}-09-18`] = '추석 연휴'
  } else if (year === 2025) {
    holidays[`${year}-01-28`] = '설날 연휴'
    holidays[`${year}-01-29`] = '설날'
    holidays[`${year}-01-30`] = '설날 연휴'
    holidays[`${year}-03-03`] = '대체휴일'
    holidays[`${year}-05-13`] = '부처님 오신 날'
    holidays[`${year}-10-06`] = '추석 연휴'
    holidays[`${year}-10-07`] = '추석'
    holidays[`${year}-10-08`] = '추석 연휴'
  }
  
  return holidays
}
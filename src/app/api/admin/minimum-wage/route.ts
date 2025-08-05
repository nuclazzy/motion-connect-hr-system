import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

// 백업용 최저임금 데이터 (API 연동 실패 시 사용)
const FALLBACK_MINIMUM_WAGE_DATA = {
  2024: 9860, // 2024년 최저시급 (원)
  2025: 10030, // 2025년 최저시급 (원) - 예상값
  2023: 9620,
  2022: 9160,
  2021: 8720,
  2020: 8590
}

// 공공데이터포털 최저임금 API 호출
async function fetchMinimumWageFromAPI(year?: string) {
  const API_KEY = process.env.PUBLIC_DATA_API_KEY
  
  if (!API_KEY) {
    console.warn('공공데이터포털 API 키가 설정되지 않았습니다. 백업 데이터를 사용합니다.')
    return null
  }

  try {
    // 공공데이터포털 "연도별 최저임금" API 엔드포인트
    // 파일데이터 형태이므로 전체 데이터를 한번에 가져옴
    const baseUrl = 'https://www.data.go.kr/cmm/cmm/file/FileDown.do'
    const params = new URLSearchParams({
      fileId: '15068774', // 연도별 최저임금 데이터셋 ID
      serviceKey: API_KEY
    })

    const response = await fetch(`${baseUrl}?${params}`, {
      headers: {
        'Accept': 'text/csv, text/plain, */*',
        'User-Agent': 'Motion-Connect-HR-System'
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(15000) // 15초
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const csvText = await response.text()
    
    // CSV 데이터 파싱
    const lines = csvText.split('\n')
    const processedData: { [key: number]: number } = {}
    
    // 첫 번째 라인은 헤더이므로 건너뛰기
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // CSV 파싱 (콤마로 구분, 따옴표 처리)
      const columns = line.split(',').map(col => col.replace(/"/g, '').trim())
      
      // 예상 컬럼 구조: [연도, 시간당최저임금, 일최저임금, 월최저임금]
      if (columns.length >= 2) {
        const year = parseInt(columns[0])
        const hourlyWage = parseInt(columns[1].replace(/[^0-9]/g, '')) // 숫자만 추출
        
        if (!isNaN(year) && !isNaN(hourlyWage) && year > 2000 && hourlyWage > 0) {
          processedData[year] = hourlyWage
        }
      }
    }
    
    // 데이터가 파싱되었다면 반환
    if (Object.keys(processedData).length > 0) {
      return processedData
    }
    
    return null
  } catch (error) {
    console.error('공공데이터포털 API 호출 실패:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    
    // 공공데이터포털 API 시도
    const apiData = await fetchMinimumWageFromAPI(year || undefined)
    
    // API 데이터와 백업 데이터 병합
    const minimumWageData = apiData ? { ...FALLBACK_MINIMUM_WAGE_DATA, ...apiData } : FALLBACK_MINIMUM_WAGE_DATA
    
    if (year) {
      const yearNum = parseInt(year)
      const wage = minimumWageData[yearNum as keyof typeof minimumWageData]
      
      if (wage) {
        return NextResponse.json({
          success: true,
          year: yearNum,
          minimumWage: wage,
          monthlyMinimum: Math.round(wage * 8 * 22), // 8시간 * 22일 기준 (주휴수당 포함)
          description: `${yearNum}년 최저시급`,
          source: apiData ? 'api' : 'fallback'
        })
      } else {
        return NextResponse.json({
          success: false,
          error: `${yearNum}년 최저임금 데이터가 없습니다.`
        }, { status: 404 })
      }
    }
    
    // 전체 데이터 반환
    const currentYear = new Date().getFullYear()
    const currentMinimumWage = minimumWageData[currentYear as keyof typeof minimumWageData]
    
    return NextResponse.json({
      success: true,
      currentYear,
      currentMinimumWage,
      allData: minimumWageData,
      monthlyMinimum: currentMinimumWage ? Math.round(currentMinimumWage * 8 * 22) : 0,
      source: apiData ? 'api' : 'fallback',
      note: apiData ? '공공데이터포털에서 가져온 실시간 데이터' : '백업 데이터 사용 중'
    })
    
  } catch (error) {
    console.error('최저임금 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '최저임금 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
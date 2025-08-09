/**
 * 공휴일 데이터 다중 소스 관리 시스템
 * 여러 신뢰할 수 있는 소스에서 데이터를 가져와 병합
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Holiday {
  date: string
  name: string
  type: 'regular' | 'temporary' | 'substitute'
  source: string
  isConfirmed: boolean
}

export interface HolidaySource {
  id: string
  name: string
  priority: number
  isReliable: boolean
  fetchHolidays: (year: number) => Promise<Holiday[]>
}

/**
 * 1. Google Calendar 공휴일 (가장 신뢰할 수 있음)
 */
async function fetchGoogleCalendarHolidays(year: number): Promise<Holiday[]> {
  try {
    // Google Calendar API 설정
    const CALENDAR_ID = 'ko.south_korea#holiday@group.v.calendar.google.com'
    const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    
    if (!API_KEY) {
      throw new Error('Google API key not configured')
    }
    
    const timeMin = `${year}-01-01T00:00:00Z`
    const timeMax = `${year}-12-31T23:59:59Z`
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?` +
      `key=${API_KEY}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`
    )
    
    if (!response.ok) {
      throw new Error(`Google Calendar API failed: ${response.status}`)
    }
    
    const data = await response.json()
    const holidays: Holiday[] = []
    
    for (const event of data.items || []) {
      const date = event.start.date || event.start.dateTime?.split('T')[0]
      if (date) {
        holidays.push({
          date,
          name: event.summary,
          type: event.summary.includes('대체') ? 'substitute' : 
                event.summary.includes('임시') ? 'temporary' : 'regular',
          source: 'Google Calendar',
          isConfirmed: true
        })
      }
    }
    
    console.log(`✅ Google Calendar: ${holidays.length}개 공휴일`)
    return holidays
  } catch (error) {
    console.error('❌ Google Calendar 조회 실패:', error)
    return []
  }
}

/**
 * 2. KASI API (한국천문연구원)
 */
async function fetchKASIHolidays(year: number): Promise<Holiday[]> {
  try {
    const response = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year })
    })
    
    if (!response.ok) {
      throw new Error(`KASI API failed: ${response.status}`)
    }
    
    const data = await response.json()
    const holidays: Holiday[] = []
    
    for (const [date, name] of Object.entries(data.holidays || {})) {
      holidays.push({
        date,
        name: name as string,
        type: 'regular',
        source: 'KASI',
        isConfirmed: true
      })
    }
    
    console.log(`✅ KASI: ${holidays.length}개 공휴일`)
    return holidays
  } catch (error) {
    console.error('❌ KASI 조회 실패:', error)
    return []
  }
}

/**
 * 3. Supabase Custom Holidays
 */
async function fetchCustomHolidays(year: number): Promise<Holiday[]> {
  try {
    const { data, error } = await supabase
      .from('custom_holidays')
      .select('*')
      .eq('year', year)
      .eq('is_active', true)
    
    if (error) throw error
    
    const holidays: Holiday[] = (data || []).map(h => ({
      date: h.date,
      name: h.name,
      type: h.type as 'temporary' | 'substitute',
      source: 'Custom DB',
      isConfirmed: true
    }))
    
    console.log(`✅ Custom DB: ${holidays.length}개 공휴일`)
    return holidays
  } catch (error) {
    console.error('❌ Custom DB 조회 실패:', error)
    return []
  }
}

/**
 * 4. 정부24 또는 행정안전부 공식 데이터 (추후 구현)
 */
async function fetchGovernmentHolidays(year: number): Promise<Holiday[]> {
  // TODO: 정부24 API 또는 행정안전부 공식 API 연동
  // 현재는 구현 예정
  return []
}

/**
 * 공휴일 소스 정의
 */
export const holidaySources: HolidaySource[] = [
  {
    id: 'google',
    name: 'Google Calendar',
    priority: 1,
    isReliable: true,
    fetchHolidays: fetchGoogleCalendarHolidays
  },
  {
    id: 'kasi',
    name: 'KASI (한국천문연구원)',
    priority: 2,
    isReliable: true,
    fetchHolidays: fetchKASIHolidays
  },
  {
    id: 'custom',
    name: 'Custom Database',
    priority: 3,
    isReliable: true,
    fetchHolidays: fetchCustomHolidays
  },
  {
    id: 'government',
    name: '정부24',
    priority: 4,
    isReliable: true,
    fetchHolidays: fetchGovernmentHolidays
  }
]

/**
 * 여러 소스에서 공휴일 데이터를 가져와 병합
 */
export async function fetchHolidaysFromMultipleSources(year: number): Promise<{
  holidays: Map<string, Holiday>
  sources: string[]
  conflicts: Array<{ date: string, sources: Holiday[] }>
}> {
  const allHolidays = new Map<string, Holiday[]>()
  const activeSources: string[] = []
  
  // 모든 소스에서 병렬로 데이터 가져오기
  const results = await Promise.allSettled(
    holidaySources.map(async source => ({
      source,
      holidays: await source.fetchHolidays(year)
    }))
  )
  
  // 성공한 소스의 데이터 수집
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { source, holidays } = result.value
      if (holidays.length > 0) {
        activeSources.push(source.name)
        
        for (const holiday of holidays) {
          const existing = allHolidays.get(holiday.date) || []
          existing.push(holiday)
          allHolidays.set(holiday.date, existing)
        }
      }
    }
  }
  
  // 데이터 병합 및 충돌 감지
  const mergedHolidays = new Map<string, Holiday>()
  const conflicts: Array<{ date: string, sources: Holiday[] }> = []
  
  for (const [date, holidays] of allHolidays) {
    if (holidays.length === 1) {
      // 단일 소스: 그대로 사용
      mergedHolidays.set(date, holidays[0])
    } else {
      // 여러 소스: 우선순위가 높은 것 선택
      const sorted = holidays.sort((a, b) => {
        const sourceA = holidaySources.find(s => s.name === a.source)
        const sourceB = holidaySources.find(s => s.name === b.source)
        return (sourceA?.priority || 999) - (sourceB?.priority || 999)
      })
      
      mergedHolidays.set(date, sorted[0])
      
      // 이름이 다른 경우 충돌로 기록
      const uniqueNames = new Set(holidays.map(h => h.name))
      if (uniqueNames.size > 1) {
        conflicts.push({ date, sources: holidays })
      }
    }
  }
  
  console.log(`📊 병합 결과: ${mergedHolidays.size}개 공휴일, ${conflicts.length}개 충돌`)
  
  return {
    holidays: mergedHolidays,
    sources: activeSources,
    conflicts
  }
}

/**
 * 공휴일 데이터 검증 및 보고
 */
export async function validateHolidayData(year: number): Promise<{
  isValid: boolean
  report: string
  recommendations: string[]
}> {
  const { holidays, sources, conflicts } = await fetchHolidaysFromMultipleSources(year)
  
  const recommendations: string[] = []
  let report = `## ${year}년 공휴일 데이터 검증 보고서\n\n`
  
  // 소스 정보
  report += `### 데이터 소스 (${sources.length}개)\n`
  sources.forEach(source => {
    report += `- ✅ ${source}\n`
  })
  report += '\n'
  
  // 공휴일 수 확인
  report += `### 총 공휴일: ${holidays.size}개\n\n`
  
  // 충돌 정보
  if (conflicts.length > 0) {
    report += `### ⚠️ 데이터 충돌 (${conflicts.length}개)\n`
    conflicts.forEach(conflict => {
      report += `- ${conflict.date}: `
      conflict.sources.forEach(h => {
        report += `${h.name} (${h.source}), `
      })
      report += '\n'
    })
    recommendations.push('충돌하는 공휴일 데이터를 수동으로 확인하세요.')
  }
  
  // 필수 공휴일 체크
  const requiredHolidays = [
    { date: `${year}-01-01`, name: '신정' },
    { date: `${year}-03-01`, name: '삼일절' },
    { date: `${year}-05-05`, name: '어린이날' },
    { date: `${year}-06-06`, name: '현충일' },
    { date: `${year}-08-15`, name: '광복절' },
    { date: `${year}-10-03`, name: '개천절' },
    { date: `${year}-10-09`, name: '한글날' },
    { date: `${year}-12-25`, name: '성탄절' }
  ]
  
  report += `### 필수 공휴일 체크\n`
  const missingRequired: string[] = []
  
  for (const required of requiredHolidays) {
    if (holidays.has(required.date)) {
      report += `- ✅ ${required.name}\n`
    } else {
      report += `- ❌ ${required.name} (누락)\n`
      missingRequired.push(required.name)
    }
  }
  
  if (missingRequired.length > 0) {
    recommendations.push(`누락된 필수 공휴일: ${missingRequired.join(', ')}`)
  }
  
  // 검증 결과
  const isValid = sources.length >= 2 && missingRequired.length === 0
  
  if (!isValid) {
    if (sources.length < 2) {
      recommendations.push('최소 2개 이상의 데이터 소스를 활성화하세요.')
    }
  }
  
  return { isValid, report, recommendations }
}

/**
 * 공휴일 데이터 자동 동기화 (매일 실행 권장)
 */
export async function syncHolidayData(): Promise<{
  success: boolean
  message: string
  added: number
  updated: number
}> {
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear + 1]
  
  let totalAdded = 0
  let totalUpdated = 0
  
  for (const year of years) {
    const { holidays } = await fetchHolidaysFromMultipleSources(year)
    
    // Supabase holiday_sync_log 테이블에 저장 (추후 구현)
    for (const [date, holiday] of holidays) {
      try {
        // 기존 데이터 확인
        const { data: existing } = await supabase
          .from('custom_holidays')
          .select('id, name')
          .eq('date', date)
          .single()
        
        if (!existing) {
          // 새로운 공휴일 추가
          const { error } = await supabase
            .from('custom_holidays')
            .insert({
              date,
              name: holiday.name,
              type: holiday.type,
              description: `Auto-synced from ${holiday.source}`
            })
          
          if (!error) totalAdded++
        } else if (existing.name !== holiday.name) {
          // 이름이 다른 경우 업데이트
          const { error } = await supabase
            .from('custom_holidays')
            .update({ name: holiday.name })
            .eq('id', existing.id)
          
          if (!error) totalUpdated++
        }
      } catch (error) {
        console.error(`Sync error for ${date}:`, error)
      }
    }
  }
  
  return {
    success: true,
    message: `동기화 완료: ${totalAdded}개 추가, ${totalUpdated}개 업데이트`,
    added: totalAdded,
    updated: totalUpdated
  }
}
/**
 * 공휴일 데이터베이스 동기화 스케줄러
 * 한국천문연구원 API → Supabase 실시간 동기화
 * 
 * 참고: https://rockbach.tistory.com/entry/공휴일-api-연동-중-임시-공휴일이나-대체-공휴일-보완방법
 * "개발자는 게을러져야 한다" 철학 적용
 */

import { createClient } from '@supabase/supabase-js'

interface Holiday {
  date: string
  name: string
  is_temporary: boolean
  is_substitute: boolean
  created_at?: string
  source: 'kasi-api' | 'manual' | 'enhanced-api'
}

interface DatabaseHoliday {
  id: string
  holiday_date: string
  holiday_name: string
  is_temporary: boolean
  is_substitute: boolean
  created_at: string
  source: string
}

// Supabase 클라이언트 (서버사이드 전용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // 서비스 역할 키 사용
)

/**
 * 공휴일 테이블 스키마 (SQL)
 * 
 * CREATE TABLE public.holidays (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   holiday_date DATE NOT NULL UNIQUE,
 *   holiday_name VARCHAR(100) NOT NULL,
 *   is_temporary BOOLEAN DEFAULT false,
 *   is_substitute BOOLEAN DEFAULT false,
 *   source VARCHAR(50) DEFAULT 'kasi-api',
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_holidays_date ON holidays(holiday_date);
 * CREATE INDEX idx_holidays_year ON holidays(EXTRACT(YEAR FROM holiday_date));
 */

/**
 * 한국천문연구원 API로부터 최신 공휴일 데이터 조회
 */
export async function fetchLatestHolidaysFromKASI(year: number): Promise<Holiday[]> {
  try {
    console.log(`🌟 Fetching latest holidays for ${year} from KASI API`)
    
    // 우리의 하이브리드 API 사용
    const response = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year })
    })
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Holiday[] 형태로 변환
    const holidays: Holiday[] = Object.entries(data.holidays).map(([date, name]) => ({
      date,
      name: name as string,
      is_temporary: false, // 기본값 (변경 감지로 판별)
      is_substitute: false, // 기본값 (변경 감지로 판별)
      source: data.source === 'distbe-github-enhanced' ? 'enhanced-api' : 'kasi-api'
    }))
    
    console.log(`✅ Fetched ${holidays.length} holidays from ${data.source}`)
    return holidays
    
  } catch (error) {
    console.error(`❌ Failed to fetch holidays for ${year}:`, error)
    throw error
  }
}

/**
 * 데이터베이스에서 기존 공휴일 데이터 조회
 */
export async function getExistingHolidays(year: number): Promise<DatabaseHoliday[]> {
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('holiday_date', startDate)
    .lte('holiday_date', endDate)
    .order('holiday_date')
  
  if (error) {
    console.error('❌ Failed to fetch existing holidays:', error)
    throw error
  }
  
  console.log(`📅 Found ${data?.length || 0} existing holidays in DB for ${year}`)
  return data || []
}

/**
 * 임시/대체공휴일 감지 로직
 * "개발자는 게을러져야 한다" - 자동 감지
 */
export function detectTemporaryHolidays(
  newHolidays: Holiday[], 
  existingHolidays: DatabaseHoliday[]
): Holiday[] {
  
  const existingDates = new Set(existingHolidays.map(h => h.holiday_date))
  
  return newHolidays.map(holiday => {
    const isNewHoliday = !existingDates.has(holiday.date)
    
    if (isNewHoliday) {
      // 새로 추가된 공휴일 → 임시 또는 대체공휴일 가능성
      const isTemporary = holiday.name.includes('임시공휴일') || 
                         holiday.name.includes('선거일') ||
                         holiday.name.includes('특별휴일')
      
      const isSubstitute = holiday.name.includes('대체휴일') || 
                          holiday.name.includes('대체공휴일')
      
      console.log(`🚨 New holiday detected: ${holiday.date} - ${holiday.name} (Temporary: ${isTemporary}, Substitute: ${isSubstitute})`)
      
      return {
        ...holiday,
        is_temporary: isTemporary,
        is_substitute: isSubstitute
      }
    }
    
    return holiday
  })
}

/**
 * 데이터베이스 동기화 (신규/업데이트)
 */
export async function syncHolidaysToDatabase(holidays: Holiday[]): Promise<{ inserted: number, updated: number }> {
  let inserted = 0
  let updated = 0
  
  for (const holiday of holidays) {
    try {
      // UPSERT 방식: 존재하면 업데이트, 없으면 삽입
      const { data, error } = await supabase
        .from('holidays')
        .upsert({
          holiday_date: holiday.date,
          holiday_name: holiday.name,
          is_temporary: holiday.is_temporary,
          is_substitute: holiday.is_substitute,
          source: holiday.source,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'holiday_date'
        })
        .select()
      
      if (error) {
        console.error(`❌ Failed to sync holiday ${holiday.date}:`, error)
        continue
      }
      
      // 새로 삽입된 경우 (created_at이 최근)
      if (data && data.length > 0) {
        const now = new Date()
        const createdAt = new Date(data[0].created_at)
        const isNewlyCreated = (now.getTime() - createdAt.getTime()) < 10000 // 10초 내
        
        if (isNewlyCreated) {
          inserted++
          console.log(`➕ Inserted new holiday: ${holiday.date} - ${holiday.name}`)
        } else {
          updated++
          console.log(`🔄 Updated existing holiday: ${holiday.date} - ${holiday.name}`)
        }
      }
      
    } catch (syncError) {
      console.error(`❌ Sync error for ${holiday.date}:`, syncError)
    }
  }
  
  return { inserted, updated }
}

/**
 * 메인 스케줄러 함수: 일정 주기 실행 (Daily Cron Job)
 * Vercel Cron Jobs 또는 GitHub Actions 스케줄러에서 호출
 */
export async function runHolidaySyncScheduler(year?: number): Promise<{
  success: boolean
  year: number
  stats: {
    fetched: number
    existing: number
    inserted: number
    updated: number
    newTemporary: number
    newSubstitute: number
  }
  message: string
}> {
  
  const targetYear = year || new Date().getFullYear()
  
  try {
    console.log(`🚀 Starting holiday sync scheduler for ${targetYear}`)
    
    // 1. 최신 공휴일 데이터 조회 (하이브리드 API)
    const newHolidays = await fetchLatestHolidaysFromKASI(targetYear)
    
    // 2. 기존 데이터베이스 데이터 조회
    const existingHolidays = await getExistingHolidays(targetYear)
    
    // 3. 임시/대체공휴일 자동 감지
    const enhancedHolidays = detectTemporaryHolidays(newHolidays, existingHolidays)
    
    // 4. 데이터베이스 동기화
    const { inserted, updated } = await syncHolidaysToDatabase(enhancedHolidays)
    
    // 5. 통계 계산
    const newTemporary = enhancedHolidays.filter(h => h.is_temporary).length
    const newSubstitute = enhancedHolidays.filter(h => h.is_substitute).length
    
    const stats = {
      fetched: newHolidays.length,
      existing: existingHolidays.length,
      inserted,
      updated,
      newTemporary,
      newSubstitute
    }
    
    const message = `Holiday sync completed: ${inserted} inserted, ${updated} updated, ${newTemporary} temporary, ${newSubstitute} substitute`
    
    console.log(`✅ ${message}`)
    
    return {
      success: true,
      year: targetYear,
      stats,
      message
    }
    
  } catch (error) {
    const errorMessage = `Holiday sync failed for ${targetYear}: ${error instanceof Error ? error.message : 'Unknown error'}`
    console.error(`❌ ${errorMessage}`)
    
    return {
      success: false,
      year: targetYear,
      stats: {
        fetched: 0,
        existing: 0,
        inserted: 0,
        updated: 0,
        newTemporary: 0,
        newSubstitute: 0
      },
      message: errorMessage
    }
  }
}

/**
 * 기업별 맞춤 공휴일 추가 (수동 관리)
 * 예: 회사 창립일, 임직원의 날 등
 */
export async function addCustomHoliday(
  date: string,
  name: string,
  isCompanySpecific: boolean = true
): Promise<{ success: boolean, message: string }> {
  
  try {
    const { data, error } = await supabase
      .from('holidays')
      .insert({
        holiday_date: date,
        holiday_name: name,
        is_temporary: false,
        is_substitute: false,
        source: 'manual',
        // 기업 특화 공휴일 플래그 추가 (스키마 확장 필요)
      })
      .select()
    
    if (error) {
      throw error
    }
    
    console.log(`🏢 Added custom holiday: ${date} - ${name}`)
    
    return {
      success: true,
      message: `Custom holiday added successfully: ${name}`
    }
    
  } catch (error) {
    console.error(`❌ Failed to add custom holiday: ${date}`, error)
    
    return {
      success: false,
      message: `Failed to add custom holiday: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Vercel Cron Job 엔드포인트에서 사용할 export
 * /api/cron/holiday-sync 에서 호출
 */
export { runHolidaySyncScheduler as default }
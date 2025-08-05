import { supabase } from './supabase'

// 설정 값 타입 정의
export interface SystemSettings {
  // 근무시간 설정
  monthly_standard_hours: number
  lunch_break_minutes: number
  overtime_threshold_minutes: number
  night_work_start: string
  night_work_end: string
  
  // 수당 비율 설정
  overtime_rate: number
  night_rate: number
  holiday_rate: number
  dinner_allowance: number
}

// 기본값 (DB 연결 실패 시 폴백)
const DEFAULT_SETTINGS: SystemSettings = {
  monthly_standard_hours: 209,
  lunch_break_minutes: 60,
  overtime_threshold_minutes: 10,
  night_work_start: '22:00',
  night_work_end: '06:00',
  overtime_rate: 1.5,
  night_rate: 1.5,
  holiday_rate: 1.5,
  dinner_allowance: 10000
}

// 설정 캐시 (성능 최적화)
let settingsCache: SystemSettings | null = null
let cacheExpiry: Date | null = null

/**
 * 시스템 설정 조회 (캐시 적용)
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  // 캐시 확인
  if (settingsCache && cacheExpiry && cacheExpiry > new Date()) {
    return settingsCache
  }

  try {
    const { data, error } = await supabase
      .rpc('get_all_system_settings')

    if (error) {
      console.error('설정 조회 오류:', error)
      return DEFAULT_SETTINGS
    }

    // 설정 값 파싱
    const settings: SystemSettings = { ...DEFAULT_SETTINGS }
    
    data?.forEach((setting: any) => {
      const key = setting.key as keyof SystemSettings
      if (key in settings) {
        // JSON 값을 적절한 타입으로 변환
        let parsedValue: any
        if (typeof setting.value === 'string') {
          parsedValue = JSON.parse(setting.value)
        } else {
          parsedValue = setting.value
        }
          
        (settings as any)[key] = parsedValue
      }
    })

    // 캐시 업데이트 (5분간 유효)
    settingsCache = settings
    cacheExpiry = new Date(Date.now() + 5 * 60 * 1000)

    return settings
  } catch (error) {
    console.error('시스템 설정 조회 실패:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * 특정 설정 값 조회
 */
export async function getSystemSetting<K extends keyof SystemSettings>(
  key: K
): Promise<SystemSettings[K]> {
  const settings = await getSystemSettings()
  return settings[key]
}

/**
 * 설정 값 업데이트 (관리자 전용)
 */
export async function updateSystemSetting(
  key: keyof SystemSettings,
  value: any,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .update({
        value: JSON.stringify(value),
        updated_at: new Date().toISOString(),
        updated_by: userId
      })
      .eq('key', key)

    if (error) {
      console.error('설정 업데이트 오류:', error)
      return false
    }

    // 캐시 무효화
    settingsCache = null
    cacheExpiry = null

    return true
  } catch (error) {
    console.error('설정 업데이트 실패:', error)
    return false
  }
}

/**
 * 설정 변경 이력 조회
 */
export async function getSettingsHistory(
  settingKey?: string,
  limit: number = 50
): Promise<any[]> {
  try {
    let query = supabase
      .from('settings_history')
      .select(`
        *,
        users:changed_by(name, email)
      `)
      .order('changed_at', { ascending: false })
      .limit(limit)

    if (settingKey) {
      query = query.eq('setting_key', settingKey)
    }

    const { data, error } = await query

    if (error) {
      console.error('설정 이력 조회 오류:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('설정 이력 조회 실패:', error)
    return []
  }
}

/**
 * 캐시 초기화 (설정 변경 시 호출)
 */
export function clearSettingsCache() {
  settingsCache = null
  cacheExpiry = null
}
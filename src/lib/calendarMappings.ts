import { supabase } from '@/lib/supabase'

export interface CalendarMapping {
  id: string
  calendar_config_id: string
  feature_id: string
  feature_name: string
  is_active: boolean
  calendar_config: {
    id: string
    config_type: 'team' | 'function'
    target_name: string
    calendar_id: string
    calendar_alias: string | null
    description: string | null
    color: string | null
    is_active: boolean
  }
}

// 특정 기능에 연결된 활성 캘린더들을 가져오는 함수
export async function getCalendarsForFeature(featureId: string) {
  try {
    const { data, error } = await supabase
      .from('calendar_feature_mappings')
      .select(`
        *,
        calendar_config:calendar_configs(*)
      `)
      .eq('feature_id', featureId)
      .eq('is_active', true)
      .eq('calendar_config.is_active', true)

    if (error) {
      console.error(`기능 ${featureId}의 캘린더 매핑 조회 실패:`, error)
      return []
    }

    return (data as CalendarMapping[]) || []
  } catch (error) {
    console.error(`기능 ${featureId}의 캘린더 매핑 조회 오류:`, error)
    return []
  }
}

// 모든 활성 캘린더 설정을 가져오는 함수 (기존 방식과 호환)
export async function getAllActiveCalendarConfigs() {
  try {
    const { data, error } = await supabase
      .from('calendar_configs')
      .select('*')
      .eq('is_active', true)
      .order('config_type', { ascending: true })

    if (error) {
      console.error('캘린더 설정 조회 실패:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('캘린더 설정 조회 오류:', error)
    return []
  }
}

// 기능별 캘린더 연결 상태를 확인하는 함수
export async function isFeatureConnectedToCalendars(featureId: string): Promise<boolean> {
  const calendars = await getCalendarsForFeature(featureId)
  return calendars.length > 0
}
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
export async function getCalendarsForFeature(featureId: string, teamName?: string) {
  try {
    // 우선 테이블이 존재하는지 확인하고, 없으면 기본 방식 사용
    const { data, error } = await supabase
      .from('calendar_feature_mappings')
      .select(`
        *,
        calendar_config:calendar_configs(*)
      `)
      .eq('feature_id', featureId)
      .eq('is_active', true)

    if (error) {
      // 테이블이 없으면 모든 활성 캘린더 반환 (기존 방식과 호환)
      if (error.code === '42P01') {
        console.log(`캘린더 매핑 테이블이 없어서 기본 방식 사용: ${featureId}`)
        return await getAllActiveCalendarConfigs()
      }
      console.error(`기능 ${featureId}의 캘린더 매핑 조회 실패:`, error)
      return await getAllActiveCalendarConfigs()
    }

    // 팀 이름이 지정된 경우 해당 팀에 맞는 매핑만 필터링
    let mappings = (data as CalendarMapping[]) || []
    if (teamName && mappings.length > 0) {
      mappings = mappings.filter(mapping => {
        // feature_id에 팀 정보가 포함된 경우 (format: featureId:teamName)
        if (mapping.feature_id.includes(':')) {
          const [baseFeatureId, mappingTeamName] = mapping.feature_id.split(':')
          return baseFeatureId === featureId && mappingTeamName === teamName
        }
        // 팀 정보가 없는 경우 캘린더 설정의 target_name으로 필터링
        return mapping.calendar_config.target_name === teamName ||
               mapping.calendar_config.calendar_alias?.includes(teamName)
      })
    } else if (!teamName) {
      // 팀 이름이 지정되지 않은 경우 일반 매핑만 가져오기 (팀별 매핑 제외)
      mappings = mappings.filter(mapping => !mapping.feature_id.includes(':'))
    }

    // 매핑이 없으면 기본 방식 사용
    if (mappings.length === 0) {
      return await getAllActiveCalendarConfigs()
    }

    return mappings
  } catch (error) {
    console.error(`기능 ${featureId}의 캘린더 매핑 조회 오류:`, error)
    return await getAllActiveCalendarConfigs()
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
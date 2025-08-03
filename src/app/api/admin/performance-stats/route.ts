import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authorization 확인
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const userId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 성능 통계 수집
    const performanceStats = await collectPerformanceStats(supabase)

    return NextResponse.json(performanceStats)
  } catch (error) {
    console.error('성능 통계 조회 실패:', error)
    return NextResponse.json({ 
      error: '성능 통계 조회에 실패했습니다.' 
    }, { status: 500 })
  }
}

async function collectPerformanceStats(supabase: any) {
  try {
    // 1. 슬로우 쿼리 통계
    const { data: queryStats } = await supabase.rpc('get_slow_queries', {
      min_mean_time: 50 // 50ms 이상
    }).then((result: any) => result).catch(() => ({ data: [] }))

    // 2. 인덱스 사용률 통계
    const { data: indexStats } = await supabase
      .from('index_usage_stats')
      .select('*')
      .order('idx_scan', { ascending: false })
      .limit(20)
      .then((result: any) => result)
      .catch(() => ({ data: [] }))

    // 3. 테이블 활동 통계
    const { data: tableStatsRaw } = await supabase.rpc('get_table_stats')
      .then((result: any) => result)
      .catch(() => ({ data: [] }))

    // 4. 시스템 통계
    const systemStats = await getSystemStats(supabase)

    return {
      queryStats: queryStats || [],
      indexStats: indexStats || [],
      tableStats: tableStatsRaw || [],
      systemStats
    }
  } catch (error) {
    console.error('성능 통계 수집 오류:', error)
    return {
      queryStats: [],
      indexStats: [],
      tableStats: [],
      systemStats: {
        active_connections: 0,
        total_connections: 100,
        database_size: '0 MB',
        cache_hit_ratio: 0
      }
    }
  }
}

async function getSystemStats(supabase: any) {
  try {
    // PostgreSQL 시스템 통계 조회
    const queries = [
      // 활성 연결 수
      `SELECT count(*) as active_connections 
       FROM pg_stat_activity 
       WHERE state = 'active'`,
      
      // 전체 연결 수
      `SELECT setting::int as max_connections 
       FROM pg_settings 
       WHERE name = 'max_connections'`,
      
      // 데이터베이스 크기
      `SELECT pg_size_pretty(pg_database_size(current_database())) as database_size`,
      
      // 캐시 적중률
      `SELECT 
         round(
           (sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read) + 1)) * 100, 
           2
         ) as cache_hit_ratio
       FROM pg_statio_user_tables`
    ]

    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const { data } = await supabase.rpc('execute_sql', { sql_query: query })
          return data?.[0] || {}
        } catch (error) {
          console.warn('시스템 통계 쿼리 실패:', query, error)
          return {}
        }
      })
    )

    return {
      active_connections: results[0]?.active_connections || 0,
      total_connections: results[1]?.max_connections || 100,
      database_size: results[2]?.database_size || '0 MB',
      cache_hit_ratio: parseFloat(results[3]?.cache_hit_ratio || '0')
    }
  } catch (error) {
    console.error('시스템 통계 조회 실패:', error)
    return {
      active_connections: 0,
      total_connections: 100,
      database_size: '0 MB',
      cache_hit_ratio: 0
    }
  }
}
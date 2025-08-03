'use client'

import { useState, useEffect } from 'react'
import { createServiceRoleClient } from '@/lib/supabase/server'

interface PerformanceStats {
  queryStats: {
    query: string
    calls: number
    total_time: number
    mean_time: number
    max_time: number
  }[]
  indexStats: {
    tablename: string
    indexname: string
    idx_scan: number
    idx_tup_read: number
  }[]
  tableStats: {
    tablename: string
    n_tup_ins: number
    n_tup_upd: number
    n_tup_del: number
    n_live_tup: number
    n_dead_tup: number
  }[]
  systemStats: {
    active_connections: number
    total_connections: number
    database_size: string
    cache_hit_ratio: number
  }
}

export default function AdminPerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    loadPerformanceStats()
    const interval = setInterval(loadPerformanceStats, 30000) // 30초마다 갱신
    return () => clearInterval(interval)
  }, [])

  const loadPerformanceStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/performance-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('user_id')}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('성능 통계 조회 실패')
      }

      const data = await response.json()
      setStats(data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('성능 통계 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshMaterializedViews = async () => {
    try {
      const response = await fetch('/api/admin/refresh-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('user_id')}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        await loadPerformanceStats()
        alert('통계가 성공적으로 갱신되었습니다.')
      } else {
        throw new Error('통계 갱신 실패')
      }
    } catch (error) {
      console.error('통계 갱신 실패:', error)
      alert('통계 갱신에 실패했습니다.')
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getPerformanceColor = (value: number, thresholds: { good: number, warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600'
    if (value <= thresholds.warning) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading && !stats) {
    return (
      <div className="p-8 text-center">
        <div className="text-lg text-gray-600">성능 통계를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">시스템 성능 모니터링</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            마지막 갱신: {lastRefresh?.toLocaleTimeString() || '-'}
          </div>
          <button
            onClick={refreshMaterializedViews}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            통계 갱신
          </button>
          <button
            onClick={loadPerformanceStats}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            새로고침
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* 시스템 개요 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">활성 연결</div>
              <div className={`text-2xl font-bold ${getPerformanceColor(
                stats.systemStats.active_connections / stats.systemStats.total_connections * 100,
                { good: 50, warning: 80 }
              )}`}>
                {stats.systemStats.active_connections}/{stats.systemStats.total_connections}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">데이터베이스 크기</div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.systemStats.database_size}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">캐시 적중률</div>
              <div className={`text-2xl font-bold ${getPerformanceColor(
                100 - stats.systemStats.cache_hit_ratio,
                { good: 5, warning: 15 }
              )}`}>
                {stats.systemStats.cache_hit_ratio.toFixed(1)}%
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-sm font-medium text-gray-500">상태</div>
              <div className="text-2xl font-bold text-green-600">정상</div>
            </div>
          </div>

          {/* 슬로우 쿼리 분석 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">슬로우 쿼리 분석</h3>
              <p className="text-sm text-gray-500">평균 실행 시간이 긴 쿼리들</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      쿼리
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      호출 횟수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      평균 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      최대 시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      총 시간
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.queryStats.slice(0, 10).map((query, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                        {query.query.length > 100 ? 
                          `${query.query.substring(0, 100)}...` : 
                          query.query
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {query.calls.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getPerformanceColor(
                        query.mean_time, { good: 100, warning: 500 }
                      )}`}>
                        {formatTime(query.mean_time)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${getPerformanceColor(
                        query.max_time, { good: 500, warning: 2000 }
                      )}`}>
                        {formatTime(query.max_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(query.total_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 인덱스 사용률 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">인덱스 사용률</h3>
              <p className="text-sm text-gray-500">인덱스별 스캔 횟수와 효율성</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      테이블
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      인덱스
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      스캔 횟수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      읽은 행 수
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      효율성
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.indexStats.slice(0, 15).map((idx, index) => {
                    const efficiency = idx.idx_scan > 0 ? idx.idx_tup_read / idx.idx_scan : 0
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {idx.tablename}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {idx.indexname}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {idx.idx_scan.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {idx.idx_tup_read.toLocaleString()}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          efficiency > 10 ? 'text-red-600' : 
                          efficiency > 5 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {efficiency.toFixed(1)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 테이블 통계 */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">테이블 활동 통계</h3>
              <p className="text-sm text-gray-500">테이블별 INSERT/UPDATE/DELETE 작업 현황</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      테이블
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      삽입
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      수정
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      삭제
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      활성 행
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      죽은 행
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.tableStats.map((table, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {table.tablename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.n_tup_ins.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.n_tup_upd.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.n_tup_del.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {table.n_live_tup.toLocaleString()}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                        table.n_dead_tup > table.n_live_tup * 0.1 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {table.n_dead_tup.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 성능 권장사항 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-lg font-medium text-yellow-800 mb-2">성능 권장사항</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• 평균 쿼리 시간이 500ms 이상인 쿼리를 최적화하세요.</li>
              <li>• 인덱스 효율성이 10 이상인 항목은 인덱스 재구성을 고려하세요.</li>
              <li>• 죽은 행이 많은 테이블은 VACUUM 작업을 실행하세요.</li>
              <li>• 캐시 적중률이 95% 미만이면 shared_buffers 증가를 고려하세요.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
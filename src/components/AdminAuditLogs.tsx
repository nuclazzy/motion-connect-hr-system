'use client'

import { useState, useEffect } from 'react'
import { AuditLogger, AuditSeverity, AuditCategory } from '@/lib/audit/audit-logger'

interface AuditLogEntry {
  id: string
  created_at: string
  user_name: string
  user_email: string
  action_type: string
  table_name: string
  description: string
  severity: string
  category: string
  affected_resource: string
  ip_address: string
  changes: any
}

interface AuditStats {
  total: number
  byAction: Record<string, number>
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
  dailyCount: Record<string, number>
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    severity: '',
    category: '',
    action: '',
    days: 7
  })

  useEffect(() => {
    loadAuditData()
  }, [filters])

  const loadAuditData = async () => {
    setLoading(true)
    try {
      // 감사 로그 및 통계 조회
      const [logsData, statsData] = await Promise.all([
        AuditLogger.getAuditLogs({
          severity: filters.severity as AuditSeverity || undefined,
          category: filters.category as AuditCategory || undefined,
          limit: 100
        }),
        AuditLogger.getAuditStats(filters.days)
      ])

      setLogs(logsData)
      setStats(statsData)
    } catch (error) {
      console.error('감사 로그 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'WARN': return 'bg-yellow-100 text-yellow-800'
      case 'INFO': return 'bg-blue-100 text-blue-800'
      case 'LOW': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'SECURITY': return 'bg-red-100 text-red-800'
      case 'PERMISSION': return 'bg-purple-100 text-purple-800'
      case 'AUTHENTICATION': return 'bg-indigo-100 text-indigo-800'
      case 'DATA_CHANGE': return 'bg-green-100 text-green-800'
      case 'SYSTEM': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="text-lg text-gray-600">감사 로그를 불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 감사 로그 통계 요약 */}
      {stats && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            감사 로그 통계 (최근 {filters.days}일)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-500">총 이벤트</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {stats.bySeverity.INFO || 0}
              </div>
              <div className="text-sm text-gray-500">일반 이벤트</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {(stats.bySeverity.WARN || 0) + (stats.bySeverity.HIGH || 0)}
              </div>
              <div className="text-sm text-gray-500">주의 이벤트</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {stats.bySeverity.CRITICAL || 0}
              </div>
              <div className="text-sm text-gray-500">긴급 이벤트</div>
            </div>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">필터</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              심각도
            </label>
            <select
              value={filters.severity}
              onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체</option>
              <option value="CRITICAL">긴급</option>
              <option value="HIGH">높음</option>
              <option value="WARN">주의</option>
              <option value="INFO">정보</option>
              <option value="LOW">낮음</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체</option>
              <option value="SECURITY">보안</option>
              <option value="PERMISSION">권한</option>
              <option value="AUTHENTICATION">인증</option>
              <option value="DATA_CHANGE">데이터 변경</option>
              <option value="SYSTEM">시스템</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              기간
            </label>
            <select
              value={filters.days}
              onChange={(e) => setFilters(prev => ({ ...prev, days: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={1}>1일</option>
              <option value={7}>7일</option>
              <option value={30}>30일</option>
              <option value={90}>90일</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={loadAuditData}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* 감사 로그 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">감사 로그</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사용자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  설명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  심각도
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP 주소
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length > 0 ? logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {log.user_name || '시스템'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {log.user_email || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.action_type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {log.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                      {log.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                      {log.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ip_address || '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    표시할 감사 로그가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
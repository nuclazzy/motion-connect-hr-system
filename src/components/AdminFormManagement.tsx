'use client'

import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/auth'

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request_data: any
  processed_at?: string
  user: {
    name: string
    department: string
  }
}

export default function AdminFormManagement() {
  const [requests, setRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const fetchRequests = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true)
    } else {
      setIsRefreshing(true)
    }
    setError(null)
    try {
      const response = await fetch(`/api/admin/form-requests?filter=${filter}`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error('서식 신청 내역을 불러오는데 실패했습니다.')
      }
      const data = await response.json()
      setRequests(data.requests || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    fetchRequests(true)
  }, [fetchRequests])

  const handleUpdateRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    const adminNote = newStatus === 'rejected' ? prompt('거절 사유를 입력하세요:') : undefined
    if (newStatus === 'rejected' && !adminNote) return

    // Optimistic update
    const originalRequests = [...requests]
    setRequests(currentRequests =>
      currentRequests.map(req =>
        req.id === requestId ? { ...req, status: newStatus, processed_at: new Date().toISOString() } : req
      )
    )

    try {
      const response = await fetch('/api/admin/approve-request', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          requestId, 
          action: newStatus === 'approved' ? 'approve' : 'reject',
          adminNote 
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || '상태 업데이트에 실패했습니다.')
      }
      
      // 성공 시 부드럽게 목록 갱신
      setTimeout(() => fetchRequests(false), 500)
    } catch (err) {
      alert(`처리 중 오류 발생: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setRequests(originalRequests) // 실패 시 원래 상태로 롤백
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'approved': return '승인됨'
      case 'rejected': return '거절됨'
      default: return '알 수 없음'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) return <div className="p-4">로딩 중...</div>
  if (error) return <div className="p-4 text-red-500">오류: {error}</div>

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg relative">
      {isRefreshing && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
          <div className="text-sm text-gray-500">새로고침 중...</div>
        </div>
      )}
      <div className="p-5">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">전체 서식 신청 내역</h3>
          <div className="space-x-2">
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'pending' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              승인 대기
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-sm rounded-md ${filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              전체 보기
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">서식 종류</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일시</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">처리</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length > 0 ? (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-gray-900">{request.user.name}</div>
                      <div className="text-gray-500">{request.user.department}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{request.form_type}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{formatDate(request.submitted_at)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                      {request.status === 'pending' ? (
                        <div className="space-x-4">
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'approved')}
                            className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleUpdateRequest(request.id, 'rejected')}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-400"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">{getStatusText(request.status)}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    {filter === 'pending' ? '승인 대기 중인 신청이 없습니다.' : '표시할 신청 내역이 없습니다.'}
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
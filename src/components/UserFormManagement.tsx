'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { type User } from '@/lib/auth'

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  request_data: {
    form_name?: string
    submitted_via?: string
  } | null
  processed_at?: string
  processed_by?: string
}

interface UserFormManagementProps {
  user: User
}

export default function UserFormManagement({ user }: UserFormManagementProps) {
  const [formRequests, setFormRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMyFormRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('form_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('서식 신청 조회 실패:', error)
      } else {
        setFormRequests(data || [])
      }
    } catch (err) {
      console.error('서식 신청 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchMyFormRequests()
  }, [fetchMyFormRequests])

  const handleDeleteRequest = async (requestId: string, formType: string) => {
    if (!confirm(`정말로 "${formType}" 신청을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('form_requests')
        .delete()
        .eq('id', requestId)
        .eq('user_id', user.id) // 본인이 신청한 것만 삭제 가능

      if (error) {
        console.error('서식 삭제 실패:', error)
        alert('서식 삭제에 실패했습니다.')
      } else {
        alert('서식 신청이 삭제되었습니다.')
        fetchMyFormRequests()
      }
    } catch (err) {
      console.error('서식 삭제 오류:', err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '대기중'
      case 'approved':
        return '승인됨'
      case 'rejected':
        return '거절됨'
      default:
        return '알 수 없음'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="ml-5">
            <h3 className="text-lg font-medium text-gray-900">내 서식 신청 내역</h3>
            <p className="text-sm text-gray-500">신청한 서식의 처리 상태를 확인하고 관리할 수 있습니다</p>
          </div>
        </div>

        <div className="mt-6">
          {formRequests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">신청한 서식이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      서식 종류
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      신청일시
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      처리일시
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {request.form_type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(request.submitted_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                          {getStatusText(request.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {request.processed_at ? formatDate(request.processed_at) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleDeleteRequest(request.id, request.form_type)}
                          className="text-red-600 hover:text-red-900"
                          disabled={request.status === 'approved'}
                          title={request.status === 'approved' ? '승인된 서식은 삭제할 수 없습니다' : '삭제'}
                        >
                          {request.status === 'approved' ? '삭제불가' : '삭제'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
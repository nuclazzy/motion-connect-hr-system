'use client'

import { useState, useEffect, useCallback } from 'react'
import { type User } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface FormRequest {
  id: string
  user_id: string
  form_type: string
  status: 'pending' | 'approved' | 'rejected'
  submitted_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request_data: any
  processed_at?: string
  processed_by?: string
  admin_notes?: string
  user?: {
    name: string
    department: string
    position: string
  }
}

interface UserFormManagementProps {
  user: User
  onApplyClick: () => void
}

export default function UserFormManagement({ user, onApplyClick }: UserFormManagementProps) {
  const [formRequests, setFormRequests] = useState<FormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchMyFormRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('form_requests')
        .select('id, user_id, form_type, status, submitted_at, request_data, processed_at, processed_by, admin_notes')
        .eq('user_id', user.id)
        .order('submitted_at', { ascending: false })

      if (error) {
        console.error('Supabase form requests error:', error)
        return
      }

      // UserFormManagement는 현재 사용자 본인의 요청만 조회하므로 user 정보가 필요 없음
      // 그러나 기존 인터페이스 호환성을 위해 현재 사용자 정보를 설정
      const formattedData = data?.map(item => ({
        ...item,
        user: {
          name: user.name,
          department: user.department,
          position: user.position
        }
      })) || []
      
      setFormRequests(formattedData)
    } catch (err) {
      console.error('서식 신청 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => {
    fetchMyFormRequests()
    
    // 폼 제출 성공 이벤트 리스너 추가
    const handleFormSubmitSuccess = () => {
      fetchMyFormRequests()
    }
    
    window.addEventListener('formSubmitSuccess', handleFormSubmitSuccess)
    
    return () => {
      window.removeEventListener('formSubmitSuccess', handleFormSubmitSuccess)
    }
  }, [fetchMyFormRequests])

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('정말로 이 신청을 취소하시겠습니까?\n승인된 휴가인 경우 사용된 휴가일수가 복원됩니다.')) {
      return
    }

    setCancellingId(requestId)
    try {
      const response = await fetch('/api/user/cancel-leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requestId }),
      })

      const result = await response.json()

      if (response.ok) {
        alert(result.message || '신청이 취소되었습니다.')
        await fetchMyFormRequests() // 목록 새로고침
      } else {
        alert(result.error || '취소 처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('취소 요청 오류:', error)
      alert('취소 처리 중 오류가 발생했습니다.')
    } finally {
      setCancellingId(null)
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
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
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
      case 'cancelled':
        return '취소됨'
      default:
        return '알 수 없음'
    }
  }

  // 서식 타입을 더 구체적으로 표시하는 함수
  const getDetailedFormType = (request: FormRequest) => {
    return request.form_type
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
        <div className="mb-6">
          <div className="flex items-center mb-6">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-5">
              <h3 className="text-lg font-medium text-gray-900">문서/서식 신청 및 내역</h3>
              <p className="text-sm text-gray-500">재직증명서, 경위서, 휴직계 등을 신청하고 내역을 확인합니다.</p>
            </div>
          </div>
          
          {/* 서식 신청 버튼 */}
          <div className="mb-6">
            <button
              onClick={onApplyClick}
              className="w-full bg-indigo-600 text-white px-6 py-4 rounded-lg text-lg font-medium hover:bg-indigo-700 flex items-center justify-center"
            >
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              문서 서식 신청하기
            </button>
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">통합 서식 시스템</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>• 모든 서식을 시스템 내에서 작성하고 자동으로 PDF가 생성됩니다.</p>
                <p>• 휴가 신청 시 잔여 휴가가 자동으로 확인되고 차감됩니다.</p>
                <p>• 관리자 승인을 거쳐 처리되며, 처리 상태는 아래 표에서 확인 가능합니다.</p>
                <p>• 생성된 PDF를 인쇄하여 서명 후 관리자에게 제출하세요.</p>
              </div>
            </div>
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
                      상태 / 처리
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {formRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {request.form_type}
                        </div>
                        {request.form_type === '휴가 신청서' && request.request_data && (
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="font-medium">{request.request_data['휴가형태']}</span>
                            {request.request_data['시작일'] && request.request_data['종료일'] && (
                              <span className="ml-2">
                                {request.request_data['시작일'] === request.request_data['종료일'] 
                                  ? `(${request.request_data['시작일']})` 
                                  : `(${request.request_data['시작일']} ~ ${request.request_data['종료일']})`
                                }
                              </span>
                            )}
                            {request.request_data['휴가일수'] && (
                              <span className="ml-2 text-blue-600">
                                {request.request_data['휴가일수']}일
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(request.submitted_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                            {getStatusText(request.status)}
                          </span>
                          {request.processed_at && (
                            <span className="text-xs text-gray-500 ml-3">
                              {formatDate(request.processed_at)}
                            </span>
                          )}
                        </div>
                        {request.status === 'rejected' && request.admin_notes && (
                          <div className="mt-2 text-xs text-red-500">
                            사유: {request.admin_notes}
                          </div>
                        )}
                        {(request.status === 'pending' || request.status === 'approved') && (
                          <div className="mt-2">
                            <button
                              onClick={() => handleCancelRequest(request.id)}
                              disabled={cancellingId === request.id}
                              className="bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                              {cancellingId === request.id ? '취소 중...' : '신청 취소'}
                            </button>
                          </div>
                        )}
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
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
  const [showLeaveForm, setShowLeaveForm] = useState(false)

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

  const openFormModal = (formType: string, formUrl: string) => {
    // Google Apps Script 웹앱은 iframe 제한이 있을 수 있으므로 새 창에서 열기
    const popup = window.open(formUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')
    
    if (!popup) {
      alert('팝업이 차단되었습니다. 브라우저의 팝업 차단을 해제해주세요.')
    }
  }

  const handleFormComplete = async (formType: string) => {
    if (confirm(`${formType} 서식을 작성하고 제출하셨나요?\n\n작성 완료 후 서식을 인쇄하여 대표에게 제출해주세요.`)) {
      try {
        const { error } = await supabase
          .from('form_requests')
          .insert([{
            user_id: user.id,
            form_type: formType,
            status: 'pending',
            request_data: {
              form_name: formType,
              submitted_via: '웹앱'
            }
          }])

        if (error) {
          console.error('서식 신청 실패:', error)
          alert('서식 신청에 실패했습니다.')
        } else {
          alert(`${formType} 신청이 완료되었습니다.\n관리자가 검토 후 처리해드립니다.`)
          fetchMyFormRequests()
        }
      } catch (err) {
        console.error('서식 신청 오류:', err)
        alert('신청 중 오류가 발생했습니다.')
      }
    }
  }

  const handleLeaveRequest = async () => {
    try {
      const { error } = await supabase
        .from('form_requests')
        .insert([
          {
            user_id: user.id,
            form_type: '휴가신청서',
            status: 'pending',
            request_data: {
              form_name: '휴가신청서',
              submitted_via: '웹앱'
            }
          }
        ])

      if (error) {
        console.error('휴가 신청 실패:', error)
        alert('휴가 신청에 실패했습니다.')
      } else {
        alert('휴가 신청서가 제출되었습니다.\n관리자가 검토 후 처리해드립니다.')
        setShowLeaveForm(false)
        fetchMyFormRequests()
      }
    } catch (err) {
      console.error('휴가 신청 오류:', err)
      alert('신청 중 오류가 발생했습니다.')
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
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
          <div className="space-y-3">
            {/* 휴가 신청서 */}
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <button
                onClick={() => setShowLeaveForm(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                휴가 신청서 작성
              </button>
              <span className="text-sm text-indigo-700">모달을 통한 직접 신청</span>
            </div>

            {/* 재직증명서 */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <button
                onClick={() => openFormModal('재직증명서', 'http://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=certificate')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center"
              >
                📄 재직증명서 작성
              </button>
              <button
                onClick={() => handleFormComplete('재직증명서')}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded text-sm font-medium border border-blue-300"
              >
                작성 완료
              </button>
            </div>

            {/* 경위서 */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
              <button
                onClick={() => openFormModal('경위서', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=report')}
                className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700 flex items-center"
              >
                📋 경위서 작성
              </button>
              <button
                onClick={() => handleFormComplete('경위서')}
                className="bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded text-sm font-medium border border-purple-300"
              >
                작성 완료
              </button>
            </div>

            {/* 휴직계 */}
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <button
                onClick={() => openFormModal('휴직계', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=leave')}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 flex items-center"
              >
                🏥 휴직계 작성
              </button>
              <button
                onClick={() => handleFormComplete('휴직계')}
                className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm font-medium border border-green-300"
              >
                작성 완료
              </button>
            </div>

            {/* 출산휴가 및 육아휴직 */}
            <div className="flex items-center justify-between p-3 bg-pink-50 rounded-lg border border-pink-200">
              <button
                onClick={() => openFormModal('출산휴가 및 육아휴직 신청서', 'https://script.google.com/a/motionsense.co.kr/macros/s/AKfycbwnUTLRBpF4gd35Lf07y34jFHsZpgKbTGcwwn5err0Mug9nUYqF0ONWmuntTckSo6Y9/exec?form=maternity')}
                className="bg-pink-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-pink-700 flex items-center"
              >
                👶 출산휴가 및 육아휴직 작성
              </button>
              <button
                onClick={() => handleFormComplete('출산휴가 및 육아휴직 신청서')}
                className="bg-pink-100 hover:bg-pink-200 text-pink-800 px-3 py-1 rounded text-sm font-medium border border-pink-300"
              >
                작성 완료
              </button>
            </div>
          </div>
        </div>

        {/* 공통 안내 문구 */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">서식 신청 안내</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>• 작성 버튼 클릭 시 새 창에서 웹앱 서식이 열립니다.</p>
                <p>• 서식 작성 후 인쇄하여 서명 후 관리자에게 제출하세요.</p>
                <p>• 웹앱에서 작성 완료 시 오른쪽 &ldquo;작성 완료&rdquo; 버튼을 눌러 신청 내역에 기록해주세요.</p>
                <p>• 관리자 승인을 거쳐 처리되며, 처리 상태는 아래 표에서 확인 가능합니다.</p>
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
                        {request.status !== 'approved' && (
                          <button
                            onClick={() => handleDeleteRequest(request.id, request.form_type)}
                            className="text-red-600 hover:text-red-900"
                            title="삭제"
                          >
                            삭제
                          </button>
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

      {/* 휴가 신청 모달 */}
      {showLeaveForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">휴가 신청서 작성</h3>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">휴가 신청 안내</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <p>• 휴가 신청서는 기존 웹앱을 통해 작성됩니다.</p>
                        <p>• 신청 후 관리자 승인을 거쳐 처리됩니다.</p>
                        <p>• 신청 상태는 이 페이지에서 확인할 수 있습니다.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-md p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">신청자 정보</h4>
                  <div className="text-sm text-gray-600">
                    <p>이름: {user.name}</p>
                    <p>부서: {user.department}</p>
                    <p>직급: {user.position}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleLeaveRequest}
                  className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700"
                >
                  휴가 신청서 제출
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
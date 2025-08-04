'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  name: string
  department: string
  position: string
  employee_id: string
}

interface ReviewLink {
  id: string
  user_id: string
  employee_name: string
  review_url: string
  season: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ReviewLinkWithUser extends ReviewLink {
  user?: User
}

export default function AdminReviewManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [reviewLinks, setReviewLinks] = useState<ReviewLinkWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    user_id: '',
    employee_name: '',
    review_url: '',
    season: 'both' as 'both' | '상반기' | '하반기'
  })

  const fetchData = useCallback(async () => {
    try {
      // 모든 사용자 조회 (관리자 제외)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, department, position, employee_id')
        .neq('role', 'admin')
        .order('employee_id')

      if (usersError) {
        console.error('사용자 조회 실패:', usersError)
      } else {
        setUsers(usersData || [])
      }

      // 모든 리뷰 링크 조회 (user 정보 별도 조회)
      const { data: reviewLinksData, error: reviewLinksError } = await supabase
        .from('review_links')
        .select('*')
        .order('created_at', { ascending: false })

      if (reviewLinksError) {
        console.error('리뷰 링크 조회 실패:', reviewLinksError)
      } else {
        // user 정보를 별도로 조회하여 매핑
        const reviewLinksWithUser = []
        if (reviewLinksData) {
          for (const reviewLink of reviewLinksData) {
            // 각 리뷰 링크에 대해 user 정보 조회
            const { data: userData } = await supabase
              .from('users')
              .select('name, department, position, employee_id')
              .eq('id', reviewLink.user_id)
              .single()
            
            reviewLinksWithUser.push({
              ...reviewLink,
              user: userData || { name: '알 수 없음', department: '알 수 없음', position: '알 수 없음', employee_id: '' }
            })
          }
        }
        setReviewLinks(reviewLinksWithUser)
      }
    } catch (err) {
      console.error('데이터 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.user_id || !formData.employee_name || !formData.review_url) {
      alert('모든 필드를 입력해주세요.')
      return
    }

    try {
      if (editingId) {
        // 수정
        const { error } = await supabase
          .from('review_links')
          .update({
            employee_name: formData.employee_name,
            review_url: formData.review_url,
            season: formData.season
          })
          .eq('id', editingId)

        if (error) {
          console.error('리뷰 링크 수정 실패:', error)
          alert('리뷰 링크 수정에 실패했습니다.')
        } else {
          alert('리뷰 링크가 성공적으로 수정되었습니다.')
          setEditingId(null)
          resetForm()
          fetchData()
        }
      } else {
        // 새로 추가
        const { error } = await supabase
          .from('review_links')
          .insert([{
            user_id: formData.user_id,
            employee_name: formData.employee_name,
            review_url: formData.review_url,
            season: formData.season
          }])

        if (error) {
          console.error('리뷰 링크 추가 실패:', error)
          alert('리뷰 링크 추가에 실패했습니다.')
        } else {
          alert('리뷰 링크가 성공적으로 추가되었습니다.')
          resetForm()
          fetchData()
        }
      }
    } catch (err) {
      console.error('리뷰 링크 처리 오류:', err)
      alert('오류가 발생했습니다.')
    }
  }

  const handleEdit = (reviewLink: ReviewLinkWithUser) => {
    setEditingId(reviewLink.id)
    setFormData({
      user_id: reviewLink.user_id,
      employee_name: reviewLink.employee_name,
      review_url: reviewLink.review_url,
      season: reviewLink.season as 'both' | '상반기' | '하반기'
    })
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 리뷰 링크를 삭제하시겠습니까?')) {
      try {
        const { error } = await supabase
          .from('review_links')
          .delete()
          .eq('id', id)

        if (error) {
          console.error('리뷰 링크 삭제 실패:', error)
          alert('리뷰 링크 삭제에 실패했습니다.')
        } else {
          alert('리뷰 링크가 성공적으로 삭제되었습니다.')
          fetchData()
        }
      } catch (err) {
        console.error('리뷰 링크 삭제 오류:', err)
        alert('오류가 발생했습니다.')
      }
    }
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('review_links')
        .update({ is_active: !isActive })
        .eq('id', id)

      if (error) {
        console.error('상태 변경 실패:', error)
        alert('상태 변경에 실패했습니다.')
      } else {
        fetchData()
      }
    } catch (err) {
      console.error('상태 변경 오류:', err)
      alert('오류가 발생했습니다.')
    }
  }

  const resetForm = () => {
    setFormData({
      user_id: '',
      employee_name: '',
      review_url: '',
      season: 'both'
    })
    setEditingId(null)
  }

  const handleUserSelect = (userId: string) => {
    const selectedUser = users.find(user => user.id === userId)
    if (selectedUser) {
      setFormData({
        ...formData,
        user_id: userId,
        employee_name: selectedUser.name
      })
    }
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
            <h3 className="text-lg font-medium text-gray-900">반기 리뷰 링크 관리</h3>
            <p className="text-sm text-gray-500">직원별 개별 반기 리뷰 링크를 설정하고 관리합니다</p>
          </div>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직원 선택
              </label>
              <select
                value={formData.user_id}
                onChange={(e) => handleUserSelect(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                required
              >
                <option value="">직원을 선택하세요</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.department} {user.position})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직원 이름
              </label>
              <input
                type="text"
                value={formData.employee_name}
                onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                required
                readOnly
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                리뷰 링크 URL
              </label>
              <input
                type="url"
                value={formData.review_url}
                onChange={(e) => setFormData({ ...formData, review_url: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://docs.google.com/spreadsheets/..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시즌
              </label>
              <select
                value={formData.season}
                onChange={(e) => setFormData({ ...formData, season: e.target.value as 'both' | '상반기' | '하반기' })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="both">상반기/하반기 공통</option>
                <option value="상반기">상반기만</option>
                <option value="하반기">하반기만</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex space-x-3">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              {editingId ? '수정' : '추가'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                취소
              </button>
            )}
          </div>
        </form>

        {/* 리뷰 링크 목록 */}
        <div className="mt-6">
          {reviewLinks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">설정된 리뷰 링크가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      직원
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      리뷰 링크
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시즌
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reviewLinks.map((reviewLink) => (
                    <tr key={reviewLink.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reviewLink.employee_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reviewLink.user?.department} {reviewLink.user?.position}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          <a 
                            href={reviewLink.review_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {reviewLink.review_url}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {reviewLink.season}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(reviewLink.id, reviewLink.is_active)}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            reviewLink.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {reviewLink.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(reviewLink)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(reviewLink.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        </div>
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
'use client'

import { useState } from 'react'
import { updateUserProfile, type User } from '@/lib/auth'

interface UserProfileProps {
  user: User
  onProfileUpdate: (updatedUser: User) => void
}

export default function UserProfile({ user, onProfileUpdate }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user.name,
    department: user.department,
    position: user.position,
    phone: '',
    dob: '',
    address: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await updateUserProfile(user.id, formData)
      
      if (result.success && result.user) {
        onProfileUpdate(result.user)
        setIsEditing(false)
      } else {
        setError(result.error || '프로필 업데이트에 실패했습니다.')
      }
    } catch {
      setError('프로필 업데이트 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: user.name,
      department: user.department,
      position: user.position,
      phone: '',
      dob: '',
      address: ''
    })
    setIsEditing(false)
    setError('')
  }

  if (isEditing) {
    return (
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-5">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-5">
                <h3 className="text-lg font-medium text-gray-900">내 정보 수정</h3>
              </div>
            </div>

            {error && (
              <div className="mb-4 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">회사 정보 (관리자만 수정 가능)</h4>
              
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  이름
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100"
                  required
                  disabled
                  title="회사 정보는 관리자만 수정 가능합니다"
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                  부서
                </label>
                <input
                  type="text"
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-100"
                  required
                  disabled
                  title="회사 정보는 관리자만 수정 가능합니다"
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                  직책
                </label>
                <input
                  type="text"
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  required
                  disabled
                  title="회사 정보는 관리자만 수정 가능합니다"
                />
              </div>
              
              <hr className="my-4" />
              <h4 className="text-sm font-medium text-gray-900 mb-3">개인 정보 (수정 가능)</h4>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  전화번호
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="010-0000-0000"
                />
              </div>
              
              <div>
                <label htmlFor="dob" className="block text-sm font-medium text-gray-700">
                  생년월일
                </label>
                <input
                  type="date"
                  id="dob"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  주소
                </label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="주소를 입력하세요"
                />
              </div>

              <div className="text-sm text-gray-600">
                <p>사번: {user.employee_id}</p>
                <p>이메일: {user.email}</p>
                <p>근무년차: 1년차</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-5 py-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                내 정보
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {user.name}
              </dd>
            </dl>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-sm text-gray-600 space-y-1">
            <p>사번: {user.employee_id}</p>
            <p>부서: {user.department}</p>
            <p>직책: {user.position}</p>
            <p>이메일: {user.email}</p>
            <p>근무년차: 1년차</p>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-5 py-3">
        <div className="text-sm">
          <button 
            onClick={() => setIsEditing(true)}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            정보 수정
          </button>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { updateUserProfile, type User, authenticatedFetch } from '@/lib/auth'

interface UserProfileProps {
  user: User
  onProfileUpdate: (updatedUser: User) => void
}

export default function UserProfile({ user, onProfileUpdate }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [formData, setFormData] = useState({
    phone: user.phone || '',
    dob: user.dob || '',
    address: user.address || ''
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // 근무년차 계산 함수
  const calculateYearsOfService = (hireDate: string) => {
    if (!hireDate) return '미정'
    
    const hire = new Date(hireDate)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - hire.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const years = Math.floor(diffDays / 365)
    
    if (years === 0) {
      return '1년차 미만'
    } else {
      return `${years + 1}년차`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await updateUserProfile(user.id, formData)
      
      if (result.success && result.user) {
        onProfileUpdate(result.user)
        setIsEditing(false)
        setSuccessMessage('프로필이 성공적으로 업데이트되었습니다.')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setError(result.error || '프로필 업데이트에 실패했습니다.')
      }
    } catch {
      setError('프로필 업데이트 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordLoading(true)
    setPasswordError('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('새 비밀번호가 일치하지 않습니다.')
      setPasswordLoading(false)
      return
    }

    if (passwordData.newPassword.length < 4) {
      setPasswordError('새 비밀번호는 최소 4자 이상이어야 합니다.')
      setPasswordLoading(false)
      return
    }

    try {
      const response = await authenticatedFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      })

      const result = await response.json()

      if (result.success) {
        setShowPasswordChange(false)
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setSuccessMessage('비밀번호가 성공적으로 변경되었습니다.')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        setPasswordError(result.error || '비밀번호 변경에 실패했습니다.')
      }
    } catch {
      setPasswordError('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      phone: user.phone || '',
      dob: user.dob || '',
      address: user.address || ''
    })
    setIsEditing(false)
    setError('')
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR')
  }

  if (isEditing) {
    return (
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">프로필 수정</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 (수정 불가)
              </label>
              <input
                type="text"
                value={user.name}
                className="w-full border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                부서 (수정 불가)
              </label>
              <input
                type="text"
                value={user.department}
                className="w-full border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                직책 (수정 불가)
              </label>
              <input
                type="text"
                value={user.position}
                className="w-full border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                disabled
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전화번호
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="010-0000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                생년월일
              </label>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="주소를 입력하세요"
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>사번: {user.employee_id}</p>
            <p>이메일: {user.email}</p>
            <p>근무년차: {calculateYearsOfService(user.hire_date)}</p>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">내 정보</h3>
      </div>
      
      <div className="p-5">
        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {successMessage}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">이름</label>
              <p className="mt-1 text-sm text-gray-900">{user.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">부서</label>
              <p className="mt-1 text-sm text-gray-900">{user.department}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">직책</label>
              <p className="mt-1 text-sm text-gray-900">{user.position}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">전화번호</label>
              <p className="mt-1 text-sm text-gray-900">{user.phone || '미입력'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">생년월일</label>
              <p className="mt-1 text-sm text-gray-900">{user.dob ? formatDate(user.dob) : '미입력'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500">입사일</label>
              <p className="mt-1 text-sm text-gray-900">{formatDate(user.hire_date)}</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-500">주소</label>
              <p className="mt-1 text-sm text-gray-900">{user.address || '미입력'}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm text-gray-600 space-y-1">
              <p>사번: {user.employee_id}</p>
              <p>이메일: {user.email}</p>
              <p>근무년차: {calculateYearsOfService(user.hire_date)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex space-x-3">
          <button 
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700"
          >
            프로필 수정
          </button>
          <button 
            onClick={() => setShowPasswordChange(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-gray-700"
          >
            비밀번호 변경
          </button>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">비밀번호 변경</h3>
            </div>
            
            <form onSubmit={handlePasswordChange} className="p-6">
              {passwordError && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {passwordError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    새 비밀번호
                  </label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false)
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                    setPasswordError('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {passwordLoading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { updateUserProfile, changePassword, type User } from '@/lib/auth'

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

  // 메모리 정리를 위한 useEffect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    
    if (successMessage) {
      timeoutId = setTimeout(() => setSuccessMessage(''), 2000)
    }
    
    // cleanup 함수
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [successMessage])

  // 근무년차 계산 함수 (메모이제이션)
  const calculateYearsOfService = useCallback((hireDate: string) => {
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
  }, [])

  // 입력값 검증 함수
  const validateInputs = () => {
    // 전화번호 검증 (010-0000-0000 형식)
    if (formData.phone && !/^010-\d{4}-\d{4}$/.test(formData.phone)) {
      return '전화번호는 010-0000-0000 형식으로 입력해주세요.'
    }

    // 생년월일 검증 (18-100세)
    if (formData.dob) {
      const birthYear = new Date(formData.dob).getFullYear()
      const currentYear = new Date().getFullYear()
      const age = currentYear - birthYear
      if (age < 18 || age > 100) {
        return '올바른 생년월일을 입력해주세요. (18-100세)'
      }
    }

    // 주소 길이 제한 (200자)
    if (formData.address && formData.address.length > 200) {
      return '주소는 200자 이내로 입력해주세요.'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 중복 클릭 방지
    if (loading) return
    
    // 입력값 검증
    const validationError = validateInputs()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await updateUserProfile(user.id, formData)
      
      if (result.success && result.user) {
        onProfileUpdate(result.user)
        setIsEditing(false)
        setSuccessMessage('프로필이 성공적으로 업데이트되었습니다.')
        // useEffect에서 자동으로 처리됨
      } else {
        setError(result.error || '프로필 업데이트에 실패했습니다.')
      }
    } catch (error: any) {
      // 구체적인 에러 메시지
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        setError('인터넷 연결을 확인해주세요.')
      } else if (error?.message?.includes('timeout')) {
        setError('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError('프로필 업데이트 중 오류가 발생했습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 중복 클릭 방지
    if (passwordLoading) return
    
    setPasswordLoading(true)
    setPasswordError('')

    // 현재 비밀번호 입력 확인
    if (!passwordData.currentPassword.trim()) {
      setPasswordError('현재 비밀번호를 입력해주세요.')
      setPasswordLoading(false)
      return
    }

    // 새 비밀번호 입력 확인
    if (!passwordData.newPassword.trim()) {
      setPasswordError('새 비밀번호를 입력해주세요.')
      setPasswordLoading(false)
      return
    }

    // 비밀번호 확인 입력 확인
    if (!passwordData.confirmPassword.trim()) {
      setPasswordError('비밀번호 확인을 입력해주세요.')
      setPasswordLoading(false)
      return
    }

    // 새 비밀번호 일치 확인 (가장 중요!)
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('⚠️ 새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      setPasswordLoading(false)
      return
    }

    // 비밀번호 길이 확인 (6자로 완화)
    if (passwordData.newPassword.length < 6) {
      setPasswordError('새 비밀번호는 최소 6자 이상이어야 합니다.')
      setPasswordLoading(false)
      return
    }

    // 현재 비밀번호와 동일한지 확인
    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordError('새 비밀번호는 현재 비밀번호와 달라야 합니다.')
      setPasswordLoading(false)
      return
    }

    try {
      // Supabase 직접 연동으로 비밀번호 변경
      const result = await changePassword(
        user.id,
        passwordData.currentPassword,
        passwordData.newPassword
      )

      if (result.success) {
        setShowPasswordChange(false)
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        setSuccessMessage('비밀번호가 성공적으로 변경되었습니다.')
        // useEffect에서 자동으로 처리됨
      } else {
        setPasswordError(result.error || '비밀번호 변경에 실패했습니다.')
      }
    } catch (error: any) {
      // 구체적인 에러 메시지
      if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
        setPasswordError('인터넷 연결을 확인해주세요.')
      } else if (error?.message?.includes('timeout')) {
        setPasswordError('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setPasswordError('비밀번호 변경 중 오류가 발생했습니다.')
      }
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
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave'

interface Employee {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  employee_id: string
  department: string
  position: string
  phone?: string
  hire_date?: string
  dob?: string
  address?: string
  work_type?: string
  termination_date?: string
  contract_end_date?: string | null
}

export default function AdminEmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    employee_id: '',
    department: '',
    position: '',
    role: 'user' as 'admin' | 'user',
    phone: '',
    dob: '',
    address: '',
    work_type: '정규직',
    hire_date: '',
    contract_end_date: null as string | null,
    newPassword: '',
    reviewUrl: ''
  })

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, role, employee_id, department, position, phone, hire_date, dob, address, work_type, termination_date, contract_end_date')
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching employees:', error)
      } else {
        setEmployees(data || [])
      }
    } catch (err) {
      console.error('Error in fetchEmployees:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmployee = () => {
    setFormData({
      name: '',
      email: '',
      employee_id: '',
      department: '',
      position: '',
      role: 'user',
      phone: '',
      dob: '',
      address: '',
      work_type: '정규직',
      hire_date: new Date().toISOString().split('T')[0],
      contract_end_date: null,
      newPassword: '',
      reviewUrl: ''
    })
    setEditingEmployee(null)
    setShowAddForm(true)
  }

  const handleEditEmployee = async (employee: Employee) => {
    // 기존 리뷰 링크 조회
    let existingReviewUrl = ''
    try {
      const { data: reviewData } = await supabase
        .from('review_links')
        .select('review_url')
        .eq('user_id', employee.id)
        .single()
      
      if (reviewData) {
        existingReviewUrl = reviewData.review_url
      }
    } catch (error) {
      console.log('No existing review link found:', error)
    }

    setFormData({
      name: employee.name,
      email: employee.email,
      employee_id: employee.employee_id,
      department: employee.department,
      position: employee.position,
      role: employee.role,
      phone: employee.phone || '',
      dob: employee.dob || '',
      address: employee.address || '',
      work_type: employee.work_type || '정규직',
      hire_date: employee.hire_date || '',
      contract_end_date: employee.contract_end_date || null,
      newPassword: '',
      reviewUrl: existingReviewUrl
    })
    setEditingEmployee(employee)
    setShowAddForm(true)
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    const dataToSubmit = { ...formData };
    if (dataToSubmit.work_type === '정규직') {
      dataToSubmit.contract_end_date = null;
    } else if (!dataToSubmit.contract_end_date) {
        alert('계약직/인턴의 경우 계약 만료일을 반드시 입력해야 합니다.');
        setFormLoading(false);
        return;
    }

    try {
      if (editingEmployee) {
        // 관리자 API를 통한 수정
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
        
        const response = await fetch(`/api/admin/users/${editingEmployee.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            adminId: currentUser.id,
            ...dataToSubmit,
            newPassword: formData.newPassword || undefined
          }),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || '수정에 실패했습니다.')
        }

        // 입사일이 변경되었을 수 있으므로 연차 정보도 업데이트
        const annual_days = calculateAnnualLeave(result.user.hire_date);
        const { error: leaveError } = await supabase
            .from('leave_days')
            .update({ 
                leave_types: { 
                    annual_days: annual_days,
                    used_annual_days: 0, // 입사일 변경 시 사용일수는 초기화 (정책 필요)
                    sick_days: 5, // 기본 병가
                    used_sick_days: 0
                }
            })
            .eq('user_id', result.user.id)

        if (leaveError) throw leaveError;

        // 리뷰 링크 저장/업데이트
        if (formData.reviewUrl.trim()) {
          const { error: reviewError } = await supabase
            .from('review_links')
            .upsert([{
              user_id: result.user.id,
              employee_name: result.user.name,
              review_url: formData.reviewUrl.trim(),
              season: 'both',
              is_active: true
            }], {
              onConflict: 'user_id'
            })
          
          if (reviewError) {
            console.error('리뷰 링크 저장 실패:', reviewError)
          }
        } else {
          // 리뷰 URL이 비어있으면 기존 링크 삭제
          await supabase
            .from('review_links')
            .delete()
            .eq('user_id', result.user.id)
        }

        alert('직원 정보가 수정되었습니다.')
        setShowAddForm(false)
        fetchEmployees()

      } else {
        // 추가
        const bcrypt = await import('bcryptjs')
        const passwordHash = await bcrypt.hash('0000', 10) // 기본 비밀번호

        const { data: newUserData, error: userError } = await supabase
          .from('users')
          .insert([{
            ...dataToSubmit,
            password_hash: passwordHash
          }])
          .select()
          .single()

        if (userError) throw userError;

        // 새 직원의 연차 정보 생성
        const annual_days = calculateAnnualLeave(newUserData.hire_date);
        const { error: leaveError } = await supabase
            .from('leave_days')
            .insert([{
                user_id: newUserData.id,
                leave_types: { 
                    annual_days: annual_days,
                    used_annual_days: 0,
                    sick_days: 5, // 기본 병가
                    used_sick_days: 0
                }
            }]);

        if (leaveError) {
            // 유저 생성은 성공했으나 휴가 정보 생성 실패 시 롤백(유저 삭제)
            await supabase.from('users').delete().eq('id', newUserData.id);
            throw leaveError;
        }

        // 리뷰 링크 저장 (새 직원 추가 시)
        if (formData.reviewUrl.trim()) {
          const { error: reviewError } = await supabase
            .from('review_links')
            .insert([{
              user_id: newUserData.id,
              employee_name: newUserData.name,
              review_url: formData.reviewUrl.trim(),
              season: 'both',
              is_active: true
            }])
          
          if (reviewError) {
            console.error('리뷰 링크 저장 실패:', reviewError)
          }
        }

        alert('새 직원이 추가되었습니다. (기본 비밀번호: 0000)')
        setShowAddForm(false)
        fetchEmployees()
      }
    } catch (err) {
      console.error('폼 제출 오류:', err)
      alert('오류가 발생했습니다.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleCloseForm = () => {
    setFormData({
      name: '',
      email: '',
      employee_id: '',
      department: '',
      position: '',
      role: 'user' as 'admin' | 'user',
      phone: '',
      dob: '',
      address: '',
      work_type: '정규직',
      hire_date: '',
      contract_end_date: null as string | null,
      newPassword: '',
      reviewUrl: ''
    })
    setShowAddForm(false)
    setEditingEmployee(null)
  }

  // 퇴사자와 재직자 구분
  const activeEmployees = employees.filter(emp => !emp.termination_date || new Date(emp.termination_date) > new Date())
  const retiredEmployees = employees.filter(emp => emp.termination_date && new Date(emp.termination_date) <= new Date())
  
  const displayEmployees = showActiveOnly ? activeEmployees : retiredEmployees
  
  const handleTerminate = async (employeeId: string) => {
    if (!confirm('정말 퇴사 처리하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ termination_date: new Date().toISOString().split('T')[0] })
        .eq('id', employeeId)
        
      if (error) {
        alert('퇴사 처리에 실패했습니다.')
      } else {
        alert('퇴사 처리가 완료되었습니다.')
        fetchEmployees()
        setSelectedEmployee(null)
      }
    } catch (err) {
      console.error('퇴사 처리 오류:', err)
      alert('오류가 발생했습니다.')
    }
  }
  
  const handleReinstate = async (employeeId: string) => {
    if (!confirm('정말 복직 처리하시겠습니까?')) return
    
    try {
      const { error } = await supabase
        .from('users')
        .update({ termination_date: null })
        .eq('id', employeeId)
        
      if (error) {
        alert('복직 처리에 실패했습니다.')
      } else {
        alert('복직 처리가 완료되었습니다.')
        fetchEmployees()
        setSelectedEmployee(null)
      }
    } catch (err) {
      console.error('복직 처리 오류:', err)
      alert('오류가 발생했습니다.')
    }
  }
  
  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm('정말 직원을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.')) return
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', employeeId)
        
      if (error) {
        alert('직원 삭제에 실패했습니다.')
      } else {
        alert('직원이 삭제되었습니다.')
        fetchEmployees()
        setSelectedEmployee(null)
      }
    } catch (err) {
      console.error('직원 삭제 오류:', err)
      alert('오류가 발생했습니다.')
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

  const departmentCounts = activeEmployees.reduce((acc, emp) => {
    acc[emp.department] = (acc[emp.department] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* 요약 위젯 */}
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  직원 관리
                </dt>
                <dd className="text-lg font-medium text-gray-900">
                  재직자 {activeEmployees.length}명 | 퇴사자 {retiredEmployees.length}명
                </dd>
              </dl>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-sm text-gray-600 space-y-1">
              {Object.entries(departmentCounts).map(([dept, count]) => (
                <p key={dept}>{dept}: {count}명</p>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-5 py-3">
          <div className="text-sm">
            <button 
              onClick={handleAddEmployee}
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              직원 추가
            </button>
          </div>
        </div>
      </div>

      {/* 직원 선택 및 관리 */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">직원 관리</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                직원을 선택하여 상세 정보를 확인하고 수정하세요
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowActiveOnly(true)}
                className={`px-3 py-1 text-sm rounded-md ${showActiveOnly ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
              >
                재직자 ({activeEmployees.length})
              </button>
              <button
                onClick={() => setShowActiveOnly(false)}
                className={`px-3 py-1 text-sm rounded-md ${!showActiveOnly ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}
              >
                퇴사자 ({retiredEmployees.length})
              </button>
            </div>
          </div>
          
          {/* 직원 선택 드롭다운 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {showActiveOnly ? '재직자' : '퇴사자'} 선택
            </label>
            <select
              value={selectedEmployee?.id || ''}
              onChange={(e) => {
                const employee = displayEmployees.find(emp => emp.id === e.target.value)
                setSelectedEmployee(employee || null)
              }}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">직원을 선택하세요</option>
              {displayEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.department} {employee.position} ({employee.employee_id})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* 선택된 직원 상세 정보 */}
        {selectedEmployee && (
          <div className="border-t border-gray-200 px-4 py-5">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 h-12 w-12">
                    <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-700">
                        {selectedEmployee.name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h4 className="text-lg font-medium text-gray-900">{selectedEmployee.name}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedEmployee.department} | {selectedEmployee.position} | {selectedEmployee.employee_id}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${selectedEmployee.role === 'admin' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedEmployee.role === 'admin' ? '관리자' : '사용자'}
                    </span>
                    {selectedEmployee.termination_date && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        퇴사일: {selectedEmployee.termination_date}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600"><strong>이메일:</strong> {selectedEmployee.email}</p>
                    <p className="text-gray-600"><strong>전화번호:</strong> {selectedEmployee.phone || '미등록'}</p>
                    <p className="text-gray-600"><strong>생년월일:</strong> {selectedEmployee.dob || '미등록'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600"><strong>입사일:</strong> {selectedEmployee.hire_date || '미등록'}</p>
                    <p className="text-gray-600"><strong>근무형태:</strong> {selectedEmployee.work_type || '미등록'}</p>
                    {selectedEmployee.contract_end_date && (
                        <p className="text-gray-600"><strong>계약만료일:</strong> {selectedEmployee.contract_end_date}</p>
                    )}
                    <p className="text-gray-600"><strong>주소:</strong> {selectedEmployee.address || '미등록'}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col space-y-2 ml-4">
                <button
                  onClick={() => handleEditEmployee(selectedEmployee)}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  수정
                </button>
                <a
                  href="https://docs.google.com/spreadsheets/d/1I4eH8V45PreS3QG8AVjz5kc09uavGTzqbOz8ODh6EBI/edit?gid=1461209875#gid=1461209875"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-purple-700"
                >
                  근태 기록
                </a>
                {showActiveOnly ? (
                  <button
                    onClick={() => handleTerminate(selectedEmployee.id)}
                    className="bg-yellow-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-yellow-700"
                  >
                    퇴사 처리
                  </button>
                ) : (
                  <button
                    onClick={() => handleReinstate(selectedEmployee.id)}
                    className="bg-green-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    복직
                  </button>
                )}
                <button
                  onClick={() => handleDeleteEmployee(selectedEmployee.id)}
                  className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 직원 추가/수정 모달 */}
      {(showAddForm || editingEmployee) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingEmployee ? '직원 정보 수정' : '새 직원 추가'}
              </h3>
              
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">이름</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">사번</label>
                  <input
                    type="text"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">부서</label>
                  <select 
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  >
                    <option value="">부서 선택</option>
                    <option value="경영팀">경영팀</option>
                    <option value="편집팀">편집팀</option>
                    <option value="촬영팀">촬영팀</option>
                    <option value="행사기획팀">행사기획팀</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">직책</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({...formData, position: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">권한</label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as 'admin' | 'user'})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="user">사용자</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">전화번호</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="010-0000-0000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">생년월일</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({...formData, dob: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">주소</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="주소를 입력하세요"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">입사일</label>
                  <input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({...formData, hire_date: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">근무형태</label>
                  <select 
                    value={formData.work_type}
                    onChange={(e) => setFormData({...formData, work_type: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="정규직">정규직</option>
                    <option value="계약직">계약직</option>
                    <option value="인턴">인턴</option>
                    <option value="프리랜서">프리랜서</option>
                  </select>
                </div>

                {(formData.work_type === '계약직' || formData.work_type === '인턴') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">계약 만료일</label>
                    <input
                      type="date"
                      value={formData.contract_end_date || ''}
                      onChange={(e) => setFormData({...formData, contract_end_date: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">반기 리뷰 링크 (선택사항)</label>
                  <input
                    type="url"
                    value={formData.reviewUrl}
                    onChange={(e) => setFormData({...formData, reviewUrl: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="https://docs.google.com/spreadsheets/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">직원의 개별 반기 리뷰 스프레드시트 링크를 입력하세요</p>
                </div>

                {editingEmployee && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">새 비밀번호 (선택사항)</label>
                    <input
                      type="password"
                      value={formData.newPassword}
                      onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="새 비밀번호를 입력하세요 (입력하지 않으면 기존 비밀번호 유지)"
                    />
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading ? '처리 중...' : (editingEmployee ? '수정' : '추가')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

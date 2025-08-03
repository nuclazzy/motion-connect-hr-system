'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/lib/auth'
import { getLeaveStatus, LEAVE_TYPE_NAMES } from '@/lib/hoursToLeaveDay'

interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'time'
  required: boolean
  options?: string[]
  defaultValue?: string
  condition?: {
    field: string
    operator: 'in' | 'not in' | '>=' | '<=' | '==' | '!='
    value: string | string[]
  }
}

interface FormTemplate {
  id: string
  name: string
  description: string
  fields: FormField[]
}

interface FormApplicationModalProps {
  user: User
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultFormType?: string | null
  defaultValues?: Record<string, string> | null
}

export default function FormApplicationModal({ user, isOpen, onClose, onSuccess, defaultFormType, defaultValues }: FormApplicationModalProps) {
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [modalTitle, setModalTitle] = useState('서식 신청')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaveData, setLeaveData] = useState<any>(null)

  // 폼 템플릿 목록 로드
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/form-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates)
      } else {
        setError('폼 템플릿을 불러올 수 없습니다.')
      }
    } catch (err) {
      setError('폼 템플릿 로드 중 오류가 발생했습니다.')
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 휴가 데이터 로드
  const loadLeaveData = useCallback(async () => {
    try {
      const response = await fetch(`/api/user/leave-data?userId=${user.id}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setLeaveData(result.data)
        }
      }
    } catch (err) {
      console.error('휴가 데이터 로드 오류:', err)
    }
  }, [user.id])

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
      loadLeaveData()
    } else {
      // 모달이 닫힐 때 상태 초기화
      setSelectedTemplate(null)
      setFormData({})
      setModalTitle('서식 신청')
      setError('')
    }
  }, [isOpen, loadTemplates, loadLeaveData])

  // defaultFormType이 제공되면 해당 템플릿을 자동으로 선택
  useEffect(() => {
    if (isOpen && defaultFormType && templates.length > 0 && !selectedTemplate) {
      const template = templates.find(t => t.name === defaultFormType)
      if (template) {
        setSelectedTemplate(template)
      } else {
        setError(`'${defaultFormType}' 서식을 찾을 수 없습니다.`)
      }
    }
  }, [isOpen, defaultFormType, templates, selectedTemplate])

  // 템플릿 선택 시 기본값 설정
  useEffect(() => {
    if (selectedTemplate) {
      const initialData: Record<string, string> = {}
      
      selectedTemplate.fields.forEach(field => {
        if (field.defaultValue === 'today') {
          initialData[field.name] = new Date().toISOString().split('T')[0]
        }
      })
      
      setFormData(prev => ({ ...initialData, ...prev, ...defaultValues }))

      // 동적 제목 설정
      if (defaultValues?.휴가형태) {
        setModalTitle(`${defaultValues.휴가형태} 신청`)
      } else {
        setModalTitle(selectedTemplate.name)
      }
    }
  }, [selectedTemplate, defaultValues])

  // 자동 계산 함수들
  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) return 0
    
    // 같은 날짜면 1일
    if (startDate === endDate) {
      return 1
    }
    
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  // 경조사 휴가 일수 계산
  const getCondolenceLeave = (type: string): number => {
    switch (type) {
      case '본인 결혼': return 5
      case '자녀 결혼': return 2
      case '부모 사망':
      case '배우자 사망': return 5
      case '배우자 부모 사망': return 3
      case '자녀 사망':
      case '형제·자매 사망': return 3
      case '기타 가족/친족 사망': return 0 // 회사와 협의
      default: return 0
    }
  }

  const calculateHours = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return ''
    const start = new Date(`1970-01-01T${startTime}:00`)
    const end = new Date(`1970-01-01T${endTime}:00`)
    if (end < start) return '종료시간 오류'
    const diffMinutes = (end.getTime() - start.getTime()) / 60000
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    return `${hours}시간 ${minutes}분`
  }

  const calculateEmploymentPeriod = (hireDate: string, requestDate: string): string => {
    if (!hireDate || !requestDate) return ''
    const start = new Date(hireDate)
    const end = new Date(requestDate)
    if (end < start) return '신청일 오류'
    let years = end.getFullYear() - start.getFullYear()
    let months = end.getMonth() - start.getMonth()
    if (end.getDate() < start.getDate()) months--
    if (months < 0) { years--; months += 12 }
    return `${years}년 ${months}개월`
  }

  // 폼 데이터 변경 시 자동 계산 수행
  useEffect(() => {
    if (!selectedTemplate) return

    const newFormData = { ...formData }
    let hasChanges = false

    // 휴가/휴직 일수 자동 계산
    if ((selectedTemplate.name === '휴가 신청서' || selectedTemplate.name === '휴직계') && formData.시작일 && formData.종료일) {
      const days = calculateDays(formData.시작일, formData.종료일)
      if (formData.휴가일수 !== days.toString() && formData.휴직일수 !== days.toString()) {
        if (selectedTemplate.name === '휴가 신청서') newFormData.휴가일수 = days.toString()
        if (selectedTemplate.name === '휴직계') newFormData.휴직일수 = days.toString()
        hasChanges = true
      }
    }

    // 출산휴가 일수 자동 계산
    if (selectedTemplate.name === '출산휴가 및 육아휴직 신청서') {
      if (formData.출산휴가시작일 && formData.출산휴가종료일) {
        const days = calculateDays(formData.출산휴가시작일, formData.출산휴가종료일)
        if (formData.휴가일수 !== days.toString()) {
          newFormData.휴가일수 = days.toString()
          hasChanges = true
        }
      }
      if (formData.육아휴직시작일 && formData.육아휴직종료일) {  
        const days = calculateDays(formData.육아휴직시작일, formData.육아휴직종료일)
        if (formData.육아휴직일수 !== days.toString()) {
          newFormData.육아휴직일수 = days.toString()
          hasChanges = true
        }
      }
      if (formData.육아기근무시작시간 && formData.육아기근무종료시간) {
        const hours = calculateHours(formData.육아기근무시작시간, formData.육아기근무종료시간)
        if (formData.육아기단축근무시간 !== hours) {
          newFormData.육아기단축근무시간 = hours
          hasChanges = true
        }
      }
    }

    // 재직기간 자동 계산
    if (selectedTemplate.name === '재직증명서' && user.hire_date && formData.신청일) {
      const period = calculateEmploymentPeriod(user.hire_date, formData.신청일)
      if (formData.재직일 !== period) {
        newFormData.재직일 = period
        hasChanges = true
      }
    }

    // 경조사 휴가 일수 자동 계산 및 종료일 설정
    if (selectedTemplate.name === '휴가 신청서' && formData.휴가형태 === '경조사' && formData.경조사구분 && formData.시작일) {
      const leaveDays = getCondolenceLeave(formData.경조사구분)
      if (leaveDays > 0) {
        const startDate = new Date(formData.시작일)
        const endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + leaveDays - 1)
        const endDateString = endDate.toISOString().split('T')[0]
        
        if (formData.종료일 !== endDateString || formData.휴가일수 !== leaveDays.toString()) {
          newFormData.종료일 = endDateString
          newFormData.휴가일수 = leaveDays.toString()
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      setFormData(newFormData)
    }
  }, [formData, selectedTemplate, user.hire_date])

  // 조건부 필드 표시 여부 확인
  const shouldShowField = (field: FormField): boolean => {
    if (!field.condition) return true

    const conditionValue = formData[field.condition.field]
    if (!conditionValue) return false // 조건 필드가 비어있으면 숨김

    const { operator, value } = field.condition

    switch (operator) {
      case 'in':
        return Array.isArray(value) ? value.includes(conditionValue) : conditionValue === value
      case 'not in':
        return Array.isArray(value) ? !value.includes(conditionValue) : conditionValue !== value
      case '>=':
        return conditionValue >= value
      case '<=':
        return conditionValue <= value
      case '==':
        return conditionValue === value
      case '!=':
        return conditionValue !== value
      default:
        return true
    }
  }

  // Input 필드 렌더링
  const renderField = (field: FormField) => {
    if (!shouldShowField(field)) return null

    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: field.name === '휴가형태' && !!defaultValues?.휴가형태,
      value: formData[field.name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
          ...prev,
          [field.name]: e.target.value
        }))
      },
      required: field.required,
      className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${field.name === '휴가형태' && !!defaultValues?.휴가형태 ? 'bg-gray-100 cursor-not-allowed' : ''}`
    }

    return (
      <div key={field.name} className="mb-4">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {field.type === 'textarea' ? (
          <textarea
            {...commonProps}
            rows={4}
            placeholder={`${field.label}을(를) 입력해주세요`}
          />
        ) : field.type === 'select' && field.options ? (
          <select {...commonProps}>
            <option value="">선택해주세요</option>
            {field.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        ) : (
          <input
            {...commonProps}
            type={field.type}
            placeholder={field.type === 'date' || field.type === 'time' ? '' : `${field.label}을(를) 입력해주세요`}
          />
        )}
      </div>
    )
  }

  // PDF 생성 및 다운로드
  const generatePDF = async () => {
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: selectedTemplate?.name,
          formData,
          userData: {
            name: user.name,
            department: user.department,
            position: user.position,
            phone: user.phone,
            hire_date: user.hire_date
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        // HTML을 PDF로 변환하여 다운로드
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(result.htmlContent)
          printWindow.document.close()
          printWindow.focus()
          printWindow.print()
        }
      }
    } catch (error) {
      console.error('PDF 생성 오류:', error)
    }
  }

  // 폼 제출
  // 대체휴가 및 보상휴가 사용 규칙 검증
  const validateHourlyLeave = (): string | null => {
    if (selectedTemplate?.name !== '휴가 신청서') return null
    
    const leaveType = formData.휴가형태
    const days = parseFloat(formData.휴가일수 || '0')
    console.log('🔍 클라이언트 휴가 검증:', { 
      leaveType, 
      days, 
      시작일: formData.시작일, 
      종료일: formData.종료일,
      휴가일수: formData.휴가일수,
      leaveData 
    })
    
    if (leaveType === '대체휴가' || leaveType === '대체휴가 반차') {
      // 잔여 시간 확인 (시간을 일수로 변환) - 새 필드 또는 기존 필드에서 조회
      const availableHours = leaveData?.substitute_leave_hours || leaveData?.leave_types?.substitute_leave_hours || 0
      const availableDays = availableHours / 8 // 8시간 = 1일
      
      if (days < 0.5) {
        return '대체휴가는 최소 0.5일(반차)부터 사용 가능합니다.'
      }
      
      // 0.5일 또는 1일 단위로만 사용 가능
      if (days !== 0.5 && days !== Math.floor(days)) {
        return '대체휴가는 0.5일(반차) 또는 1일 단위로만 사용 가능합니다.'
      }
      
      // 보유 시간이 부족한 경우
      if (days > availableDays) {
        return `대체휴가 잔여량이 부족합니다. (신청: ${days}일, 잔여: ${availableDays.toFixed(1)}일)`
      }
    }
    
    if (leaveType === '보상휴가' || leaveType === '보상휴가 반차') {
      // 잔여 시간 확인 (시간을 일수로 변환) - 새 필드 또는 기존 필드에서 조회
      const availableHours = leaveData?.compensatory_leave_hours || leaveData?.leave_types?.compensatory_leave_hours || 0
      const availableDays = availableHours / 8 // 8시간 = 1일
      
      if (days < 0.5) {
        return '보상휴가는 최소 0.5일(반차)부터 사용 가능합니다.'
      }
      
      // 0.5일 또는 1일 단위로만 사용 가능
      if (days !== 0.5 && days !== Math.floor(days)) {
        return '보상휴가는 0.5일(반차) 또는 1일 단위로만 사용 가능합니다.'
      }
      
      // 보유 시간이 부족한 경우
      if (days > availableDays) {
        return `보상휴가 잔여량이 부족합니다. (신청: ${days}일, 잔여: ${availableDays.toFixed(1)}일)`
      }
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    setSubmitting(true)
    setError('')

    try {
      // 대체휴가/보상휴가 사용 규칙 검증
      const hourlyLeaveError = validateHourlyLeave()
      if (hourlyLeaveError) {
        setError(hourlyLeaveError)
        setSubmitting(false)
        return
      }

      // 1. 서식 신청 제출
      const response = await fetch('/api/form-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`, // 로컬 테스트용 임시 인증
        },
        body: JSON.stringify({
          formType: selectedTemplate.name,
          requestData: formData
        })
      })

      const result = await response.json()

      if (response.ok) {
        // 🎯 대체휴가 우선 사용 독려 메시지 처리
        if (result.warning && result.message) {
          const userChoice = confirm(`⚠️ ${result.message}\n\n${result.suggestion}`)
          
          if (userChoice) {
            // 사용자가 대체휴가 사용을 선택한 경우
            const newFormData = { ...formData }
            newFormData.휴가형태 = formData.휴가형태?.includes('반차') ? '대체휴가 반차' : '대체휴가'
            setFormData(newFormData)
            
            alert('💡 휴가 종류를 대체휴가로 변경했습니다. 다시 신청해주세요.')
            setSubmitting(false)
            return
          }
          
          // 사용자가 연차로 계속 진행하려는 경우
          const confirmAnnual = confirm('연차로 계속 신청하시겠습니까?')
          if (!confirmAnnual) {
            setSubmitting(false)
            return
          }
          
          // 강제로 연차 신청 - 추가 파라미터 전송
          const forceResponse = await fetch('/api/form-requests', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${user.id}`,
            },
            body: JSON.stringify({
              formType: selectedTemplate.name,
              requestData: { ...formData, forceAnnualLeave: true }
            })
          })
          
          const forceResult = await forceResponse.json()
          if (!forceResponse.ok) {
            setError(forceResult.error || '신청 처리 중 오류가 발생했습니다.')
            setSubmitting(false)
            return
          }
        }
        
        // 2. PDF 생성 및 출력
        await generatePDF()
        
        alert(`✅ ${selectedTemplate.name} 신청이 완료되었습니다!`)
        onSuccess()
        handleClose()
      } else {
        setError(result.error || '신청 처리 중 오류가 발생했습니다.')
      }
    } catch (err) {
      setError('신청 처리 중 오류가 발생했습니다.')
      console.error('Error submitting form:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // 모달 닫기
  const handleClose = () => {
    onClose()
    setModalTitle('서식 신청')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {modalTitle}
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {loading || (defaultFormType && !selectedTemplate && !error) ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">폼 템플릿을 불러오는 중...</p>
            </div>
          ) : !selectedTemplate && !error ? (
            // 템플릿 선택 화면
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">신청할 서식을 선택해주세요</h4>
              <div className="grid gap-4">
                {templates
                  .filter(template => {
                    // defaultFormType이 null일 때만 (문서 서식 신청) 필터링 적용
                    if (defaultFormType === null) {
                      const excludedForms = ['휴가 신청서', '출산휴가 및 육아휴직 신청서']
                      return !excludedForms.includes(template.name)
                    }
                    return true // 그 외의 경우는 모든 템플릿을 보여주지만, 실제로는 이 뷰가 보이지 않음
                  })
                  .map(template => (
                    <div
                      key={template.id}
                      className="border border-gray-300 rounded-lg p-4 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <h5 className="font-medium text-gray-900">{template.name}</h5>
                      <p className="mt-1 text-sm text-gray-600">{template.description}</p>
                    </div>
                  ))}
              </div>
            </div>
          ) : selectedTemplate ? (
            // 선택된 템플릿의 폼 화면
            <div>
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                <p className="mt-1 text-sm text-gray-600">{selectedTemplate.description}</p>
              </div>

              {/* 휴가 신청서인 경우 잔여 휴가 현황 표시 */}
              {selectedTemplate.name === '휴가 신청서' && leaveData && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">📊 현재 잔여 휴가</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-blue-800">
                        <strong>연차:</strong> {(leaveData.leave_types.annual_days || 0) - (leaveData.leave_types.used_annual_days || 0)}일 잔여
                      </p>
                      <p className="text-blue-800">
                        <strong>병가:</strong> {(leaveData.leave_types.sick_days || 0) - (leaveData.leave_types.used_sick_days || 0)}일 잔여
                      </p>
                    </div>
                    <div>
                      {/* 대체휴가 시간 - leave_days 테이블의 새 필드 또는 기존 leave_types 필드에서 조회 */}
                      {((leaveData.substitute_leave_hours || leaveData.leave_types.substitute_leave_hours || 0) > 0) && (
                        <p className="text-purple-800">
                          <strong>{LEAVE_TYPE_NAMES.substitute}:</strong> {getLeaveStatus(leaveData.substitute_leave_hours || leaveData.leave_types.substitute_leave_hours || 0).displayText}
                        </p>
                      )}
                      {/* 보상휴가 시간 - leave_days 테이블의 새 필드 또는 기존 leave_types 필드에서 조회 */}
                      {((leaveData.compensatory_leave_hours || leaveData.leave_types.compensatory_leave_hours || 0) > 0) && (
                        <p className="text-green-800">
                          <strong>{LEAVE_TYPE_NAMES.compensatory}:</strong> {getLeaveStatus(leaveData.compensatory_leave_hours || leaveData.leave_types.compensatory_leave_hours || 0).displayText}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 출산휴가 및 육아휴직 신청서인 경우 제도 안내 표시 */}
              {selectedTemplate.name === '출산휴가 및 육아휴직 신청서' && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-green-900 mb-2">👶 육아기 근로시간 단축 제도 안내</h5>
                  <div className="text-sm text-green-800 space-y-1">
                    <p><strong>대상:</strong> 만 8세 이하 또는 초등학교 2학년 이하 자녀를 둔 직원</p>
                    <p><strong>기간:</strong> 기본 1년 이내 (미사용 육아휴직 기간 가산 가능)</p>
                    <p><strong>근무시간:</strong> 주 15시간 이상 ~ 35시간 이하</p>
                    <p><strong>분할 사용:</strong> 가능 (1회 최소 3개월 이상)</p>
                    <p><strong>중요:</strong> 근로시간 단축을 이유로 불리한 처우를 받지 않으며, 종료 후 원 직무로 복귀합니다.</p>
                  </div>
                </div>
              )}

              {/* 대체휴가 사용 규칙 안내 */}
              {selectedTemplate.name === '휴가 신청서' && (formData.휴가형태 === '대체휴가' || formData.휴가형태 === '대체휴가 반차') && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-purple-900 mb-2">🔄 대체휴가 사용 규칙</h5>
                  <div className="text-sm text-purple-800 space-y-1">
                    <p><strong>대상:</strong> 토요일 근무에 대한 1:1 대응 휴가</p>
                    <p><strong>사용 단위:</strong> 0.5일(반차) 또는 1일 단위 사용 가능</p>
                    <p><strong>신청 방법:</strong> 토요일 근무 후 발생한 대체휴가만 신청 가능</p>
                    <p><strong>유효기간:</strong> 발생일로부터 90일 이내 사용 권장</p>
                  </div>
                </div>
              )}

              {/* 보상휴가 사용 규칙 안내 */}
              {selectedTemplate.name === '휴가 신청서' && (formData.휴가형태 === '보상휴가' || formData.휴가형태 === '보상휴가 반차') && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-green-900 mb-2">⭐ 보상휴가 사용 규칙</h5>
                  <div className="text-sm text-green-800 space-y-1">
                    <p><strong>대상:</strong> 일요일 또는 공휴일 근무에 대한 보상 휴가</p>
                    <p><strong>사용 단위:</strong> 0.5일(반차) 또는 1일 단위 사용 가능</p>
                    <p><strong>신청 방법:</strong> 0.5일부터 신청 가능, 남은 시간에 따라 조정</p>
                    <p><strong>유효기간:</strong> 발생일로부터 90일 이내 사용 권장</p>
                  </div>
                </div>
              )}

              {/* 경조사 휴가 신청 시 정책 안내 표시 */}
              {selectedTemplate.name === '휴가 신청서' && formData.휴가형태 === '경조사' && (
                <div className="mb-4 bg-orange-50 border border-orange-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-orange-900 mb-2">🎗️ 경조사 휴가 정책 안내</h5>
                  <div className="text-sm text-orange-800 space-y-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p><strong>본인 결혼:</strong> 5일</p>
                        <p><strong>자녀 결혼:</strong> 2일</p>
                        <p><strong>부모·배우자 사망:</strong> 5일</p>
                      </div>
                      <div>
                        <p><strong>배우자 부모 사망:</strong> 3일</p>
                        <p><strong>자녀·형제자매 사망:</strong> 3일</p>
                        <p><strong>기타 가족/친족:</strong> 회사 협의</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs bg-orange-100 p-2 rounded">
                      <strong>※ 참고:</strong> 경조사 휴가 기간에 휴일이나 휴무일이 포함된 경우에도 휴가일수에 포함하여 계산됩니다.
                    </p>
                    {formData.경조사구분 && (
                      <p className="mt-2 font-medium text-orange-900">
                        선택한 경조사 ({formData.경조사구분}): {getCondolenceLeave(formData.경조사구분) || '회사 협의'}일
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 병가 신청 시 정책 안내 표시 */}
              {selectedTemplate.name === '휴가 신청서' && formData.휴가형태 === '병가' && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
                  <h5 className="text-sm font-medium text-red-900 mb-2">🏥 병가 정책 안내</h5>
                  <div className="text-sm text-red-800 space-y-2">
                    <p>업무 외 질병이나 부상으로 병가를 신청할 경우, <strong>연간 최대 60일</strong>까지 허가할 수 있습니다.</p>
                    <p>사용 가능한 <strong>연차휴가를 우선 사용</strong>하며, 연차휴가를 초과하는 일수에 대해서는 <strong>무급으로 처리</strong>됩니다.</p>
                    <p className="bg-red-100 p-2 rounded text-xs">
                      <strong>⚠️ 중요:</strong> 1주 이상 계속 병가를 신청할 경우에는 <strong>의사 진단서를 첨부</strong>해야 합니다.
                    </p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {selectedTemplate.fields.map(renderField)}

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  {!defaultFormType && (
                    <button
                      type="button"
                      onClick={() => setSelectedTemplate(null)}
                      className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      뒤로
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? '제출 중...' : '신청하기'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            null // 오류가 있는 경우 error 메시지가 표시되므로 여기서는 null 반환
          ) }
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { getLeaveStatus, LEAVE_TYPE_NAMES } from '@/lib/hoursToLeaveDay'
import { useSupabase } from '@/components/SupabaseProvider'

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
  const { supabase } = useSupabase()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [modalTitle, setModalTitle] = useState('서식 신청')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [leaveData, setLeaveData] = useState<any>(null)

  // 폼 템플릿 목록 로드 (Supabase 직접 연동)
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .order('name')

      if (error) {
        console.error('Supabase form templates error:', error)
        setError('폼 템플릿을 불러올 수 없습니다.')
        return
      }

      setTemplates(data || [])
    } catch (err) {
      setError('폼 템플릿 로드 중 오류가 발생했습니다.')
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // 휴가 데이터 로드 (Supabase 직접 연동)
  const loadLeaveData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, name, department, position, hire_date,
          annual_days, used_annual_days,
          sick_days, used_sick_days,
          substitute_leave_hours, compensatory_leave_hours
        `)
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Supabase leave data error:', error)
        return
      }

      const leaveInfo = {
        user: {
          name: data.name,
          department: data.department,
          position: data.position,
          hire_date: data.hire_date
        },
        leave_types: {
          annual_days: data.annual_days || 0,
          used_annual_days: data.used_annual_days || 0,
          sick_days: data.sick_days || 0,
          used_sick_days: data.used_sick_days || 0,
          substitute_leave_hours: data.substitute_leave_hours || 0,
          compensatory_leave_hours: data.compensatory_leave_hours || 0
        }
      }

      setLeaveData(leaveInfo)
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
      if (defaultValues?._leaveCategory) {
        if (defaultValues._leaveCategory === 'substitute') {
          setModalTitle('대체휴가 신청서')
        } else if (defaultValues._leaveCategory === 'compensatory') {
          setModalTitle('보상휴가 신청서')
        } else {
          setModalTitle(selectedTemplate.name)
        }
      } else if (defaultValues?.휴가형태) {
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
    
    // 날짜 차이 계산 (inclusive) - 시작일과 종료일 모두 포함
    const timeDiff = end.getTime() - start.getTime()
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
    return daysDiff + 1 // 시작일도 포함하므로 +1
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

    // 휴가 신청서에서 시작일만 설정된 경우 자동으로 종료일 설정 (1일 휴가 기본)
    if (selectedTemplate.name === '휴가 신청서' && formData.시작일 && !formData.종료일) {
      // 모든 휴가 형태에 대해 기본적으로 1일로 설정 (대체휴가, 보상휴가 포함)
      if (!formData.휴가형태 || ['연차', '반차', '병가', '보건휴가', '대체휴가', '보상휴가', '기타'].includes(formData.휴가형태)) {
        const startDate = new Date(formData.시작일)
        const endDateString = startDate.toISOString().split('T')[0] 
        newFormData.종료일 = endDateString
        
        // 휴가형태에 따른 기본 일수 설정
        if (formData.휴가형태 === '반차') {
          newFormData.휴가일수 = '0.5'
        } else if (formData.휴가형태 === '시간차') {
          newFormData.휴가일수 = '0' // 시간차는 시간 계산 후 결정
        } else {
          newFormData.휴가일수 = '1'
        }
        hasChanges = true
      }
    }

    // 시간차 휴가일 경우 시작시간과 종료시간으로 시간 계산
    if (selectedTemplate.name === '휴가 신청서' && formData.휴가형태 === '시간차' && formData.시작시간 && formData.종료시간) {
      const startTime = formData.시작시간
      const endTime = formData.종료시간
      
      if (startTime && endTime) {
        const start = new Date(`1970-01-01T${startTime}:00`)
        const end = new Date(`1970-01-01T${endTime}:00`)
        
        if (end > start) {
          const diffMinutes = (end.getTime() - start.getTime()) / 60000
          const hours = Math.round(diffMinutes / 60 * 10) / 10 // 0.1시간 단위로 반올림
          
          // 시간을 일수로 변환 (8시간 = 1일 기준)
          const days = Math.round((hours / 8) * 10) / 10
          
          if (formData.휴가일수 !== days.toString()) {
            newFormData.휴가일수 = days.toString()
            hasChanges = true
          }
        }
      }
    }

    // 휴가/휴직 일수 자동 계산 (시작일과 종료일이 모두 있는 경우)
    if ((selectedTemplate.name === '휴가 신청서' || selectedTemplate.name === '휴직계') && formData.시작일 && formData.종료일) {
      const days = calculateDays(formData.시작일, formData.종료일)
      if (formData.휴가일수 !== days.toString() && formData.휴직일수 !== days.toString()) {
        if (selectedTemplate.name === '휴가 신청서') {
          // 반차인 경우 0.5일로 고정
          if (formData.휴가형태 === '반차') {
            newFormData.휴가일수 = '0.5'
          } else {
            newFormData.휴가일수 = days.toString()
          }
        }
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

    // 자동 계산 필드인지 확인
    const isAutoCalculatedField = ['휴가일수', '휴직일수', '육아휴직일수', '재직일', '육아기단축근무시간'].includes(field.name)
    const isDateField = field.type === 'date' && (field.name === '시작일' || field.name === '종료일')
    const isDisabled = (field.name === '휴가형태' && !!defaultValues?.휴가형태) || isAutoCalculatedField

    const commonProps = {
      id: field.name,
      name: field.name,
      disabled: isDisabled,
      value: formData[field.name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const newValue = e.target.value
        setFormData(prev => ({
          ...prev,
          [field.name]: newValue
        }))
      },
      required: field.required,
      className: `mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
        isDisabled ? 'bg-gray-100 cursor-not-allowed' : ''
      } ${field.type === 'date' ? 'cursor-pointer' : ''}`
    }

    return (
      <div key={field.name} className="mb-4">
        <label htmlFor={field.name} className="block text-sm font-medium text-gray-700">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
          {isAutoCalculatedField && <span className="text-blue-500 ml-1 text-xs">(자동 계산)</span>}
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
            {field.options
              .filter(option => {
                // 휴가형태 필드이고 카테고리 힌트가 있는 경우 필터링
                if (field.name === '휴가형태' && defaultValues?._leaveCategory) {
                  if (defaultValues._leaveCategory === 'substitute') {
                    return option.includes('대체휴가')
                  }
                  if (defaultValues._leaveCategory === 'compensatory') {
                    return option.includes('보상휴가')
                  }
                }
                return true
              })
              .map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
          </select>
        ) : (
          <input
            {...commonProps}
            type={field.type}
            placeholder={field.type === 'date' || field.type === 'time' ? '' : 
                       field.name === '휴가일수' ? '' : `${field.label}을(를) 입력해주세요`}
            style={field.type === 'date' ? {
              position: 'relative',
              WebkitAppearance: 'none',
              MozAppearance: 'textfield'
            } : {}}
            onClick={field.type === 'date' ? (e) => {
              // 날짜 입력 필드 전체 영역 클릭 시 calendar picker 열기
              e.currentTarget.showPicker?.()
            } : undefined}
          />
        )}
        
        {/* 자동 계산 필드에 대한 설명 */}
        {isAutoCalculatedField && (
          <p className="mt-1 text-xs text-blue-600">
            {field.name === '휴가일수' && selectedTemplate?.name === '휴가 신청서' && 
              (formData.휴가형태 === '시간차' ? '시작시간과 종료시간을 선택하면 자동으로 계산됩니다' : 
               formData.휴가형태 === '반차' ? '반차는 0.5일로 자동 설정됩니다' :
               '시작일과 종료일을 선택하면 자동으로 계산됩니다')
            }
            {field.name === '휴직일수' && '시작일과 종료일을 선택하면 자동으로 계산됩니다'}
            {field.name === '재직일' && '신청일을 선택하면 입사일 기준으로 자동 계산됩니다'}
            {field.name === '육아기단축근무시간' && '시작시간과 종료시간을 선택하면 자동으로 계산됩니다'}
          </p>
        )}
        
        {/* 날짜 필드에 대한 도움말 */}
        {field.name === '시작일' && selectedTemplate?.name === '휴가 신청서' && (
          <p className="mt-1 text-xs text-gray-500">
            시작일을 선택하면 종료일이 자동으로 설정됩니다
          </p>
        )}
      </div>
    )
  }

  // PDF HTML 생성 함수들
  const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const generateFormHTML = (formType: string, formData: any, userData: any): string => {
    const baseStyle = `
      <style>
        @page { size: A4; margin: 20mm; }
        body { font-family: 'Malgun Gothic', sans-serif; font-size: 12pt; line-height: 1.6; margin: 0; padding: 0; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
        .title { font-size: 24pt; font-weight: bold; margin-bottom: 10px; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .info-table td { padding: 8px; border: 1px solid #333; }
        .info-table .label { background-color: #f0f0f0; font-weight: bold; width: 120px; }
        .content-section { margin-bottom: 20px; }
        .content-section h3 { font-size: 14pt; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #333; padding-left: 10px; }
        .content-text { border: 1px solid #333; padding: 15px; min-height: 80px; white-space: pre-wrap; }
        .signature-section { margin-top: 40px; text-align: right; }
        .date-text { margin-bottom: 20px; }
      </style>
    `
    
    switch (formType) {
      case '경위서':
        return generateReportHTML(formData, userData, baseStyle)
      case '휴가 신청서':
        return generateLeaveHTML(formData, userData, baseStyle)
      case '재직증명서':
        return generateCertificateHTML(formData, userData, baseStyle)
      case '휴직계':
        return generateLeaveOfAbsenceHTML(formData, userData, baseStyle)
      case '출산휴가 및 육아휴직 신청서':
        return generateMaternityHTML(formData, userData, baseStyle)
      default:
        return generateGenericHTML(formType, formData, userData, baseStyle)
    }
  }

  const generateReportHTML = (formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">경 위 서</div>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
            <td class="label">연락처</td>
            <td>${userData?.phone || formData.연락처 || ''}</td>
          </tr>
        </table>
        
        <div class="content-section">
          <h3>1. 사건개요</h3>
          <div class="content-text">${formData.사건개요 || ''}</div>
        </div>
        
        <div class="content-section">
          <h3>2. 사건 상세 내용</h3>
          <div class="content-text">${formData.상세내용 || ''}</div>
        </div>
        
        <div class="content-section">
          <h3>3. 사건 발생 원인</h3>
          <div class="content-text">${formData.원인분석 || ''}</div>
        </div>
        
        <div class="content-section">
          <h3>4. 향후 대책 및 본인 추가 의견</h3>
          <div class="content-text">${formData.본인의견 || ''}</div>
        </div>
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div>신청자: ${userData?.name || ''} (인)</div>
          <div style="margin-top: 40px;">Motion Connect 귀하</div>
        </div>
      </body>
      </html>
    `
  }

  const generateLeaveHTML = (formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    let period = ''
    if (formData.휴가형태?.includes('반차')) {
      period = `${formatDate(formData.시작일)} (${formData.휴가형태 === '오전 반차' ? '오전' : '오후'})`
    } else if (formData.시작일 && formData.종료일) {
      period = `${formatDate(formData.시작일)} ~ ${formatDate(formData.종료일)}`
    } else if (formData.시작일) {
      period = formatDate(formData.시작일)
    }
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">휴 가 신 청 서</div>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
            <td class="label">연락처</td>
            <td>${userData?.phone || formData.연락처 || ''}</td>
          </tr>
          <tr>
            <td class="label">휴가형태</td>
            <td>${formData.휴가형태 || ''}</td>
            <td class="label">휴가기간</td>
            <td>${period}</td>
          </tr>
        </table>
        
        ${formData.사유 ? `
        <div class="content-section">
          <h3>사유</h3>
          <div class="content-text">${formData.사유}</div>
        </div>
        ` : ''}
        
        <div class="content-section">
          <h3>전달사항 (업무 인수인계)</h3>
          <div class="content-text">${formData.전달사항 || ''}</div>
        </div>
        
        <div class="content-section">
          <h3>비상연락처</h3>
          <div class="content-text">${formData.비상연락처 || ''}</div>
        </div>
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div>신청자: ${userData?.name || ''} (인)</div>
          <div style="margin-top: 40px;">Motion Connect 귀하</div>
        </div>
      </body>
      </html>
    `
  }

  const generateCertificateHTML = (formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    // 재직기간 계산
    const hireDate = new Date(userData?.hire_date || '2024-01-01')
    const now = new Date()
    const years = now.getFullYear() - hireDate.getFullYear()
    const months = now.getMonth() - hireDate.getMonth()
    const employmentPeriod = `${years}년 ${months >= 0 ? months : months + 12}개월`
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">재 직 증 명 서</div>
        </div>
        
        <div style="margin: 40px 0; font-size: 14pt; line-height: 2;">
          <p>아래 사람의 재직사실을 증명합니다.</p>
          
          <table class="info-table" style="margin: 30px 0;">
            <tr>
              <td class="label">성명</td>
              <td>${userData?.name || ''}</td>
            </tr>
            <tr>
              <td class="label">소속</td>
              <td>${userData?.department || ''}</td>
            </tr>
            <tr>
              <td class="label">직위</td>
              <td>${userData?.position || ''}</td>
            </tr>
            <tr>
              <td class="label">입사일</td>
              <td>${formatDate(userData?.hire_date)}</td>
            </tr>
            <tr>
              <td class="label">재직기간</td>
              <td>${employmentPeriod}</td>
            </tr>
          </table>
          
          <p><strong>제출처:</strong> ${formData.제출처 || ''}</p>
        </div>
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div style="margin-top: 40px;">
            <strong>Motion Connect</strong><br>
            대표자: [대표자명] (인)
          </div>
        </div>
      </body>
      </html>
    `
  }

  const generateLeaveOfAbsenceHTML = (formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    const period = `${formatDate(formData.시작일)} ~ ${formatDate(formData.종료일)}`
    const days = calculateDays(formData.시작일, formData.종료일)
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">휴 직 계</div>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
            <td class="label">연락처</td>
            <td>${userData?.phone || formData.연락처 || ''}</td>
          </tr>
          <tr>
            <td class="label">휴직형태</td>
            <td>${formData.휴직형태 === '기타' ? formData.휴직형태_기타 : formData.휴직형태}</td>
            <td class="label">휴직기간</td>
            <td>${period} (${days}일)</td>
          </tr>
        </table>
        
        <div class="content-section">
          <h3>휴직사유</h3>
          <div class="content-text">${formData.휴직사유 || ''}</div>
        </div>
        
        <div class="content-section">
          <h3>전달사항</h3>
          <div class="content-text">${formData.전달사항 || ''}</div>
        </div>
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div>신청자: ${userData?.name || ''} (인)</div>
          <div style="margin-top: 40px;">Motion Connect 귀하</div>
        </div>
      </body>
      </html>
    `
  }

  const generateMaternityHTML = (formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">출산휴가 및 육아휴직 신청서</div>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
            <td class="label">출산예정일</td>
            <td>${formatDate(formData.출산예정일)}</td>
          </tr>
        </table>
        
        <div class="content-section">
          <h3>출산전후휴가</h3>
          <table class="info-table">
            <tr>
              <td class="label">시작일</td>
              <td>${formatDate(formData.출산휴가시작일)}</td>
              <td class="label">종료일</td>
              <td>${formatDate(formData.출산휴가종료일)}</td>
            </tr>
          </table>
        </div>
        
        ${formData.육아휴직시작일 ? `
        <div class="content-section">
          <h3>육아휴직</h3>
          <table class="info-table">
            <tr>
              <td class="label">시작일</td>
              <td>${formatDate(formData.육아휴직시작일)}</td>
              <td class="label">종료일</td>
              <td>${formatDate(formData.육아휴직종료일)}</td>
            </tr>
          </table>
        </div>
        ` : ''}
        
        ${formData.육아기단축시작일 ? `
        <div class="content-section">
          <h3>육아기 근로시간 단축</h3>
          <table class="info-table">
            <tr>
              <td class="label">기간</td>
              <td>${formatDate(formData.육아기단축시작일)} ~ ${formatDate(formData.육아기단축종료일)}</td>
            </tr>
            <tr>
              <td class="label">근무시간</td>
              <td>${formData.육아기근무시작시간} ~ ${formData.육아기근무종료시간}</td>
            </tr>
          </table>
        </div>
        ` : ''}
        
        ${formData.비고 ? `
        <div class="content-section">
          <h3>비고</h3>
          <div class="content-text">${formData.비고}</div>
        </div>
        ` : ''}
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div>신청자: ${userData?.name || ''} (인)</div>
          <div style="margin-top: 40px;">Motion Connect 귀하</div>
        </div>
      </body>
      </html>
    `
  }

  const generateGenericHTML = (formType: string, formData: any, userData: any, baseStyle: string): string => {
    const today = new Date().toLocaleDateString('ko-KR', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    })
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyle}
      </head>
      <body>
        <div class="header">
          <div class="title">${formType}</div>
        </div>
        
        <table class="info-table">
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
            <td class="label">연락처</td>
            <td>${userData?.phone || ''}</td>
          </tr>
        </table>
        
        ${Object.entries(formData).map(([key, value]) => `
          <div class="content-section">
            <h3>${key}</h3>
            <div class="content-text">${value || ''}</div>
          </div>
        `).join('')}
        
        <div class="signature-section">
          <div class="date-text">${today}</div>
          <div>신청자: ${userData?.name || ''} (인)</div>
          <div style="margin-top: 40px;">Motion Connect 귀하</div>
        </div>
      </body>
      </html>
    `
  }

  // PDF 생성 및 다운로드 (클라이언트 사이드)
  const generatePDF = async () => {
    try {
      if (!selectedTemplate) return

      const userData = {
        name: user.name,
        department: user.department,
        position: user.position,
        phone: user.phone,
        hire_date: user.hire_date
      }

      console.log('📄 PDF 생성 요청:', { formType: selectedTemplate.name, userData: userData.name })
      
      // HTML 콘텐츠 생성
      const htmlContent = generateFormHTML(selectedTemplate.name, formData, userData)
      
      // 새 창에서 PDF 출력
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(htmlContent)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
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
    
    // 휴가 데이터가 로드되지 않은 경우 대기 요청
    if (!leaveData) {
      return '휴가 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
    }
    
    console.log('🔍 클라이언트 휴가 검증:', { 
      leaveType, 
      days, 
      시작일: formData.시작일, 
      종료일: formData.종료일,
      휴가일수: formData.휴가일수,
      leaveData,
      // 디버깅을 위한 상세 정보
      substitute_separate: leaveData?.substitute_leave_hours,
      substitute_json: leaveData?.leave_types?.substitute_leave_hours,
      compensatory_separate: leaveData?.compensatory_leave_hours,
      compensatory_json: leaveData?.leave_types?.compensatory_leave_hours
    })
    
    if (leaveType === '대체휴가' || leaveType === '대체휴가 오전 반차' || leaveType === '대체휴가 오후 반차' || leaveType?.includes('대체휴가')) {
      // 잔여 시간 확인 (시간을 일수로 변환) - 별도 컬럼 우선, 없으면 JSON 필드
      const availableHours = leaveData?.substitute_leave_hours ?? leaveData?.leave_types?.substitute_leave_hours ?? 0
      const availableDays = availableHours / 8 // 8시간 = 1일
      
      console.log('🔍 대체휴가 검증 상세:', {
        leaveType,
        days,
        availableHours,
        availableDays,
        separate_field: leaveData?.substitute_leave_hours,
        json_field: leaveData?.leave_types?.substitute_leave_hours,
        leaveData_exists: !!leaveData
      })
      
      // 휴가 데이터가 로드되지 않은 경우
      if (!leaveData) {
        return '휴가 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
      }
      
      if (days < 0.5) {
        return '대체휴가는 최소 0.5일(반차)부터 사용 가능합니다.'
      }
      
      // 0.5일 또는 1일 단위로만 사용 가능
      if (days !== 0.5 && days !== 1) {
        return '대체휴가는 0.5일(반차) 또는 1일 단위로만 사용 가능합니다.'
      }
      
      // 보유 시간이 부족한 경우 (더 자세한 디버그 정보 포함)
      if (days > availableDays) {
        return `대체휴가 잔여량이 부족합니다. (신청: ${days}일, 잔여: ${availableDays.toFixed(1)}일) [디버그: ${availableHours}시간 보유]`
      }
    }
    
    if (leaveType === '보상휴가' || leaveType === '보상휴가 오전 반차' || leaveType === '보상휴가 오후 반차' || leaveType?.includes('보상휴가')) {
      // 잔여 시간 확인 (시간을 일수로 변환) - 별도 컬럼 우선, 없으면 JSON 필드
      const availableHours = leaveData?.compensatory_leave_hours ?? leaveData?.leave_types?.compensatory_leave_hours ?? 0
      const availableDays = availableHours / 8 // 8시간 = 1일
      
      console.log('🔍 보상휴가 검증 상세:', {
        leaveType,
        days,
        availableHours,
        availableDays,
        separate_field: leaveData?.compensatory_leave_hours,
        json_field: leaveData?.leave_types?.compensatory_leave_hours,
        leaveData_exists: !!leaveData
      })
      
      // 휴가 데이터가 로드되지 않은 경우
      if (!leaveData) {
        return '휴가 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
      }
      
      if (days < 0.5) {
        return '보상휴가는 최소 0.5일(반차)부터 사용 가능합니다.'
      }
      
      // 0.5일 또는 1일 단위로만 사용 가능
      if (days !== 0.5 && days !== 1) {
        return '보상휴가는 0.5일(반차) 또는 1일 단위로만 사용 가능합니다.'
      }
      
      // 보유 시간이 부족한 경우 (더 자세한 디버그 정보 포함)
      if (days > availableDays) {
        return `보상휴가 잔여량이 부족합니다. (신청: ${days}일, 잔여: ${availableDays.toFixed(1)}일) [디버그: ${availableHours}시간 보유]`
      }
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    // 휴가 신청서인 경우 휴가 데이터 로딩 완료까지 대기
    if (selectedTemplate.name === '휴가 신청서') {
      if (!leaveData || !leaveData.leave_types) {
        setError('휴가 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
        setSubmitting(false)
        
        // 5초 후 자동으로 다시 시도
        setTimeout(() => {
          if (leaveData && leaveData.leave_types) {
            setError('')
            console.log('✅ 휴가 데이터 로딩 완료, 다시 시도 가능')
          }
        }, 2000)
        
        return
      }
    }

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

      // 1. 서식 신청 제출 (Supabase 직접 연동)
      const { data, error } = await supabase
        .from('form_requests')
        .insert({
          user_id: user.id,
          form_type: selectedTemplate.name,
          request_data: formData,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()

      if (error) {
        console.error('Supabase form request error:', error)
        setError('신청 처리 중 오류가 발생했습니다.')
        return
      }

      // 대체휴가 우선 사용 독려 메시지 비활성화
      
      // 2. PDF 생성 및 출력
      await generatePDF()
      
      alert(`✅ ${selectedTemplate.name} 신청이 완료되었습니다!`)
      onSuccess()
      handleClose()
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
                  <div className="text-sm">
                    {/* 대체휴가 신청시 대체휴가 잔여량만 표시 */}
                    {defaultValues?._leaveCategory === 'substitute' && (
                      <div>
                        <p className="text-purple-800">
                          <strong>대체휴가:</strong> {((leaveData.leave_types.substitute_leave_hours ?? 0) / 8).toFixed(1)}일 잔여 
                          <span className="text-xs text-purple-600 ml-2">({leaveData.leave_types.substitute_leave_hours ?? 0}시간)</span>
                        </p>
                      </div>
                    )}
                    
                    {/* 보상휴가 신청시 보상휴가 잔여량만 표시 */}
                    {defaultValues?._leaveCategory === 'compensatory' && (
                      <div>
                        <p className="text-green-800">
                          <strong>보상휴가:</strong> {((leaveData.leave_types.compensatory_leave_hours ?? 0) / 8).toFixed(1)}일 잔여
                          <span className="text-xs text-green-600 ml-2">({leaveData.leave_types.compensatory_leave_hours ?? 0}시간)</span>
                        </p>
                      </div>
                    )}
                    
                    {/* 일반 휴가 신청시 연차/병가 표시 */}
                    {!defaultValues?._leaveCategory && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-blue-800">
                            <strong>연차:</strong> {(leaveData.leave_types.annual_days || 0) - (leaveData.leave_types.used_annual_days || 0)}일 잔여
                          </p>
                        </div>
                        <div>
                          <p className="text-blue-800">
                            <strong>병가:</strong> {(leaveData.leave_types.sick_days || 0) - (leaveData.leave_types.used_sick_days || 0)}일 잔여
                          </p>
                        </div>
                      </div>
                    )}
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
                {selectedTemplate.fields
                  .sort((a, b) => {
                    // 필드 순서 정의 (휴가일수를 사유 앞으로)
                    const fieldOrder = [
                      '신청일', '휴가형태', '시작일', '종료일', '시작시간', '종료시간', 
                      '휴가일수', '휴직일수', '육아휴직일수', // 일수 관련 필드들을 사유 앞으로
                      '사유', // 사유를 뒤로
                      '업무인수자', '연락처', '기타'
                    ]
                    
                    const aIndex = fieldOrder.indexOf(a.name)
                    const bIndex = fieldOrder.indexOf(b.name)
                    
                    // 정의된 순서에 없는 필드는 맨 뒤로
                    if (aIndex === -1 && bIndex === -1) return 0
                    if (aIndex === -1) return 1
                    if (bIndex === -1) return -1
                    
                    return aIndex - bIndex
                  })
                  .map(renderField)}

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
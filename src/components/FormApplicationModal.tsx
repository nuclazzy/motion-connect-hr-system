'use client'

import { useState, useEffect, useCallback } from 'react'
import type { User } from '@/lib/auth'

interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'time'
  required: boolean
  options?: string[]
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
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function FormApplicationModal({ user, isOpen, onClose, onSuccess }: FormApplicationModalProps) {
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen, loadTemplates])

  // 조건부 필드 표시 여부 확인
  const shouldShowField = (field: FormField): boolean => {
    if (!field.condition) return true

    const conditionValue = formData[field.condition.field]
    if (!conditionValue) return true

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
      value: formData[field.name] || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({
          ...prev,
          [field.name]: e.target.value
        }))
      },
      required: field.required,
      className: "mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/form-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formType: selectedTemplate.name,
          requestData: formData
        })
      })

      const result = await response.json()

      if (response.ok) {
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
    setSelectedTemplate(null)
    setFormData({})
    setError('')
    onClose()
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
              {selectedTemplate ? selectedTemplate.name : '서식 신청'}
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

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">폼 템플릿을 불러오는 중...</p>
            </div>
          ) : !selectedTemplate ? (
            // 템플릿 선택 화면
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">신청할 서식을 선택해주세요</h4>
              <div className="grid gap-4">
                {templates.map(template => (
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
          ) : (
            // 선택된 템플릿의 폼 화면
            <div>
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="font-medium text-gray-900">{selectedTemplate.name}</h4>
                <p className="mt-1 text-sm text-gray-600">{selectedTemplate.description}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {selectedTemplate.fields.map(renderField)}

                <div className="flex justify-end space-x-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    뒤로
                  </button>
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
          )}
        </div>
      </div>
    </div>
  )
}
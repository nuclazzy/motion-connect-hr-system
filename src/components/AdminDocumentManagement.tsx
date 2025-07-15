'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Document {
  id: string
  name: string
  link: string
  uploaded_by: string | null
  upload_date: string
}

export default function AdminDocumentManagement() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [showDocumentsList, setShowDocumentsList] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    link: ''
  })

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('upload_date', { ascending: false })

      if (error) {
        console.error('문서 조회 실패:', error)
      } else {
        setDocuments(data || [])
      }
    } catch (error) {
      console.error('문서 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)

    try {
      const { error } = await supabase
        .from('documents')
        .insert([{
          name: formData.name,
          link: formData.link,
          upload_date: new Date().toISOString().split('T')[0]
        }])

      if (error) {
        console.error('문서 추가 실패:', error)
        alert('문서 추가에 실패했습니다.')
      } else {
        alert('문서가 성공적으로 추가되었습니다.')
        setFormData({ name: '', link: '' })
        setShowAddForm(false)
        fetchDocuments()
      }
    } catch (error) {
      console.error('문서 추가 오류:', error)
      alert('오류가 발생했습니다.')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDeleteDocument = async (id: string, name: string) => {
    if (!confirm(`"${name}" 문서를 삭제하시겠습니까?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('문서 삭제 실패:', error)
        alert('문서 삭제에 실패했습니다.')
      } else {
        alert('문서가 삭제되었습니다.')
        fetchDocuments()
      }
    } catch (error) {
      console.error('문서 삭제 오류:', error)
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

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      {/* 요약 위젯 */}
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-5 flex-1">
              <div>
                <div className="text-sm font-medium text-gray-500">
                  자료실 관리
                </div>
                <div className="text-lg font-medium text-gray-900">
                  전체 {documents.length}개 문서
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowDocumentsList(!showDocumentsList)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg 
              className={`h-5 w-5 transform transition-transform ${showDocumentsList ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="bg-gray-50 px-5 py-3">
        <div className="text-sm">
          <button 
            onClick={() => setShowAddForm(true)}
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            문서 추가
          </button>
        </div>
      </div>

      {/* 문서 목록 - 펼침/접힘 */}
      {showDocumentsList && (
        <div className="border-t border-gray-200">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">문서 목록</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              등록된 문서 관리
            </p>
          </div>
          <ul className="border-t border-gray-200 divide-y divide-gray-200">
          {documents.map((doc) => (
            <li key={doc.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">{doc.name}</div>
                    <div className="text-sm text-gray-500">
                      업로드: {new Date(doc.upload_date).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <a
                    href={doc.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    보기
                  </a>
                  <button
                    onClick={() => handleDeleteDocument(doc.id, doc.name)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </li>
          ))}
          {documents.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">
              등록된 문서가 없습니다.
            </li>
          )}
          </ul>
        </div>
      )}

      {/* 문서 추가 모달 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">새 문서 추가</h3>
              
              <form onSubmit={handleSubmitForm} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">문서명</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="문서 이름을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">링크</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setFormData({ name: '', link: '' })
                    }}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {formLoading ? '추가 중...' : '추가'}
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
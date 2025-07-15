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

export default function DocumentLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

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
        console.log('조회된 문서 수:', data?.length || 0)
        console.log('문서 목록:', data)
        setDocuments(data || [])
      }
    } catch (error) {
      console.error('문서 조회 오류:', error)
    } finally {
      setLoading(false)
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
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-5 flex-1">
            <div>
              <div className="text-sm font-medium text-gray-500">
                자료실
              </div>
              <div className="text-lg font-medium text-gray-900">
                회사 자료 조회 ({documents.length}개)
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-gray-50 px-5 py-3">
        {documents.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {documents.map((doc) => (
              <div key={doc.id} className="text-sm">
                <a 
                  href={doc.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 hover:text-indigo-500 block truncate"
                  title={doc.name}
                >
                  📄 {doc.name}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            등록된 문서가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
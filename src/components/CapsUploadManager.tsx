'use client'

import { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'

interface UploadResult {
  fileName: string
  fileSize: number
  totalProcessed: number
  inserted: number
  duplicates: number
  invalidUsers: number
  errors: string[]
}

export default function CapsUploadManager() {
  const [adminUserId, setAdminUserId] = useState('') // 실제로는 인증에서 가져와야 함
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadMode, setUploadMode] = useState<'caps' | 'attendance'>('caps')

  const handleFileUpload = async (file: File) => {
    if (!adminUserId) {
      setError('관리자 인증이 필요합니다.')
      return
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('CSV 파일만 업로드 가능합니다.')
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)

    try {
      let response: Response

      if (uploadMode === 'attendance') {
        // 출퇴근 데이터 일괄 업로드
        const csvText = await file.text()
        
        response = await fetch('/api/admin/attendance/bulk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminUserId}`
          },
          body: JSON.stringify({
            csvData: csvText,
            overwrite: true
          })
        })
      } else {
        // CAPS 데이터 업로드 (기존)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('admin_user_id', adminUserId)

        response = await fetch('/api/admin/attendance/upload-csv', {
          method: 'POST',
          body: formData
        })
      }

      const data = await response.json()

      if (data.success) {
        if (uploadMode === 'attendance') {
          // 출퇴근 데이터 결과 변환
          setResult({
            fileName: file.name,
            fileSize: file.size,
            totalProcessed: data.results.processed,
            inserted: data.results.success,
            duplicates: data.results.skipped,
            invalidUsers: data.results.errors,
            errors: data.results.errorMessages || []
          })
        } else {
          setResult(data.data)
        }
      } else {
        setError(data.error || '업로드에 실패했습니다.')
      }
    } catch (err) {
      console.error('업로드 오류:', err)
      setError('업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!adminUserId) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-4">관리자 인증 필요</h3>
          <input
            type="text"
            placeholder="관리자 ID를 입력하세요"
            value={adminUserId}
            onChange={(e) => setAdminUserId(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          CSV 데이터 업로드
        </h2>
        <p className="text-gray-600">
          출퇴근 데이터를 일괄 업로드하세요
        </p>
      </div>

      {/* 업로드 모드 선택 */}
      <div className="flex justify-center space-x-4">
        <label className="flex items-center">
          <input
            type="radio"
            name="uploadMode"
            value="caps"
            checked={uploadMode === 'caps'}
            onChange={(e) => setUploadMode(e.target.value as 'caps' | 'attendance')}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">CAPS 지문인식 데이터</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="uploadMode"
            value="attendance"
            checked={uploadMode === 'attendance'}
            onChange={(e) => setUploadMode(e.target.value as 'caps' | 'attendance')}
            className="mr-2"
          />
          <span className="text-sm font-medium text-gray-700">출퇴근 상세 데이터 (6월 등)</span>
        </label>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver 
            ? 'border-blue-500 bg-blue-50' 
            : uploading 
            ? 'border-gray-300 bg-gray-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
      >
        {uploading ? (
          <div className="flex flex-col items-center">
            <RefreshCw className="h-12 w-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium text-blue-600">업로드 중...</p>
            <p className="text-sm text-gray-500">데이터를 처리하고 있습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 mb-2">
              {uploadMode === 'caps' 
                ? 'CAPS CSV 파일을 드래그하거나 클릭하여 업로드'
                : '출퇴근 상세 데이터 CSV 파일을 드래그하거나 클릭하여 업로드'
              }
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {uploadMode === 'caps'
                ? '지원 형식: CAPS 지문인식 시스템에서 추출한 .csv 파일'
                : '지원 형식: 직원명,날짜,근무상태,출퇴근시간,근무시간 등이 포함된 .csv 파일'
              }
            </p>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              <span className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                파일 선택
              </span>
            </label>
          </div>
        )}
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <XCircle className="h-5 w-5 text-red-500 mr-2" />
            <h3 className="text-sm font-medium text-red-800">업로드 실패</h3>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* 업로드 결과 */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
            <h3 className="text-lg font-medium text-green-800">업로드 완료</h3>
          </div>

          {/* 파일 정보 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <FileText className="h-4 w-4 text-gray-500 mr-2" />
              <span className="font-medium">{result.fileName}</span>
              <span className="text-sm text-gray-500 ml-2">
                ({formatFileSize(result.fileSize)})
              </span>
            </div>
          </div>

          {/* 처리 결과 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.inserted}</div>
              <div className="text-sm text-blue-800">새로 추가</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{result.duplicates}</div>
              <div className="text-sm text-yellow-800">중복 스킵</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{result.totalProcessed}</div>
              <div className="text-sm text-gray-800">총 처리</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.invalidUsers}</div>
              <div className="text-sm text-red-800">사용자 오류</div>
            </div>
          </div>

          {/* 오류 목록 */}
          {result.errors.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mr-2" />
                <h4 className="text-sm font-medium text-orange-800">
                  처리 중 발견된 문제점 ({result.errors.length}개)
                </h4>
              </div>
              <div className="text-sm text-orange-700 space-y-1">
                {result.errors.map((error, index) => (
                  <div key={index} className="font-mono text-xs bg-orange-100 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 안내 메시지 */}
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              ✅ 업로드된 데이터는 자동으로 근무시간이 계산되며, 출퇴근 현황에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 사용법 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 사용법 안내</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• CAPS 관리 프로그램에서 "데이터 내보내기" → CSV 형식으로 저장</li>
          <li>• 파일명 예시: "7월4주차.xls - Sheet1.csv"</li>
          <li>• 중복 데이터는 자동으로 스킵되므로 안전하게 재업로드 가능</li>
          <li>• 시스템에 등록되지 않은 사용자는 무시됩니다</li>
          <li>• "출입", "해제", "세트" 등 보안 기록은 제외하고 "출근", "퇴근"만 처리</li>
        </ul>
      </div>
    </div>
  )
}
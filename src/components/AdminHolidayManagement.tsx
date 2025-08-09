'use client'

import React, { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { Calendar, Plus, Trash2, Edit2, Check, X } from 'lucide-react'

interface CustomHoliday {
  id: string
  date: string
  name: string
  type: string
  description?: string
  is_active: boolean
}

export default function AdminHolidayManagement() {
  const { supabase } = useSupabase()
  const [holidays, setHolidays] = useState<CustomHoliday[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    type: 'temporary',
    description: ''
  })

  // 임시공휴일 목록 조회
  const fetchHolidays = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('custom_holidays')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setHolidays(data || [])
    } catch (error) {
      console.error('Failed to fetch holidays:', error)
      alert('임시공휴일 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHolidays()
  }, [])

  // 임시공휴일 추가
  const handleAdd = async () => {
    if (!formData.date || !formData.name) {
      alert('날짜와 이름은 필수입니다.')
      return
    }

    try {
      const { error } = await supabase
        .from('custom_holidays')
        .insert([formData])

      if (error) throw error

      alert('임시공휴일이 추가되었습니다.')
      setFormData({ date: '', name: '', type: 'temporary', description: '' })
      setShowAddForm(false)
      fetchHolidays()
    } catch (error) {
      console.error('Failed to add holiday:', error)
      alert('임시공휴일 추가에 실패했습니다.')
    }
  }

  // 임시공휴일 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('이 임시공휴일을 삭제하시겠습니까?')) return

    try {
      const { error } = await supabase
        .from('custom_holidays')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('임시공휴일이 삭제되었습니다.')
      fetchHolidays()
    } catch (error) {
      console.error('Failed to delete holiday:', error)
      alert('임시공휴일 삭제에 실패했습니다.')
    }
  }

  // 활성/비활성 토글
  const handleToggle = async (id: string, is_active: boolean) => {
    try {
      const { error } = await supabase
        .from('custom_holidays')
        .update({ is_active: !is_active })
        .eq('id', id)

      if (error) throw error
      fetchHolidays()
    } catch (error) {
      console.error('Failed to toggle holiday:', error)
      alert('상태 변경에 실패했습니다.')
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          임시공휴일 관리
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          임시공휴일 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 임시공휴일"
                className="w-full border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full border-gray-300 rounded-md"
              >
                <option value="temporary">임시공휴일</option>
                <option value="substitute">대체공휴일</option>
                <option value="special">특별휴일</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="예: 대통령 선거"
                className="w-full border-gray-300 rounded-md"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddForm(false)
                setFormData({ date: '', name: '', type: 'temporary', description: '' })
              }}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              추가
            </button>
          </div>
        </div>
      )}

      {/* 목록 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                날짜
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                이름
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                유형
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                설명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  등록된 임시공휴일이 없습니다.
                </td>
              </tr>
            ) : (
              holidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(holiday.date + 'T00:00:00').toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {holiday.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${holiday.type === 'temporary' ? 'bg-yellow-100 text-yellow-800' :
                        holiday.type === 'substitute' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'}`}>
                      {holiday.type === 'temporary' ? '임시공휴일' :
                       holiday.type === 'substitute' ? '대체공휴일' : '특별휴일'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {holiday.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleToggle(holiday.id, holiday.is_active)}
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${holiday.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {holiday.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDelete(holiday.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>사용 방법:</strong> 정부에서 발표한 임시공휴일이나 회사 고유의 휴일을 추가할 수 있습니다.
          추가된 공휴일은 즉시 시스템 전체에 반영됩니다.
        </p>
      </div>
    </div>
  )
}
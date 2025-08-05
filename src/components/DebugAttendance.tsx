'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/components/SupabaseProvider'
import { getCurrentUser } from '@/lib/auth'

export default function DebugAttendance() {
  const { supabase } = useSupabase()
  const [data, setData] = useState<any>({
    records: [],
    summary: null,
    user: null
  })
  const [loading, setLoading] = useState(true)
  const [manualCalc, setManualCalc] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser || currentUser.role !== 'admin') {
          console.error('Admin access required')
          return
        }

        // 허지현 사용자 정보 조회
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('name', '허지현')
          .single()

        if (userError) {
          console.error('User fetch error:', userError)
          return
        }

        // 6월 11일 출퇴근 기록 조회
        const { data: attendanceRecords, error: recordsError } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userData.id)
          .eq('record_date', '2025-06-11')
          .order('record_timestamp', { ascending: true })

        if (recordsError) {
          console.error('Records fetch error:', recordsError)
          return
        }

        // 6월 11일 일일 근무 요약 조회
        const { data: summaryData, error: summaryError } = await supabase
          .from('daily_work_summary')
          .select('*')
          .eq('user_id', userData.id)
          .eq('work_date', '2025-06-11')
          .single()

        if (summaryError && summaryError.code !== 'PGRST116') {
          console.error('Summary fetch error:', summaryError)
        }

        // 6월 전체 근무 요약 조회
        const { data: monthlyData, error: monthlyError } = await supabase
          .from('daily_work_summary')
          .select('*')
          .eq('user_id', userData.id)
          .gte('work_date', '2025-06-01')
          .lte('work_date', '2025-06-30')
          .order('work_date', { ascending: true })

        if (monthlyError) {
          console.error('Monthly fetch error:', monthlyError)
        }

        setData({
          records: attendanceRecords || [],
          summary: summaryData,
          user: userData,
          monthly: monthlyData || []
        })
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  if (loading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">허지현 6월 11일 근무 데이터 디버그</h2>
      
      {/* 사용자 정보 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">사용자 정보</h3>
        <p>이름: {data.user?.name}</p>
        <p className="text-blue-600 font-semibold">대체휴가 잔액: {data.user?.substitute_leave_hours || 0}시간</p>
        <p className="text-green-600 font-semibold">보상휴가 잔액: {data.user?.compensatory_leave_hours || 0}시간</p>
      </div>

      {/* 6월 11일 출퇴근 기록 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">6월 11일 출퇴근 기록</h3>
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">시간</th>
              <th className="px-4 py-2 text-left">유형</th>
              <th className="px-4 py-2 text-left">타임스탬프</th>
              <th className="px-4 py-2 text-left">수동입력</th>
            </tr>
          </thead>
          <tbody>
            {data.records.map((record: any, index: number) => (
              <tr key={index}>
                <td className="px-4 py-2">{record.record_time}</td>
                <td className="px-4 py-2">{record.record_type}</td>
                <td className="px-4 py-2">{new Date(record.record_timestamp).toLocaleString('ko-KR')}</td>
                <td className="px-4 py-2">{record.is_manual ? '예' : '아니오'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 6월 11일 일일 근무 요약 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">6월 11일 일일 근무 요약</h3>
        {data.summary ? (
          <div>
            <p>출근시간: {data.summary.check_in_time ? new Date(data.summary.check_in_time).toLocaleString('ko-KR') : '없음'}</p>
            <p>퇴근시간: {data.summary.check_out_time ? new Date(data.summary.check_out_time).toLocaleString('ko-KR') : '없음'}</p>
            <p>기본근무시간: {data.summary.basic_hours}시간</p>
            <p className="text-red-600 font-bold">초과근무시간: {data.summary.overtime_hours}시간</p>
            <p>야간근무시간: {data.summary.night_hours}시간</p>
            <p>대체휴가시간: {data.summary.substitute_hours}시간</p>
            <p>보상휴가시간: {data.summary.compensatory_hours}시간</p>
            <p>휴게시간: {data.summary.break_minutes}분</p>
            <p>근무상태: {data.summary.work_status}</p>
            <p>저녁식사: {data.summary.had_dinner ? '예' : '아니오'}</p>
          </div>
        ) : (
          <p>데이터 없음</p>
        )}
      </div>

      {/* 6월 전체 근무 요약 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">6월 전체 근무 요약</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">날짜</th>
                <th className="px-4 py-2 text-left">출근</th>
                <th className="px-4 py-2 text-left">퇴근</th>
                <th className="px-4 py-2 text-left">기본</th>
                <th className="px-4 py-2 text-left">초과</th>
                <th className="px-4 py-2 text-left">야간</th>
                <th className="px-4 py-2 text-left">대체</th>
                <th className="px-4 py-2 text-left">보상</th>
                <th className="px-4 py-2 text-left">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly?.map((day: any, index: number) => (
                <tr key={index} className={day.work_date === '2025-06-11' ? 'bg-yellow-100' : ''}>
                  <td className="px-4 py-2">{day.work_date}</td>
                  <td className="px-4 py-2">{day.check_in_time ? new Date(day.check_in_time).toLocaleTimeString('ko-KR') : '-'}</td>
                  <td className="px-4 py-2">{day.check_out_time ? new Date(day.check_out_time).toLocaleTimeString('ko-KR') : '-'}</td>
                  <td className="px-4 py-2">{day.basic_hours}</td>
                  <td className="px-4 py-2 text-red-600">{day.overtime_hours}</td>
                  <td className="px-4 py-2">{day.night_hours}</td>
                  <td className="px-4 py-2 text-blue-600">{day.substitute_hours || '-'}</td>
                  <td className="px-4 py-2 text-green-600">{day.compensatory_hours || '-'}</td>
                  <td className="px-4 py-2">{day.work_status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={3} className="px-4 py-2 font-semibold">합계</td>
                <td className="px-4 py-2 font-semibold">
                  {data.monthly?.reduce((sum: number, day: any) => sum + (day.basic_hours || 0), 0).toFixed(1)}
                </td>
                <td className="px-4 py-2 font-semibold text-red-600">
                  {data.monthly?.reduce((sum: number, day: any) => sum + (day.overtime_hours || 0), 0).toFixed(1)}
                </td>
                <td className="px-4 py-2 font-semibold">
                  {data.monthly?.reduce((sum: number, day: any) => sum + (day.night_hours || 0), 0).toFixed(1)}
                </td>
                <td className="px-4 py-2 font-semibold text-blue-600">
                  {data.monthly?.reduce((sum: number, day: any) => sum + (day.substitute_hours || 0), 0).toFixed(1)}
                </td>
                <td className="px-4 py-2 font-semibold text-green-600">
                  {data.monthly?.reduce((sum: number, day: any) => sum + (day.compensatory_hours || 0), 0).toFixed(1)}
                </td>
                <td className="px-4 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 근무시간 계산 검증 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">6월 11일 근무시간 계산 검증</h3>
        {data.summary && data.summary.check_in_time && data.summary.check_out_time && (
          <div>
            <p>출근: {new Date(data.summary.check_in_time).toLocaleTimeString('ko-KR')}</p>
            <p>퇴근: {new Date(data.summary.check_out_time).toLocaleTimeString('ko-KR')}</p>
            <p>총 근무시간: {
              (() => {
                const checkIn = new Date(data.summary.check_in_time)
                const checkOut = new Date(data.summary.check_out_time)
                const diffMs = checkOut.getTime() - checkIn.getTime()
                const diffHours = diffMs / (1000 * 60 * 60)
                return diffHours.toFixed(1)
              })()
            }시간</p>
            <p>휴게시간: {data.summary.break_minutes}분 ({(data.summary.break_minutes / 60).toFixed(1)}시간)</p>
            <p>실 근무시간: {
              (() => {
                const checkIn = new Date(data.summary.check_in_time)
                const checkOut = new Date(data.summary.check_out_time)
                const diffMs = checkOut.getTime() - checkIn.getTime()
                const diffHours = diffMs / (1000 * 60 * 60)
                const actualHours = diffHours - (data.summary.break_minutes / 60)
                return actualHours.toFixed(1)
              })()
            }시간</p>
            <p className="mt-2 text-sm text-gray-600">계산된 값:</p>
            <p>기본근무: {data.summary.basic_hours}시간 (예상: 8.0)</p>
            <p className="text-red-600 font-bold">초과근무: {data.summary.overtime_hours}시간 (예상: 0.4)</p>
            <p>야간근무: {data.summary.night_hours}시간</p>
          </div>
        )}
      </div>

      {/* 데이터베이스 직접 쿼리 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-2">데이터베이스 원본 데이터</h3>
        <p className="text-sm text-gray-600 mb-2">daily_work_summary 테이블 원본:</p>
        <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
          {JSON.stringify(data.summary, null, 2)}
        </pre>
      </div>
    </div>
  )
}
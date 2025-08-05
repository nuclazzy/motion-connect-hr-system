'use client'

import React, { useState } from 'react'
import { FileText, Download, Calendar } from 'lucide-react'

interface CapsTestDataGeneratorProps {
  onDataGenerated?: (data: string) => void
}

export default function CapsTestDataGenerator({ onDataGenerated }: CapsTestDataGeneratorProps) {
  const [employeeCount, setEmployeeCount] = useState(3)
  const [dateRange, setDateRange] = useState({
    start: '2025-08-01',
    end: '2025-08-05'
  })

  const generateCapsData = () => {
    const employees = [
      { name: '홍길동', id: '1001', empNo: 'E001' },
      { name: '김철수', id: '1002', empNo: 'E002' },
      { name: '이영희', id: '1003', empNo: 'E003' },
      { name: '박민수', id: '1004', empNo: 'E004' },
      { name: '정수진', id: '1005', empNo: 'E005' }
    ].slice(0, employeeCount)

    const capsRecords: string[] = []
    
    // 헤더 추가
    capsRecords.push('[timestamp]\t[terminal_id]\t[user_id]\t[user_name]\t[employee_no]\t[mode]\t[auth]')
    
    const startDate = new Date(dateRange.start)
    const endDate = new Date(dateRange.end)
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d)
      
      // 주말 스킵
      if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue
      
      employees.forEach(emp => {
        // 출근 시간 (8:30 ~ 9:30)
        const checkInHour = 8 + Math.floor(Math.random() * 2)
        const checkInMinute = Math.floor(Math.random() * 60)
        const checkInTime = `${String(checkInHour).padStart(2, '0')}:${String(checkInMinute).padStart(2, '0')}:00`
        
        // 퇴근 시간 (18:00 ~ 20:00)
        const checkOutHour = 18 + Math.floor(Math.random() * 3)
        const checkOutMinute = Math.floor(Math.random() * 60)
        const checkOutTime = `${String(checkOutHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}:00`
        
        const dateStr = currentDate.toISOString().split('T')[0]
        
        // 출근 기록 (해제)
        capsRecords.push(
          `${dateStr} ${checkInTime} AM\tCAPS_001\t${emp.id}\t${emp.name}\t${emp.empNo}\t해제\t지문인증`
        )
        
        // 중간에 출입 기록 추가 (20% 확률)
        if (Math.random() < 0.2) {
          const midHour = checkInHour + 3 + Math.floor(Math.random() * 2)
          const midTime = `${String(midHour).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`
          capsRecords.push(
            `${dateStr} ${midTime} ${midHour < 12 ? 'AM' : 'PM'}\tCAPS_001\t${emp.id}\t${emp.name}\t${emp.empNo}\t출입\t지문인증`
          )
        }
        
        // 퇴근 기록 (세트)
        const isPM = checkOutHour >= 12
        const displayHour = checkOutHour > 12 ? checkOutHour - 12 : checkOutHour
        capsRecords.push(
          `${dateStr} ${String(displayHour).padStart(2, '0')}:${String(checkOutMinute).padStart(2, '0')}:00 PM\tCAPS_001\t${emp.id}\t${emp.name}\t${emp.empNo}\t세트\t지문인증`
        )
      })
    }
    
    const capsDataText = capsRecords.join('\n')
    
    if (onDataGenerated) {
      onDataGenerated(capsDataText)
    }
    
    // 다운로드
    const blob = new Blob([capsDataText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caps_test_data_${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <FileText className="h-6 w-6 text-blue-600 mr-2" />
        <h3 className="text-lg font-semibold text-gray-800">CAPS 테스트 데이터 생성기</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            직원 수
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={employeeCount}
            onChange={(e) => setEmployeeCount(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작 날짜
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료 날짜
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <button
          onClick={generateCapsData}
          className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          <Download className="h-5 w-5 mr-2" />
          테스트 데이터 생성 및 다운로드
        </button>
        
        <div className="text-sm text-gray-600">
          <p>📌 생성되는 데이터:</p>
          <ul className="list-disc list-inside mt-1">
            <li>평일만 출퇴근 기록 생성</li>
            <li>출근: 8:30~9:30 (해제)</li>
            <li>퇴근: 18:00~20:00 (세트)</li>
            <li>20% 확률로 중간 출입 기록</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
/**
 * 공휴일 캘린더 통합 유틸리티
 * 휴가 관리 시스템과 대시보드에 공휴일 표시 기능 제공
 */

import { getHolidayInfoSync, isWeekend, updateHolidayCache } from '@/lib/holidays'

export interface HolidayInfo {
  date: string
  name: string
  isHoliday: boolean
  isWeekend: boolean
  dayType: 'holiday' | 'weekend' | 'weekday'
}

/**
 * 특정 월의 모든 날짜에 대한 공휴일/주말 정보 가져오기
 */
export async function getMonthHolidayInfo(year: number, month: number): Promise<Map<string, HolidayInfo>> {
  // 해당 연도의 공휴일 캐시 업데이트
  await updateHolidayCache(year)
  
  const holidayMap = new Map<string, HolidayInfo>()
  const daysInMonth = new Date(year, month, 0).getDate()
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dateString = formatDateString(year, month, day)
    
    const holidayInfo = getHolidayInfoSync(date)
    const weekend = isWeekend(date)
    
    let dayType: 'holiday' | 'weekend' | 'weekday' = 'weekday'
    if (holidayInfo.isHoliday) {
      dayType = 'holiday'
    } else if (weekend) {
      dayType = 'weekend'
    }
    
    holidayMap.set(dateString, {
      date: dateString,
      name: holidayInfo.name || (weekend ? (date.getDay() === 0 ? '일요일' : '토요일') : ''),
      isHoliday: holidayInfo.isHoliday,
      isWeekend: weekend,
      dayType
    })
  }
  
  return holidayMap
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
export function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * 날짜별 스타일 클래스 반환
 */
export function getDayStyleClass(dayInfo: HolidayInfo): string {
  switch (dayInfo.dayType) {
    case 'holiday':
      return 'bg-red-50 text-red-700 font-semibold'
    case 'weekend':
      if (dayInfo.date.endsWith('토')) {
        return 'bg-blue-50 text-blue-700'
      }
      return 'bg-gray-50 text-gray-600'
    default:
      return 'bg-white text-gray-900'
  }
}

/**
 * 캘린더 셀 스타일 (공휴일/주말 포함)
 */
export function getCalendarCellStyle(dayInfo: HolidayInfo, hasEvents: boolean = false): string {
  const baseClasses = 'p-2 md:p-3 border border-gray-200 min-h-[80px] md:min-h-[100px] relative'
  
  let bgClass = ''
  if (dayInfo.dayType === 'holiday') {
    bgClass = hasEvents ? 'bg-red-50' : 'bg-red-50/70'
  } else if (dayInfo.dayType === 'weekend') {
    bgClass = hasEvents ? 'bg-gray-50' : 'bg-gray-50/50'
  } else {
    bgClass = hasEvents ? 'bg-blue-50/30' : 'bg-white'
  }
  
  return `${baseClasses} ${bgClass}`
}

/**
 * 날짜 라벨 스타일
 */
export function getDayLabelStyle(dayInfo: HolidayInfo): string {
  switch (dayInfo.dayType) {
    case 'holiday':
      return 'text-red-600 font-bold'
    case 'weekend':
      return dayInfo.date.includes('토') ? 'text-blue-600 font-semibold' : 'text-gray-500 font-semibold'
    default:
      return 'text-gray-700'
  }
}

/**
 * 공휴일 배지 컴포넌트용 props
 */
export function getHolidayBadgeProps(dayInfo: HolidayInfo) {
  if (!dayInfo.isHoliday) return null
  
  return {
    className: 'absolute top-1 right-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded-full',
    title: dayInfo.name,
    children: '공휴일'
  }
}

/**
 * 연간 공휴일 목록 가져오기
 */
export async function getYearlyHolidays(year: number): Promise<Array<{date: string, name: string}>> {
  await updateHolidayCache(year)
  
  const holidays: Array<{date: string, name: string}> = []
  
  // 1월부터 12월까지 모든 날짜 체크
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate()
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dateString = formatDateString(year, month, day)
      const holidayInfo = getHolidayInfoSync(date)
      
      if (holidayInfo.isHoliday && holidayInfo.name) {
        holidays.push({
          date: dateString,
          name: holidayInfo.name
        })
      }
    }
  }
  
  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * 특정 기간의 근무일수 계산 (공휴일/주말 제외)
 */
export function calculateWorkDays(startDate: Date, endDate: Date): number {
  let workDays = 0
  const current = new Date(startDate)
  
  while (current <= endDate) {
    const holidayInfo = getHolidayInfoSync(current)
    const weekend = isWeekend(current)
    
    if (!holidayInfo.isHoliday && !weekend) {
      workDays++
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return workDays
}

/**
 * 휴가 신청 시 실제 차감일수 계산 (공휴일/주말 제외)
 */
export function calculateActualLeaveDays(
  startDate: string, 
  endDate: string,
  includeWeekends: boolean = false
): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  let actualDays = 0
  
  const current = new Date(start)
  while (current <= end) {
    const holidayInfo = getHolidayInfoSync(current)
    const weekend = isWeekend(current)
    
    // 공휴일은 항상 제외
    if (!holidayInfo.isHoliday) {
      // 주말 포함 여부에 따라 계산
      if (includeWeekends || !weekend) {
        actualDays++
      }
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return actualDays
}
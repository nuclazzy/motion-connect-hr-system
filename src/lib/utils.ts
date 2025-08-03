import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind CSS 클래스를 병합하는 유틸리티 함수
 * clsx와 tailwind-merge를 결합하여 조건부 클래스와 중복 제거를 동시에 지원
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 객체의 빈 값들을 필터링하는 유틸리티
 */
export function filterEmpty<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => 
      value !== null && value !== undefined && value !== ''
    )
  ) as Partial<T>
}

/**
 * 숫자를 한국 로케일로 포맷팅
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ko-KR').format(num)
}

/**
 * 날짜를 한국 형식으로 포맷팅
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  }).format(dateObj)
}

/**
 * 날짜와 시간을 한국 형식으로 포맷팅
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * 바이트를 읽기 쉬운 형식으로 변환
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 문자열을 슬러그로 변환 (URL 친화적)
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 특수문자 제거
    .replace(/[\s_-]+/g, '-') // 공백을 하이픈으로
    .replace(/^-+|-+$/g, '') // 앞뒤 하이픈 제거
}

/**
 * 배열을 청크 단위로 나누기
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * 딜레이 함수 (Promise 기반)
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 디바운스 함수
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * 스로틀 함수
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

/**
 * 깊은 복사
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T
  if (typeof obj === 'object') {
    const copy: any = {}
    Object.keys(obj).forEach(key => {
      copy[key] = deepClone((obj as any)[key])
    })
    return copy
  }
  return obj
}

/**
 * 랜덤 ID 생성
 */
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 이메일 유효성 검사
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * 전화번호 유효성 검사 (한국)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const phoneRegex = /^010-\d{4}-\d{4}$/
  return phoneRegex.test(phone)
}

/**
 * 사원번호 유효성 검사
 */
export function isValidEmployeeId(employeeId: string): boolean {
  const employeeIdRegex = /^\d{4,8}$/
  return employeeIdRegex.test(employeeId)
}

/**
 * 색상 팔레트에서 안전한 색상 가져오기
 */
export function getSafeColor(color: string, fallback = 'gray'): string {
  const validColors = [
    'primary', 'secondary', 'success', 'warning', 'error', 'info',
    'gray', 'red', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink'
  ]
  
  return validColors.includes(color) ? color : fallback
}

/**
 * 로컬 스토리지 안전 접근
 */
export const localStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, value)
    } catch {
      // 실패 시 무시
    }
  },
  
  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 실패 시 무시
    }
  }
}

/**
 * 세션 스토리지 안전 접근
 */
export const sessionStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(key, value)
    } catch {
      // 실패 시 무시
    }
  },
  
  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(key)
    } catch {
      // 실패 시 무시
    }
  }
}

/**
 * 환경 변수 안전 접근
 */
export function getEnvVar(key: string, fallback?: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || fallback || ''
  }
  return fallback || ''
}

/**
 * 객체의 중첩된 속성에 안전하게 접근
 */
export function get<T>(obj: any, path: string, defaultValue?: T): T {
  const keys = path.split('.')
  let result = obj
  
  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return defaultValue as T
    }
    result = result[key]
  }
  
  return result !== undefined ? result : defaultValue as T
}

/**
 * 배열에서 중복 제거
 */
export function unique<T>(array: T[]): T[] {
  return Array.from(new Set(array))
}

/**
 * 배열을 특정 속성으로 그룹화
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key])
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

/**
 * 두 배열의 차이점 찾기
 */
export function arrayDiff<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter(item => !arr2.includes(item))
}

/**
 * 문자열 자르기 (말줄임표 포함)
 */
export function truncate(text: string, length: number, suffix = '...'): string {
  if (text.length <= length) return text
  return text.slice(0, length - suffix.length) + suffix
}
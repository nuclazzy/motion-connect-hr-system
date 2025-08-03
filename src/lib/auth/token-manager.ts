/**
 * 토큰 자동 갱신 및 세션 관리를 위한 유틸리티
 */

const TOKEN_KEY = 'auth_token'
const TOKEN_EXPIRY_KEY = 'auth_token_expiry'
const REFRESH_THRESHOLD = 5 * 60 * 1000 // 만료 5분 전 갱신

export interface AuthToken {
  userId: string
  expiresAt: number
}

/**
 * 토큰 저장
 */
export function saveToken(userId: string, expiresIn: number = 3600) {
  const expiresAt = Date.now() + (expiresIn * 1000)
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, userId)
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString())
  }
  
  // 자동 갱신 설정
  scheduleTokenRefresh()
}

/**
 * 토큰 가져오기 (자동 검증 포함)
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  
  const token = localStorage.getItem(TOKEN_KEY)
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
  
  if (!token || !expiryStr) return null
  
  const expiry = parseInt(expiryStr)
  const now = Date.now()
  
  // 토큰 만료 확인
  if (now >= expiry) {
    clearToken()
    return null
  }
  
  // 갱신 필요 확인
  if (now >= expiry - REFRESH_THRESHOLD) {
    refreshToken()
  }
  
  return token
}

/**
 * 토큰 삭제
 */
export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }
}

/**
 * 토큰 갱신
 */
async function refreshToken() {
  const currentToken = localStorage.getItem(TOKEN_KEY)
  if (!currentToken) return
  
  try {
    // 실제로는 서버에 갱신 요청을 보내야 하지만,
    // 현재 시스템에서는 토큰이 userId이므로 만료 시간만 연장
    saveToken(currentToken, 3600)
    console.log('✅ 토큰 자동 갱신 완료')
  } catch (error) {
    console.error('❌ 토큰 갱신 실패:', error)
    clearToken()
  }
}

/**
 * 토큰 자동 갱신 스케줄링
 */
let refreshTimer: NodeJS.Timeout | null = null

function scheduleTokenRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }
  
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY)
  if (!expiryStr) return
  
  const expiry = parseInt(expiryStr)
  const now = Date.now()
  const timeUntilRefresh = Math.max(0, expiry - now - REFRESH_THRESHOLD)
  
  refreshTimer = setTimeout(() => {
    refreshToken()
  }, timeUntilRefresh)
}

/**
 * 인증 헤더 생성 (자동 갱신 포함)
 */
export function getAuthHeaders(): HeadersInit {
  const token = getToken()
  
  if (!token) {
    throw new Error('인증이 필요합니다.')
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

/**
 * localStorage 손상 복구
 */
export function repairTokenStorage() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
    
    // 토큰은 있는데 만료 시간이 없는 경우
    if (token && !expiry) {
      saveToken(token, 3600) // 1시간으로 재설정
      console.log('✅ 토큰 저장소 복구 완료')
      return true
    }
    
    // 둘 다 없으면 복구 불가
    if (!token) {
      return false
    }
    
    return true
  } catch (error) {
    console.error('❌ 토큰 저장소 복구 실패:', error)
    return false
  }
}

// 페이지 로드 시 토큰 상태 확인
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    const token = getToken()
    if (token) {
      scheduleTokenRefresh()
    }
  })
}
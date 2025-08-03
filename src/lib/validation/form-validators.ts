/**
 * 강화된 폼 데이터 검증 시스템
 * 기존 문제: 기본적인 검증만 수행 (days > 0)
 * 개선: 비즈니스 로직, 보안, 데이터 무결성 검증 추가
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface ValidationContext {
  userId: string
  userRole: 'admin' | 'user'
  currentLeaveData?: any
  companyPolicies?: any
}

/**
 * 휴가 신청 검증 (기존 대비 대폭 강화)
 */
export function validateLeaveRequest(
  requestData: any, 
  context: ValidationContext
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. 기본 필드 검증 (기존)
  if (!requestData.휴가형태) {
    errors.push('휴가 형태를 선택해주세요.')
  }
  
  if (!requestData.시작일) {
    errors.push('시작일을 입력해주세요.')
  }

  // 2. 날짜 논리 검증 (개선)
  if (requestData.시작일 && requestData.종료일) {
    const startDate = new Date(requestData.시작일)
    const endDate = new Date(requestData.종료일)
    const today = new Date()
    
    // 과거 날짜 검증
    if (startDate < today && !context.userRole.includes('admin')) {
      errors.push('과거 날짜로는 휴가를 신청할 수 없습니다.')
    }
    
    // 날짜 순서 검증
    if (endDate < startDate) {
      errors.push('종료일은 시작일보다 늦어야 합니다.')
    }
    
    // 최대 연속 휴가 일수 검증
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff > 30) {
      errors.push('한 번에 신청할 수 있는 최대 휴가는 30일입니다.')
    }
    
    // 너무 먼 미래 날짜 검증
    const futureLimit = new Date()
    futureLimit.setFullYear(futureLimit.getFullYear() + 1)
    if (startDate > futureLimit) {
      errors.push('1년 이내의 날짜만 신청할 수 있습니다.')
    }
  }

  // 3. 휴가 잔여량 검증 (대폭 강화)
  if (context.currentLeaveData && requestData.휴가일수) {
    const requestedDays = parseFloat(requestData.휴가일수)
    const leaveType = requestData.휴가형태
    
    // 휴가 타입별 상세 검증
    switch (leaveType) {
      case '연차':
        const remainingAnnual = context.currentLeaveData.annual_days - context.currentLeaveData.used_annual_days
        if (requestedDays > remainingAnnual) {
          errors.push(`연차가 부족합니다. (신청: ${requestedDays}일, 잔여: ${remainingAnnual}일)`)
        }
        
        // 연차 사용 패턴 경고
        if (requestedDays > 5) {
          warnings?.push('5일 이상의 연차 사용 시 업무 인수인계를 확실히 해주세요.')
        }
        break
        
      case '병가':
        if (requestedDays > 3 && !requestData.의료진단서) {
          errors.push('3일 이상의 병가 신청 시 의료진단서가 필요합니다.')
        }
        break
        
      case '경조사':
        if (!requestData.경조사구분) {
          errors.push('경조사 구분을 선택해주세요.')
        }
        
        // 경조사 종류별 일수 제한 검증
        const allowedDays = getCondolenceLeaveDays(requestData.경조사구분)
        if (requestedDays > allowedDays) {
          errors.push(`${requestData.경조사구분}의 경우 최대 ${allowedDays}일까지 신청 가능합니다.`)
        }
        break
    }
  }

  // 4. 중복 신청 검증 (신규)
  if (requestData.시작일 && requestData.종료일) {
    // 실제로는 DB 쿼리로 중복 확인해야 함
    // 여기서는 검증 로직만 표시
    const hasOverlapping = checkOverlappingLeaveRequests(
      context.userId, 
      requestData.시작일, 
      requestData.종료일
    )
    
    if (hasOverlapping) {
      errors.push('해당 기간에 이미 신청된 휴가가 있습니다.')
    }
  }

  // 5. 사유 필수 입력 검증 (강화)
  const requiresReason = ['병가', '경조사', '기타', '공가']
  if (requiresReason.includes(requestData.휴가형태) && !requestData.사유?.trim()) {
    errors.push(`${requestData.휴가형태} 신청 시 사유는 필수입니다.`)
  }

  // 6. 보안 검증 (신규)
  if (containsSuspiciousContent(requestData)) {
    errors.push('부적절한 내용이 포함되어 있습니다.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 관리자 승인/거절 검증
 */
export function validateAdminAction(
  action: 'approve' | 'reject',
  requestId: string,
  adminNote?: string,
  context?: ValidationContext
): ValidationResult {
  const errors: string[] = []

  // 1. 기본 권한 검증
  if (context?.userRole !== 'admin') {
    errors.push('관리자 권한이 필요합니다.')
  }

  // 2. 거절 시 사유 필수
  if (action === 'reject' && !adminNote?.trim()) {
    errors.push('거절 시 사유를 입력해주세요.')
  }

  // 3. 요청 ID 형식 검증
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(requestId)) {
    errors.push('잘못된 요청 ID 형식입니다.')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * 직원 데이터 생성/수정 검증
 */
export function validateEmployeeData(employeeData: any): ValidationResult {
  const errors: string[] = []

  // 1. 필수 필드 검증
  const requiredFields = ['name', 'email', 'employee_id', 'department', 'position', 'hire_date']
  requiredFields.forEach(field => {
    if (!employeeData[field]?.toString().trim()) {
      errors.push(`${field}는 필수 입력 항목입니다.`)
    }
  })

  // 2. 이메일 형식 검증
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (employeeData.email && !emailRegex.test(employeeData.email)) {
    errors.push('올바른 이메일 형식이 아닙니다.')
  }

  // 3. 사번 형식 검증 (숫자만)
  if (employeeData.employee_id && !/^\d+$/.test(employeeData.employee_id)) {
    errors.push('사번은 숫자만 입력 가능합니다.')
  }

  // 4. 입사일 검증
  if (employeeData.hire_date) {
    const hireDate = new Date(employeeData.hire_date)
    const today = new Date()
    
    if (hireDate > today) {
      errors.push('입사일은 미래 날짜가 될 수 없습니다.')
    }
    
    // 너무 오래된 날짜 검증
    const oldestDate = new Date()
    oldestDate.setFullYear(oldestDate.getFullYear() - 50)
    if (hireDate < oldestDate) {
      errors.push('입사일이 너무 오래되었습니다.')
    }
  }

  // 5. 전화번호 형식 검증
  if (employeeData.phone) {
    const phoneRegex = /^010-\d{4}-\d{4}$/
    if (!phoneRegex.test(employeeData.phone)) {
      errors.push('전화번호는 010-0000-0000 형식으로 입력해주세요.')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// 헬퍼 함수들
function getCondolenceLeaveDays(type: string): number {
  const leaveDays: { [key: string]: number } = {
    '본인 결혼': 5,
    '자녀 결혼': 2,
    '부모 사망': 5,
    '배우자 사망': 5,
    '배우자 부모 사망': 3,
    '자녀 사망': 5,
    '형제·자매 사망': 2
  }
  return leaveDays[type] || 1
}

function checkOverlappingLeaveRequests(userId: string, startDate: string, endDate: string): boolean {
  // 실제 구현에서는 DB 쿼리 필요
  // 여기서는 검증 로직만 표시
  return false
}

function containsSuspiciousContent(data: any): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /\bselect\b.*\bfrom\b/i,
    /\bunion\b.*\bselect\b/i
  ]
  
  const dataString = JSON.stringify(data).toLowerCase()
  return suspiciousPatterns.some(pattern => pattern.test(dataString))
}
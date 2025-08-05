// CAPS 데이터 업로드 검증 및 중복 방지 유틸리티

export interface CapsValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  duplicateCount: number
  processableCount: number
}

export interface ProcessedCapsRecord {
  user_id: string
  record_date: string
  record_time: string
  record_timestamp: string
  record_type: '출근' | '퇴근'
  source: string
  device_id: string
  reason: string
  is_manual: boolean
}

/**
 * CAPS 데이터 검증 클래스
 * 중복 제약조건 오류 방지를 위한 포괄적 검증
 */
export class CapsDataValidator {
  private duplicateMap = new Map<string, number>()
  private validationErrors: string[] = []
  private validationWarnings: string[] = []

  /**
   * 배치 전체 검증
   */
  public validateBatch(records: ProcessedCapsRecord[]): CapsValidationResult {
    this.reset()
    
    for (let i = 0; i < records.length; i++) {
      this.validateRecord(records[i], i + 1)
    }

    return {
      isValid: this.validationErrors.length === 0,
      errors: [...this.validationErrors],
      warnings: [...this.validationWarnings],
      duplicateCount: this.duplicateMap.size,
      processableCount: records.length - this.validationErrors.length
    }
  }

  /**
   * 개별 레코드 검증
   */
  private validateRecord(record: ProcessedCapsRecord, lineNumber: number): void {
    // 1. 필수 필드 검증
    this.validateRequiredFields(record, lineNumber)
    
    // 2. 데이터 형식 검증
    this.validateDataFormats(record, lineNumber)
    
    // 3. 비즈니스 로직 검증
    this.validateBusinessRules(record, lineNumber)
    
    // 4. 중복 검증 (배치 내)
    this.validateDuplicates(record, lineNumber)
  }

  private validateRequiredFields(record: ProcessedCapsRecord, line: number): void {
    if (!record.user_id?.trim()) {
      this.validationErrors.push(`${line}행: 사용자 ID가 필요합니다`)
    }
    
    if (!record.record_timestamp?.trim()) {
      this.validationErrors.push(`${line}행: 기록 시간이 필요합니다`)
    }
    
    if (!record.record_type || !['출근', '퇴근'].includes(record.record_type)) {
      this.validationErrors.push(`${line}행: 올바른 기록 타입이 필요합니다 (출근/퇴근)`)
    }
  }

  private validateDataFormats(record: ProcessedCapsRecord, line: number): void {
    // 타임스탬프 형식 검증
    try {
      const timestamp = new Date(record.record_timestamp)
      if (isNaN(timestamp.getTime())) {
        this.validationErrors.push(`${line}행: 잘못된 시간 형식`)
      }
      
      // 미래 시간 체크
      if (timestamp > new Date()) {
        this.validationWarnings.push(`${line}행: 미래 시간 기록 발견`)
      }
      
      // 너무 오래된 기록 체크 (1년 이상)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      if (timestamp < oneYearAgo) {
        this.validationWarnings.push(`${line}행: 1년 이상 오래된 기록`)
      }
    } catch (error) {
      this.validationErrors.push(`${line}행: 시간 파싱 오류`)
    }
  }

  private validateBusinessRules(record: ProcessedCapsRecord, line: number): void {
    // 근무시간 상식 검증 (새벽 2-5시 기록은 경고)
    try {
      const timestamp = new Date(record.record_timestamp)
      const hour = timestamp.getHours()
      
      if (hour >= 2 && hour <= 5) {
        this.validationWarnings.push(
          `${line}행: 새벽 시간대 기록 (${hour}시) - 야간근무 확인 필요`
        )
      }
    } catch (error) {
      // 이미 format validation에서 처리됨
    }
  }

  private validateDuplicates(record: ProcessedCapsRecord, line: number): void {
    const key = `${record.user_id}-${record.record_timestamp}-${record.record_type}`
    
    if (this.duplicateMap.has(key)) {
      const previousLine = this.duplicateMap.get(key)!
      this.validationWarnings.push(
        `${line}행: 배치 내 중복 발견 (${previousLine}행과 동일)`
      )
    } else {
      this.duplicateMap.set(key, line)
    }
  }

  private reset(): void {
    this.duplicateMap.clear()
    this.validationErrors = []
    this.validationWarnings = []
  }

  /**
   * 중복 제거된 고유 레코드만 반환
   */
  public getUniqueRecords(records: ProcessedCapsRecord[]): ProcessedCapsRecord[] {
    const uniqueMap = new Map<string, ProcessedCapsRecord>()
    const seen = new Set<string>()
    
    for (const record of records) {
      const key = `${record.user_id}-${record.record_timestamp}-${record.record_type}`
      
      if (!seen.has(key)) {
        seen.add(key)
        uniqueMap.set(key, record)
      }
    }
    
    return Array.from(uniqueMap.values())
  }
}

/**
 * CAPS 업로드 결과 추적
 */
export interface CapsUploadMetrics {
  startTime: Date
  endTime?: Date
  totalRecords: number
  processedRecords: number
  successfulInserts: number
  duplicatesSkipped: number
  errorsEncountered: number
  processingTimeMs?: number
}

export class CapsUploadTracker {
  private metrics: CapsUploadMetrics

  constructor(totalRecords: number) {
    this.metrics = {
      startTime: new Date(),
      totalRecords,
      processedRecords: 0,
      successfulInserts: 0,
      duplicatesSkipped: 0,
      errorsEncountered: 0
    }
  }

  public recordSuccess(): void {
    this.metrics.successfulInserts++
    this.metrics.processedRecords++
  }

  public recordDuplicate(): void {
    this.metrics.duplicatesSkipped++
    this.metrics.processedRecords++
  }

  public recordError(): void {
    this.metrics.errorsEncountered++
    this.metrics.processedRecords++
  }

  public finish(): CapsUploadMetrics {
    this.metrics.endTime = new Date()
    this.metrics.processingTimeMs = 
      this.metrics.endTime.getTime() - this.metrics.startTime.getTime()
    
    return { ...this.metrics }
  }

  public getProgress(): number {
    return (this.metrics.processedRecords / this.metrics.totalRecords) * 100
  }
}
// CAPS 업로드 중복 제약조건 테스트
import { describe, it, expect, beforeEach } from '@jest/globals'
import { CapsDataValidator } from '../lib/caps-validator'

describe('CAPS 데이터 업로드 중복 방지 테스트', () => {
  let validator: CapsDataValidator

  beforeEach(() => {
    validator = new CapsDataValidator()
  })

  describe('중복 제약조건 테스트', () => {
    it('동일한 사용자, 시간, 타입의 중복 레코드를 감지해야 함', () => {
      const duplicateRecords = [
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        },
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00', // 동일한 시간
          record_type: '출근' as const,                    // 동일한 타입
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        }
      ]

      const result = validator.validateBatch(duplicateRecords)
      
      expect(result.warnings).toContain(
        expect.stringContaining('배치 내 중복 발견')
      )
      expect(result.duplicateCount).toBe(1)
    })

    it('서로 다른 사용자의 동일 시간 기록은 허용해야 함', () => {
      const differentUserRecords = [
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        },
        {
          user_id: 'user2', // 다른 사용자
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        }
      ]

      const result = validator.validateBatch(differentUserRecords)
      
      expect(result.isValid).toBe(true)
      expect(result.duplicateCount).toBe(0)
    })

    it('동일 사용자의 출근/퇴근은 허용해야 함', () => {
      const checkInOutRecords = [
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        },
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T18:00:00+09:00',
          record_type: '퇴근' as const, // 다른 타입
          record_date: '2025-08-05',
          record_time: '18:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: 'CAPS 지문인식',
          is_manual: false
        }
      ]

      const result = validator.validateBatch(checkInOutRecords)
      
      expect(result.isValid).toBe(true)
      expect(result.duplicateCount).toBe(0)
    })
  })

  describe('데이터 검증 테스트', () => {
    it('필수 필드 누락 시 오류를 발생시켜야 함', () => {
      const invalidRecord = [{
        user_id: '', // 빈 값
        record_timestamp: '2025-08-05T09:00:00+09:00',
        record_type: '출근' as const,
        record_date: '2025-08-05',
        record_time: '09:00:00',
        source: 'CAPS',
        device_id: 'device1',
        reason: 'CAPS 지문인식',
        is_manual: false
      }]

      const result = validator.validateBatch(invalidRecord)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        expect.stringContaining('사용자 ID가 필요합니다')
      )
    })

    it('잘못된 기록 타입 시 오류를 발생시켜야 함', () => {
      const invalidRecord = [{
        user_id: 'user1',
        record_timestamp: '2025-08-05T09:00:00+09:00',
        record_type: '출입' as any, // 잘못된 타입
        record_date: '2025-08-05',
        record_time: '09:00:00',
        source: 'CAPS',
        device_id: 'device1',
        reason: 'CAPS 지문인식',
        is_manual: false
      }]

      const result = validator.validateBatch(invalidRecord)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(
        expect.stringContaining('올바른 기록 타입이 필요합니다')
      )
    })

    it('새벽 시간 기록 시 경고를 발생시켜야 함', () => {
      const nightRecord = [{
        user_id: 'user1',
        record_timestamp: '2025-08-05T03:00:00+09:00', // 새벽 3시
        record_type: '출근' as const,
        record_date: '2025-08-05',
        record_time: '03:00:00',
        source: 'CAPS',
        device_id: 'device1',
        reason: 'CAPS 지문인식',
        is_manual: false
      }]

      const result = validator.validateBatch(nightRecord)
      
      expect(result.warnings).toContain(
        expect.stringContaining('새벽 시간대 기록')
      )
    })
  })

  describe('중복 제거 기능 테스트', () => {
    it('중복된 레코드를 제거하고 첫 번째 것만 유지해야 함', () => {
      const recordsWithDuplicates = [
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: '첫 번째 기록',
          is_manual: false
        },
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T09:00:00+09:00',
          record_type: '출근' as const,
          record_date: '2025-08-05',
          record_time: '09:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: '중복된 기록', // 다른 reason이지만 중복으로 간주
          is_manual: false
        },
        {
          user_id: 'user1',
          record_timestamp: '2025-08-05T18:00:00+09:00',
          record_type: '퇴근' as const,
          record_date: '2025-08-05',
          record_time: '18:00:00',
          source: 'CAPS',
          device_id: 'device1',
          reason: '고유한 기록',
          is_manual: false
        }
      ]

      const uniqueRecords = validator.getUniqueRecords(recordsWithDuplicates)
      
      expect(uniqueRecords).toHaveLength(2) // 중복 제거 후 2개
      expect(uniqueRecords[0].reason).toBe('첫 번째 기록') // 첫 번째 것이 유지됨
      expect(uniqueRecords[1].reason).toBe('고유한 기록')
    })
  })
})
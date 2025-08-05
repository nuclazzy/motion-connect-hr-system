// 캡스 기록 처리 유틸리티
// Google Apps Script 로직 완전 구현

export interface CapsRecord {
  timestamp: string
  name: string
  mode: '출근' | '퇴근' | '해제' | '세트' | '출입'
  hadDinner?: boolean
}

export interface ProcessedAttendanceTime {
  checkInTime: string | null
  checkOutTime: string | null
  hadDinner: boolean
}

/**
 * 캡스 기록을 처리하여 최종 출퇴근 시간을 확정합니다
 * Google Apps Script의 로직을 완전히 구현
 * 
 * 규칙:
 * 1. 해제 = 출근으로 인식
 * 2. 세트 = 퇴근으로 인식  
 * 3. 출입 = 무시
 * 4. 마지막 기록이 출입인 경우, 그 앞의 마지막 세트/퇴근을 퇴근으로 사용
 * 5. 가장 이른 출근시간, 가장 늦은 퇴근시간 사용
 */
export function processCapsRecords(
  records: CapsRecord[], 
  date: string
): ProcessedAttendanceTime {
  if (!records || records.length === 0) {
    return { checkInTime: null, checkOutTime: null, hadDinner: false }
  }

  // 해당 날짜의 기록만 필터링
  const dayRecords = records.filter(record => {
    const recordDate = new Date(record.timestamp).toISOString().split('T')[0]
    return recordDate === date
  })

  if (dayRecords.length === 0) {
    return { checkInTime: null, checkOutTime: null, hadDinner: false }
  }

  // 시간순 정렬
  dayRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // 출근 기록들과 퇴근 기록들 분리
  const checkInRecords: { timestamp: string, hadDinner?: boolean }[] = []
  const checkOutRecords: { timestamp: string, hadDinner?: boolean }[] = []

  for (const record of dayRecords) {
    const recordObj = { 
      timestamp: record.timestamp, 
      hadDinner: record.hadDinner || false 
    }

    if (record.mode === '출근' || record.mode === '해제') {
      checkInRecords.push(recordObj)
    } else if (record.mode === '퇴근' || record.mode === '세트') {
      checkOutRecords.push(recordObj)
    }
    // '출입'은 무시
  }

  // 마지막 기록이 출입인 경우 특별 처리
  const lastRecord = dayRecords[dayRecords.length - 1]
  if (lastRecord.mode === '출입') {
    // 마지막 출입 기록 이전의 세트/퇴근 기록 찾기
    for (let i = dayRecords.length - 2; i >= 0; i--) {
      const prevRecord = dayRecords[i]
      if (prevRecord.mode === '세트' || prevRecord.mode === '퇴근') {
        const recordObj = {
          timestamp: prevRecord.timestamp,
          hadDinner: prevRecord.hadDinner || false
        }
        
        // 이미 추가되지 않았다면 추가
        const alreadyExists = checkOutRecords.some(r => r.timestamp === recordObj.timestamp)
        if (!alreadyExists) {
          checkOutRecords.push(recordObj)
        }
        break
      }
    }
  }

  // 가장 이른 출근시간과 가장 늦은 퇴근시간 선택
  let checkInTime: string | null = null
  let checkOutTime: string | null = null
  let hadDinner = false

  if (checkInRecords.length > 0) {
    // 가장 이른 출근시간
    checkInRecords.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    checkInTime = checkInRecords[0].timestamp
  }

  if (checkOutRecords.length > 0) {
    // 가장 늦은 퇴근시간
    checkOutRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const latestCheckOut = checkOutRecords[0]
    checkOutTime = latestCheckOut.timestamp
    hadDinner = latestCheckOut.hadDinner || false
  }

  return {
    checkInTime,
    checkOutTime,
    hadDinner
  }
}

/**
 * 시간 문자열을 HH:MM:SS 형식으로 변환
 */
export function formatTimeString(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toTimeString().split(' ')[0] // HH:MM:SS 부분만 추출
}

/**
 * 익일 퇴근 시간을 25:XX:XX 형식으로 변환
 */
export function handleOvernightCheckout(
  checkInTimestamp: string,
  checkOutTimestamp: string
): { time: string, isNextDay: boolean } {
  const checkIn = new Date(checkInTimestamp)
  const checkOut = new Date(checkOutTimestamp)

  // 퇴근이 출근보다 이른 시간인 경우 (익일 퇴근)
  if (checkOut.getTime() <= checkIn.getTime() || 
      (checkOut.getDate() > checkIn.getDate())) {
    
    const hours = checkOut.getHours()
    const minutes = checkOut.getMinutes().toString().padStart(2, '0')
    const seconds = checkOut.getSeconds().toString().padStart(2, '0')
    
    // 익일인 경우 24시간을 더해서 25:XX:XX 형식으로 표현
    const adjustedHours = hours + 24
    
    return {
      time: `${adjustedHours}:${minutes}:${seconds}`,
      isNextDay: true
    }
  }

  return {
    time: formatTimeString(checkOutTimestamp),
    isNextDay: false
  }
}

/**
 * 캡스 기록을 파싱하여 CapsRecord 배열로 변환
 * CSV 또는 텍스트 데이터에서 캡스 기록을 추출
 */
export function parseCapsRecordsFromText(
  textData: string,
  nameColumn: number = 4, // 이름 컬럼 인덱스
  modeColumn: number = 8, // 모드 컬럼 인덱스
  timestampColumns: [number, number] = [0, 1] // [날짜, 시간] 컬럼 인덱스
): CapsRecord[] {
  const records: CapsRecord[] = []
  const lines = textData.trim().split('\n')

  for (const line of lines) {
    if (!line.trim()) continue

    const columns = line.split(/\t+|\s{2,}/).filter(col => col.trim())
    
    if (columns.length <= Math.max(nameColumn, modeColumn, ...timestampColumns)) {
      continue // 컬럼 수 부족
    }

    const name = columns[nameColumn]?.trim()
    const mode = columns[modeColumn]?.trim() as CapsRecord['mode']
    const dateStr = columns[timestampColumns[0]]?.trim()
    const timeStr = columns[timestampColumns[1]]?.trim()

    if (!name || !mode || !dateStr || !timeStr) continue

    // 타임스탬프 생성
    try {
      const timestamp = new Date(`${dateStr} ${timeStr}`).toISOString()
      
      records.push({
        timestamp,
        name,
        mode,
        hadDinner: false // 기본값, 나중에 저녁식사 감지로 업데이트
      })
    } catch (error) {
      console.warn('캡스 기록 타임스탬프 파싱 오류:', { dateStr, timeStr, error })
    }
  }

  return records
}
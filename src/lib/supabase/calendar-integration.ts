import { CALENDAR_IDS } from '@/lib/calendarMapping'
import { createServiceRoleGoogleCalendarService } from '@/services/googleCalendarServiceAccount'

// 휴가 캘린더 이벤트 생성 인터페이스
export interface LeaveEventData {
  userId: string
  userName: string
  leaveType: 'substitute' | 'compensatory'
  requestedHours: number
  startDate: string
  endDate: string
  reason: string
  requestId: string
}

// 구글 캘린더 이벤트 생성 클래스
export class LeaveCalendarIntegration {
  
  // 휴가 이벤트 생성
  static async createLeaveEvent(eventData: LeaveEventData): Promise<{
    success: boolean
    eventId?: string
    message: string
  }> {
    try {
      console.log('📅 구글 캘린더 이벤트 생성 시작:', {
        userId: eventData.userId,
        userName: eventData.userName,
        leaveType: eventData.leaveType,
        requestedHours: eventData.requestedHours
      })

      // 구글 캘린더 서비스 생성
      const googleCalendarService = await createServiceRoleGoogleCalendarService()
      
      // 휴가 유형별 제목 및 색상 설정
      const leaveTypeDisplayName = eventData.leaveType === 'substitute' ? '대체휴가' : '보상휴가'
      const eventColor = eventData.leaveType === 'substitute' ? '9' : '11' // 9: 파란색, 11: 빨간색
      
      // 이벤트 데이터 구성
      const calendarEventData = {
        summary: `[${leaveTypeDisplayName}] ${eventData.userName}`,
        description: this.createEventDescription(eventData),
        start: {
          date: eventData.startDate // 종일 이벤트로 생성
        },
        end: {
          date: this.calculateEndDate(eventData.endDate) // 다음 날로 설정 (구글 캘린더 규칙)
        },
        colorId: eventColor,
        extendedProperties: {
          shared: {
            userId: eventData.userId,
            requestId: eventData.requestId,
            leaveType: eventData.leaveType,
            requestedHours: eventData.requestedHours.toString(),
            approvedAt: new Date().toISOString(),
            source: 'motion-connect-leave-system'
          }
        },
        transparency: 'opaque', // 바쁨으로 표시
        visibility: 'default'
      }

      console.log('📋 생성할 캘린더 이벤트 데이터:', calendarEventData)

      // 지정된 휴가 관리 캘린더에 이벤트 생성
      const event = await googleCalendarService.createEvent(
        CALENDAR_IDS.LEAVE_MANAGEMENT,
        calendarEventData
      )

      console.log('✅ 구글 캘린더 이벤트 생성 완료:', {
        eventId: event.id,
        calendar: '연차 및 경조사 현황',
        user: eventData.userName,
        leaveType: leaveTypeDisplayName,
        period: `${eventData.startDate} ~ ${eventData.endDate}`
      })

      return {
        success: true,
        eventId: event.id,
        message: `구글 캘린더에 ${leaveTypeDisplayName} 이벤트가 생성되었습니다.`
      }

    } catch (error) {
      console.error('❌ 구글 캘린더 이벤트 생성 실패:', error)
      
      // 캘린더 연동 실패는 휴가 승인을 막지 않음 (선택적 기능)
      return {
        success: false,
        message: `캘린더 이벤트 생성에 실패했지만 휴가는 정상 승인되었습니다. 오류: ${(error as Error).message}`
      }
    }
  }

  // 이벤트 설명 생성
  private static createEventDescription(eventData: LeaveEventData): string {
    const leaveTypeDisplayName = eventData.leaveType === 'substitute' ? '대체휴가' : '보상휴가'
    
    return [
      `휴가 유형: ${leaveTypeDisplayName}`,
      `사용 시간: ${eventData.requestedHours}시간`,
      `기간: ${eventData.startDate} ~ ${eventData.endDate}`,
      `사유: ${eventData.reason || '사유 없음'}`,
      `신청자: ${eventData.userName}`,
      '',
      '※ Motion Connect HR 시스템에서 자동 생성된 이벤트입니다.',
      `신청 ID: ${eventData.requestId}`
    ].join('\n')
  }

  // 종료일 계산 (구글 캘린더 종일 이벤트는 다음 날까지)
  private static calculateEndDate(endDate: string): string {
    const end = new Date(endDate)
    end.setDate(end.getDate() + 1)
    return end.toISOString().split('T')[0]
  }

  // 이벤트 삭제 (필요 시)
  static async deleteLeaveEvent(eventId: string): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const googleCalendarService = await createServiceRoleGoogleCalendarService()
      await googleCalendarService.deleteEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, eventId)
      
      console.log('🗑️ 구글 캘린더 이벤트 삭제 완료:', eventId)
      
      return {
        success: true,
        message: '캘린더 이벤트가 삭제되었습니다.'
      }
    } catch (error) {
      console.error('❌ 구글 캘린더 이벤트 삭제 실패:', error)
      
      return {
        success: false,
        message: `캘린더 이벤트 삭제 실패: ${(error as Error).message}`
      }
    }
  }

  // 이벤트 업데이트 (필요 시)
  static async updateLeaveEvent(
    eventId: string, 
    updateData: Partial<LeaveEventData>
  ): Promise<{
    success: boolean
    message: string
  }> {
    try {
      const googleCalendarService = await createServiceRoleGoogleCalendarService()
      
      // 업데이트할 필드만 구성
      const updateFields: any = {}
      
      if (updateData.startDate) {
        updateFields.start = { date: updateData.startDate }
      }
      
      if (updateData.endDate) {
        updateFields.end = { date: this.calculateEndDate(updateData.endDate) }
      }
      
      if (updateData.reason) {
        // 설명 업데이트 (기존 이벤트 정보 없이 단순화)
        const originalData = {
          userId: updateData.userId || '',
          userName: updateData.userName || '',
          leaveType: (updateData.leaveType || 'substitute') as 'substitute' | 'compensatory',
          requestedHours: updateData.requestedHours || 0,
          startDate: updateData.startDate || '',
          endDate: updateData.endDate || '',
          reason: updateData.reason,
          requestId: 'update-request'
        }
        
        updateFields.description = this.createEventDescription(originalData as LeaveEventData)
      }
      
      await googleCalendarService.updateEvent(CALENDAR_IDS.LEAVE_MANAGEMENT, eventId, updateFields)
      
      console.log('📝 구글 캘린더 이벤트 업데이트 완료:', eventId)
      
      return {
        success: true,
        message: '캘린더 이벤트가 업데이트되었습니다.'
      }
    } catch (error) {
      console.error('❌ 구글 캘린더 이벤트 업데이트 실패:', error)
      
      return {
        success: false,
        message: `캘린더 이벤트 업데이트 실패: ${(error as Error).message}`
      }
    }
  }
}
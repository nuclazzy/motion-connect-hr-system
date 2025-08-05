import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { googleCalendarService } from '@/lib/googleCalendar'
import { CALENDAR_IDS } from '@/lib/calendarMapping'

export async function POST(request: NextRequest) {
  try {
    const { leaveData, userData } = await request.json()
    
    console.log('🔍 휴가 캘린더 이벤트 생성 요청:', { leaveData, userData })
    
    // 휴가 형태별 이벤트 제목 생성
    const getLeaveTitle = (leaveType: string, userName: string) => {
      const typeMap: { [key: string]: string } = {
        '연차': '연차',
        '병가': '병가',
        '경조사': '경조사',
        '대체휴가': '대체휴가',
        '보상휴가': '보상휴가'
      }
      return `${typeMap[leaveType] || leaveType} - ${userName}`
    }
    
    // 휴가 형태별 색상 설정
    const getLeaveColor = (leaveType: string) => {
      const colorMap: { [key: string]: string } = {
        '연차': '10', // 녹색
        '병가': '11', // 빨간색
        '경조사': '9',  // 파란색
        '대체휴가': '5', // 노란색
        '보상휴가': '6'  // 주황색
      }
      return colorMap[leaveType] || '1' // 기본 색상
    }
    
    // 이벤트 데이터 생성
    const eventData = {
      summary: getLeaveTitle(leaveData.leaveType, userData.name),
      description: `직원: ${userData.name}\n부서: ${userData.department}\n휴가 종류: ${leaveData.leaveType}\n신청 일수: ${leaveData.leaveDays}일\n사유: ${leaveData.reason || '없음'}`,
      start: {
        date: leaveData.startDate, // 종일 이벤트로 설정 (time이 아닌 date 사용)
      },
      end: {
        date: leaveData.endDate, // 종일 이벤트로 설정
      },
      colorId: getLeaveColor(leaveData.leaveType),
      // 캘린더 이벤트에 메타데이터 추가 (취소 시 이벤트 찾기용)
      extendedProperties: {
        shared: {
          employeeId: userData.id,
          department: userData.department,
          leaveType: leaveData.leaveType,
          leaveDays: leaveData.leaveDays.toString(),
          requestId: leaveData.formRequestId || '',
          userId: userData.id,
          source: 'motion-connect'
        }
      }
    }
    
    console.log('📅 Google Calendar 이벤트 데이터:', eventData)
    
    // 휴가 관리 캘린더에 이벤트 생성
    const calendarEvent = await googleCalendarService.createEvent(
      CALENDAR_IDS.LEAVE_MANAGEMENT,
      eventData
    )
    
    if (calendarEvent) {
      console.log('✅ 휴가 캘린더 이벤트 생성 성공:', calendarEvent)
      return NextResponse.json({
        success: true,
        eventId: (calendarEvent as any).id,
        event: calendarEvent
      })
    } else {
      throw new Error('캘린더 이벤트 생성 실패')
    }
    
  } catch (error) {
    console.error('❌ 휴가 캘린더 이벤트 생성 오류:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // 기존 데이터 삭제
    await supabase.from('calendar_configs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    // 캘린더 설정 데이터 준비
    const calendarConfigs = [
      {
        config_type: 'function',
        target_name: 'leave-management',
        calendar_id: 'c_rb1oser82snsqf9vdkr7jgr9r8@group.calendar.google.com',
        calendar_alias: '연차 및 경조사 현황',
        description: '직원 휴가 및 경조사 일정 관리',
        color: '#E74C3C',
        is_active: true
      },
      {
        config_type: 'team',
        target_name: 'event-planning',
        calendar_id: 'motionsense.co.kr_v114c8qko1blc6966cice8hcv4@group.calendar.google.com',
        calendar_alias: '이벤트 기획 본부',
        description: '행사 및 이벤트 기획 관련 일정',
        color: '#FF6B6B',
        is_active: true
      },
      {
        config_type: 'team',
        target_name: 'broadcast-system',
        calendar_id: 'c_a3439675645443007e8ff58575fcfa4bbb7fbfadece96235962422566cf987e3@group.calendar.google.com',
        calendar_alias: '중계 및 시스템 운영',
        description: '방송 중계 및 시스템 운영 관련 일정',
        color: '#4ECDC4',
        is_active: true
      },
      {
        config_type: 'team',
        target_name: 'filming',
        calendar_id: 'dingastory.com_i0i3lutf4rkeijhen3cqju08co@group.calendar.google.com',
        calendar_alias: '촬영팀',
        description: '촬영 관련 일정',
        color: '#45B7D1',
        is_active: true
      },
      {
        config_type: 'team',
        target_name: 'editing',
        calendar_id: 'c_22693rqcgc7nrbdhl96f0g903k@group.calendar.google.com',
        calendar_alias: '편집팀',
        description: '편집 관련 일정',
        color: '#96CEB4',
        is_active: true
      },
      {
        config_type: 'function',
        target_name: 'external-meeting',
        calendar_id: 'motionsense.co.kr_vdbr1eu5ectsbsnod67gdohj00@group.calendar.google.com',
        calendar_alias: '외부 미팅 및 답사',
        description: '외부 미팅 및 현장 답사 일정',
        color: '#FFEAA7',
        is_active: true
      },
      {
        config_type: 'function',
        target_name: 'internal-meeting',
        calendar_id: 'dingastory.com_aatf30n7ad8e3mq7kfilhvu6rk@group.calendar.google.com',
        calendar_alias: '내부 회의 및 면담',
        description: '내부 회의 및 면담 일정',
        color: '#DDA0DD',
        is_active: true
      }
    ]

    // 데이터 삽입
    const { data, error } = await supabase
      .from('calendar_configs')
      .insert(calendarConfigs)
      .select()

    if (error) {
      console.error('캘린더 설정 삽입 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '캘린더 설정을 추가할 수 없습니다.', 
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: '캘린더 설정이 성공적으로 추가되었습니다.',
      data: data,
      count: data?.length || 0
    })

  } catch (error) {
    console.error('캘린더 설정 초기화 오류:', error)
    return NextResponse.json({ 
      success: false,
      error: '캘린더 설정 초기화 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // 현재 저장된 캘린더 설정 조회
    const { data: configs, error } = await supabase
      .from('calendar_configs')
      .select('*')
      .order('config_type', { ascending: true })
      .order('target_name', { ascending: true })

    if (error) {
      console.error('캘린더 설정 조회 오류:', error)
      return NextResponse.json({ 
        success: false,
        error: '캘린더 설정을 조회할 수 없습니다.',
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      configs: configs || [],
      count: configs?.length || 0
    })

  } catch (error) {
    console.error('캘린더 설정 조회 오류:', error)
    return NextResponse.json({ 
      success: false,
      error: '캘린더 설정 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
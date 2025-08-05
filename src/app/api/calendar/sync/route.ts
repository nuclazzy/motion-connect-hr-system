import { NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase';

interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
}

export async function POST(request: Request) {
  try {
    const { events: googleEvents, userId }: { events: GoogleEvent[], userId: string } = await request.json();

    if (!googleEvents || googleEvents.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '동기화할 이벤트가 없습니다.',
        synced: 0 
      });
    }

    // 1. DB에 저장된 미팅 중 google_event_id가 있는 것들을 가져옵니다
    const { data: existingMeetings, error: fetchError } = await supabase
      .from('meetings')
      .select('google_event_id')
      .not('google_event_id', 'is', null);

    if (fetchError) {
      console.error('기존 미팅 조회 오류:', fetchError);
      throw fetchError;
    }

    const existingEventIds = new Set(existingMeetings?.map(m => m.google_event_id) || []);

    // 2. DB에 존재하지 않는 새로운 Google Calendar 이벤트만 필터링
    const newEventsToSync = googleEvents.filter((event: GoogleEvent) => 
      event.id && !existingEventIds.has(event.id)
    );

    if (newEventsToSync.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '모든 이벤트가 이미 동기화되어 있습니다.',
        synced: 0 
      });
    }

    // 3. 새로운 이벤트를 meetings 테이블에 삽입
    const meetingsToInsert = newEventsToSync.map((event: GoogleEvent) => {
      const start = event.start?.dateTime || event.start?.date;
      if (!start) return null;

      const meetingDate = new Date(start);
      
      // 제목에서 미팅 타입 추정
      const title = event.summary || '제목 없음';
      const isInternal = title.includes('내부') || title.includes('회의') || title.includes('면담');
      
      return {
        title,
        description: event.description || '',
        location: event.location || '',
        date: meetingDate.toISOString().split('T')[0],
        time: event.start?.dateTime ? 
          meetingDate.toTimeString().slice(0, 5) : '00:00',
        google_event_id: event.id,
        created_by: userId,
        meeting_type: isInternal ? 'internal' : 'external'
      };
    }).filter(Boolean); // null 값 제거

    if (meetingsToInsert.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '삽입 가능한 이벤트가 없습니다.',
        synced: 0 
      });
    }

    const { error: insertError } = await supabase
      .from('meetings')
      .insert(meetingsToInsert);

    if (insertError) {
      console.error('미팅 삽입 오류:', insertError);
      throw insertError;
    }

    console.log(`Google Calendar에서 ${meetingsToInsert.length}개 이벤트 동기화 완료`);

    return NextResponse.json({ 
      success: true, 
      message: `${meetingsToInsert.length}개 이벤트가 동기화되었습니다.`,
      synced: meetingsToInsert.length 
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('캘린더 동기화 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}
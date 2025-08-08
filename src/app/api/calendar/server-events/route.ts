import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchMultipleCalendarEventsServer,
  createCalendarEventServer,
  updateCalendarEventServer,
  deleteCalendarEventServer
} from '@/lib/googleCalendarService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, calendarIds, timeMin, timeMax, calendarId, eventData, eventId } = body;

    // 액션에 따라 다른 처리
    if (action === 'fetch-multiple') {
      // 여러 캘린더 이벤트 조회
      if (!calendarIds || !Array.isArray(calendarIds)) {
        return NextResponse.json(
          { error: '캘린더 ID 목록이 필요합니다' },
          { status: 400 }
        );
      }

      const events = await fetchMultipleCalendarEventsServer(
        calendarIds,
        timeMin,
        timeMax
      );

      return NextResponse.json({ events });
    } else if (action === 'create') {
      // 이벤트 생성
      if (!calendarId || !eventData) {
        return NextResponse.json(
          { error: '캘린더 ID와 이벤트 데이터가 필요합니다' },
          { status: 400 }
        );
      }

      const newEvent = await createCalendarEventServer(calendarId, eventData);
      return NextResponse.json({ event: newEvent });
    } else if (action === 'update') {
      // 이벤트 수정
      if (!calendarId || !eventId || !eventData) {
        return NextResponse.json(
          { error: '캘린더 ID, 이벤트 ID와 이벤트 데이터가 필요합니다' },
          { status: 400 }
        );
      }

      const updatedEvent = await updateCalendarEventServer(calendarId, eventId, eventData);
      return NextResponse.json({ event: updatedEvent });
    } else if (action === 'delete') {
      // 이벤트 삭제
      if (!calendarId || !eventId) {
        return NextResponse.json(
          { error: '캘린더 ID와 이벤트 ID가 필요합니다' },
          { status: 400 }
        );
      }

      await deleteCalendarEventServer(calendarId, eventId);
      return NextResponse.json({ success: true });
    } else {
      // 기본 동작: 여러 캘린더 이벤트 조회 (이전 버전 호환성)
      if (!calendarIds || !Array.isArray(calendarIds)) {
        return NextResponse.json(
          { error: '캘린더 ID 목록이 필요합니다' },
          { status: 400 }
        );
      }

      const events = await fetchMultipleCalendarEventsServer(
        calendarIds,
        timeMin,
        timeMax
      );

      return NextResponse.json({ events });
    }
  } catch (error: any) {
    console.error('Server calendar events error:', error);
    return NextResponse.json(
      { error: error.message || '캘린더 작업 실패' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const calendarId = searchParams.get('calendarId');
    const timeMin = searchParams.get('timeMin');
    const timeMax = searchParams.get('timeMax');

    if (!calendarId) {
      return NextResponse.json(
        { error: '캘린더 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Service Account로 단일 캘린더 이벤트 가져오기
    const events = await fetchMultipleCalendarEventsServer(
      [calendarId],
      timeMin || undefined,
      timeMax || undefined
    );

    return NextResponse.json({ events: events[calendarId] || [] });
  } catch (error: any) {
    console.error('Server calendar events error:', error);
    return NextResponse.json(
      { error: error.message || '캘린더 이벤트 조회 실패' },
      { status: 500 }
    );
  }
}
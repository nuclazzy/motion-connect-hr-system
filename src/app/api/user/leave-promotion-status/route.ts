
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isPromotionTarget } from '@/lib/leave';

export async function GET(request: NextRequest) {
  try {
    // 이 API는 브라우저의 쿠키/세션 기반이 아닌, 
    // 클라이언트가 헤더에 담아 보내는 사용자 ID를 기반으로 동작해야 합니다.
    // 하지만 현재 auth.ts의 getCurrentUser가 localStorage를 사용하므로, 
    // 실제 프로덕션에서는 JWT 토큰 검증 방식으로 변경해야 합니다.
    // 여기서는 임시로 사용자 ID를 쿼리 파라미터로 받는다고 가정하겠습니다.
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '사용자 ID가 필요합니다.' }, { status: 400 });
    }

    // 1. 사용자 정보 조회 (입사일 확인)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, hire_date')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 사용자의 휴가 데이터 조회
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (leaveError) {
      // 휴가 데이터가 없는 경우, 촉진 대상이 아님
      return NextResponse.json({ isTarget: false });
    }

    // 3. 연차 촉진 대상 여부 판별
    const isTarget = isPromotionTarget(user, leaveData);

    return NextResponse.json({ isTarget });

  } catch (error) {
    console.error('연차 촉진 대상 확인 오류:', error);
    return NextResponse.json(
      { error: '연차 촉진 대상 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

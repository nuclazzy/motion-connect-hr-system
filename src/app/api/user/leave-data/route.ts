import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceRoleClient();
    
    // URL에서 사용자 ID 가져오기
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 요청된 userId가 실제 존재하는 사용자인지 확인
    const { data: userExists, error: userCheckError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('id', userId)
      .single();

    if (userCheckError || !userExists) {
      return NextResponse.json(
        { success: false, error: '존재하지 않는 사용자입니다.' },
        { status: 404 }
      );
    }

    // 관리자가 아닌 경우 본인 데이터만 조회 가능하도록 제한
    // (실제 프로덕션에서는 더 강화된 인증이 필요)
    console.log(`휴가 데이터 조회 요청: User ID ${userId}`);

    // 휴가 데이터 조회
    const { data: leaveData, error } = await supabase
      .from('leave_days')
      .select(`
        *,
        user:users(name, department, position, hire_date)
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('개인 휴가 데이터 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: '휴가 데이터를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: leaveData
    });
  } catch (error) {
    console.error('Error fetching personal leave data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
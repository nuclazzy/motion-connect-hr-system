import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // URL에서 사용자 ID 가져오기 (직원용)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 본인의 데이터만 조회 가능하도록 확인
    const { data: currentUserData } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!currentUserData || currentUserData.id !== userId) {
      return NextResponse.json(
        { success: false, error: '본인의 휴가 데이터만 조회할 수 있습니다.' },
        { status: 403 }
      );
    }

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
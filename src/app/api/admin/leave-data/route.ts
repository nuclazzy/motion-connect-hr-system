import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // 관리자 권한 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // 휴가 데이터 조회
    const { data: leaveData, error } = await supabase
      .from('leave_days')
      .select(`
        *,
        user:users(name, department, position, termination_date)
      `)
      .order('user_id');

    if (error) {
      console.error('휴가 데이터 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leave data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: leaveData || []
    });
  } catch (error) {
    console.error('Error fetching leave data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
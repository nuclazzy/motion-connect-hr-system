import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
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

    const { user_id, leave_types } = await request.json();

    if (!user_id || !leave_types) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 휴가 데이터 업데이트
    const { data, error } = await supabase
      .from('leave_days')
      .update({
        leave_types,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user_id)
      .select(`
        *,
        user:users(name, department, position, termination_date)
      `)
      .single();

    if (error) {
      console.error('휴가 데이터 업데이트 실패:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update leave data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error updating leave data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
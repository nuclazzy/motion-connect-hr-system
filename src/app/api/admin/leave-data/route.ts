import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Authorization header validation
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    const adminUserId = authorization.replace('Bearer ', '')
    
    const supabase = await createServiceRoleClient();

    // 관리자 권한 확인
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
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
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

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

    // 휴가 신청 목록 조회
    const { data: leaveRequests, error } = await supabase
      .from('form_requests')
      .select(`
        *,
        user:users(name, department, position)
      `)
      .eq('form_type', 'vacation')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('휴가 신청 조회 실패:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch leave requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: leaveRequests || []
    });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
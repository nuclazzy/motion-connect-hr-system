import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave';

export async function POST(request: NextRequest) {
  try {
    // Authorization header에서 userId 가져오기
    const authorization = request.headers.get('authorization')
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminUserId = authorization.replace('Bearer ', '')
    const supabase = await createServiceRoleClient()

    // 관리자 권한 확인
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', adminUserId)
      .single()

    if (userProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admins only' }, { status: 403 })
    }

    // 모든 사용자 가져오기
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, department, position, hire_date')
      .order('name');

    if (usersError) {
      console.error('사용자 조회 실패:', usersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users found'
      });
    }

    // 기존 휴가 데이터 확인
    const { data: existingLeaveData } = await supabase
      .from('leave_days')
      .select('user_id');

    const existingUserIds = new Set(existingLeaveData?.map(item => item.user_id) || []);

    // 휴가 데이터가 없는 사용자들을 위한 초기 데이터 생성
    const newLeaveData = users
      .filter(user => !existingUserIds.has(user.id))
      .map(user => {
        const annualDays = user.hire_date ? calculateAnnualLeave(user.hire_date) : 15;

        return {
          user_id: user.id,
          leave_types: {
            annual_days: annualDays,
            used_annual_days: 0,
            sick_days: 30,
            used_sick_days: 0,
            family_care_days: 90,
            used_family_care_days: 0,
            maternity_days: 90,
            used_maternity_days: 0,
            paternity_days: 10,
            used_paternity_days: 0,
            special_days: 5,
            used_special_days: 0,
            substitute_leave_hours: 0,
            compensatory_leave_hours: 0
          },
          substitute_leave_hours: 0,
          compensatory_leave_hours: 0,
          year: new Date().getFullYear(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });

    if (newLeaveData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All users already have leave data',
        users_count: users.length,
        existing_leave_count: existingLeaveData?.length || 0
      });
    }

    // 새로운 휴가 데이터 삽입
    const { data: insertedData, error: insertError } = await supabase
      .from('leave_days')
      .insert(newLeaveData)
      .select(`
        *,
        user:users(name, department, position, termination_date)
      `);

    if (insertError) {
      console.error('휴가 데이터 삽입 실패:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to initialize leave data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Leave data initialized successfully',
      users_count: users.length,
      existing_leave_count: existingLeaveData?.length || 0,
      new_leave_count: newLeaveData.length,
      inserted_data: insertedData
    });

  } catch (error) {
    console.error('Error initializing leave data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables'
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 먼저 기존 사용자들 확인
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, department, position, hire_date')
      .order('name');

    if (usersError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch users: ' + usersError.message
      });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users found in database'
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
        // 입사일 기준으로 연차 계산
        const hireDate = new Date(user.hire_date);
        const currentDate = new Date();
        const yearsWorked = Math.floor((currentDate.getTime() - hireDate.getTime()) / (365 * 24 * 60 * 60 * 1000));
        
        // 연차 계산 (1년차: 15일, 3년차부터 매년 1일씩 증가, 최대 25일)
        let annualDays = 15;
        if (yearsWorked >= 3) {
          annualDays = Math.min(15 + (yearsWorked - 1), 25);
        }

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
            used_special_days: 0
          },
          year: currentDate.getFullYear(),
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
      .select();

    if (insertError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to insert leave data: ' + insertError.message
      });
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
      { success: false, error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
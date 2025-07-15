
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave';

// Vercel Cron Job에 의해 호출될 API
export async function GET() {
  try {
    // 1. 모든 재직 중인 직원 정보를 가져옵니다.
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, hire_date')
      .is('termination_date', null);

    if (usersError) throw usersError;

    let updatedCount = 0;

    // 2. 각 직원의 연차를 재계산하고 업데이트합니다.
    for (const user of users) {
      if (!user.hire_date) continue;

      const newAnnualDays = calculateAnnualLeave(user.hire_date);

      const { error: leaveError } = await supabase
        .from('leave_days')
        .update({
          leave_types: {
            annual_days: newAnnualDays,
            // 연간 갱신 시 사용일수는 0으로 초기화
            used_annual_days: 0,
            // 병가는 그대로 유지 (정책에 따라 변경 가능)
            sick_days: 5, 
            used_sick_days: 0 
          }
        })
        .eq('user_id', user.id);

      if (leaveError) {
        console.error(`Failed to update leave for user ${user.id}:`, leaveError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({ 
        message: `Successfully updated annual leave for ${updatedCount} users.` 
    });

  } catch (error) {
    console.error('Error updating annual leave:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { calculateAnnualLeave } from '@/lib/calculateAnnualLeave';

export const dynamic = 'force-dynamic';

// Vercel Cron Job에 의해 호출될 API
export async function GET() {
  try {
    const supabase = await createServiceRoleClient();
    
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

      // 기존 휴가 데이터 조회
      const { data: currentLeaveData, error: fetchError } = await supabase
        .from('leave_days')
        .select('leave_types')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !currentLeaveData) {
        console.error(`Failed to fetch current leave data for user ${user.id}:`, fetchError);
        continue;
      }

      const newAnnualDays = calculateAnnualLeave(user.hire_date);
      const currentLeaveTypes = currentLeaveData.leave_types || {};

      // 기존 데이터를 보존하면서 연차만 업데이트
      const updatedLeaveTypes = {
        ...currentLeaveTypes,
        annual_days: newAnnualDays,
        // 기존 사용일수와 병가 데이터는 그대로 유지
        used_annual_days: currentLeaveTypes.used_annual_days || 0,
        sick_days: currentLeaveTypes.sick_days || 60, // 기존값 유지, 없으면 60일
        used_sick_days: currentLeaveTypes.used_sick_days || 0,
        // 시간 단위 휴가도 보존
        substitute_leave_hours: currentLeaveTypes.substitute_leave_hours || 0,
        compensatory_leave_hours: currentLeaveTypes.compensatory_leave_hours || 0
      };

      const { error: leaveError } = await supabase
        .from('leave_days')
        .update({
          leave_types: updatedLeaveTypes
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

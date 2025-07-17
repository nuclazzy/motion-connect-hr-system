import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({
        success: false,
        error: 'Missing environment variables',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!serviceKey
        }
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 사용자 데이터 확인
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, department, position, termination_date, hire_date')
      .order('name');

    // 휴가 데이터 확인
    const { data: leaveData, error: leaveError } = await supabase
      .from('leave_days')
      .select(`
        *,
        user:users(name, department, position, termination_date)
      `)
      .order('user_id');

    return NextResponse.json({
      success: true,
      users: {
        count: users?.length || 0,
        data: users || [],
        error: usersError?.message || null
      },
      leave_data: {
        count: leaveData?.length || 0,
        data: leaveData || [],
        error: leaveError?.message || null
      },
      debug: {
        supabaseUrl: supabaseUrl.substring(0, 30) + '...',
        hasServiceKey: !!serviceKey
      }
    });

  } catch (error) {
    console.error('Error checking data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
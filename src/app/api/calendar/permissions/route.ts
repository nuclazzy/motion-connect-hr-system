import { NextRequest, NextResponse } from 'next/server';
import { teamCalendarPermissionService } from '@/lib/teamCalendarPermissions';
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

    const { searchParams } = new URL(request.url);
    const calendarConfigId = searchParams.get('calendarConfigId');

    if (!calendarConfigId) {
      return NextResponse.json(
        { success: false, error: 'Calendar config ID is required' },
        { status: 400 }
      );
    }

    const permissions = await teamCalendarPermissionService.getCalendarPermissions(calendarConfigId);

    return NextResponse.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('Error fetching calendar permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch calendar permissions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { userId, calendarConfigId, permissionType, action } = body;

    if (!userId || !calendarConfigId || !permissionType || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'grant') {
      result = await teamCalendarPermissionService.grantPermission(
        userId,
        calendarConfigId,
        permissionType,
        user.id
      );
    } else if (action === 'revoke') {
      result = await teamCalendarPermissionService.revokePermission(
        userId,
        calendarConfigId,
        permissionType
      );
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error managing calendar permissions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to manage calendar permissions' },
      { status: 500 }
    );
  }
}
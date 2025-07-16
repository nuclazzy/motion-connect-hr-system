import { supabase } from '@/lib/supabase';
import { type User } from '@/lib/auth';

export interface TeamCalendarPermission {
  id: string;
  user_id: string;
  calendar_config_id: string;
  permission_type: 'read' | 'write' | 'admin';
  granted_by: string;
  granted_at: string;
  is_active: boolean;
}

export interface CalendarAccessLevel {
  canRead: boolean;
  canWrite: boolean;
  canAdmin: boolean;
}

export class TeamCalendarPermissionService {
  // 사용자의 특정 캘린더에 대한 권한 확인
  async getUserCalendarPermissions(userId: string, calendarConfigId: string): Promise<CalendarAccessLevel> {
    try {
      const { data, error } = await supabase
        .from('team_calendar_permissions')
        .select('permission_type')
        .eq('user_id', userId)
        .eq('calendar_config_id', calendarConfigId)
        .eq('is_active', true);

      if (error) {
        console.error('권한 조회 실패:', error);
        return { canRead: false, canWrite: false, canAdmin: false };
      }

      const permissions = data || [];
      const hasRead = permissions.some(p => ['read', 'write', 'admin'].includes(p.permission_type));
      const hasWrite = permissions.some(p => ['write', 'admin'].includes(p.permission_type));
      const hasAdmin = permissions.some(p => p.permission_type === 'admin');

      return {
        canRead: hasRead,
        canWrite: hasWrite,
        canAdmin: hasAdmin
      };
    } catch (error) {
      console.error('권한 확인 오류:', error);
      return { canRead: false, canWrite: false, canAdmin: false };
    }
  }

  // 사용자가 접근 가능한 캘린더 목록 조회
  async getUserAccessibleCalendars(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('team_calendar_permissions')
        .select('calendar_config_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('접근 가능한 캘린더 조회 실패:', error);
        return [];
      }

      return data?.map(p => p.calendar_config_id) || [];
    } catch (error) {
      console.error('접근 가능한 캘린더 조회 오류:', error);
      return [];
    }
  }

  // 권한 부여
  async grantPermission(
    userId: string,
    calendarConfigId: string,
    permissionType: 'read' | 'write' | 'admin',
    grantedBy: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 기존 권한 확인
      const { data: existingPermission } = await supabase
        .from('team_calendar_permissions')
        .select('*')
        .eq('user_id', userId)
        .eq('calendar_config_id', calendarConfigId)
        .eq('permission_type', permissionType)
        .eq('is_active', true)
        .single();

      if (existingPermission) {
        return { success: false, message: '이미 해당 권한이 부여되어 있습니다.' };
      }

      const { error } = await supabase
        .from('team_calendar_permissions')
        .insert({
          user_id: userId,
          calendar_config_id: calendarConfigId,
          permission_type: permissionType,
          granted_by: grantedBy,
          granted_at: new Date().toISOString(),
          is_active: true
        });

      if (error) {
        console.error('권한 부여 실패:', error);
        return { success: false, message: '권한 부여에 실패했습니다.' };
      }

      return { success: true, message: '권한이 성공적으로 부여되었습니다.' };
    } catch (error) {
      console.error('권한 부여 오류:', error);
      return { success: false, message: '권한 부여 중 오류가 발생했습니다.' };
    }
  }

  // 권한 취소
  async revokePermission(
    userId: string,
    calendarConfigId: string,
    permissionType: 'read' | 'write' | 'admin'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('team_calendar_permissions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('calendar_config_id', calendarConfigId)
        .eq('permission_type', permissionType);

      if (error) {
        console.error('권한 취소 실패:', error);
        return { success: false, message: '권한 취소에 실패했습니다.' };
      }

      return { success: true, message: '권한이 성공적으로 취소되었습니다.' };
    } catch (error) {
      console.error('권한 취소 오류:', error);
      return { success: false, message: '권한 취소 중 오류가 발생했습니다.' };
    }
  }

  // 특정 캘린더의 모든 권한 조회
  async getCalendarPermissions(calendarConfigId: string): Promise<TeamCalendarPermission[]> {
    try {
      const { data, error } = await supabase
        .from('team_calendar_permissions')
        .select(`
          *,
          users!team_calendar_permissions_user_id_fkey(name, email, department),
          granted_by_user:users!team_calendar_permissions_granted_by_fkey(name, email)
        `)
        .eq('calendar_config_id', calendarConfigId)
        .eq('is_active', true)
        .order('granted_at', { ascending: false });

      if (error) {
        console.error('캘린더 권한 조회 실패:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('캘린더 권한 조회 오류:', error);
      return [];
    }
  }

  // 사용자가 팀 캘린더에 접근할 수 있는지 확인 (부서 기반)
  async checkTeamCalendarAccess(user: User, calendarConfigId: string): Promise<boolean> {
    try {
      // 1. 직접 권한 확인
      const directPermissions = await this.getUserCalendarPermissions(user.id, calendarConfigId);
      if (directPermissions.canRead) {
        return true;
      }

      // 2. 캘린더 설정 조회
      const { data: calendarConfig } = await supabase
        .from('calendar_configs')
        .select('target_name, config_type')
        .eq('id', calendarConfigId)
        .single();

      if (!calendarConfig) {
        return false;
      }

      // 3. 팀 캘린더인 경우 부서 일치 확인
      if (calendarConfig.config_type === 'team') {
        return user.department === calendarConfig.target_name;
      }

      // 4. 기능 캘린더인 경우 관리자 권한 확인
      if (calendarConfig.config_type === 'function') {
        return user.role === 'admin';
      }

      return false;
    } catch (error) {
      console.error('팀 캘린더 접근 권한 확인 오류:', error);
      return false;
    }
  }
}

export const teamCalendarPermissionService = new TeamCalendarPermissionService();
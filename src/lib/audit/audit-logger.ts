/**
 * 감사 로그 유틸리티
 * 애플리케이션 레벨에서 중요한 작업들을 쉽게 로깅할 수 있도록 지원
 */

import { createServiceRoleClient } from '@/lib/supabase/server'

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  SYSTEM = 'SYSTEM'
}

export enum AuditSeverity {
  LOW = 'LOW',
  INFO = 'INFO',
  WARN = 'WARN',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  DATA_CHANGE = 'DATA_CHANGE',
  PERMISSION = 'PERMISSION',
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  COMPLIANCE = 'COMPLIANCE'
}

export interface AuditLogEntry {
  userId?: string
  action: AuditAction
  tableName?: string
  recordId?: string
  oldValues?: any
  newValues?: any
  description: string
  severity?: AuditSeverity
  category?: AuditCategory
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  requestPath?: string
}

export class AuditLogger {
  private static async getSupabase() {
    return await createServiceRoleClient()
  }

  /**
   * 감사 로그 생성
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const supabase = await this.getSupabase()
      const { error } = await supabase.rpc('log_user_action', {
        p_user_id: entry.userId || null,
        p_action_type: entry.action,
        p_table_name: entry.tableName || null,
        p_record_id: entry.recordId || null,
        p_old_values: entry.oldValues || null,
        p_new_values: entry.newValues || null,
        p_description: entry.description,
        p_severity: entry.severity || AuditSeverity.INFO,
        p_category: entry.category || AuditCategory.DATA_CHANGE,
        p_metadata: {
          ...entry.metadata,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          request_path: entry.requestPath,
          timestamp: new Date().toISOString()
        }
      })

      if (error) {
        console.error('감사 로그 생성 실패:', error)
      }
    } catch (error) {
      console.error('감사 로그 시스템 오류:', error)
    }
  }

  /**
   * 사용자 인증 관련 로그
   */
  static async logAuth(
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED',
    userId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const descriptions = {
      LOGIN: '사용자 로그인',
      LOGOUT: '사용자 로그아웃',
      LOGIN_FAILED: '로그인 실패'
    }

    await this.log({
      userId,
      action: action as AuditAction,
      description: descriptions[action],
      severity: action === 'LOGIN_FAILED' ? AuditSeverity.WARN : AuditSeverity.INFO,
      category: AuditCategory.AUTHENTICATION,
      metadata
    })
  }

  /**
   * 폼 요청 승인/거절 로그
   */
  static async logFormApproval(
    action: 'APPROVE' | 'REJECT',
    adminUserId: string,
    formRequest: any,
    adminNote?: string
  ): Promise<void> {
    await this.log({
      userId: adminUserId,
      action: action as AuditAction,
      tableName: 'form_requests',
      recordId: formRequest.id,
      description: `${formRequest.form_type} ${action === 'APPROVE' ? '승인' : '거절'}`,
      severity: AuditSeverity.INFO,
      category: AuditCategory.PERMISSION,
      metadata: {
        request_type: formRequest.form_type,
        affected_user: formRequest.user_id,
        admin_note: adminNote,
        request_data: formRequest.request_data
      }
    })
  }

  /**
   * 휴가 데이터 변경 로그
   */
  static async logLeaveDataChange(
    adminUserId: string,
    targetUserId: string,
    oldData: any,
    newData: any,
    reason: string
  ): Promise<void> {
    await this.log({
      userId: adminUserId,
      action: AuditAction.UPDATE,
      tableName: 'leave_days',
      recordId: targetUserId,
      oldValues: oldData,
      newValues: newData,
      description: `휴가 데이터 수정: ${reason}`,
      severity: AuditSeverity.INFO,
      category: AuditCategory.DATA_CHANGE,
      metadata: {
        affected_user: targetUserId,
        modification_reason: reason
      }
    })
  }

  /**
   * 직원 데이터 변경 로그
   */
  static async logEmployeeDataChange(
    adminUserId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    employeeData: any,
    oldData?: any
  ): Promise<void> {
    const descriptions = {
      CREATE: `새 직원 생성: ${employeeData.name}`,
      UPDATE: `직원 정보 수정: ${employeeData.name}`,
      DELETE: `직원 삭제: ${oldData?.name || '알 수 없음'}`
    }

    await this.log({
      userId: adminUserId,
      action: action as AuditAction,
      tableName: 'users',
      recordId: employeeData.id || oldData?.id,
      oldValues: oldData,
      newValues: action !== 'DELETE' ? employeeData : null,
      description: descriptions[action],
      severity: action === 'DELETE' ? AuditSeverity.HIGH : AuditSeverity.INFO,
      category: AuditCategory.DATA_CHANGE,
      metadata: {
        employee_id: employeeData.employee_id || oldData?.employee_id,
        department: employeeData.department || oldData?.department
      }
    })
  }

  /**
   * 보안 관련 이벤트 로그
   */
  static async logSecurityEvent(
    event: string,
    userId?: string,
    severity: AuditSeverity = AuditSeverity.WARN,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.log({
      userId,
      action: AuditAction.SYSTEM,
      description: `보안 이벤트: ${event}`,
      severity,
      category: AuditCategory.SECURITY,
      metadata
    })
  }

  /**
   * 시스템 작업 로그
   */
  static async logSystemAction(
    action: string,
    description: string,
    severity: AuditSeverity = AuditSeverity.INFO,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await this.log({
      action: AuditAction.SYSTEM,
      description: `시스템 작업: ${description}`,
      severity,
      category: AuditCategory.SYSTEM,
      metadata: {
        system_action: action,
        ...metadata
      }
    })
  }

  /**
   * 감사 로그 조회 (관리자용)
   */
  static async getAuditLogs(
    filters: {
      userId?: string
      action?: AuditAction
      severity?: AuditSeverity
      category?: AuditCategory
      startDate?: string
      endDate?: string
      limit?: number
    } = {}
  ) {
    try {
      const supabase = await this.getSupabase()
      let query = supabase
        .from('admin_audit_summary')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.action) {
        query = query.eq('action_type', filters.action)
      }

      if (filters.severity) {
        query = query.eq('severity', filters.severity)
      }

      if (filters.category) {
        query = query.eq('category', filters.category)
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate)
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('감사 로그 조회 실패:', error)
        return []
      }

      return data
    } catch (error) {
      console.error('감사 로그 조회 오류:', error)
      return []
    }
  }

  /**
   * 감사 로그 통계 (관리자용)
   */
  static async getAuditStats(days: number = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const supabase = await this.getSupabase()
      const { data, error } = await supabase
        .from('audit_logs')
        .select('action_type, severity, category, created_at')
        .gte('created_at', startDate.toISOString())

      if (error) {
        console.error('감사 로그 통계 조회 실패:', error)
        return null
      }

      // 통계 계산
      const stats = {
        total: data.length,
        byAction: {} as Record<string, number>,
        bySeverity: {} as Record<string, number>,
        byCategory: {} as Record<string, number>,
        dailyCount: {} as Record<string, number>
      }

      data.forEach(log => {
        // 액션별 통계
        stats.byAction[log.action_type] = (stats.byAction[log.action_type] || 0) + 1

        // 심각도별 통계
        stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1

        // 카테고리별 통계
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1

        // 일별 통계
        const date = new Date(log.created_at).toISOString().split('T')[0]
        stats.dailyCount[date] = (stats.dailyCount[date] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('감사 로그 통계 오류:', error)
      return null
    }
  }
}

/**
 * 요청 컨텍스트에서 IP 주소와 User-Agent 추출
 */
export function extractRequestContext(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    requestPath: new URL(request.url).pathname
  }
}

/**
 * 사용 예시:
 * 
 * // 폼 승인 시
 * await AuditLogger.logFormApproval('APPROVE', adminUserId, formRequest, adminNote)
 * 
 * // 직원 데이터 수정 시
 * await AuditLogger.logEmployeeDataChange(adminUserId, 'UPDATE', newData, oldData)
 * 
 * // 보안 이벤트 발생 시
 * await AuditLogger.logSecurityEvent('Multiple failed login attempts', userId, AuditSeverity.HIGH)
 * 
 * // 감사 로그 조회
 * const logs = await AuditLogger.getAuditLogs({ 
 *   severity: AuditSeverity.HIGH, 
 *   limit: 100 
 * })
 */
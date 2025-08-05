// 분기별 탄력근로제 정산 계산 라이브러리

export interface MonthlyWorkSummary {
  user_id: string
  user_name: string
  department: string
  position: string
  month: string
  work_days: number
  basic_hours: number
  overtime_hours: number
  night_hours: number
  total_work_hours: number
  weekly_avg_hours: number
  night_allowance_paid?: number
}

export interface QuarterlySettlement {
  user_id: string
  user_name: string
  department: string
  position: string
  
  // 3개월 집계
  total_work_hours: number
  total_work_days: number
  total_weeks: number
  weekly_avg_hours: number
  
  // 기준 대비
  standard_weekly_hours: number
  standard_total_hours: number
  excess_hours: number
  
  // 야간근무 관련
  total_night_hours: number
  monthly_night_hours: { [month: string]: number }
  estimated_night_allowance_paid: number
  
  // 초과근무 수당 계산
  overtime_allowance_hours: number
  final_overtime_hours: number // 야간시간 차감 후
  overtime_allowance_amount: number
  
  // 월별 상세
  monthly_details: {
    month: string
    work_hours: number
    night_hours: number
    weekly_avg: number
    excess_over_40h: number
  }[]
}

/**
 * 6-7-8월 3개월 탄력근로제 정산 계산
 * @param monthlyData 월별 근무 데이터 배열
 * @param standardWeeklyHours 주당 기준 근로시간 (기본 40시간)
 * @param averageHourlyRate 평균 시급 (야간수당 차감 계산용)
 * @returns 사용자별 정산 결과
 */
export function calculateQuarterlySettlement(
  monthlyData: MonthlyWorkSummary[],
  standardWeeklyHours: number = 40.0,
  averageHourlyRate: number = 15000
): QuarterlySettlement[] {
  
  // 사용자별로 데이터 그룹화
  const userGroups = monthlyData.reduce((acc, data) => {
    if (!acc[data.user_id]) {
      acc[data.user_id] = []
    }
    acc[data.user_id].push(data)
    return acc
  }, {} as { [userId: string]: MonthlyWorkSummary[] })
  
  const settlements: QuarterlySettlement[] = []
  
  Object.entries(userGroups).forEach(([userId, userMonthlyData]) => {
    const firstRecord = userMonthlyData[0]
    
    // 3개월 집계 계산
    const totalWorkHours = userMonthlyData.reduce((sum, data) => sum + data.total_work_hours, 0)
    const totalWorkDays = userMonthlyData.reduce((sum, data) => sum + data.work_days, 0)
    const totalNightHours = userMonthlyData.reduce((sum, data) => sum + data.night_hours, 0)
    
    // 12주 기준 (3개월 = 약 12-13주, 보수적으로 12주 적용)
    const totalWeeks = 12
    const weeklyAvgHours = Math.round((totalWorkHours / totalWeeks) * 10) / 10
    
    // 기준 시간 계산
    const standardTotalHours = standardWeeklyHours * totalWeeks // 40 * 12 = 480시간
    const excessHours = Math.max(totalWorkHours - standardTotalHours, 0)
    
    // 야간근무 수당 추정 (이미 지급된 것으로 가정)
    const nightAllowanceRate = averageHourlyRate * 0.5 // 야간근무 수당 50%
    const estimatedNightAllowancePaid = totalNightHours * nightAllowanceRate
    
    // 초과근무 수당 계산
    let overtimeAllowanceHours = 0
    
    // 1) 3개월 평균이 주당 40시간을 초과하는 경우
    if (weeklyAvgHours > standardWeeklyHours) {
      overtimeAllowanceHours = (weeklyAvgHours - standardWeeklyHours) * totalWeeks
    }
    
    // 2) 계획외 초과근무도 포함 (일별 기준 초과분이 있다면)
    // 현재는 월별 데이터만 있으므로 주당 평균 기준으로만 계산
    
    // 3) 야간근무 시간 차감 (이미 야간수당 지급된 시간)
    const finalOvertimeHours = Math.max(overtimeAllowanceHours - totalNightHours, 0)
    
    // 4) 초과근무 수당 금액 (시급 * 1.5배)
    const overtimeAllowanceAmount = Math.round(finalOvertimeHours * averageHourlyRate * 1.5)
    
    // 월별 상세 정보
    const monthlyDetails = userMonthlyData.map(data => ({
      month: data.month,
      work_hours: data.total_work_hours,
      night_hours: data.night_hours,
      weekly_avg: Math.round((data.total_work_hours / 4) * 10) / 10, // 한 달을 4주로 가정
      excess_over_40h: Math.max((data.total_work_hours / 4) - 40, 0) * 4 // 주당 40시간 초과분
    }))
    
    // 월별 야간시간 맵
    const monthlyNightHours = userMonthlyData.reduce((acc, data) => {
      acc[data.month] = data.night_hours
      return acc
    }, {} as { [month: string]: number })
    
    settlements.push({
      user_id: userId,
      user_name: firstRecord.user_name,
      department: firstRecord.department,
      position: firstRecord.position,
      
      total_work_hours: totalWorkHours,
      total_work_days: totalWorkDays,
      total_weeks: totalWeeks,
      weekly_avg_hours: weeklyAvgHours,
      
      standard_weekly_hours: standardWeeklyHours,
      standard_total_hours: standardTotalHours,
      excess_hours: excessHours,
      
      total_night_hours: totalNightHours,
      monthly_night_hours: monthlyNightHours,
      estimated_night_allowance_paid: estimatedNightAllowancePaid,
      
      overtime_allowance_hours: overtimeAllowanceHours,
      final_overtime_hours: finalOvertimeHours,
      overtime_allowance_amount: overtimeAllowanceAmount,
      
      monthly_details: monthlyDetails
    })
  })
  
  // 이름순 정렬
  return settlements.sort((a, b) => a.user_name.localeCompare(b.user_name))
}

/**
 * 6월 출퇴근 데이터에서 월별 요약 데이터 생성
 * @param attendanceSummaries API에서 받은 출퇴근 요약 데이터
 * @returns 월별 근무 요약 데이터
 */
export function convertAttendanceToMonthly(attendanceSummaries: any[]): MonthlyWorkSummary[] {
  return attendanceSummaries.map(summary => ({
    user_id: summary.user_id,
    user_name: summary.users?.name || '',
    department: summary.users?.department || '',
    position: summary.users?.position || '',
    month: '6월', // 6월 데이터
    work_days: summary.total_work_days || 0,
    basic_hours: summary.total_basic_hours || 0,
    overtime_hours: summary.total_overtime_hours || 0,
    night_hours: summary.total_night_hours || 0,
    total_work_hours: (summary.total_basic_hours || 0) + (summary.total_overtime_hours || 0),
    weekly_avg_hours: Math.round(((summary.total_basic_hours || 0) + (summary.total_overtime_hours || 0)) / 4 * 10) / 10,
    night_allowance_paid: (summary.total_night_hours || 0) * 7500 // 추정 야간수당 (시급 15000원 * 0.5)
  }))
}

/**
 * 정산 결과 요약 통계 계산
 */
export function calculateSettlementSummary(settlements: QuarterlySettlement[]) {
  return {
    total_employees: settlements.length,
    total_overtime_allowance: settlements.reduce((sum, s) => sum + s.overtime_allowance_amount, 0),
    employees_with_overtime: settlements.filter(s => s.final_overtime_hours > 0).length,
    avg_weekly_hours: Math.round(
      settlements.reduce((sum, s) => sum + s.weekly_avg_hours, 0) / settlements.length * 10
    ) / 10,
    total_night_hours: settlements.reduce((sum, s) => sum + s.total_night_hours, 0),
    estimated_night_allowance_paid: settlements.reduce((sum, s) => sum + s.estimated_night_allowance_paid, 0)
  }
}

/**
 * 정산 결과를 CSV 형태로 내보내기
 */
export function exportSettlementToCSV(settlements: QuarterlySettlement[]): string {
  const headers = [
    '직원명', '부서', '직급',
    '총근무시간', '주당평균', '기준초과시간',
    '야간근무시간', '초과수당대상시간', '최종초과시간', '초과수당금액',
    '6월근무시간', '7월근무시간', '8월근무시간'
  ]
  
  const rows = settlements.map(s => [
    s.user_name,
    s.department,
    s.position,
    s.total_work_hours,
    s.weekly_avg_hours,
    s.excess_hours,
    s.total_night_hours,
    s.overtime_allowance_hours,
    s.final_overtime_hours,
    s.overtime_allowance_amount,
    s.monthly_details.find(m => m.month === '6월')?.work_hours || 0,
    s.monthly_details.find(m => m.month === '7월')?.work_hours || 0,
    s.monthly_details.find(m => m.month === '8월')?.work_hours || 0
  ])
  
  return [headers, ...rows].map(row => row.join(',')).join('\n')
}
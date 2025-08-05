// 야간근무 수당 매월 자동 지급 로직
// 탄력근무제와 관계없이 야간근무는 매월 수당 지급

import { createClient } from '@supabase/supabase-js'
import { getSystemSettings } from './settings'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface MonthlyNightPayCalculation {
  user_id: string
  user_name: string
  department: string
  position: string
  month: string
  total_night_hours: number
  hourly_rate: number
  night_rate: number
  night_allowance_amount: number
  calculation_date: string
}

/**
 * 특정 월의 야간근무 수당 계산
 * @param month 계산할 월 (YYYY-MM 형식)
 * @returns 직원별 야간근무 수당 계산 결과
 */
export async function calculateMonthlyNightPay(month: string): Promise<MonthlyNightPayCalculation[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    // 시스템 설정 조회
    const settings = await getSystemSettings()
    const nightRate = settings.night_rate || 1.5
    
    const monthStart = `${month}-01`
    const nextMonth = new Date(monthStart)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const monthEnd = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0]
    
    // 해당 월의 야간근무 시간 집계
    const { data: nightWorkData, error } = await supabase
      .from('daily_work_summary')
      .select(`
        user_id,
        night_hours,
        users!inner(name, department, position, annual_salary, meal_allowance, car_allowance)
      `)
      .gte('work_date', monthStart)
      .lte('work_date', monthEnd)
      .gt('night_hours', 0) // 야간근무시간이 있는 경우만
      .eq('users.work_type', '정규직')
    
    if (error) {
      console.error('야간근무 데이터 조회 오류:', error)
      return []
    }
    
    if (!nightWorkData || nightWorkData.length === 0) {
      console.log(`${month}월 야간근무 데이터가 없습니다.`)
      return []
    }
    
    // 사용자별 야간근무시간 집계
    const userNightHours = nightWorkData.reduce((acc: any, record: any) => {
      const userId = record.user_id
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          user_name: record.users.name,
          department: record.users.department,
          position: record.users.position,
          annual_salary: record.users.annual_salary || 0,
          meal_allowance: record.users.meal_allowance || 0,
          car_allowance: record.users.car_allowance || 0,
          total_night_hours: 0
        }
      }
      acc[userId].total_night_hours += record.night_hours
      return acc
    }, {})
    
    // 야간근무 수당 계산
    const calculations: MonthlyNightPayCalculation[] = Object.values(userNightHours).map((user: any) => {
      // 시급 계산: (기본급 + 식대 + 자가운전) / 월 기준 근무시간
      const annualSalary = user.annual_salary || 0
      const monthlySalary = Math.round(annualSalary / 12)
      const basicSalary = monthlySalary - (user.meal_allowance || 0) - (user.car_allowance || 0)
      const hourlyRate = Math.round((basicSalary + (user.meal_allowance || 0) + (user.car_allowance || 0)) / (settings.monthly_standard_hours || 209))
      
      // 야간근무 수당 = 야간근무시간 × 시급 × 야간가산률
      const nightAllowanceAmount = Math.round(user.total_night_hours * hourlyRate * nightRate)
      
      return {
        user_id: user.user_id,
        user_name: user.user_name,
        department: user.department,
        position: user.position,
        month: month,
        total_night_hours: Math.round(user.total_night_hours * 10) / 10,
        hourly_rate: hourlyRate,
        night_rate: nightRate,
        night_allowance_amount: nightAllowanceAmount,
        calculation_date: new Date().toISOString().split('T')[0]
      }
    })
    
    return calculations
    
  } catch (error) {
    console.error('야간근무 수당 계산 오류:', error)
    return []
  }
}

/**
 * 야간근무 수당 지급 내역을 데이터베이스에 기록
 * @param calculations 야간근무 수당 계산 결과
 * @returns 저장 성공 여부
 */
export async function recordMonthlyNightPay(calculations: MonthlyNightPayCalculation[]): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    if (calculations.length === 0) {
      console.log('기록할 야간근무 수당 데이터가 없습니다.')
      return true
    }
    
    // 야간근무 수당 지급 내역 테이블에 저장
    // (필요시 테이블 생성: monthly_night_allowances)
    const payrollRecords = calculations.map(calc => ({
      user_id: calc.user_id,
      pay_month: calc.month + '-01', // 첫 번째 날로 저장
      night_hours: calc.total_night_hours,
      hourly_rate: calc.hourly_rate,
      night_rate: calc.night_rate,
      allowance_amount: calc.night_allowance_amount,
      paid_at: new Date().toISOString(),
      pay_type: 'monthly_night_allowance'
    }))
    
    // 실제로는 급여 지급 테이블에 저장해야 함
    // 현재는 로그만 출력
    console.log('💰 야간근무 수당 지급 내역:')
    calculations.forEach(calc => {
      console.log(`- ${calc.user_name}: ${calc.total_night_hours}h × ${calc.hourly_rate}원 × ${calc.night_rate} = ${calc.night_allowance_amount.toLocaleString()}원`)
    })
    
    return true
    
  } catch (error) {
    console.error('야간근무 수당 기록 오류:', error)
    return false
  }
}

/**
 * 월말 자동 야간근무 수당 계산 및 지급
 * @param month 계산할 월 (YYYY-MM 형식)
 * @returns 처리 결과
 */
export async function processMonthlyNightAllowance(month: string) {
  try {
    console.log(`🌙 ${month}월 야간근무 수당 자동 계산 시작...`)
    
    // 1. 야간근무 수당 계산
    const calculations = await calculateMonthlyNightPay(month)
    
    if (calculations.length === 0) {
      console.log(`${month}월 야간근무 대상자가 없습니다.`)
      return {
        success: true,
        message: '야간근무 대상자 없음',
        data: []
      }
    }
    
    // 2. 지급 내역 기록
    const recorded = await recordMonthlyNightPay(calculations)
    
    if (!recorded) {
      throw new Error('야간근무 수당 기록 실패')
    }
    
    // 3. 결과 요약
    const totalAmount = calculations.reduce((sum, calc) => sum + calc.night_allowance_amount, 0)
    const totalHours = calculations.reduce((sum, calc) => sum + calc.total_night_hours, 0)
    
    console.log(`✅ ${month}월 야간근무 수당 처리 완료:`)
    console.log(`- 대상자: ${calculations.length}명`)
    console.log(`- 총 야간근무시간: ${totalHours.toFixed(1)}시간`)
    console.log(`- 총 지급액: ${totalAmount.toLocaleString()}원`)
    
    return {
      success: true,
      message: '야간근무 수당 처리 완료',
      data: {
        month: month,
        employee_count: calculations.length,
        total_night_hours: totalHours,
        total_allowance: totalAmount,
        calculations: calculations
      }
    }
    
  } catch (error) {
    console.error('야간근무 수당 처리 오류:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '알 수 없는 오류',
      data: null
    }
  }
}

/**
 * 3개월 탄력근무제 정산 시 야간수당 차감 계산
 * @param userNightCalculations 사용자별 월별 야간수당 계산 내역
 * @returns 차감할 야간수당 총액
 */
export function calculateNightAllowanceDeduction(
  userNightCalculations: MonthlyNightPayCalculation[]
): number {
  return userNightCalculations.reduce((total, calc) => total + calc.night_allowance_amount, 0)
}

/**
 * 현재 월 기준으로 야간근무 수당 자동 처리
 * (월말 자동 실행용)
 */
export async function autoProcessCurrentMonthNightAllowance() {
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const month = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  
  return await processMonthlyNightAllowance(month)
}
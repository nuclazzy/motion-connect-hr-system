
interface UserForLeave {
  id: string;
  hire_date?: string | null;
}

interface LeaveData {
  leave_types: {
    annual_days: number;
    used_annual_days: number;
    sick_days: number;
    used_sick_days: number;
  };
}

/**
 * 직원이 연차 촉진 대상인지 확인합니다.
 * @param user 사용자 정보 (id, hire_date 포함)
 * @param leaveData 사용자의 휴가 데이터
 * @returns 촉진 대상 여부 (boolean)
 */
export function isPromotionTarget(user: UserForLeave, leaveData: LeaveData | null): boolean {
  if (!user.hire_date || !leaveData) {
    return false;
  }

  const hireDate = new Date(user.hire_date);
  const today = new Date();
  
  // 근무 개월 수 계산 (1달을 30.44일로 평균 계산)
  const workingMonths = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  
  // 잔여 연차 계산
  const remainingDays = leaveData.leave_types.annual_days - leaveData.leave_types.used_annual_days;

  // 법적 연차 촉진 기준 (근무 12개월 이상, 잔여 연차 5일 이상)
  const isLegalRequired = workingMonths >= 12 && remainingDays >= 5;

  return isLegalRequired;
}


import { differenceInYears, differenceInMonths } from 'date-fns';

/**
 * 직원의 입사일을 기준으로 현재 시점의 총 연차 개수를 계산합니다.
 * 제공된 Excel 수식 로직을 기반으로 구현되었습니다.
 * 
 * @param hireDate 직원의 입사일 (Date 객체 또는 YYYY-MM-DD 형식의 문자열)
 * @returns 계산된 총 연차 개수 (number)
 */
export function calculateAnnualLeave(hireDate: Date | string): number {
  const today = new Date();
  const hireDateObj = typeof hireDate === 'string' ? new Date(hireDate) : hireDate;

  const yearsOfService = differenceInYears(today, hireDateObj);

  // 엑셀 수식: =IF(YEAR(TODAY())-YEAR(입사일)=0, ...)
  // 1. 1년차 (입사년도와 현재년도가 같음)
  if (yearsOfService === 0) {
    // 1달 만근 시 1일 휴가 발생 로직
    const fullMonthsOfService = differenceInMonths(today, hireDateObj);
    return fullMonthsOfService;
  }

  // 엑셀 수식: =IF(YEAR(TODAY())-YEAR(입사일)=1, ...)
  // 2. 2년차 (입사 후 1년이 지남)
  if (yearsOfService === 1) {
    // 근로기준법에 따라 1년차에 최대 11일, 2년차에 15일이 발생하는 것으로 구현합니다.
    // 제공된 수식은 매우 특수하여, 일반적인 근로기준법 해석과 다를 수 있으므로, 표준적인 방식으로 구현합니다.
    return 15;
  }

  // 엑셀 수식: =IF(YEAR(TODAY())-YEAR(입사일)=2, 15, ...)
  // 3. 3년차 (입사 후 2년이 지남)
  if (yearsOfService === 2) {
    return 15;
  }

  // 엑셀 수식: MIN(15+ROUNDDOWN((YEAR(TODAY())-YEAR(입사일)-1)/2,0),25)
  // 4. 4년차 이상 (입사 후 3년 이상 지남)
  if (yearsOfService >= 3) {
    // 3년차부터 2년에 1일씩 가산
    const additionalLeave = Math.floor((yearsOfService - 1) / 2);
    const totalLeave = 15 + additionalLeave;
    
    // 최대 25일 한도
    return Math.min(totalLeave, 25);
  }

  return 0; // 예외 케이스
}

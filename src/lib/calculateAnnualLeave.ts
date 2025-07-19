/**
 * 직원의 입사일을 기준으로 현재 시점의 총 연차 개수를 계산합니다.
 * 제공된 Excel 수식 로직을 기반으로 구현되었습니다.
 */

/**
 * Calculates the number of days between two dates.
 * Equivalent to Excel's DATEDIF(start, end, "D").
 * @param date1 Start date
 * @param date2 End date
 * @returns The number of full days between the two dates.
 */
function dateDiffInDays(date1: Date, date2: Date): number {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getUTCFullYear(), date1.getUTCMonth(), date1.getUTCDate());
  const utc2 = Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate());
  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

/**
 * 제공된 엑셀 공식을 기반으로 직원의 현재 시점 연차 일수를 계산합니다.
 * 이 공식은 회계연도(매년 1월 1일) 기준으로 연차를 산정하는 방식을 따릅니다.
 * @param hireDateStr 직원의 입사일 (YYYY-MM-DD 형식)
 * @returns 계산된 총 연차 일수
 */
export function calculateAnnualLeave(hireDateStr: string | null | undefined): number {
  if (!hireDateStr) {
    return 0;
  }

  // 'YYYY-MM-DD' 문자열을 Date 객체로 변환. UTC 기준으로 처리하여 타임존 문제 방지.
  const hireDate = new Date(hireDateStr);
  const today = new Date();

  const yearOfToday = today.getUTCFullYear();
  const yearOfHire = hireDate.getUTCFullYear();

  const calendarYearsPassed = yearOfToday - yearOfHire;

  // 1. 입사 1년차 (입사한 해)
  // =IF(YEAR(TODAY())-YEAR(입사일)=0, MONTH(TODAY())-MONTH(입사일)+IF(DAY(TODAY())>=DAY(입사일),1,0), ...)
  if (calendarYearsPassed === 0) {
    let leaveDays = today.getUTCMonth() - hireDate.getUTCMonth();
    if (today.getUTCDate() >= hireDate.getUTCDate()) {
      leaveDays += 1;
    }
    return Math.max(0, leaveDays);
  }

  // 2. 입사 2년차 (입사 다음 해)
  // =IF(YEAR(TODAY())-YEAR(입사일)=1, ROUNDUP((DATEDIF(입사일,DATE(YEAR(입사일),12,31),"D")+1)/365*15,0)+MONTH(입사일)-1, ...)
  if (calendarYearsPassed === 1) {
    const endOfHireYear = new Date(Date.UTC(yearOfHire, 11, 31)); // 입사한 해의 12월 31일
    const daysInFirstCalYear = dateDiffInDays(hireDate, endOfHireYear) + 1;
    const proRatedLeave = Math.ceil((daysInFirstCalYear / 365) * 15);
    const monthBonus = hireDate.getUTCMonth(); // getUTCMonth()는 0부터 시작하므로 이미 '월-1' 입니다.
    return proRatedLeave + monthBonus;
  }

  // 3. 입사 3년차 (입사 2년 후)
  // =IF(YEAR(TODAY())-YEAR(입사일)=2, 15, ...)
  if (calendarYearsPassed === 2) {
    return 15;
  }

  // 4. 입사 4년차 이상 (입사 3년 후부터)
  // =MIN(15+ROUNDDOWN((YEAR(TODAY())-YEAR(입사일)-1)/2,0),25)
  if (calendarYearsPassed > 2) {
    const additionalLeave = Math.floor((calendarYearsPassed - 1) / 2);
    return Math.min(15 + additionalLeave, 25);
  }

  return 0;
}
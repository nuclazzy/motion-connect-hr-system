// 급여대장 PDF 생성 라이브러리
// jsPDF와 html2canvas를 사용하여 급여대장 PDF 생성

interface PayrollData {
  employee_name: string
  department: string
  position: string
  base_salary: number
  meal_allowance: number
  car_allowance: number
  bonus: number
  overtime_allowance: number
  night_allowance: number
  total_salary: number
}

interface PayrollSummary {
  month: string
  company_name: string
  total_employees: number
  total_base_salary: number
  total_meal_allowance: number
  total_car_allowance: number
  total_bonus: number
  total_overtime_allowance: number
  total_night_allowance: number
  grand_total: number
}

/**
 * 급여대장 HTML 템플릿 생성
 */
export function generatePayrollHTML(
  data: PayrollData[],
  summary: PayrollSummary
): string {
  const currentDate = new Date().toLocaleDateString('ko-KR')
  
  const tableRows = data.map((employee, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${employee.employee_name}</td>
      <td>${employee.department}</td>
      <td>${employee.position}</td>
      <td class="amount">${employee.base_salary.toLocaleString()}</td>
      <td class="amount">${employee.meal_allowance.toLocaleString()}</td>
      <td class="amount">${employee.car_allowance.toLocaleString()}</td>
      <td class="amount">${employee.bonus.toLocaleString()}</td>
      <td class="amount">${employee.overtime_allowance.toLocaleString()}</td>
      <td class="amount">${employee.night_allowance.toLocaleString()}</td>
      <td class="amount total">${employee.total_salary.toLocaleString()}</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <title>${summary.company_name} ${summary.month} 급여내역</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
        
        body {
          font-family: 'Malgun Gothic', sans-serif;
          font-size: 10pt;
          color: #333;
          margin: 0;
          padding: 20px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        h1 {
          font-size: 20pt;
          margin: 10px 0;
          color: #2c3e50;
        }
        
        .company-info {
          font-size: 12pt;
          color: #666;
          margin: 5px 0;
        }
        
        .date-info {
          text-align: right;
          margin-bottom: 20px;
          font-size: 10pt;
          color: #666;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        th {
          background-color: #34495e;
          color: white;
          padding: 10px 8px;
          text-align: center;
          font-weight: bold;
          font-size: 9pt;
          border: 1px solid #2c3e50;
        }
        
        td {
          padding: 8px;
          border: 1px solid #ddd;
          text-align: center;
          font-size: 9pt;
        }
        
        td.amount {
          text-align: right;
          padding-right: 10px;
        }
        
        td.total {
          font-weight: bold;
          background-color: #f8f9fa;
        }
        
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        
        .summary-row {
          background-color: #ecf0f1 !important;
          font-weight: bold;
        }
        
        .summary-row td {
          padding: 12px 8px;
          font-size: 10pt;
        }
        
        
        .notes {
          margin-top: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border-left: 4px solid #34495e;
        }
        
        .notes h3 {
          margin: 0 0 10px 0;
          font-size: 11pt;
          color: #34495e;
        }
        
        .notes ul {
          margin: 5px 0;
          padding-left: 20px;
        }
        
        .notes li {
          margin: 3px 0;
          font-size: 9pt;
          color: #666;
        }
        
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${summary.company_name} ${summary.month} 급여내역</h1>
      </div>
      
      <div class="date-info">
        작성일: ${currentDate}
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 3%">No</th>
            <th style="width: 8%">성명</th>
            <th style="width: 10%">부서</th>
            <th style="width: 10%">직급</th>
            <th style="width: 11%">기본급</th>
            <th style="width: 9%">식대</th>
            <th style="width: 9%">차량유지비</th>
            <th style="width: 9%">상여금</th>
            <th style="width: 10%">초과근무수당</th>
            <th style="width: 10%">야간근무수당</th>
            <th style="width: 11%">총 지급액</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr class="summary-row">
            <td colspan="4">합계 (${summary.total_employees}명)</td>
            <td class="amount">${summary.total_base_salary.toLocaleString()}</td>
            <td class="amount">${summary.total_meal_allowance.toLocaleString()}</td>
            <td class="amount">${summary.total_car_allowance.toLocaleString()}</td>
            <td class="amount">${summary.total_bonus.toLocaleString()}</td>
            <td class="amount">${summary.total_overtime_allowance.toLocaleString()}</td>
            <td class="amount">${summary.total_night_allowance.toLocaleString()}</td>
            <td class="amount total">${summary.grand_total.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="notes">
        <h3>참고사항</h3>
        <ul>
          <li>초과근무수당: 시급 × 1.5배 × 초과근무시간</li>
          <li>야간근무수당: 시급 × 0.5배 × 야간근무시간 (22:00~06:00)</li>
          <li>탄력근무제 기간: 3개월 평균 주 40시간 초과분 정산</li>
          <li>본 급여대장은 ${summary.month} 실제 지급액 기준입니다.</li>
          <li>※ 본 자료는 회계 처리용 급여 집계표입니다.</li>
        </ul>
      </div>
      
    </body>
    </html>
  `
}

/**
 * PDF 생성을 위한 데이터 준비
 */
export function preparePayrollData(employees: any[], month: string): {
  data: PayrollData[]
  summary: PayrollSummary
} {
  const data: PayrollData[] = employees.map(emp => ({
    employee_name: emp.name,
    department: emp.department || '-',
    position: emp.position || '-',
    base_salary: emp.monthlyBaseSalary || 0,
    meal_allowance: emp.meal_allowance || 0,
    car_allowance: emp.car_allowance || 0,
    bonus: emp.bonus || 0,
    overtime_allowance: emp.overtimeAllowance || 0,
    night_allowance: emp.nightAllowance || 0,
    total_salary: emp.totalSalary || 0
  }))

  const summary: PayrollSummary = {
    month: formatMonth(month),
    company_name: '주식회사 모션센스',
    total_employees: data.length,
    total_base_salary: data.reduce((sum, emp) => sum + emp.base_salary, 0),
    total_meal_allowance: data.reduce((sum, emp) => sum + emp.meal_allowance, 0),
    total_car_allowance: data.reduce((sum, emp) => sum + emp.car_allowance, 0),
    total_bonus: data.reduce((sum, emp) => sum + emp.bonus, 0),
    total_overtime_allowance: data.reduce((sum, emp) => sum + emp.overtime_allowance, 0),
    total_night_allowance: data.reduce((sum, emp) => sum + emp.night_allowance, 0),
    grand_total: data.reduce((sum, emp) => sum + emp.total_salary, 0)
  }

  return { data, summary }
}

/**
 * 월 포맷팅
 */
function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  return `${year}년 ${parseInt(monthNum)}월`
}

/**
 * PDF 다운로드 트리거
 */
export async function downloadPayrollPDF(
  employees: any[],
  month: string
): Promise<void> {
  try {
    // jsPDF 동적 임포트
    const { default: jsPDF } = await import('jspdf')
    const { default: html2canvas } = await import('html2canvas')
    
    // 데이터 준비
    const { data, summary } = preparePayrollData(employees, month)
    
    // HTML 생성
    const htmlContent = generatePayrollHTML(data, summary)
    
    // 임시 div 생성
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '-9999px'
    tempDiv.style.width = '1200px'
    document.body.appendChild(tempDiv)
    
    // HTML을 캔버스로 변환
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      logging: false
    })
    
    // PDF 생성
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })
    
    const imgWidth = 297 // A4 landscape width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pageHeight = 210 // A4 landscape height in mm
    
    let position = 0
    let heightLeft = imgHeight
    
    // 첫 페이지 추가
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      position,
      imgWidth,
      imgHeight
    )
    
    heightLeft -= pageHeight
    
    // 추가 페이지가 필요한 경우
    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight
      )
      heightLeft -= pageHeight
    }
    
    // 임시 div 제거
    document.body.removeChild(tempDiv)
    
    // PDF 다운로드
    const fileName = `주식회사모션센스_${summary.month.replace(/[년월\s]/g, '')}_급여내역.pdf`
    pdf.save(fileName)
    
  } catch (error) {
    console.error('PDF 생성 오류:', error)
    throw new Error('PDF 생성에 실패했습니다.')
  }
}
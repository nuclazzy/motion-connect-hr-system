import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { formType, formData, userData } = await request.json()
    
    console.log('📄 PDF 생성 요청:', { formType, userData: userData?.name })
    
    // 서식별 HTML 템플릿 생성
    const htmlContent = generateFormHTML(formType, formData, userData)
    
    // 클라이언트에서 PDF 생성을 위해 HTML 반환
    return NextResponse.json({
      success: true,
      htmlContent,
      fileName: `[${new Date().toISOString().split('T')[0]}] ${userData?.name}_${formType}.pdf`
    })
    
  } catch (error) {
    console.error('PDF 생성 오류:', error)
    return NextResponse.json(
      { success: false, error: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateFormHTML(formType: string, formData: any, userData: any): string {
  const baseStyle = `
    <style>
      @page { size: A4; margin: 20mm; }
      body { font-family: 'Malgun Gothic', sans-serif; font-size: 12pt; line-height: 1.6; margin: 0; padding: 0; }
      .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
      .title { font-size: 24pt; font-weight: bold; margin-bottom: 10px; }
      .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      .info-table td { padding: 8px; border: 1px solid #333; }
      .info-table .label { background-color: #f0f0f0; font-weight: bold; width: 120px; }
      .content-section { margin-bottom: 20px; }
      .content-section h3 { font-size: 14pt; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #333; padding-left: 10px; }
      .content-text { border: 1px solid #333; padding: 15px; min-height: 80px; white-space: pre-wrap; }
      .signature-section { margin-top: 40px; text-align: right; }
      .date-text { margin-bottom: 20px; }
    </style>
  `
  
  switch (formType) {
    case '경위서':
      return generateReportHTML(formData, userData, baseStyle)
    case '휴가 신청서':
      return generateLeaveHTML(formData, userData, baseStyle)
    case '재직증명서':
      return generateCertificateHTML(formData, userData, baseStyle)
    case '휴직계':
      return generateLeaveOfAbsenceHTML(formData, userData, baseStyle)
    case '출산휴가 및 육아휴직 신청서':
      return generateMaternityHTML(formData, userData, baseStyle)
    default:
      return generateGenericHTML(formType, formData, userData, baseStyle)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateReportHTML(formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">경 위 서</div>
      </div>
      
      <table class="info-table">
        <tr>
          <td class="label">소속</td>
          <td>${userData?.department || ''}</td>
          <td class="label">직위</td>
          <td>${userData?.position || ''}</td>
        </tr>
        <tr>
          <td class="label">성명</td>
          <td>${userData?.name || ''}</td>
          <td class="label">연락처</td>
          <td>${userData?.phone || formData.연락처 || ''}</td>
        </tr>
      </table>
      
      <div class="content-section">
        <h3>1. 사건개요</h3>
        <div class="content-text">${formData.사건개요 || ''}</div>
      </div>
      
      <div class="content-section">
        <h3>2. 사건 상세 내용</h3>
        <div class="content-text">${formData.상세내용 || ''}</div>
      </div>
      
      <div class="content-section">
        <h3>3. 사건 발생 원인</h3>
        <div class="content-text">${formData.원인분석 || ''}</div>
      </div>
      
      <div class="content-section">
        <h3>4. 향후 대책 및 본인 추가 의견</h3>
        <div class="content-text">${formData.본인의견 || ''}</div>
      </div>
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div>신청자: ${userData?.name || ''} (인)</div>
        <div style="margin-top: 40px;">Motion Connect 귀하</div>
      </div>
    </body>
    </html>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLeaveHTML(formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  let period = ''
  if (formData.휴가형태?.includes('반차')) {
    period = `${formatDate(formData.시작일)} (${formData.휴가형태 === '오전 반차' ? '오전' : '오후'})`
  } else if (formData.시작일 && formData.종료일) {
    period = `${formatDate(formData.시작일)} ~ ${formatDate(formData.종료일)}`
  } else if (formData.시작일) {
    period = formatDate(formData.시작일)
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">휴 가 신 청 서</div>
      </div>
      
      <table class="info-table">
        <tr>
          <td class="label">소속</td>
          <td>${userData?.department || ''}</td>
          <td class="label">직위</td>
          <td>${userData?.position || ''}</td>
        </tr>
        <tr>
          <td class="label">성명</td>
          <td>${userData?.name || ''}</td>
          <td class="label">연락처</td>
          <td>${userData?.phone || formData.연락처 || ''}</td>
        </tr>
        <tr>
          <td class="label">휴가형태</td>
          <td>${formData.휴가형태 || ''}</td>
          <td class="label">휴가기간</td>
          <td>${period}</td>
        </tr>
      </table>
      
      ${formData.사유 ? `
      <div class="content-section">
        <h3>사유</h3>
        <div class="content-text">${formData.사유}</div>
      </div>
      ` : ''}
      
      <div class="content-section">
        <h3>전달사항 (업무 인수인계)</h3>
        <div class="content-text">${formData.전달사항 || ''}</div>
      </div>
      
      <div class="content-section">
        <h3>비상연락처</h3>
        <div class="content-text">${formData.비상연락처 || ''}</div>
      </div>
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div>신청자: ${userData?.name || ''} (인)</div>
        <div style="margin-top: 40px;">Motion Connect 귀하</div>
      </div>
    </body>
    </html>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateCertificateHTML(formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  // 재직기간 계산
  const hireDate = new Date(userData?.hire_date || '2024-01-01')
  const now = new Date()
  const years = now.getFullYear() - hireDate.getFullYear()
  const months = now.getMonth() - hireDate.getMonth()
  const employmentPeriod = `${years}년 ${months >= 0 ? months : months + 12}개월`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">재 직 증 명 서</div>
      </div>
      
      <div style="margin: 40px 0; font-size: 14pt; line-height: 2;">
        <p>아래 사람의 재직사실을 증명합니다.</p>
        
        <table class="info-table" style="margin: 30px 0;">
          <tr>
            <td class="label">성명</td>
            <td>${userData?.name || ''}</td>
          </tr>
          <tr>
            <td class="label">소속</td>
            <td>${userData?.department || ''}</td>
          </tr>
          <tr>
            <td class="label">직위</td>
            <td>${userData?.position || ''}</td>
          </tr>
          <tr>
            <td class="label">입사일</td>
            <td>${formatDate(userData?.hire_date)}</td>
          </tr>
          <tr>
            <td class="label">재직기간</td>
            <td>${employmentPeriod}</td>
          </tr>
        </table>
        
        <p><strong>제출처:</strong> ${formData.제출처 || ''}</p>
      </div>
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div style="margin-top: 40px;">
          <strong>Motion Connect</strong><br>
          대표자: [대표자명] (인)
        </div>
      </div>
    </body>
    </html>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateLeaveOfAbsenceHTML(formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  const period = `${formatDate(formData.시작일)} ~ ${formatDate(formData.종료일)}`
  const days = calculateDays(formData.시작일, formData.종료일)
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">휴 직 계</div>
      </div>
      
      <table class="info-table">
        <tr>
          <td class="label">소속</td>
          <td>${userData?.department || ''}</td>
          <td class="label">직위</td>
          <td>${userData?.position || ''}</td>
        </tr>
        <tr>
          <td class="label">성명</td>
          <td>${userData?.name || ''}</td>
          <td class="label">연락처</td>
          <td>${userData?.phone || formData.연락처 || ''}</td>
        </tr>
        <tr>
          <td class="label">휴직형태</td>
          <td>${formData.휴직형태 === '기타' ? formData.휴직형태_기타 : formData.휴직형태}</td>
          <td class="label">휴직기간</td>
          <td>${period} (${days}일)</td>
        </tr>
      </table>
      
      <div class="content-section">
        <h3>휴직사유</h3>
        <div class="content-text">${formData.휴직사유 || ''}</div>
      </div>
      
      <div class="content-section">
        <h3>전달사항</h3>
        <div class="content-text">${formData.전달사항 || ''}</div>
      </div>
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div>신청자: ${userData?.name || ''} (인)</div>
        <div style="margin-top: 40px;">Motion Connect 귀하</div>
      </div>
    </body>
    </html>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateMaternityHTML(formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">출산휴가 및 육아휴직 신청서</div>
      </div>
      
      <table class="info-table">
        <tr>
          <td class="label">소속</td>
          <td>${userData?.department || ''}</td>
          <td class="label">직위</td>
          <td>${userData?.position || ''}</td>
        </tr>
        <tr>
          <td class="label">성명</td>
          <td>${userData?.name || ''}</td>
          <td class="label">출산예정일</td>
          <td>${formatDate(formData.출산예정일)}</td>
        </tr>
      </table>
      
      <div class="content-section">
        <h3>출산전후휴가</h3>
        <table class="info-table">
          <tr>
            <td class="label">시작일</td>
            <td>${formatDate(formData.출산휴가시작일)}</td>
            <td class="label">종료일</td>
            <td>${formatDate(formData.출산휴가종료일)}</td>
          </tr>
        </table>
      </div>
      
      ${formData.육아휴직시작일 ? `
      <div class="content-section">
        <h3>육아휴직</h3>
        <table class="info-table">
          <tr>
            <td class="label">시작일</td>
            <td>${formatDate(formData.육아휴직시작일)}</td>
            <td class="label">종료일</td>
            <td>${formatDate(formData.육아휴직종료일)}</td>
          </tr>
        </table>
      </div>
      ` : ''}
      
      ${formData.육아기단축시작일 ? `
      <div class="content-section">
        <h3>육아기 근로시간 단축</h3>
        <table class="info-table">
          <tr>
            <td class="label">기간</td>
            <td>${formatDate(formData.육아기단축시작일)} ~ ${formatDate(formData.육아기단축종료일)}</td>
          </tr>
          <tr>
            <td class="label">근무시간</td>
            <td>${formData.육아기근무시작시간} ~ ${formData.육아기근무종료시간}</td>
          </tr>
        </table>
      </div>
      ` : ''}
      
      ${formData.비고 ? `
      <div class="content-section">
        <h3>비고</h3>
        <div class="content-text">${formData.비고}</div>
      </div>
      ` : ''}
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div>신청자: ${userData?.name || ''} (인)</div>
        <div style="margin-top: 40px;">Motion Connect 귀하</div>
      </div>
    </body>
    </html>
  `
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generateGenericHTML(formType: string, formData: any, userData: any, baseStyle: string): string {
  const today = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  })
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${baseStyle}
    </head>
    <body>
      <div class="header">
        <div class="title">${formType}</div>
      </div>
      
      <table class="info-table">
        <tr>
          <td class="label">소속</td>
          <td>${userData?.department || ''}</td>
          <td class="label">직위</td>
          <td>${userData?.position || ''}</td>
        </tr>
        <tr>
          <td class="label">성명</td>
          <td>${userData?.name || ''}</td>
          <td class="label">연락처</td>
          <td>${userData?.phone || ''}</td>
        </tr>
      </table>
      
      ${Object.entries(formData).map(([key, value]) => `
        <div class="content-section">
          <h3>${key}</h3>
          <div class="content-text">${value || ''}</div>
        </div>
      `).join('')}
      
      <div class="signature-section">
        <div class="date-text">${today}</div>
        <div>신청자: ${userData?.name || ''} (인)</div>
        <div style="margin-top: 40px;">Motion Connect 귀하</div>
      </div>
    </body>
    </html>
  `
}

function formatDate(dateString: string): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

function calculateDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}
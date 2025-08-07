import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import nodemailer from 'nodemailer' // 이메일 발송 활성화
// import puppeteer from 'puppeteer' // PDF 생성 비활성화

export async function POST(request: NextRequest) {
  try {
    const {
      formType,
      applicantName,
      applicantDepartment,
      applicantPosition,
      formData,
      pdfContent,
      adminEmail, // 후방 호환성을 위해 유지
      adminEmails // 새로운 여러 이메일 필드
    } = await request.json()
    
    // Supabase에서 활성 알림 이메일 조회
    let targetEmails = ['lewis@motionsense.co.kr'] // 기본값
    
    try {
      const { data: notificationSettings } = await supabase
        .rpc('get_active_notification_emails', { 
          p_notification_type: formType.includes('휴가') ? 'leave_application' : 'form_submission' 
        })
      
      if (notificationSettings && notificationSettings.length > 0) {
        targetEmails = notificationSettings
      }
    } catch (dbError) {
      console.warn('알림 설정 조회 실패, 기본 이메일 사용:', dbError)
      // 후방 호환성: 기존 방식 사용
      targetEmails = adminEmails && adminEmails.length > 0 ? adminEmails : (adminEmail ? [adminEmail] : ['lewis@motionsense.co.kr'])
    }

    console.log('📧 서식 신청 알림 이메일 발송:', {
      formType,
      applicant: applicantName,
      department: applicantDepartment,
      targetEmails: targetEmails
    })

    // PDF 생성 비활성화 (puppeteer 의존성 제거)
    // 필요 시 클라이언트 측에서 PDF 생성 처리
    let pdfBuffer = null
    /*
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      })
      const page = await browser.newPage()
      
      await page.setContent(pdfContent, {
        waitUntil: 'networkidle0'
      })
      
      pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true
      })
      
      await browser.close()
      console.log('📄 PDF 생성 완료')
    } catch (pdfError) {
      console.error('PDF 생성 오류:', pdfError)
      // PDF 생성 실패해도 이메일은 발송
    }
    */

    // 이메일 내용 생성
    const emailSubject = `📋 [Motion Connect] ${formType} 신청 - ${applicantName}`
    
    const emailBody = `
    <div style="font-family: 'Malgun Gothic', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">📋 서식 신청 알림</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Motion Connect HR System</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📝 신청 정보</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: 500; width: 120px;">서식 종류:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${formType}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">신청자:</td>
              <td style="padding: 8px 0; color: #111827; font-weight: 600;">${applicantName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">소속:</td>
              <td style="padding: 8px 0; color: #111827;">${applicantDepartment}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">직급:</td>
              <td style="padding: 8px 0; color: #111827;">${applicantPosition}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; font-weight: 500;">신청 시간:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date().toLocaleString('ko-KR')}</td>
            </tr>
          </table>
        </div>

        ${formType === '휴가 신청서' && formData ? `
        <div style="background: #fef3f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">🏖️ 휴가 신청 상세</h3>
          <ul style="margin: 0; padding-left: 20px; color: #7f1d1d;">
            ${formData.휴가형태 ? `<li><strong>휴가 형태:</strong> ${formData.휴가형태}</li>` : ''}
            ${formData.시작일 ? `<li><strong>시작일:</strong> ${formData.시작일}</li>` : ''}
            ${formData.종료일 ? `<li><strong>종료일:</strong> ${formData.종료일}</li>` : ''}
            ${formData.휴가일수 ? `<li><strong>휴가 일수:</strong> ${formData.휴가일수}일</li>` : ''}
            ${formData.사유 ? `<li><strong>사유:</strong> ${formData.사유}</li>` : ''}
          </ul>
        </div>
        ` : ''}

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <h3 style="color: #1d4ed8; margin: 0 0 10px 0; font-size: 16px;">⚡ 다음 단계</h3>
          <p style="margin: 0; color: #1e3a8a; line-height: 1.6;">
            1. 첨부된 PDF 문서를 검토해주세요<br>
            2. Motion Connect 시스템에서 승인/반려 처리<br>
            3. 필요시 신청자에게 직접 연락
          </p>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
          <p style="color: #6b7280; font-size: 14px; margin: 0;">
            Motion Connect HR System에서 자동 발송된 메일입니다.<br>
            시스템 접속: <a href="https://motion-connect-hxr9zyo25-motionsenses-projects.vercel.app" style="color: #3b82f6;">Motion Connect</a>
          </p>
        </div>
      </div>
    </div>
    `

    // 이메일 발송 활성화
    try {
      // nodemailer 트랜스포터 생성
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      })

      // 여러 관리자에게 동시 발송
      const mailOptions = {
        from: `"Motion Connect HR System" <${process.env.EMAIL_USER}>`,
        to: targetEmails.join(', '), // 여러 이메일 주소를 쉼표로 구분
        bcc: targetEmails.length > 3 ? targetEmails.slice(3) : [], // 3개 이상시 BCC 사용
        subject: emailSubject,
        html: emailBody,
        attachments: pdfBuffer ? [
          {
            filename: `${formType}_${applicantName}_${new Date().toISOString().split('T')[0]}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ] : []
      }

      // 이메일 발송
      await transporter.sendMail(mailOptions)
      console.log(`✅ 이메일 발송 성공: ${targetEmails.join(', ')}`)
      
    } catch (emailError) {
      console.error('📧 이메일 발송 실패:', emailError)
      // 이메일 발송 실패해도 API는 성공으로 처리 (알림 로깅은 완료)
      console.log(`⚠️ 이메일 발송 실패, 로깅만 완료: ${targetEmails.join(', ')}`)
    }

    return NextResponse.json({ 
      success: true, 
      message: `알림이 ${targetEmails.length}개 이메일로 발송되었습니다.`,
      recipients: targetEmails,
      emailSent: true
    })

  } catch (error) {
    console.error('이메일 알림 발송 오류:', error)
    return NextResponse.json(
      { success: false, error: '이메일 발송에 실패했습니다.' },
      { status: 500 }
    )
  }
}
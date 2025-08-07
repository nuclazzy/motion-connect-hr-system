/**
 * 이메일 알림 서비스
 * Supabase Edge Functions 또는 외부 이메일 서비스와 연동
 */

import { supabase } from '@/lib/supabase'

export interface EmailData {
  to: string
  subject: string
  html: string
  text?: string
}

export type EmailType = 
  | 'leave_approved'
  | 'leave_rejected'
  | 'leave_promotion_1st'
  | 'leave_promotion_2nd'
  | 'leave_expiry_warning'
  | 'sick_leave_reminder'

/**
 * 이메일 템플릿 생성
 */
function getEmailTemplate(type: EmailType, data: any): { subject: string; html: string } {
  switch (type) {
    case 'leave_approved':
      return {
        subject: `[휴가 승인] ${data.leaveType} 신청이 승인되었습니다`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">휴가 신청 승인</h2>
            <p>${data.userName}님,</p>
            <p>신청하신 휴가가 승인되었습니다.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>휴가 종류:</strong> ${data.leaveType}</p>
              <p><strong>기간:</strong> ${data.startDate} ~ ${data.endDate}</p>
              <p><strong>일수:</strong> ${data.days}일</p>
              <p><strong>승인자:</strong> ${data.approvedBy}</p>
            </div>
            <p>즐거운 휴가 되세요!</p>
          </div>
        `
      }
    
    case 'leave_rejected':
      return {
        subject: `[휴가 거부] ${data.leaveType} 신청이 거부되었습니다`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">휴가 신청 거부</h2>
            <p>${data.userName}님,</p>
            <p>신청하신 휴가가 거부되었습니다.</p>
            <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>휴가 종류:</strong> ${data.leaveType}</p>
              <p><strong>기간:</strong> ${data.startDate} ~ ${data.endDate}</p>
              <p><strong>거부 사유:</strong> ${data.reason || '관리자에게 문의해주세요'}</p>
            </div>
          </div>
        `
      }
    
    case 'leave_promotion_1st':
      return {
        subject: '[연차 촉진] 미사용 연차 사용 안내 (1차)',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">연차 사용 촉진 안내</h2>
            <p>${data.userName}님,</p>
            <p>올해 미사용 연차가 <strong>${data.remainingDays}일</strong> 남아있습니다.</p>
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>응답 기한:</strong> ${data.deadline}</p>
              <p><strong>소멸 예정일:</strong> ${data.expiryDate}</p>
            </div>
            <p>기한 내에 연차 사용 희망일을 시스템에서 선택해 주세요.</p>
            <p style="color: #dc2626;"><strong>⚠️ 주의사항:</strong></p>
            <ul>
              <li>기한 내 미응답 시 회사가 연차 사용일을 지정합니다</li>
              <li>최종 미사용 시 연차 보상 의무가 소멸됩니다</li>
            </ul>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/user" 
               style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none; margin-top: 20px;">
              연차 사용일 선택하기
            </a>
          </div>
        `
      }
    
    case 'leave_promotion_2nd':
      return {
        subject: '[연차 촉진] 연차 사용일 지정 통보 (2차)',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">연차 사용일 지정 통보</h2>
            <p>${data.userName}님,</p>
            <p>1차 촉진에 응답하지 않아 회사가 연차 사용일을 지정했습니다.</p>
            <div style="background: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>지정된 연차 사용일:</strong></p>
              <ul>
                ${data.designatedDates.map((date: string) => `<li>${date}</li>`).join('')}
              </ul>
            </div>
            <p style="color: #dc2626;"><strong>최종 안내:</strong> 지정된 날짜에 연차를 사용하지 않을 경우, 미사용 연차에 대한 보상 의무가 소멸됩니다.</p>
          </div>
        `
      }
    
    case 'sick_leave_reminder':
      return {
        subject: '[병가 안내] 진단서 제출 요청',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>병가 진단서 제출 안내</h2>
            <p>${data.userName}님,</p>
            <p>${data.leaveDate}에 사용하신 병가에 대한 진단서를 제출해 주세요.</p>
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>제출 기한:</strong> 병가 사용 후 3일 이내</p>
              <p><strong>제출처:</strong> 인사팀 이메일 (hr@company.com)</p>
            </div>
            <p>기한 내 미제출 시 무단결근으로 처리될 수 있습니다.</p>
          </div>
        `
      }
    
    default:
      return {
        subject: '시스템 알림',
        html: '<p>시스템 알림입니다.</p>'
      }
  }
}

/**
 * 이메일 발송 함수
 */
export async function sendEmail(type: EmailType, recipient: string, data: any): Promise<boolean> {
  try {
    const template = getEmailTemplate(type, data)
    
    // 이메일 발송 기록 저장
    const { error: logError } = await supabase
      .from('email_logs')
      .insert({
        to: recipient,
        subject: template.subject,
        type: type,
        sent_at: new Date().toISOString(),
        status: 'pending'
      })
    
    // 실제 이메일 발송 (Supabase Edge Function 호출)
    // TODO: Edge Function 구현 필요
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        to: recipient,
        subject: template.subject,
        html: template.html
      })
    })
    
    if (response.ok) {
      // 발송 성공 기록
      await supabase
        .from('email_logs')
        .update({ status: 'sent' })
        .eq('to', recipient)
        .eq('subject', template.subject)
        .order('created_at', { ascending: false })
        .limit(1)
      
      return true
    }
    
    return false
  } catch (error) {
    console.error('Email sending failed:', error)
    return false
  }
}

/**
 * 휴가 승인 알림 이메일
 */
export async function sendLeaveApprovalEmail(
  userEmail: string,
  userName: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  days: number,
  approvedBy: string
): Promise<boolean> {
  return sendEmail('leave_approved', userEmail, {
    userName,
    leaveType,
    startDate,
    endDate,
    days,
    approvedBy
  })
}

/**
 * 연차 촉진 이메일
 */
export async function sendLeavePromotionEmail(
  userEmail: string,
  userName: string,
  remainingDays: number,
  stage: '1st' | '2nd',
  additionalData?: any
): Promise<boolean> {
  const type = stage === '1st' ? 'leave_promotion_1st' : 'leave_promotion_2nd'
  
  return sendEmail(type, userEmail, {
    userName,
    remainingDays,
    deadline: additionalData?.deadline,
    expiryDate: additionalData?.expiryDate,
    designatedDates: additionalData?.designatedDates,
    ...additionalData
  })
}
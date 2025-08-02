import { NextResponse } from 'next/server'

// 로컬 테스트용 폼 템플릿 데이터
const LOCAL_FORM_TEMPLATES = [
  {
    id: 'template-leave',
    name: '휴가 신청서',
    description: '연차, 병가, 경조사 등 일반 휴가를 신청합니다.',
    is_active: true,
    fields: [
      { name: "휴가형태", label: "휴가 형태", type: "select", required: true, options: ["연차", "오전 반차", "오후 반차", "병가", "경조사", "공가", "대체휴가", "보상휴가", "기타"] },
      { name: "휴가형태_기타", label: "기타 휴가형태", type: "text", required: false, condition: { field: "휴가형태", operator: "==", value: "기타" } },
      
      // 경조사 세부 정보
      { name: "경조사구분", label: "경조사 구분", type: "select", required: false, 
        condition: { field: "휴가형태", operator: "==", value: "경조사" },
        options: ["본인 결혼", "자녀 결혼", "부모 사망", "배우자 사망", "배우자 부모 사망", "자녀 사망", "형제·자매 사망", "기타 가족/친족 사망"] 
      },
      { name: "경조사상세", label: "경조사 상세 사항", type: "textarea", required: false, 
        condition: { field: "경조사구분", operator: "==", value: "기타 가족/친족 사망" } 
      },
      
      { name: "시작일", label: "날짜 또는 시작일", type: "date", required: true },
      { name: "종료일", label: "종료일", type: "date", required: true, condition: { field: "휴가형태", operator: "not in", value: ["오전 반차", "오후 반차"] } },
      { name: "사유", label: "사유 (연차/반차 외 필수)", type: "textarea", required: false, condition: { field: "휴가형태", operator: "not in", value: ["연차", "오전 반차", "오후 반차", "대체휴가", "보상휴가"] } },
      { name: "전달사항", label: "전달사항 (업무 인수인계)", type: "textarea", required: false },
      { name: "비상연락처", label: "비상연락처", type: "text", required: false },
      { name: "신청일", label: "신청일", type: "date", required: true, defaultValue: "today" }
    ]
  },
  {
    id: 'template-report',
    name: '경위서',
    description: '사건이나 상황에 대한 경위를 보고합니다.',
    is_active: true,
    fields: [
      { name: "사건개요", label: "1. 사건개요", type: "textarea", required: true },
      { name: "상세내용", label: "2. 사건 상세 내용", type: "textarea", required: true },
      { name: "원인분석", label: "3. 사건 발생 원인", type: "textarea", required: true },
      { name: "본인의견", label: "4. 향후 대책 및 본인 추가 의견", type: "textarea", required: true },
      { name: "신청일", label: "신청일", type: "date", required: true, defaultValue: "today" }
    ]
  },
  {
    id: 'template-certificate',
    name: '재직증명서',
    description: '재직증명서 발급을 신청합니다.',
    is_active: true,
    fields: [
      { name: "제출처", label: "제출처 (용도)", type: "text", required: true },
      { name: "신청일", label: "신청일", type: "date", required: true, defaultValue: "today" }
    ]
  },
  {
    id: 'template-leave-of-absence',
    name: '휴직계',
    description: '휴직을 신청합니다.',
    is_active: true,
    fields: [
      { name: "시작일", label: "휴직 시작일", type: "date", required: true },
      { name: "종료일", label: "휴직 종료일", type: "date", required: true },
      { name: "휴직형태", label: "휴직형태", type: "select", required: true, options: ["무급휴직", "유급휴직", "기타"] },
      { name: "휴직형태_기타", label: "기타 휴직형태", type: "text", required: false, condition: { field: "휴직형태", operator: "==", value: "기타" } },
      { name: "휴직사유", label: "휴직사유", type: "textarea", required: true },
      { name: "전달사항", label: "전달사항", type: "textarea", required: false },
      { name: "신청일", label: "신청일", type: "date", required: true, defaultValue: "today" }
    ]
  },
  {
    id: 'template-maternity',
    name: '출산휴가 및 육아휴직 신청서',
    description: '출산휴가 및 육아휴직을 신청합니다.',
    is_active: true,
    fields: [
      { name: "출산예정일", label: "출산예정일", type: "date", required: true },
      
      // 출산전후휴가
      { name: "출산휴가시작일", label: "출산휴가 시작일", type: "date", required: true },
      { name: "출산휴가종료일", label: "출산휴가 종료일", type: "date", required: true },
      
      // 육아휴직
      { name: "육아휴직시작일", label: "육아휴직 시작일", type: "date", required: false },
      { name: "육아휴직종료일", label: "육아휴직 종료일", type: "date", required: false },
      
      // 육아기 근로시간 단축
      { name: "육아기단축시작일", label: "육아기 단축 시작일", type: "date", required: false },
      { name: "육아기단축종료일", label: "육아기 단축 종료일", type: "date", required: false },
      { name: "육아기근무시작시간", label: "단축 후 근무 시작 시간", type: "time", required: false },
      { name: "육아기근무종료시간", label: "단축 후 근무 종료 시간", type: "time", required: false },
      
      // 전환형 시간 선택제
      { name: "전환형시작일", label: "전환형 시작일", type: "date", required: false },
      { name: "전환형종료일", label: "전환형 종료일", type: "date", required: false },
      
      { name: "비고", label: "비고", type: "textarea", required: false },
      { name: "신청일", label: "신청일", type: "date", required: true, defaultValue: "today" }
    ]
  }
]

export async function GET() {
  try {
    console.log('📋 로컬 폼 템플릿 조회');

    return NextResponse.json({ 
      templates: LOCAL_FORM_TEMPLATES 
    })
  } catch (error) {
    console.error('Form templates API error:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
// 로컬 테스트용 신청 데이터 저장소

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOCAL_FORM_REQUESTS: any[] = []

export function getLocalFormRequests() {
  return LOCAL_FORM_REQUESTS
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateLocalFormRequest(requestId: string, updates: any) {
  const index = LOCAL_FORM_REQUESTS.findIndex(req => req.id === requestId)
  if (index !== -1) {
    LOCAL_FORM_REQUESTS[index] = { ...LOCAL_FORM_REQUESTS[index], ...updates }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addLocalFormRequest(request: any) {
  LOCAL_FORM_REQUESTS.push(request)
}
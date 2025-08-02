// 로컬 테스트용 휴가 데이터 저장소

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOCAL_LEAVE_DATA: { [key: string]: any } = {
  'admin-test-id': {
    id: 'leave-admin-id',
    user_id: 'admin-test-id',
    leave_types: {
      annual_days: 20,
      used_annual_days: 0,
      sick_days: 60,
      used_sick_days: 0,
      substitute_leave_hours: 0,
      compensatory_leave_hours: 0
    }
  },
  'emp1-test-id': {
    id: 'leave-emp1-id',
    user_id: 'emp1-test-id',
    leave_types: {
      annual_days: 15,
      used_annual_days: 3,
      sick_days: 60,
      used_sick_days: 1,
      substitute_leave_hours: 6,
      compensatory_leave_hours: 2
    }
  },
  'emp2-test-id': {
    id: 'leave-emp2-id',
    user_id: 'emp2-test-id',
    leave_types: {
      annual_days: 15,
      used_annual_days: 5,
      sick_days: 60,
      used_sick_days: 0,
      substitute_leave_hours: 2,
      compensatory_leave_hours: 8
    }
  },
  'emp3-test-id': {
    id: 'leave-emp3-id',
    user_id: 'emp3-test-id',
    leave_types: {
      annual_days: 12,
      used_annual_days: 2,
      sick_days: 60,
      used_sick_days: 2,
      substitute_leave_hours: 9,  // 1.125일 = 9시간 (8시간 * 1.125)
      compensatory_leave_hours: 4
    }
  },
  // employee3@test.com의 실제 Supabase ID
  '42daf526-2072-4a06-8517-aee100552ae0': {
    id: 'leave-emp3-real-id',
    user_id: '42daf526-2072-4a06-8517-aee100552ae0',
    leave_types: {
      annual_days: 12,
      used_annual_days: 2,
      sick_days: 60,
      used_sick_days: 2,
      substitute_leave_hours: 9,  // 1.125일 = 9시간 (8시간 * 1.125)
      compensatory_leave_hours: 4
    }
  }
}

export function getLocalLeaveData() {
  return LOCAL_LEAVE_DATA
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function updateLocalLeaveData(userId: string, leaveData: any) {
  LOCAL_LEAVE_DATA[userId] = leaveData
}
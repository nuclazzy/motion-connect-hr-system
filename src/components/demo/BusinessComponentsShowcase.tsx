'use client'

import { useState } from 'react'
import { 
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  StatsCard,
  NotificationCard,
  EmployeeCard
} from '@/components/ui'
import { 
  Clock,
  Calendar,
  Users,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Coffee,
  Building,
  Phone,
  Mail,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react'

const codeExamples = {
  attendanceWidget: `// Attendance Recording Widget
<AttendanceWidget
  user={currentUser}
  onCheckIn={(location, reason) => handleAttendance('in', location, reason)}
  onCheckOut={(location, reason) => handleAttendance('out', location, reason)}
  currentStatus="out" // 'in' | 'out' | 'break'
  todayHours={7.5}
  location={{ enabled: true, accuracy: 'high' }}
/>`,

  employeeCard: `// Employee Information Card
<EmployeeCard
  name="김철수"
  position="시니어 개발자"
  department="기술팀"
  email="kimcs@company.com"
  phone="010-1234-5678"
  status="active"
  avatar="/avatars/kimcs.jpg"
  joinDate="2020-03-15"
  onEdit={() => handleEdit()}
  onView={() => handleView()}
/>`,

  leaveStatus: `// Leave Status Component
<LeaveStatusWidget
  employee={employee}
  totalLeave={15}
  usedLeave={8.5}
  remainingLeave={6.5}
  upcomingLeave={[
    { date: '2024-08-15', type: 'annual', duration: 1 }
  ]}
  onApplyLeave={() => openLeaveModal()}
/>`
}

// Business Components
function AttendanceWidget() {
  const [currentStatus, setCurrentStatus] = useState<'in' | 'out'>('out')
  const [todayHours, setTodayHours] = useState(7.5)
  const [checkInTime, setCheckInTime] = useState('09:15')
  const [location, setLocation] = useState<{lat: number, lng: number} | null>({
    lat: 37.5665, lng: 126.9780
  })

  const handleAttendance = (type: 'in' | 'out') => {
    if (type === 'in') {
      setCurrentStatus('in')
      setCheckInTime(new Date().toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }))
    } else {
      setCurrentStatus('out')
      setTodayHours(8.25)
    }
  }

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle level={4} className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span>출퇴근 관리</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Time */}
        <div className="text-center">
          <div className="text-3xl font-bold text-neutral-900">
            {new Date().toLocaleTimeString('ko-KR', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            })}
          </div>
          <div className="text-sm text-neutral-600">
            {new Date().toLocaleDateString('ko-KR', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
        </div>

        {/* Status */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-neutral-700">현재 상태</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              currentStatus === 'in' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {currentStatus === 'in' ? '근무중' : '퇴근'}
            </span>
          </div>
          
          {currentStatus === 'in' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-neutral-600">출근시간:</span>
                <div className="font-medium">{checkInTime}</div>
              </div>
              <div>
                <span className="text-neutral-600">근무시간:</span>
                <div className="font-medium">{todayHours}시간</div>
              </div>
            </div>
          )}
        </div>

        {/* Location */}
        {location && (
          <div className="flex items-center space-x-2 text-sm text-neutral-600">
            <MapPin className="w-4 h-4" />
            <span>서울시 강남구 테헤란로 (정확도: 높음)</span>
          </div>
        )}

        {/* Action Button */}
        <Button
          fullWidth
          variant={currentStatus === 'out' ? 'primary' : 'secondary'}
          onClick={() => handleAttendance(currentStatus === 'out' ? 'in' : 'out')}
          className={currentStatus === 'out' ? '' : 'bg-orange-500 hover:bg-orange-600 text-white'}
        >
          {currentStatus === 'out' ? '출근하기' : '퇴근하기'}
        </Button>
      </CardContent>
    </Card>
  )
}

function EmployeeProfileCard() {
  const employee = {
    id: '1',
    name: '김철수',
    position: '시니어 개발자',
    department: '기술팀',
    email: 'kimcs@motionconnect.kr',
    phone: '010-1234-5678',
    joinDate: '2020-03-15',
    status: 'active' as const
  }

  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="space-y-4">
      {/* Basic Employee Card */}
      <EmployeeCard
        name={employee.name}
        position={employee.position}
        department={employee.department}
        email={employee.email}
        status={employee.status}
        onEdit={() => alert('Edit employee')}
        onView={() => setShowDetails(!showDetails)}
      />

      {/* Detailed Profile Card */}
      {showDetails && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold text-xl">
                  {employee.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1">
                <CardTitle level={3}>{employee.name}</CardTitle>
                <p className="text-purple-600">{employee.position}</p>
                <p className="text-sm text-neutral-600">{employee.department}</p>
              </div>
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900">연락처 정보</h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm">{employee.email}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm">{employee.phone}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Building className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm">서울 본사 5층</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-neutral-900">근무 정보</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">입사일</span>
                    <span className="text-sm font-medium">2020.03.15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">근무년수</span>
                    <span className="text-sm font-medium">4년 5개월</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">직급</span>
                    <span className="text-sm font-medium">{employee.position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">상태</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      재직
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                상세 정보
              </Button>
              <Button variant="outline" size="sm">
                근무 이력
              </Button>
              <Button variant="outline" size="sm">
                휴가 현황
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

function LeaveStatusWidget() {
  const leaveData = {
    totalLeave: 15,
    usedLeave: 8.5,
    remainingLeave: 6.5,
    pendingRequests: 2,
    upcomingLeave: [
      { date: '2024-08-15', type: 'annual', duration: 1, status: 'approved' },
      { date: '2024-09-02', type: 'annual', duration: 0.5, status: 'pending' }
    ]
  }

  const usagePercent = (leaveData.usedLeave / leaveData.totalLeave) * 100

  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
      <CardHeader>
        <CardTitle level={4} className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-green-600" />
          <span>휴가 현황</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Leave Summary */}
        <div className="bg-white rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">2024년 연차</span>
            <span className="text-sm text-neutral-600">
              {leaveData.usedLeave}/{leaveData.totalLeave}일
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-neutral-200 rounded-full h-3 mb-3">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${usagePercent}%` }}
            ></div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-green-600">
                {leaveData.remainingLeave}
              </div>
              <div className="text-xs text-neutral-600">잔여</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-600">
                {leaveData.usedLeave}
              </div>
              <div className="text-xs text-neutral-600">사용</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">
                {leaveData.pendingRequests}
              </div>
              <div className="text-xs text-neutral-600">대기</div>
            </div>
          </div>
        </div>

        {/* Upcoming Leave */}
        <div>
          <h5 className="font-medium mb-3">예정된 휴가</h5>
          <div className="space-y-2">
            {leaveData.upcomingLeave.map((leave, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-white rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-neutral-400" />
                  <div>
                    <div className="font-medium text-sm">
                      {new Date(leave.date).toLocaleDateString('ko-KR')}
                    </div>
                    <div className="text-xs text-neutral-600">
                      {leave.type === 'annual' ? '연차' : '반차'} · {leave.duration}일
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  leave.status === 'approved' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {leave.status === 'approved' ? '승인' : '대기'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <Button fullWidth variant="outline">
          <Calendar className="w-4 h-4 mr-2" />
          휴가 신청하기
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkTimeStats() {
  const weeklyData = [
    { day: '월', hours: 8.5, status: 'normal' },
    { day: '화', hours: 8.0, status: 'normal' },
    { day: '수', hours: 7.5, status: 'early' },
    { day: '목', hours: 9.2, status: 'overtime' },
    { day: '금', hours: 8.1, status: 'normal' }
  ]

  const totalHours = weeklyData.reduce((sum, day) => sum + day.hours, 0)
  const avgHours = totalHours / weeklyData.length

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
      <CardHeader>
        <CardTitle level={4} className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-orange-600" />
          <span>주간 근무시간</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {totalHours}h
            </div>
            <div className="text-sm text-neutral-600">총 근무시간</div>
          </div>
          <div className="bg-white rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {avgHours.toFixed(1)}h
            </div>
            <div className="text-sm text-neutral-600">평균 근무시간</div>
          </div>
        </div>

        {/* Daily Breakdown */}
        <div className="space-y-2">
          <h5 className="font-medium">일별 근무시간</h5>
          {weeklyData.map((day, index) => (
            <div key={index} className="bg-white rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{day.day}요일</span>
                <div className="flex items-center space-x-2">
                  <span className="font-bold">{day.hours}h</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    day.status === 'normal' ? 'bg-green-100 text-green-800' :
                    day.status === 'early' ? 'bg-orange-100 text-orange-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {day.status === 'normal' ? '정상' :
                     day.status === 'early' ? '조퇴' : '연장'}
                  </span>
                </div>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    day.status === 'normal' ? 'bg-green-500' :
                    day.status === 'early' ? 'bg-orange-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${(day.hours / 10) * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Weekly Goal */}
        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">주간 목표</span>
            <span className="text-sm text-neutral-600">40시간</span>
          </div>
          <div className="w-full bg-neutral-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-500 to-red-500 h-3 rounded-full"
              style={{ width: `${(totalHours / 40) * 100}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm text-neutral-600">
            {totalHours >= 40 
              ? `목표 달성! (+${(totalHours - 40).toFixed(1)}시간)`
              : `${(40 - totalHours).toFixed(1)}시간 부족`
            }
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function NotificationCenter() {
  const notifications = [
    {
      id: 1,
      title: '휴가 신청 승인',
      message: '2024년 8월 15일 연차 휴가가 승인되었습니다.',
      time: '2시간 전',
      isRead: false,
      type: 'success'
    },
    {
      id: 2,
      title: '근무시간 수정 요청',
      message: '어제 출근시간 수정 요청이 처리되었습니다.',
      time: '5시간 전',
      isRead: true,
      type: 'info'
    },
    {
      id: 3,
      title: '월급 명세서',
      message: '2024년 7월 급여 명세서가 발급되었습니다.',
      time: '1일 전',
      isRead: false,
      type: 'info'
    }
  ]

  const [notificationList, setNotificationList] = useState(notifications)
  const unreadCount = notificationList.filter(n => !n.isRead).length

  const markAsRead = (id: number) => {
    setNotificationList(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle level={4} className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <span>알림 센터</span>
          </CardTitle>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              {unreadCount}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {notificationList.map((notification) => (
          <NotificationCard
            key={notification.id}
            title={notification.title}
            message={notification.message}
            time={notification.time}
            isRead={notification.isRead}
            onMarkAsRead={() => markAsRead(notification.id)}
          />
        ))}
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm" fullWidth>
          모든 알림 보기
        </Button>
      </CardFooter>
    </Card>
  )
}

interface BusinessDemo {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

export default function BusinessComponentsShowcase() {
  const [activeDemo, setActiveDemo] = useState('attendance')
  const [showCode, setShowCode] = useState(false)

  const businessDemos: BusinessDemo[] = [
    {
      id: 'attendance',
      title: 'Attendance Widget',
      description: 'GPS 위치 기반 출퇴근 관리 위젯',
      code: codeExamples.attendanceWidget,
      component: <AttendanceWidget />
    },
    {
      id: 'employee',
      title: 'Employee Profile',
      description: '직원 정보 표시 및 관리 컴포넌트',
      code: codeExamples.employeeCard,
      component: <EmployeeProfileCard />
    },
    {
      id: 'leave',
      title: 'Leave Management',
      description: '휴가 현황 및 신청 관리 위젯',
      code: codeExamples.leaveStatus,
      component: <LeaveStatusWidget />
    },
    {
      id: 'worktime',
      title: 'Work Time Analytics',
      description: '근무시간 통계 및 분석 대시보드',
      code: codeExamples.attendanceWidget, // placeholder
      component: <WorkTimeStats />
    },
    {
      id: 'notifications',
      title: 'Notification Center',
      description: 'HR 시스템 알림 및 공지사항 센터',
      code: codeExamples.attendanceWidget, // placeholder
      component: <NotificationCenter />
    }
  ]

  const currentDemo = businessDemos.find(demo => demo.id === activeDemo)

  return (
    <div className="space-y-6">
      {/* Demo Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
        {businessDemos.map((demo) => (
          <button
            key={demo.id}
            onClick={() => setActiveDemo(demo.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeDemo === demo.id
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {demo.title}
          </button>
        ))}
      </div>

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">{currentDemo?.title}</h3>
          <p className="text-neutral-600 mt-1">{currentDemo?.description}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCode(!showCode)}
          startIcon={showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        >
          {showCode ? '코드 숨기기' : '코드 보기'}
        </Button>
      </div>

      {/* Code Display */}
      {showCode && (
        <Card className="bg-neutral-900">
          <CardContent>
            <pre className="text-green-400 text-sm overflow-x-auto">
              <code>{currentDemo?.code}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Demo Component */}
      <div className="max-w-md mx-auto">
        {currentDemo?.component}
      </div>

      {/* Business Logic Guidelines */}
      <Card className="bg-violet-50 border-violet-200">
        <CardHeader>
          <CardTitle level={4} className="text-violet-800">
            🏢 비즈니스 컴포넌트 설계 원칙
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-violet-700 space-y-2">
            {activeDemo === 'attendance' && (
              <>
                <p>• GPS 위치 정보를 활용하여 출퇴근 기록의 신뢰성을 확보하세요</p>
                <p>• 현재 상태를 명확히 표시하여 사용자 혼동을 방지하세요</p>
                <p>• 오프라인 상황을 고려한 데이터 동기화 전략을 수립하세요</p>
              </>
            )}
            {activeDemo === 'employee' && (
              <>
                <p>• 민감한 개인정보는 권한에 따라 선택적으로 표시하세요</p>
                <p>• 직원 상태 변화를 시각적으로 명확히 구분하세요</p>
                <p>• 빠른 액션을 위한 바로가기 버튼을 제공하세요</p>
              </>
            )}
            {activeDemo === 'leave' && (
              <>
                <p>• 연도별 휴가 정책 변경을 고려한 유연한 구조를 설계하세요</p>
                <p>• 휴가 잔여일수를 시각적 진행률로 직관적으로 표시하세요</p>
                <p>• 승인 대기 중인 휴가와 확정된 휴가를 명확히 구분하세요</p>
              </>
            )}
            {activeDemo === 'worktime' && (
              <>
                <p>• 주간/월간 목표 대비 실제 근무시간을 비교 분석하세요</p>
                <p>• 초과근무나 부족근무를 색상으로 시각적 피드백을 제공하세요</p>
                <p>• 근무 패턴 분석을 통한 생산성 개선 인사이트를 제공하세요</p>
              </>
            )}
            {activeDemo === 'notifications' && (
              <>
                <p>• 알림의 우선순위와 카테고리를 명확히 구분하세요</p>
                <p>• 읽지 않은 알림 수를 시각적으로 강조하여 표시하세요</p>
                <p>• 알림 내용에 따른 적절한 액션 버튼을 제공하세요</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Integration Notes */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle level={4} className="text-gray-800">
            🔗 시스템 연동 고려사항
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-700 space-y-3">
            <div>
              <h5 className="font-semibold mb-2">데이터 동기화</h5>
              <p>• 실시간 데이터 업데이트와 캐싱 전략의 균형을 고려하세요</p>
              <p>• 오프라인 모드에서의 데이터 처리 방안을 수립하세요</p>
            </div>
            <div>
              <h5 className="font-semibold mb-2">사용자 권한</h5>
              <p>• 역할 기반 접근 제어(RBAC)를 컴포넌트 레벨에서 구현하세요</p>
              <p>• 민감한 정보는 권한에 따라 마스킹 처리하세요</p>
            </div>
            <div>
              <h5 className="font-semibold mb-2">성능 최적화</h5>
              <p>• 대용량 데이터 처리 시 가상화나 페이지네이션을 활용하세요</p>
              <p>• 불필요한 API 호출을 방지하기 위한 디바운싱을 적용하세요</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
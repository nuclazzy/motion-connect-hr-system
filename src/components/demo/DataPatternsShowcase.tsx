'use client'

import { useState } from 'react'
import { 
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  StatsCard,
  Input,
  SearchInput
} from '@/components/ui'
import { 
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Download,
  MoreVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Users,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react'

// Demo data
const employees = [
  { id: 1, name: '김철수', department: '개발팀', position: '시니어 개발자', status: 'active', salary: 6500000, joinDate: '2020-03-15' },
  { id: 2, name: '박영희', department: '디자인팀', position: 'UX 디자이너', status: 'active', salary: 5500000, joinDate: '2021-08-22' },
  { id: 3, name: '이민호', department: '마케팅팀', position: '마케팅 매니저', status: 'on-leave', salary: 5800000, joinDate: '2019-11-03' },
  { id: 4, name: '최지영', department: '인사팀', position: '인사담당자', status: 'active', salary: 4800000, joinDate: '2022-01-10' },
  { id: 5, name: '장민석', department: '개발팀', position: '주니어 개발자', status: 'active', salary: 4200000, joinDate: '2023-06-01' }
]

const attendanceData = [
  { date: '2024-08-09', checkIn: '09:15', checkOut: '18:30', workHours: 8.25, status: 'normal' },
  { date: '2024-08-08', checkIn: '09:00', checkOut: '18:00', workHours: 8.0, status: 'normal' },
  { date: '2024-08-07', checkIn: '09:30', checkOut: '17:45', workHours: 7.25, status: 'early' },
  { date: '2024-08-06', checkIn: '08:45', checkOut: '19:15', workHours: 9.5, status: 'overtime' },
  { date: '2024-08-05', checkIn: '10:00', checkOut: '18:30', workHours: 7.5, status: 'late' }
]

const codeExamples = {
  dataTable: `// Data Table Component
<DataTable
  columns={[
    { key: 'name', label: '이름', sortable: true },
    { key: 'department', label: '부서', filterable: true },
    { key: 'status', label: '상태', render: StatusBadge }
  ]}
  data={employees}
  searchable={true}
  pagination={{ pageSize: 10, currentPage: 1 }}
  onSort={(key, direction) => {}}
  onFilter={(filters) => {}}
/>`,

  statsDisplay: `// Statistics Display
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  <StatsCard
    title="총 직원"
    value="127"
    change="+5 this month"
    trend="up"
    icon={<Users />}
  />
  <StatsCard
    title="출근율"
    value="96.8%"
    change="stable"
    trend="neutral"
    icon={<Calendar />}
  />
</div>`,

  listPattern: `// List Pattern with Actions
<div className="space-y-2">
  {items.map(item => (
    <Card key={item.id} className="hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between p-4">
        <div className="flex-1">
          <h4 className="font-medium">{item.title}</h4>
          <p className="text-sm text-neutral-600">{item.subtitle}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  ))}
</div>`
}

// Reusable Components
interface DataTableProps {
  data: any[]
  columns: Array<{
    key: string
    label: string
    sortable?: boolean
    filterable?: boolean
    render?: (value: any, row: any) => React.ReactNode
  }>
  searchable?: boolean
  pagination?: {
    pageSize: number
    currentPage: number
    totalPages: number
  }
}

function DataTable({ data, columns, searchable = false, pagination }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { label: '재직', className: 'bg-green-100 text-green-800' },
      'on-leave': { label: '휴직', className: 'bg-yellow-100 text-yellow-800' },
      inactive: { label: '퇴사', className: 'bg-gray-100 text-gray-800' },
      normal: { label: '정상', className: 'bg-green-100 text-green-800' },
      late: { label: '지각', className: 'bg-red-100 text-red-800' },
      early: { label: '조퇴', className: 'bg-orange-100 text-orange-800' },
      overtime: { label: '초과근무', className: 'bg-blue-100 text-blue-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="flex items-center space-x-4">
          <SearchInput
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            필터
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            내보내기
          </Button>
        </div>
      )}
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider ${
                      column.sortable ? 'cursor-pointer hover:bg-neutral-100' : ''
                    }`}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <div className="flex flex-col">
                          <ArrowUp
                            className={`w-3 h-3 ${
                              sortKey === column.key && sortDirection === 'asc'
                                ? 'text-primary-600'
                                : 'text-neutral-400'
                            }`}
                          />
                          <ArrowDown
                            className={`w-3 h-3 -mt-1 ${
                              sortKey === column.key && sortDirection === 'desc'
                                ? 'text-primary-600'
                                : 'text-neutral-400'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-neutral-50">
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]?.toLocaleString?.() || row[column.key]
                      }
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {pagination && (
          <div className="px-6 py-3 bg-neutral-50 flex items-center justify-between">
            <div className="text-sm text-neutral-700">
              총 {data.length}개 항목
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-neutral-700">
                {pagination.currentPage} / {pagination.totalPages}
              </span>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function MetricsDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="총 직원"
          value="127"
          change="+5 this month"
          trend="up"
          icon={<Users className="w-6 h-6" />}
        />
        <StatsCard
          title="출근율"
          value="96.8%"
          change="stable"
          trend="neutral"
          icon={<Calendar className="w-6 h-6" />}
        />
        <StatsCard
          title="평균 근무시간"
          value="8.2h"
          change="-0.3h from last month"
          trend="down"
          icon={<Clock className="w-6 h-6" />}
        />
        <StatsCard
          title="휴가 사용률"
          value="73%"
          change="+12% improvement"
          trend="up"
          icon={<CheckCircle className="w-6 h-6" />}
        />
      </div>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle level={4}>부서별 인원 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: '개발팀', count: 45, percentage: 35 },
                { name: '디자인팀', count: 18, percentage: 14 },
                { name: '마케팅팀', count: 25, percentage: 20 },
                { name: '인사팀', count: 12, percentage: 9 },
                { name: '기타', count: 27, percentage: 22 }
              ].map((dept) => (
                <div key={dept.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                    <span className="text-sm font-medium">{dept.name}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-24 bg-neutral-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full"
                        style={{ width: `${dept.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-neutral-600 w-8">{dept.count}명</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle level={4}>최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { icon: CheckCircle, text: '김철수님이 연차를 신청했습니다', time: '5분 전', type: 'success' },
                { icon: AlertCircle, text: '박영희님의 근무시간 수정이 필요합니다', time: '1시간 전', type: 'warning' },
                { icon: Users, text: '새로운 직원 3명이 추가되었습니다', time: '2시간 전', type: 'info' },
                { icon: XCircle, text: '시스템 점검이 예정되어 있습니다', time: '3시간 전', type: 'error' }
              ].map((activity, index) => {
                const Icon = activity.icon
                const typeColors = {
                  success: 'text-green-600 bg-green-100',
                  warning: 'text-yellow-600 bg-yellow-100',
                  info: 'text-blue-600 bg-blue-100',
                  error: 'text-red-600 bg-red-100'
                }
                return (
                  <div key={index} className="flex items-start space-x-3">
                    <div className={`p-2 rounded-full ${typeColors[activity.type as keyof typeof typeColors]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900">{activity.text}</p>
                      <p className="text-xs text-neutral-500">{activity.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface DataDemo {
  id: string
  title: string
  description: string
  component: React.ReactNode
  code: string
}

export default function DataPatternsShowcase() {
  const [activeDemo, setActiveDemo] = useState('table')
  const [showCode, setShowCode] = useState(false)

  const dataDemos: DataDemo[] = [
    {
      id: 'table',
      title: 'Data Tables',
      description: '정렬, 필터링, 검색이 가능한 데이터 테이블',
      code: codeExamples.dataTable,
      component: (
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold mb-4">직원 목록 테이블</h4>
            <DataTable
              data={employees}
              columns={[
                { key: 'name', label: '이름', sortable: true },
                { key: 'department', label: '부서', sortable: true },
                { key: 'position', label: '직급', sortable: true },
                { 
                  key: 'status', 
                  label: '상태', 
                  render: (value) => <StatusBadge status={value} />
                },
                { 
                  key: 'salary', 
                  label: '급여', 
                  sortable: true,
                  render: (value) => `₩${value.toLocaleString()}`
                },
                { key: 'joinDate', label: '입사일', sortable: true }
              ]}
              searchable={true}
              pagination={{ pageSize: 10, currentPage: 1, totalPages: 1 }}
            />
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">출근 기록 테이블</h4>
            <DataTable
              data={attendanceData}
              columns={[
                { key: 'date', label: '날짜', sortable: true },
                { key: 'checkIn', label: '출근', sortable: true },
                { key: 'checkOut', label: '퇴근', sortable: true },
                { 
                  key: 'workHours', 
                  label: '근무시간', 
                  sortable: true,
                  render: (value) => `${value}시간`
                },
                { 
                  key: 'status', 
                  label: '상태',
                  render: (value) => <StatusBadge status={value} />
                }
              ]}
              searchable={false}
              pagination={{ pageSize: 10, currentPage: 1, totalPages: 1 }}
            />
          </div>
        </div>
      )
    },
    {
      id: 'stats',
      title: 'Statistics Display',
      description: 'KPI와 주요 지표를 표시하는 통계 대시보드',
      code: codeExamples.statsDisplay,
      component: <MetricsDashboard />
    },
    {
      id: 'lists',
      title: 'List Patterns',
      description: '액션이 포함된 리스트 패턴과 카드 리스트',
      code: codeExamples.listPattern,
      component: (
        <div className="space-y-8">
          <div>
            <h4 className="text-lg font-semibold mb-4">액션 리스트</h4>
            <div className="space-y-2">
              {[
                { title: '휴가 신청서', subtitle: '김철수 - 2024.08.15 ~ 2024.08.16', status: 'pending' },
                { title: '근무시간 수정 요청', subtitle: '박영희 - 2024.08.08 출근시간 변경', status: 'approved' },
                { title: '초과근무 신청', subtitle: '이민호 - 프로젝트 마감으로 인한 연장근무', status: 'rejected' }
              ].map((item, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-start space-x-4">
                      <div className="mt-1">
                        {item.status === 'pending' && <AlertCircle className="w-5 h-5 text-yellow-500" />}
                        {item.status === 'approved' && <CheckCircle className="w-5 h-5 text-green-500" />}
                        {item.status === 'rejected' && <XCircle className="w-5 h-5 text-red-500" />}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-neutral-900">{item.title}</h4>
                        <p className="text-sm text-neutral-600 mt-1">{item.subtitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">컴팩트 리스트</h4>
            <Card>
              <div className="divide-y divide-neutral-200">
                {[
                  { name: '김철수', department: '개발팀', lastLogin: '2시간 전' },
                  { name: '박영희', department: '디자인팀', lastLogin: '5시간 전' },
                  { name: '이민호', department: '마케팅팀', lastLogin: '1일 전' },
                  { name: '최지영', department: '인사팀', lastLogin: '3시간 전' }
                ].map((user, index) => (
                  <div key={index} className="px-6 py-4 hover:bg-neutral-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-medium text-sm">
                            {user.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">{user.name}</p>
                          <p className="text-sm text-neutral-600">{user.department}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-neutral-600">마지막 접속</p>
                        <p className="text-sm font-medium">{user.lastLogin}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )
    }
  ]

  const currentDemo = dataDemos.find(demo => demo.id === activeDemo)
  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { label: '재직', className: 'bg-green-100 text-green-800' },
      'on-leave': { label: '휴직', className: 'bg-yellow-100 text-yellow-800' },
      inactive: { label: '퇴사', className: 'bg-gray-100 text-gray-800' },
      normal: { label: '정상', className: 'bg-green-100 text-green-800' },
      late: { label: '지각', className: 'bg-red-100 text-red-800' },
      early: { label: '조퇴', className: 'bg-orange-100 text-orange-800' },
      overtime: { label: '초과근무', className: 'bg-blue-100 text-blue-800' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Demo Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-neutral-100 rounded-lg">
        {dataDemos.map((demo) => (
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
      <div>
        {currentDemo?.component}
      </div>

      {/* Data Guidelines */}
      <Card className="bg-emerald-50 border-emerald-200">
        <CardHeader>
          <CardTitle level={4} className="text-emerald-800">
            📊 데이터 표시 가이드라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-emerald-700 space-y-2">
            {activeDemo === 'table' && (
              <>
                <p>• 테이블은 대량의 구조화된 데이터 표시에 적합합니다</p>
                <p>• 정렬, 필터링, 검색 기능을 제공하여 사용자 경험을 향상시키세요</p>
                <p>• 상태나 범주형 데이터는 배지나 색상으로 시각적 구분을 제공하세요</p>
              </>
            )}
            {activeDemo === 'stats' && (
              <>
                <p>• KPI는 한눈에 파악할 수 있도록 큰 숫자와 트렌드 표시를 활용하세요</p>
                <p>• 색상을 일관되게 사용하여 긍정적/부정적 변화를 구분하세요</p>
                <p>• 관련 지표들을 그룹화하여 대시보드를 구성하세요</p>
              </>
            )}
            {activeDemo === 'lists' && (
              <>
                <p>• 리스트는 관련 항목들의 스캔 가능한 개요를 제공합니다</p>
                <p>• 액션 버튼은 일관된 위치에 배치하고 아이콘으로 의미를 명확히 하세요</p>
                <p>• 호버 상태를 제공하여 인터랙티브 요소임을 명확히 표시하세요</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
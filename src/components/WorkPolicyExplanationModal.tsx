'use client'

import { useState } from 'react'
import { X, Clock, Moon, Sun, Calendar, Calculator } from 'lucide-react'

interface WorkPolicyExplanationModalProps {
  isOpen: boolean
  onClose: () => void
  policyType?: 'flexible' | 'overtime' | 'leave' | null
}

export default function WorkPolicyExplanationModal({ 
  isOpen, 
  onClose, 
  policyType = null 
}: WorkPolicyExplanationModalProps) {
  const [activeTab, setActiveTab] = useState<'flexible' | 'overtime' | 'leave'>(
    policyType || 'flexible'
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold text-gray-900">
              📋 근무정책 안내
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* 탭 메뉴 */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('flexible')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'flexible'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-2" />
                탄력근무제
              </button>
              <button
                onClick={() => setActiveTab('overtime')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overtime'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Moon className="w-4 h-4 inline mr-2" />
                야간/초과근무
              </button>
              <button
                onClick={() => setActiveTab('leave')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'leave'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                대체/보상휴가
              </button>
            </nav>
          </div>
        </div>

        <div className="p-6">
          {/* 탄력근무제 탭 */}
          {activeTab === 'flexible' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start">
                  <Clock className="w-6 h-6 text-blue-500 mr-3 mt-1" />
                  <div>
                    <h4 className="text-lg font-semibold text-blue-900 mb-3">💡 탄력근무제란?</h4>
                    <p className="text-blue-800 mb-4 leading-relaxed">
                      일정 기간(보통 1개월~3개월) 동안 주당 평균 근무시간을 40시간으로 맞추면서, 
                      일별 근무시간을 탄력적으로 조정할 수 있는 제도입니다.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-blue-100 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-900 mb-2">✅ 장점</h5>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• 업무량에 따른 유연한 근무시간 조정</li>
                          <li>• 워라밸 개선 및 개인 스케줄 관리</li>
                          <li>• 피크 타임 효율적 인력 배치</li>
                          <li>• 직원 만족도 및 생산성 향상</li>
                        </ul>
                      </div>
                      
                      <div className="bg-blue-100 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-900 mb-2">📋 운영 방식</h5>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• 핵심시간(코어타임) 설정 가능</li>
                          <li>• 최소/최대 일일 근무시간 제한</li>
                          <li>• 정산 주기별 총 근무시간 관리</li>
                          <li>• 초과근무는 정산 주기 종료 후 계산</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h5 className="font-semibold text-blue-900 mb-3 flex items-center">
                        <Calculator className="w-4 h-4 mr-2" />
                        계산 예시
                      </h5>
                      <div className="text-sm text-blue-800">
                        <p className="mb-2"><strong>4주 탄력근무제 적용 시:</strong></p>
                        <div className="bg-blue-50 p-3 rounded">
                          <p>• 1주차: 30시간 근무 (10시간 부족)</p>
                          <p>• 2주차: 45시간 근무 (5시간 초과)</p>
                          <p>• 3주차: 40시간 근무 (정상)</p>
                          <p>• 4주차: 45시간 근무 (5시간 초과)</p>
                          <p className="font-semibold mt-2 text-blue-900">
                            → 총 160시간 = 정상 (4주×40시간), 초과근무 없음
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 야간/초과근무 탭 */}
          {activeTab === 'overtime' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                <div className="flex items-start">
                  <Moon className="w-6 h-6 text-orange-500 mr-3 mt-1" />
                  <div className="w-full">
                    <h4 className="text-lg font-semibold text-orange-900 mb-4">🌙 야간근무 & ⏰ 초과근무 계산</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-orange-100 rounded-lg p-4">
                        <h5 className="font-semibold text-orange-900 mb-3 flex items-center">
                          <Moon className="w-4 h-4 mr-2" />
                          야간근무 계산
                        </h5>
                        <div className="text-sm text-orange-800 space-y-2">
                          <p><strong>적용 시간:</strong> 22:00 ~ 06:00</p>
                          <p><strong>가산율:</strong> 기본 시급 + 50% 추가</p>
                          <div className="bg-orange-200 p-3 rounded mt-3">
                            <p className="font-semibold">💰 계산 예시</p>
                            <p>시급 10,000원 × 야간 4시간</p>
                            <p>= (10,000원 × 4시간) + (10,000원 × 0.5 × 4시간)</p>
                            <p className="font-bold text-orange-900">= 40,000원 + 20,000원 = 60,000원</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-orange-100 rounded-lg p-4">
                        <h5 className="font-semibold text-orange-900 mb-3 flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          초과근무 계산
                        </h5>
                        <div className="text-sm text-orange-800 space-y-2">
                          <p><strong>적용 기준:</strong> 8시간 초과 근무 시</p>
                          <p><strong>가산율:</strong> 기본 시급 × 150%</p>
                          <div className="bg-orange-200 p-3 rounded mt-3">
                            <p className="font-semibold">💰 계산 예시</p>
                            <p>10시간 근무 (8시간 + 2시간 초과)</p>
                            <p>= (10,000원 × 8시간) + (10,000원 × 1.5 × 2시간)</p>
                            <p className="font-bold text-orange-900">= 80,000원 + 30,000원 = 110,000원</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-orange-200 rounded-lg p-4">
                      <h5 className="font-semibold text-orange-900 mb-3">⏱️ 휴게시간 자동 차감</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-orange-800">
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="font-semibold">4시간 근무</p>
                          <p>휴게시간 30분 차감</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="font-semibold">8시간 근무</p>
                          <p>휴게시간 1시간 차감</p>
                        </div>
                        <div className="bg-orange-50 p-3 rounded">
                          <p className="font-semibold">6시간 이상 근무</p>
                          <p>저녁식사 1시간 차감</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 대체/보상휴가 탭 */}
          {activeTab === 'leave' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start">
                  <Calendar className="w-6 h-6 text-green-500 mr-3 mt-1" />
                  <div className="w-full">
                    <h4 className="text-lg font-semibold text-green-900 mb-4">📅 대체/보상휴가 계산 방식</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                        <h5 className="font-semibold text-green-900 mb-3 flex items-center">
                          <Sun className="w-4 h-4 mr-2" />
                          🗓️ 토요일 대체휴가
                        </h5>
                        <div className="text-sm text-green-800 space-y-2">
                          <div className="bg-green-200 p-3 rounded">
                            <p className="font-semibold mb-2">계산 공식</p>
                            <p>• <strong>8시간 이하:</strong> 1:1 비율</p>
                            <p>• <strong>8시간 초과:</strong> 8시간 + (초과분×1.5배)</p>
                            <p>• <strong>야간근무:</strong> +0.5배 추가</p>
                          </div>
                          <div className="bg-white border border-green-300 p-3 rounded">
                            <p className="font-semibold text-green-900">📊 예시</p>
                            <p>토요일 10시간 근무</p>
                            <p>= 8시간 + (2시간 × 1.5배)</p>
                            <p className="font-bold">= 8 + 3 = 11시간 대체휴가</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                        <h5 className="font-semibold text-green-900 mb-3 flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          🎊 일요일/공휴일 보상휴가
                        </h5>
                        <div className="text-sm text-green-800 space-y-2">
                          <div className="bg-green-200 p-3 rounded">
                            <p className="font-semibold mb-2">계산 공식</p>
                            <p>• <strong>8시간 이하:</strong> 1.5배 비율</p>
                            <p>• <strong>8시간 초과:</strong> (8×1.5) + (초과분×2.0배)</p>
                            <p>• <strong>야간근무:</strong> +0.5배 추가</p>
                          </div>
                          <div className="bg-white border border-green-300 p-3 rounded">
                            <p className="font-semibold text-green-900">📊 예시</p>
                            <p>일요일 10시간 근무</p>
                            <p>= (8시간 × 1.5배) + (2시간 × 2.0배)</p>
                            <p className="font-bold">= 12 + 4 = 16시간 보상휴가</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-green-200 rounded-lg p-4">
                      <h5 className="font-semibold text-green-900 mb-3">⚠️ 주의사항 및 제한</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-800">
                        <div>
                          <h6 className="font-semibold mb-2">📊 적립 제한</h6>
                          <ul className="space-y-1">
                            <li>• 대체휴가: 최대 240시간</li>
                            <li>• 보상휴가: 최대 240시간</li>
                            <li>• 초과 시 자동 소멸</li>
                          </ul>
                        </div>
                        <div>
                          <h6 className="font-semibold mb-2">⏰ 소멸 시효</h6>
                          <ul className="space-y-1">
                            <li>• 발생일로부터 12개월</li>
                            <li>• 미사용 시 자동 소멸</li>
                            <li>• 정기적인 사용 권장</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <h5 className="font-semibold text-blue-900 mb-2">💡 활용 팁</h5>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• 대체/보상휴가는 연차와 별도로 관리됩니다</li>
                        <li>• 휴가 신청 시 대체/보상휴가를 우선 사용하는 것을 권장합니다</li>
                        <li>• 소멸 예정인 휴가가 있다면 미리 계획을 세워 사용하세요</li>
                        <li>• 휴가 잔여량은 직원 대시보드에서 실시간 확인 가능합니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="flex justify-end pt-6 border-t border-gray-200">
            <button
              onClick={onClose}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
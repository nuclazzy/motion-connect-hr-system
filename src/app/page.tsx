'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      
      if (user) {
        // 로그인된 사용자는 역할에 따라 대시보드로 리다이렉트
        if (user.role === 'admin') {
          router.push('/admin')
        } else {
          router.push('/user')
        }
      } else {
        // 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
        router.push('/auth/login')
      }
    }

    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Motion Connect</h1>
        <p className="text-gray-600">로딩 중...</p>
      </div>
    </div>
  )
}

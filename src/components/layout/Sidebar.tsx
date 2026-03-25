'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const nav = [
  { href: '/sales', label: '매출 현황', icon: '💰' },
  { href: '/vendors', label: '거래처 DB', icon: '🏢' },
  { href: '/payments', label: '지급 관리', icon: '📋' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role === 'admin') setIsAdmin(true)
        })
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-200 flex flex-col fixed left-0 top-0">
      {/* 로고 */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-sm font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">유어메이트</p>
            <p className="text-xs text-gray-400">운영 시스템</p>
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'font-semibold text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={isActive ? { backgroundColor: '#FFCE00' } : {}}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}

        {isAdmin && (
          <>
            <div className="border-t border-gray-100 my-2" />
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/admin')
                  ? 'font-semibold text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
              style={pathname.startsWith('/admin') ? { backgroundColor: '#FFCE00' } : {}}
            >
              <span className="text-base">⚙️</span>
              <span>팀원 관리</span>
            </Link>
          </>
        )}
      </nav>

      {/* 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
        >
          <span className="text-base">🚪</span>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}

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
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single()
        .then(({ data }) => { if (data?.role === 'admin') setIsAdmin(true) })
    })
  }, [])

  // 페이지 이동 시 모바일 메뉴 닫기
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navContent = (
    <>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                pathname.startsWith('/admin') ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
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
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
        >
          <span className="text-base">🚪</span>
          <span>로그아웃</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden md:flex w-60 min-h-screen bg-white border-r border-gray-200 flex-col fixed left-0 top-0">
        {navContent}
      </aside>

      {/* 모바일 상단 바 */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center px-4 h-14">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <span className="text-sm font-bold text-gray-900">유어메이트</span>
        </div>
      </div>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          {/* 드로어 */}
          <aside className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
                  <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
                </div>
                <span className="text-sm font-bold text-gray-900">유어메이트</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {nav.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                      isActive ? 'font-semibold text-gray-900' : 'text-gray-500'
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
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                      pathname.startsWith('/admin') ? 'font-semibold text-gray-900' : 'text-gray-500'
                    }`}
                    style={pathname.startsWith('/admin') ? { backgroundColor: '#FFCE00' } : {}}
                  >
                    <span className="text-base">⚙️</span>
                    <span>팀원 관리</span>
                  </Link>
                </>
              )}
            </nav>
            <div className="px-3 py-4 border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-500 w-full"
              >
                <span className="text-base">🚪</span>
                <span>로그아웃</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

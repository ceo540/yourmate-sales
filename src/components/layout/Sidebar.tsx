'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const nav = [
  { href: '/dashboard', label: '대시보드', icon: '🏠' },
  { href: '/sales', label: '매출 현황', icon: '💰' },
  { href: '/sales/report', label: '매출 보고서', icon: '📄' },
  { href: '/receivables', label: '미수금 현황', icon: '🔔' },
  { href: '/vendors', label: '거래처 DB', icon: '🏢' },
  { href: '/payments', label: '지급 관리', icon: '📋' },
]

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자', manager: '팀장', member: '팀원',
}
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-yellow-100 text-yellow-800',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-500',
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role, name').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role === 'admin') setIsAdmin(true)
          setUserName(data?.name ?? '')
          setUserRole(data?.role ?? 'member')
        })
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
          const isActive = pathname === item.href ||
            (pathname.startsWith(item.href + '/') && !nav.some(o => o.href !== item.href && pathname.startsWith(o.href)))
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
            {[
              { href: '/finance', label: '재무 현황', icon: '📈' },
              { href: '/payroll', label: '인건비 관리', icon: '💼' },
              { href: '/fixed-costs', label: '고정비 관리', icon: '🔒' },
              { href: '/cashflow', label: '자금일보', icon: '📊' },
              { href: '/admin', label: '팀원 관리', icon: '⚙️' },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  pathname.startsWith(item.href) ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
                style={pathname.startsWith(item.href) ? { backgroundColor: '#FFCE00' } : {}}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* 소개 */}
      <div className="px-3 pb-2">
        <Link
          href="/about"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            pathname === '/about' ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
          }`}
          style={pathname === '/about' ? { backgroundColor: '#FFCE00' } : {}}
        >
          <span className="text-base">❓</span>
          <span>시스템 소개</span>
        </Link>
      </div>

      {/* 유저 정보 + 로그아웃 */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        {userName && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-gray-600">{userName[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[userRole] ?? ROLE_COLORS.member}`}>
                {ROLE_LABELS[userRole] ?? '팀원'}
              </span>
            </div>
          </div>
        )}
        <Link href="/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
        >
          <span className="text-base">🔑</span>
          <span>비밀번호 변경</span>
        </Link>
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
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-xl">×</button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5">
              {nav.map((item) => {
                const isActive = pathname === item.href ||
                  (pathname.startsWith(item.href + '/') && !nav.some(o => o.href !== item.href && pathname.startsWith(o.href)))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
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
                  {[
                    { href: '/finance', label: '재무 현황', icon: '📈' },
                    { href: '/payroll', label: '인건비 관리', icon: '💼' },
                    { href: '/cashflow', label: '자금일보', icon: '📊' },
                    { href: '/admin', label: '팀원 관리', icon: '⚙️' },
                  ].map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                        pathname.startsWith(item.href) ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      style={pathname.startsWith(item.href) ? { backgroundColor: '#FFCE00' } : {}}
                    >
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </>
              )}
            </nav>
            <div className="px-3 py-4 border-t border-gray-100 space-y-1">
              {userName && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-gray-600">{userName[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{userName}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[userRole] ?? ROLE_COLORS.member}`}>
                      {ROLE_LABELS[userRole] ?? '팀원'}
                    </span>
                  </div>
                </div>
              )}
              <Link href="/profile"
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
              >
                <span className="text-base">🔑</span>
                <span>비밀번호 변경</span>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors"
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

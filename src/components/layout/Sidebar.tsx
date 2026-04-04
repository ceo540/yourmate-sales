'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface NavItem {
  href: string
  label: string
  icon: string
  pageKey: string
  adminOnly?: boolean
  demo?: boolean
}

// ─────────────────────────────────────────────────────────────────
// 메뉴 구조
// 새 카테고리 추가: 아래 객체에 키와 아이템 배열 추가하면 끝
// ─────────────────────────────────────────────────────────────────
const NAV_GROUPS: Record<string, NavItem[]> = {
  영업: [
    { href: '/dashboard',    label: '대시보드',  icon: '🏠', pageKey: 'dashboard' },
    { href: '/sales',        label: '매출 현황', icon: '💰', pageKey: 'sales' },
    { href: '/sales/report', label: '계약 목록', icon: '📄', pageKey: 'sales_report' },
    { href: '/leads',        label: '리드 관리', icon: '📥', pageKey: 'leads' },
    { href: '/rentals',      label: '렌탈 관리', icon: '🎸', pageKey: 'rentals' },
    { href: '/tasks',        label: '업무 관리', icon: '✅', pageKey: 'tasks' },
  ],
  재무: [
    { href: '/receivables',  label: '미수금 현황', icon: '🔔', pageKey: 'receivables' },
    { href: '/payments',     label: '지급 관리',   icon: '📋', pageKey: 'payments',    adminOnly: true },
    { href: '/finance',      label: '재무 현황',   icon: '📈', pageKey: 'finance',     adminOnly: true },
    { href: '/payroll',      label: '인건비 관리', icon: '💼', pageKey: 'payroll',     adminOnly: true },
    { href: '/fixed-costs',  label: '고정비 관리', icon: '🔒', pageKey: 'fixed_costs', adminOnly: true },
    { href: '/cashflow',     label: '자금일보',    icon: '📊', pageKey: 'cashflow',    adminOnly: true },
  ],
  관리: [
    { href: '/customers',    label: '고객 DB',   icon: '🗂️', pageKey: 'customers' },
    { href: '/vendors',      label: '거래처 DB', icon: '🏢', pageKey: 'vendors' },
    { href: '/admin',        label: '팀원 관리', icon: '⚙️', pageKey: 'admin_panel', adminOnly: true },
  ],
  팀: [
    { href: '/notice',             label: '공지사항', icon: '📢', pageKey: 'notice' },
    { href: '/calendar-demo',     label: '캘린더',   icon: '📅', pageKey: 'calendar',      demo: true },
    { href: '/weekly-report-demo',label: '주간보고', icon: '📝', pageKey: 'weekly_report', demo: true },
    { href: '/attendance',         label: '근태 관리', icon: '⏰', pageKey: 'attendance' },
    { href: '/hr',                 label: '연차 관리', icon: '🏖️', pageKey: 'hr' },
    { href: '/expenses',           label: '경비 처리', icon: '💳', pageKey: 'expenses' },
  ],
}

const CATEGORIES = Object.keys(NAV_GROUPS)

function detectCategory(pathname: string): string {
  for (const cat of CATEGORIES) {
    const items = NAV_GROUPS[cat]
    const sorted = [...items].sort((a, b) => b.href.length - a.href.length)
    if (sorted.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) {
      return cat
    }
  }
  return CATEGORIES[0]
}

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

  const [activeCategory, setActiveCategory] = useState(() => detectCategory(pathname))
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('ym_is_admin') === '1'
  })
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [permissions, setPermissions] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('ym_perms') ?? '{}') } catch { return {} }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  // pathname 바뀌면 카테고리 자동 전환
  useEffect(() => {
    const cat = detectCategory(pathname)
    setActiveCategory(cat)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role, name').eq('id', user.id).single()
        .then(({ data }) => {
          const role = data?.role ?? 'member'
          const admin = role === 'admin'
          setIsAdmin(admin)
          setUserName(data?.name ?? '')
          setUserRole(role)
          localStorage.setItem('ym_is_admin', admin ? '1' : '0')
          if (admin) {
            localStorage.setItem('ym_perms', JSON.stringify({}))
            setPermissions({})
          } else {
            supabase.from('role_permissions').select('page_key, access_level').eq('role', role)
              .then(({ data: perms }) => {
                const map: Record<string, string> = {}
                for (const p of (perms ?? [])) map[p.page_key] = p.access_level
                setPermissions(map)
                localStorage.setItem('ym_perms', JSON.stringify(map))
              })
          }
        })
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isItemVisible(item: NavItem) {
    return isAdmin || (permissions[item.pageKey] ?? 'off') !== 'off'
  }

  function isItemActive(item: NavItem, allItems: NavItem[]) {
    const sorted = [...allItems].sort((a, b) => b.href.length - a.href.length)
    const activeItem = sorted.find(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    return activeItem?.href === item.href
  }

  const subItems = (NAV_GROUPS[activeCategory] ?? []).filter(isItemVisible)

  return (
    <>
      {/* ── 데스크탑: 상단 탭 바 ───────────────────────────────── */}
      <header className="hidden md:flex fixed top-0 left-0 right-0 h-12 z-40 bg-white border-b border-gray-200 items-center px-4 gap-0">
        {/* 로고 */}
        <div className="flex items-center gap-2 pr-5 border-r border-gray-100 mr-3 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <p className="text-sm font-bold text-gray-900">유어메이트</p>
        </div>

        {/* 카테고리 탭 */}
        <nav className="flex items-center h-full">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 h-full text-sm font-medium border-b-2 transition-all ${
                activeCategory === cat
                  ? 'border-yellow-400 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>

        {/* 유저 정보 */}
        <div className="ml-auto flex items-center gap-3">
          {userName && (
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-semibold text-gray-600">{userName[0]}</span>
              </div>
              <span className="text-xs text-gray-700">{userName}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[userRole] ?? ROLE_COLORS.member}`}>
                {ROLE_LABELS[userRole] ?? '팀원'}
              </span>
            </div>
          )}
          <Link href="/profile" className="text-sm text-gray-400 hover:text-gray-600 transition-colors" title="비밀번호 변경">🔑</Link>
          <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-gray-600 transition-colors" title="로그아웃">🚪</button>
        </div>
      </header>

      {/* ── 데스크탑: 서브 사이드바 ────────────────────────────── */}
      <aside className="hidden md:flex w-44 bg-white border-r border-gray-200 flex-col fixed left-0 top-12 bottom-0">
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {subItems.map(item => {
            const active = isItemActive(item, subItems)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
                style={active ? { backgroundColor: '#FFCE00' } : {}}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
                {item.demo && <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">데모</span>}
              </Link>
            )
          })}
        </nav>
        <div className="px-2 pb-3 border-t border-gray-100 pt-2">
          <Link
            href="/about"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
              pathname === '/about' ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
            }`}
            style={pathname === '/about' ? { backgroundColor: '#FFCE00' } : {}}
          >
            <span>❓</span>
            <span>시스템 소개</span>
          </Link>
        </div>
      </aside>

      {/* ── 모바일: 상단 바 ─────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 flex items-center px-4 h-12">
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

      {/* ── 모바일: 드로어 (카테고리별 그룹 표시) ──────────────── */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-white flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
                  <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
                </div>
                <span className="text-sm font-bold text-gray-900">유어메이트</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-xl px-1">×</button>
            </div>
            <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
              {CATEGORIES.map(cat => {
                const items = (NAV_GROUPS[cat] ?? []).filter(isItemVisible)
                if (items.length === 0) return null
                return (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">{cat}</p>
                    {items.map(item => {
                      const active = isItemActive(item, items)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            active ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                          style={active ? { backgroundColor: '#FFCE00' } : {}}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                          {item.demo && <span className="ml-auto text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400 font-medium">데모</span>}
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </nav>
            <div className="px-3 py-3 border-t border-gray-100 space-y-1">
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
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                <span>🔑</span><span>비밀번호 변경</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 w-full transition-colors">
                <span>🚪</span><span>로그아웃</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}

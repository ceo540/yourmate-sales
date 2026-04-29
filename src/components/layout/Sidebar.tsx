'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type NavItem = { href: string; label: string; icon: string; pageKey?: string; adminOnly?: boolean; activePrefixes?: string[] }

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: '홈',      icon: '🏠' },
  { href: '/leads',      label: '리드',    icon: '📥', pageKey: 'leads' },
  { href: '/projects',   label: '프로젝트', icon: '◈' },
  { href: '/sales',      label: '계약',    icon: '📜', pageKey: 'sales' },
  { href: '/services',   label: '서비스',   icon: '⬡', activePrefixes: ['/rentals', '/sos', '/departments'] },
  { href: '/customers',  label: '고객',    icon: '🗂️', pageKey: 'customers' },
  { href: '/calendar',   label: '캘린더',   icon: '📅' },
  { href: '/finance',    label: '재무',    icon: '📊', pageKey: 'finance', adminOnly: true },
  { href: '/team',       label: '팀',      icon: '👥', activePrefixes: ['/hr', '/attendance'] },
]

const NAV_BOTTOM: NavItem[] = [
  { href: '/notice',  label: '공지', icon: '📢', pageKey: 'notice' },
  { href: '/tasks',   label: '업무', icon: '✅', pageKey: 'tasks' },
  { href: '/admin',   label: '관리', icon: '⚙️', pageKey: 'admin_panel', adminOnly: true },
]

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자', manager: '팀장', member: '팀원',
}

function isActive(pathname: string, href: string, activePrefixes?: string[]) {
  if (href === '/dashboard') return pathname === href
  if (pathname === href || pathname.startsWith(href + '/')) return true
  return (activePrefixes ?? []).some(p => pathname === p || pathname.startsWith(p + '/'))
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [permissions, setPermissions] = useState<Record<string, string>>({})
  const [mobileOpen, setMobileOpen] = useState(false)
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({})

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role, name').eq('id', user.id).single()
        .then(async ({ data }) => {
          const role = data?.role ?? 'member'
          const admin = role === 'admin'
          setIsAdmin(admin)
          setUserName(data?.name ?? '')
          setUserRole(role)

          if (!admin) {
            supabase.from('role_permissions').select('page_key, access_level').eq('role', role)
              .then(({ data: perms }) => {
                const map: Record<string, string> = {}
                for (const p of (perms ?? [])) map[p.page_key] = p.access_level
                setPermissions(map)
              })
          }

          const today = new Date().toISOString().slice(0, 10)
          const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

          let taskQ = supabase.from('tasks').select('id', { count: 'exact', head: true })
            .not('status', 'in', '(완료,보류)').not('due_date', 'is', null).lte('due_date', sevenDays)
          if (!admin) taskQ = taskQ.eq('assignee_id', user.id)

          let leadQ = supabase.from('leads').select('id', { count: 'exact', head: true })
            .lte('remind_date', sevenDays).not('status', 'in', '(완료,취소)')
          if (!admin) leadQ = leadQ.eq('assignee_id', user.id)

          const [{ count: taskCount }, { count: leadCount }] = await Promise.all([taskQ, leadQ])
          setBadgeCounts({ tasks: taskCount ?? 0, leads: leadCount ?? 0 })
        })
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function canSee(item: { pageKey?: string; adminOnly?: boolean }) {
    if (!item.pageKey) return true
    if (item.adminOnly && !isAdmin) return false
    return isAdmin || (permissions[item.pageKey] ?? 'off') !== 'off'
  }

  function NavLink({ href, label, icon, pageKey, activePrefixes }: NavItem) {
    const active = isActive(pathname, href, activePrefixes)
    const badge = pageKey ? (badgeCounts[pageKey] ?? 0) : 0
    return (
      <Link href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
          active ? 'font-semibold text-gray-900' : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        style={active ? { backgroundColor: '#FFCE00' } : {}}>
        <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>
        <span>{label}</span>
        {badge > 0 && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold min-w-[18px] text-center">{badge}</span>
        )}
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* 로고 */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFCE00' }}>
          <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
        </div>
        <span className="text-sm font-bold text-white">유어메이트</span>
      </div>

      {/* 메인 내비게이션 */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter(canSee).map(item => (
          <NavLink key={item.href} {...item} />
        ))}

        <div className="pt-3 mt-3 border-t border-white/10 space-y-0.5">
          {NAV_BOTTOM.filter(canSee).map(item => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </nav>

      {/* 하단: 유저 정보 */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        {userName && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">{userName[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-200 truncate">{userName}</p>
              <p className="text-[10px] text-gray-500">{ROLE_LABELS[userRole] ?? '팀원'}</p>
            </div>
          </div>
        )}
        <Link href="/profile" className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
          <span>🔑</span><span>비밀번호 변경</span>
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/10 w-full transition-colors">
          <span>🚪</span><span>로그아웃</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── 데스크탑 사이드바 ── */}
      <aside className="hidden md:flex w-44 flex-col fixed left-0 top-0 bottom-0 z-40" style={{ backgroundColor: '#121212' }}>
        <SidebarContent />
      </aside>

      {/* ── 모바일: 상단 바 ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 h-12" style={{ backgroundColor: '#121212' }}>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-gray-400 hover:bg-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
            <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
          </div>
          <span className="text-sm font-bold text-white">유어메이트</span>
        </div>
      </div>

      {/* ── 모바일: 드로어 ── */}
      {mobileOpen && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-56 shadow-2xl" style={{ backgroundColor: '#121212' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFCE00' }}>
                  <span className="text-xs font-black" style={{ color: '#121212' }}>Y</span>
                </div>
                <span className="text-sm font-bold text-white">유어메이트</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white text-xl px-1">×</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarContent />
            </div>
          </aside>
        </>
      )}
    </>
  )
}

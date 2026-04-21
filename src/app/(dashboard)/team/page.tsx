import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ROLE_LABEL: Record<string, string> = { admin: '관리자', manager: '팀장', member: '팀원' }
const ROLE_COLOR: Record<string, string> = { admin: '#121212', manager: '#2563EB', member: '#6B7280' }

const QUICKLINKS = [
  { href: '/hr',         icon: '🏥', label: '인사 관리',  desc: '연차 신청 · 서류 발급' },
  { href: '/tasks',      icon: '✅', label: '업무 현황',  desc: '할 일 · 진행중 업무' },
  { href: '/notice',     icon: '📢', label: '공지사항',   desc: '팀 공지 · 알림' },
  { href: '/attendance', icon: '🕐', label: '근태 관리',  desc: '출퇴근 기록 · QR 출결' },
]

const PHASE2_ITEMS = [
  { icon: '💰', label: '급여 관리',   desc: '급여 명세서 · 정산' },
  { icon: '📈', label: '성과 관리',   desc: 'KPI · 목표 달성률' },
  { icon: '🎯', label: '채용 관리',   desc: '채용 공고 · 지원자 현황' },
  { icon: '📋', label: '온보딩',      desc: '신규 입사자 체크리스트' },
]

export default async function TeamPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profilesRaw } = await admin
    .from('profiles')
    .select('id, name, role, join_date')
    .order('created_at', { ascending: true })

  const members = profilesRaw ?? []

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀</h1>
        <p className="text-gray-500 text-sm mt-1">팀원 현황 · 인사 · 업무 관리</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 팀원 목록 */}
        <div className="bg-white rounded-xl p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 className="text-sm font-bold text-gray-900 mb-4">팀원 ({members.length}명)</h2>
          <div className="space-y-1">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#121212' }}>
                  <span className="text-xs font-bold" style={{ color: '#FFCE00' }}>{m.name?.[0] ?? '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{m.name ?? '(이름 없음)'}</p>
                  <p className="text-xs text-gray-400">
                    {m.join_date ? `입사 ${m.join_date.slice(0, 7)}` : '입사일 미등록'}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                  style={{ color: ROLE_COLOR[m.role ?? 'member'], background: (ROLE_COLOR[m.role ?? 'member']) + '18' }}>
                  {ROLE_LABEL[m.role ?? 'member'] ?? '팀원'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 우측 패널 */}
        <div className="space-y-4">
          {/* 바로가기 */}
          <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h2 className="text-sm font-bold text-gray-900 mb-3">바로가기</h2>
            <div className="space-y-1">
              {QUICKLINKS.map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                  <span className="text-xl w-8 text-center">{item.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                  <span className="text-gray-300 group-hover:text-gray-400 transition-colors">›</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Phase 2 미구현 */}
          <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #FFCE00' }}>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-sm font-bold text-gray-900">Phase 2 — 다음 단계 기능</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border"
                style={{ color: '#92400E', background: '#FFFBEB', borderColor: '#FDE68A' }}>미구현</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">현재 단계 미구현 · 별도 도구 사용 중</p>
            <div className="space-y-2">
              {PHASE2_ITEMS.map(f => (
                <div key={f.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 opacity-60">
                  <span className="text-lg">{f.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-500">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

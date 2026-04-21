import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardMemo from './DashboardMemo'

const SVC_COLOR: Record<string, string> = {
  'SOS': '#7C3AED', '교육프로그램': '#2563EB', '납품설치': '#2563EB',
  '교구대여': '#D97706', '제작인쇄': '#EC4899', '콘텐츠제작': '#EC4899',
  '행사운영': '#F97316', '행사대여': '#F59E0B', '유지보수': '#0891B2',
  '002ENT': '#EF4444', '프로젝트': '#6B7280',
}
const STATUS_STYLE: Record<string, string> = {
  '할 일': 'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '완료': 'bg-green-100 text-green-700',
  '보류': 'bg-red-100 text-red-600',
}
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function dday(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}
function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000) return `${(n / 10000000).toFixed(0) + '천만'}`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}
function ddayLabel(diff: number) {
  if (diff === 0) return { text: 'D-day', cls: 'bg-red-500 text-white' }
  if (diff < 0)  return { text: `D+${Math.abs(diff)}`, cls: 'bg-red-100 text-red-700' }
  if (diff <= 3) return { text: `D-${diff}`, cls: 'bg-orange-100 text-orange-700' }
  if (diff <= 7) return { text: `D-${diff}`, cls: 'bg-yellow-100 text-yellow-700' }
  return { text: `D-${diff}`, cls: 'bg-gray-100 text-gray-500' }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  let taskQ = admin.from('tasks')
    .select('id, title, status, priority, due_date, project_id, assignee_id')
    .not('status', 'in', '(완료,보류)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(8)
  if (!isAdmin) taskQ = taskQ.eq('assignee_id', user.id)

  let remindQ = admin.from('leads')
    .select('id, project_name, client_org, service_type, remind_date, status, assignee_id')
    .lte('remind_date', sevenDays)
    .not('status', 'in', '(완료,취소)')
    .order('remind_date', { ascending: true })
    .limit(8)
  if (!isAdmin) remindQ = remindQ.eq('assignee_id', user.id)

  let projectsQ = admin.from('projects')
    .select('id, name, service_type, status, project_number, customer_id')
    .eq('status', '진행중')
    .order('created_at', { ascending: false })
    .limit(6)
  if (!isAdmin) projectsQ = projectsQ.eq('pm_id', user.id)

  const revenueQ = admin.from('sales')
    .select('revenue')
    .gte('inflow_date', monthStart)
    .not('contract_stage', 'eq', '취소')

  const [
    { data: tasks },
    { data: reminders },
    { data: activeProjects },
    { data: revenueRows },
    { data: deliveries },
    { data: concerts },
  ] = await Promise.all([
    taskQ,
    remindQ,
    projectsQ,
    revenueQ,
    admin.from('rental_deliveries').select('id, rental_id, delivery_date, pickup_date')
      .or('delivery_date.not.is.null,pickup_date.not.is.null')
      .gte('delivery_date', today).limit(5),
    admin.from('sos_concerts').select('id, name, year, month')
      .gte('year', now.getFullYear()).limit(5),
  ])

  // 이번달 매출 집계
  const monthRevenue = (revenueRows ?? []).reduce((sum, r) => sum + (r.revenue ?? 0), 0)

  // 오늘 할 일 (due_date <= today)
  const todayTasks = (tasks ?? []).filter(t => t.due_date && t.due_date <= today)

  // 다가오는 일정
  type CalEv = { id: string; title: string; date: string; color: string }
  const calEvents: CalEv[] = []
  for (const d of deliveries ?? []) {
    if (d.delivery_date && d.delivery_date >= today)
      calEvents.push({ id: `del-${d.id}`, title: '렌탈 배송', date: d.delivery_date, color: '#D97706' })
    if (d.pickup_date && d.pickup_date >= today)
      calEvents.push({ id: `pick-${d.id}`, title: '렌탈 수거', date: d.pickup_date, color: '#EF4444' })
  }
  for (const c of concerts ?? []) {
    const mm = String(c.month).padStart(2, '0')
    calEvents.push({ id: `sos-${c.id}`, title: c.name ?? 'SOS 공연', date: `${c.year}-${mm}-01`, color: '#7C3AED' })
  }
  const upcoming = calEvents.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  const weekday = WEEKDAYS[now.getDay()]
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${weekday}요일`

  const CARD = 'bg-white rounded-xl p-5'
  const SHADOW = { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }
  const SECTION_HDR = 'text-sm font-bold text-gray-900 mb-4'

  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {profile?.name}님 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">{dateLabel}</p>
      </div>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: '이번 달 매출', value: monthRevenue > 0 ? fmtMoney(monthRevenue) : '—', sub: `${now.getMonth() + 1}월 기준`, color: '#059669' },
          { label: isAdmin ? '활성 프로젝트' : '내 프로젝트', value: `${(activeProjects ?? []).length}건`, sub: '진행중', color: '#2563EB' },
          { label: '오늘 할 일', value: `${todayTasks.length}개`, sub: todayTasks.length > 0 ? '기한 도달' : '없음', color: todayTasks.length > 0 ? '#EF4444' : '#6B7280' },
          { label: '리마인드', value: `${(reminders ?? []).length}건`, sub: '7일 이내', color: (reminders ?? []).length > 0 ? '#F59E0B' : '#6B7280' },
        ].map(c => (
          <div key={c.label} className={CARD} style={SHADOW}>
            <p className="text-xs text-gray-400 mb-1.5">{c.label}</p>
            <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 메인 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 🔔 리마인드 임박 */}
        <div className={CARD} style={SHADOW}>
          <h3 className={SECTION_HDR}>🔔 리마인드 임박</h3>
          {(reminders ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">임박한 리마인드가 없습니다</p>
          ) : (reminders ?? []).map(l => {
            const diff = dday(l.remind_date!)
            const badge = ddayLabel(diff)
            const svcColor = SVC_COLOR[l.service_type ?? ''] ?? '#6B7280'
            return (
              <Link key={l.id} href="/leads"
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${badge.cls}`}>
                  {badge.text}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {l.project_name || l.client_org || '(이름 없음)'}
                  </p>
                  <p className="text-xs text-gray-400">{l.client_org || '—'}</p>
                </div>
                {l.service_type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0"
                    style={{ color: svcColor, borderColor: svcColor + '40', background: svcColor + '10' }}>
                    {l.service_type}
                  </span>
                )}
              </Link>
            )
          })}
          <Link href="/leads" className="block text-xs text-gray-400 hover:text-gray-600 text-center mt-3">
            리드 전체 보기 →
          </Link>
        </div>

        {/* ✅ 오늘 할 일 */}
        <div className={CARD} style={SHADOW}>
          <h3 className={SECTION_HDR}>✅ 오늘 할 일</h3>
          {(tasks ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">진행 중인 업무가 없습니다</p>
          ) : (tasks ?? []).map(t => {
            const diff = t.due_date ? dday(t.due_date) : null
            const badge = diff !== null ? ddayLabel(diff) : null
            return (
              <div key={t.id}
                className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                  {t.due_date && <p className="text-xs text-gray-400">{t.due_date}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${badge.cls}`}>
                      {badge.text}
                    </span>
                  )}
                  {t.priority === '긴급' && <span className="text-[10px] text-red-500 font-bold">긴급</span>}
                </div>
              </div>
            )
          })}
          <Link href="/tasks" className="block text-xs text-gray-400 hover:text-gray-600 text-center mt-3">
            업무 전체 보기 →
          </Link>
        </div>

        {/* ◈ 진행중인 프로젝트 */}
        <div className={CARD} style={SHADOW}>
          <h3 className={SECTION_HDR}>◈ 진행중인 {isAdmin ? '' : '내 '}프로젝트</h3>
          {(activeProjects ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">진행중인 프로젝트가 없습니다</p>
          ) : (activeProjects ?? []).map(p => {
            const svcColor = SVC_COLOR[p.service_type ?? ''] ?? '#E5E7EB'
            return (
              <Link key={p.id} href={`/projects/${p.id}`}
                className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                <div className="w-1 h-9 rounded flex-shrink-0" style={{ background: svcColor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.project_number ?? ''}{p.service_type ? ` · ${p.service_type}` : ''}</p>
                </div>
              </Link>
            )
          })}
          <Link href="/projects" className="block text-xs text-gray-400 hover:text-gray-600 text-center mt-3">
            프로젝트 전체 보기 →
          </Link>
        </div>

        {/* ◷ 다가오는 일정 */}
        <div className={CARD} style={SHADOW}>
          <h3 className={SECTION_HDR}>◷ 다가오는 일정</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">예정된 일정이 없습니다</p>
          ) : upcoming.map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                <p className="text-xs text-gray-400">{e.date}</p>
              </div>
            </div>
          ))}
          <div className="mt-3 pt-2 border-t border-gray-100">
            <Link href="/calendar" className="text-xs text-gray-400 hover:text-gray-600">캘린더 전체 보기 →</Link>
          </div>
        </div>
      </div>

      {/* 메모 + 캘린더 */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashboardMemo />
      </div>
    </div>
  )
}

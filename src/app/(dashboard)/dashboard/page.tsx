import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdmin as checkIsAdmin } from '@/lib/permissions'
import DashboardMemo from './DashboardMemo'
import BrainDump from '@/components/BrainDump'

const SVC_COLOR: Record<string, string> = {
  'SOS': '#7C3AED', '교육프로그램': '#2563EB', '납품설치': '#2563EB',
  '교구대여': '#D97706', '제작인쇄': '#EC4899', '콘텐츠제작': '#EC4899',
  '행사운영': '#F97316', '행사대여': '#F59E0B', '유지보수': '#0891B2',
  '002ENT': '#EF4444', '프로젝트': '#6B7280',
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
  const isAdmin = checkIsAdmin(profile?.role)

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const threeDaysAgoStr = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)

  // (Flow UX) 이번 주 / 다음 주 범위 — 월~일 기준
  const thisMonday = new Date(now)
  const dayOfWeek = thisMonday.getDay()  // 0=일, 1=월, ..., 6=토
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  thisMonday.setDate(thisMonday.getDate() + daysToMonday); thisMonday.setHours(0, 0, 0, 0)
  const thisSunday = new Date(thisMonday); thisSunday.setDate(thisSunday.getDate() + 6)
  const nextMonday = new Date(thisMonday); nextMonday.setDate(nextMonday.getDate() + 7)
  const nextSunday = new Date(nextMonday); nextSunday.setDate(nextSunday.getDate() + 6)
  const thisWeekStart = thisMonday.toISOString().slice(0, 10)
  const thisWeekEnd   = thisSunday.toISOString().slice(0, 10)
  const nextWeekStart = nextMonday.toISOString().slice(0, 10)
  const nextWeekEnd   = nextSunday.toISOString().slice(0, 10)

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
    .select('id, name, service_type, status, project_number, customer_id, pending_discussion')
    .eq('status', '진행중')
    .order('created_at', { ascending: false })
    .limit(6)
  if (!isAdmin) projectsQ = projectsQ.eq('pm_id', user.id)

  // 빵빵이 액션: 활성 리드 중 summary_cache 있는 것 + 활성 프로젝트 중 pending_discussion 있는 것
  let actionLeadsQ = admin.from('leads')
    .select('id, project_name, client_org, service_type, summary_cache')
    .not('status', 'in', '(완료,취소)')
    .not('summary_cache', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (!isAdmin) actionLeadsQ = actionLeadsQ.eq('assignee_id', user.id)

  let actionProjectsQ = admin.from('projects')
    .select('id, name, project_number, service_type, pending_discussion')
    .eq('status', '진행중')
    .not('pending_discussion', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(30)
  if (!isAdmin) actionProjectsQ = actionProjectsQ.eq('pm_id', user.id)

  const revenueQ = admin.from('sales')
    .select('revenue')
    .gte('inflow_date', monthStart)
    .not('contract_stage', 'eq', '취소')

  // (Flow UX) task 미완료 경고 카운트 — role 정책 적용
  let todayDueQ    = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').eq('due_date', today)
  let overdueQ     = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').lt('due_date', today)
  let myActiveQ    = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').eq('assignee_id', user.id)
  let noAssigneeQ  = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').is('assignee_id', null)
  let noDueQ       = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').is('due_date', null)
  let overdue3Q    = admin.from('tasks').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,보류)').lt('due_date', threeDaysAgoStr)
  if (!isAdmin) {
    // member: 본인 담당만. noAssignee 는 의미 없음 (본인 담당만 보는데 NULL이면 본인 아님 — admin만 의미)
    todayDueQ = todayDueQ.eq('assignee_id', user.id)
    overdueQ  = overdueQ.eq('assignee_id', user.id)
    noDueQ    = noDueQ.eq('assignee_id', user.id)
    overdue3Q = overdue3Q.eq('assignee_id', user.id)
  }

  // (Flow UX) 주간 리마인드 — 이번 주/다음 주 미완료
  let thisWeekQ = admin.from('tasks')
    .select('id, title, due_date, priority, status, project_id, assignee_id')
    .not('status', 'in', '(완료,보류)')
    .gte('due_date', thisWeekStart).lte('due_date', thisWeekEnd)
    .order('due_date', { ascending: true })
    .limit(8)
  let nextWeekQ = admin.from('tasks')
    .select('id, title, due_date, priority, status, project_id, assignee_id')
    .not('status', 'in', '(완료,보류)')
    .gte('due_date', nextWeekStart).lte('due_date', nextWeekEnd)
    .order('priority', { ascending: true })
    .order('due_date', { ascending: true })
    .limit(3)
  if (!isAdmin) {
    thisWeekQ = thisWeekQ.eq('assignee_id', user.id)
    nextWeekQ = nextWeekQ.eq('assignee_id', user.id)
  }

  // ──────────── 운영 관제판 카운트 (Phase 9) ────────────
  // 모두 head:true count — 가벼운 카운트 쿼리만, 데이터 안 가져옴
  const cnt = (q: { count?: number | null }) => q.count ?? 0

  const [
    { data: tasks },
    { data: reminders },
    { data: activeProjects },
    { data: revenueRows },
    { data: deliveries },
    { data: concerts },
    { data: actionLeads },
    { data: actionProjects },
    // 단계별 카운트
    leadActive,
    leadNew,         // 신규 (유입)
    leadAwaiting,    // 응답 대기 (회신대기·견적발송·조율중)
    saleActive,
    saleNoMainType,
    saleNoAssignee,
    saleDropboxMiss,
    projectActive,
    projectNoMainType,
    projectDropboxMiss,
    leadDropboxMiss,
    paymentScheduleSaleIds,
    // (Flow UX) task 카운트
    todayDueRes,
    overdueRes,
    myActiveRes,
    noAssigneeRes,
    noDueRes,
    overdue3Res,
    thisWeekTasksRes,
    nextWeekTasksRes,
  ] = await Promise.all([
    taskQ,
    remindQ,
    projectsQ,
    revenueQ,
    admin.from('rental_deliveries').select('id, rental_id, delivery_date, pickup_date, location')
      .or('delivery_date.not.is.null,pickup_date.not.is.null')
      .gte('delivery_date', today).limit(5),
    admin.from('sos_concerts').select('id, name, year, month')
      .gte('year', now.getFullYear()).limit(5),
    actionLeadsQ,
    actionProjectsQ,
    // 단계별 카운트 (head:true)
    admin.from('leads').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,취소)'),
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('status', '유입'),
    admin.from('leads').select('id', { count: 'exact', head: true }).in('status', ['회신대기', '견적발송', '조율중']),
    admin.from('sales').select('id', { count: 'exact', head: true }).not('contract_stage', 'eq', '취소'),
    admin.from('sales').select('id', { count: 'exact', head: true }).not('contract_stage', 'eq', '취소').is('main_type', null),
    admin.from('sales').select('id', { count: 'exact', head: true }).not('contract_stage', 'eq', '취소').is('contract_assignee_id', null),
    admin.from('sales').select('id', { count: 'exact', head: true }).not('contract_stage', 'eq', '취소').is('dropbox_url', null),
    admin.from('projects').select('id', { count: 'exact', head: true }).eq('status', '진행중'),
    admin.from('projects').select('id', { count: 'exact', head: true }).eq('status', '진행중').is('main_type', null),
    admin.from('projects').select('id', { count: 'exact', head: true }).eq('status', '진행중').is('dropbox_url', null),
    admin.from('leads').select('id', { count: 'exact', head: true }).not('status', 'in', '(완료,취소)').is('dropbox_url', null).not('service_type', 'is', null),
    admin.from('payment_schedules').select('sale_id'),  // 결제 일정 등록된 sale_id distinct 계산용
    // (Flow UX) task 카운트 + 주간 리스트
    todayDueQ,
    overdueQ,
    myActiveQ,
    noAssigneeQ,
    noDueQ,
    overdue3Q,
    thisWeekQ,
    nextWeekQ,
  ])

  const todayDueCount   = cnt(todayDueRes)
  const overdueCount    = cnt(overdueRes)
  const myActiveCount   = cnt(myActiveRes)
  const noAssigneeCount = cnt(noAssigneeRes)
  const noDueCount      = cnt(noDueRes)
  const overdue3Count   = cnt(overdue3Res)
  const thisWeekTasks = thisWeekTasksRes.data ?? []
  const nextWeekTasks = nextWeekTasksRes.data ?? []

  // 결제 일정 미설정 sale = active sale 수 - distinct sale_id 수
  const scheduledSaleIdSet = new Set((paymentScheduleSaleIds.data ?? []).map((p: any) => p.sale_id).filter(Boolean))
  const saleNoScheduleCount = Math.max(0, cnt(saleActive) - scheduledSaleIdSet.size)

  // summary_cache의 "다음:" 라인만 추출
  type Action = { id: string; type: 'lead' | 'project'; name: string; subtitle: string; action: string; href: string; service_type: string | null }
  const leadActions: Action[] = (actionLeads ?? []).flatMap(l => {
    const next = l.summary_cache?.split('\n').find((line: string) => line.trim().startsWith('다음:'))?.replace(/^다음:\s*/, '').trim()
    if (!next || next === '없음' || next === '—') return []
    return [{
      id: l.id, type: 'lead' as const,
      name: l.project_name || l.client_org || '(이름 없음)',
      subtitle: l.client_org || '—',
      action: next,
      href: '/leads',
      service_type: l.service_type ?? null,
    }]
  })

  // pending_discussion 첫 항목 (markdown 헤더 + 첫 bullet)
  const projActions: Action[] = (actionProjects ?? []).flatMap(p => {
    const text = p.pending_discussion as string | null
    if (!text) return []
    // 첫 번째 bullet 또는 첫 줄 추출
    const firstAction = text.split('\n').map((s: string) => s.trim())
      .find((s: string) => /^[-*]\s/.test(s) && s.length > 5)
      ?.replace(/^[-*]\s+/, '').slice(0, 100)
    if (!firstAction) return []
    return [{
      id: p.id, type: 'project' as const,
      name: p.name,
      subtitle: p.project_number ?? '—',
      action: firstAction,
      href: `/projects/${p.id}`,
      service_type: p.service_type ?? null,
    }]
  })

  const allActions = [...leadActions, ...projActions]

  // task → 프로젝트 URL 매핑 (task.project_id = sale.id, sale.project_id = 진짜 project)
  const taskSaleIds = [...new Set((tasks ?? []).map(t => t.project_id).filter(Boolean) as string[])]
  let taskProjectMap: Record<string, string> = {}
  if (taskSaleIds.length > 0) {
    const { data: salesForTasks } = await admin
      .from('sales').select('id, project_id').in('id', taskSaleIds)
    taskProjectMap = Object.fromEntries(
      (salesForTasks ?? []).filter(s => s.project_id).map(s => [s.id, s.project_id as string])
    )
  }

  // 이번달 매출 집계
  const monthRevenue = (revenueRows ?? []).reduce((sum, r) => sum + (r.revenue ?? 0), 0)

  // 오늘 할 일 (due_date <= today)
  const todayTasks = (tasks ?? []).filter(t => t.due_date && t.due_date <= today)

  // 다가오는 일정
  type CalEv = { id: string; title: string; date: string; color: string }
  const calEvents: CalEv[] = []
  for (const d of deliveries ?? []) {
    if (d.delivery_date && d.delivery_date >= today)
      calEvents.push({ id: `del-${d.id}`, title: d.location ? `렌탈 배송 — ${d.location}` : '렌탈 배송', date: d.delivery_date, color: '#D97706' })
    if (d.pickup_date && d.pickup_date >= today)
      calEvents.push({ id: `pick-${d.id}`, title: d.location ? `렌탈 수거 — ${d.location}` : '렌탈 수거', date: d.pickup_date, color: '#EF4444' })
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
  const SECTION_HDR = 'text-base sm:text-sm font-bold text-gray-900 mb-4'

  return (
    <div className="max-w-5xl">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          안녕하세요, {profile?.name}님 👋
        </h1>
        <p className="text-gray-400 text-sm mt-1">{dateLabel}</p>
      </div>

      {/* (Flow UX) ⚡ 오늘 해야 할 일 — 4 카운트 + 최근 5개 */}
      <Link href="/tasks" className="block bg-white border-2 border-yellow-200 rounded-xl p-4 mb-4 hover:border-yellow-400 transition-colors" style={{ boxShadow: '0 2px 8px rgba(252,196,0,0.08)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">⚡</span>
          <span className="text-sm font-bold text-gray-900">오늘 해야 할 일</span>
          <span className="ml-auto text-[10px] text-gray-400">전체 보기 →</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div className="bg-red-50/40 border border-red-100 rounded-lg p-2.5">
            <p className="text-[10px] text-red-700 mb-0.5">⚠ 지연</p>
            <p className="text-2xl font-black text-red-700">{overdueCount}<span className="text-xs font-normal text-red-500 ml-0.5">건</span></p>
          </div>
          <div className="bg-orange-50/40 border border-orange-100 rounded-lg p-2.5">
            <p className="text-[10px] text-orange-700 mb-0.5">📅 오늘 마감</p>
            <p className="text-2xl font-black text-orange-700">{todayDueCount}<span className="text-xs font-normal text-orange-500 ml-0.5">건</span></p>
          </div>
          <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-2.5">
            <p className="text-[10px] text-blue-700 mb-0.5">👤 내 담당 (전체 미완료)</p>
            <p className="text-2xl font-black text-blue-700">{myActiveCount}<span className="text-xs font-normal text-blue-500 ml-0.5">건</span></p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            <p className="text-[10px] text-gray-600 mb-0.5">🗓 이번 주 미완료</p>
            <p className="text-2xl font-black text-gray-800">{thisWeekTasks.length}<span className="text-xs font-normal text-gray-500 ml-0.5">건</span></p>
          </div>
        </div>
        {(tasks ?? []).length > 0 && (
          <div className="space-y-0.5 border-t border-gray-100 pt-2">
            {(tasks ?? []).slice(0, 5).map(t => {
              const diff = t.due_date ? dday(t.due_date) : null
              const badge = diff !== null ? ddayLabel(diff) : null
              return (
                <div key={t.id} className="flex items-center gap-2 py-1 text-xs">
                  {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${badge.cls}`}>{badge.text}</span>}
                  <span className="flex-1 truncate text-gray-700">{t.title}</span>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{t.status}</span>
                </div>
              )
            })}
          </div>
        )}
      </Link>

      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: '이번 달 매출', value: monthRevenue > 0 ? fmtMoney(monthRevenue) : '—', sub: `${now.getMonth() + 1}월 기준`, color: '#059669' },
          { label: isAdmin ? '활성 프로젝트' : '내 프로젝트', value: `${(activeProjects ?? []).length}건`, sub: '진행중', color: '#2563EB' },
          { label: '오늘 할 일', value: `${todayTasks.length}개`, sub: todayTasks.length > 0 ? '기한 도달' : '없음', color: todayTasks.length > 0 ? '#EF4444' : '#6B7280' },
          { label: '리마인드', value: `${(reminders ?? []).length}건`, sub: '7일 이내', color: (reminders ?? []).length > 0 ? '#F59E0B' : '#6B7280' },
        ].map(c => (
          <div key={c.label} className={CARD} style={SHADOW}>
            <p className="text-sm sm:text-xs text-gray-500 mb-1.5">{c.label}</p>
            <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
            <p className="text-sm sm:text-xs text-gray-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ──────────── 단계별 운영 카드 (Phase 9) ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* 📥 lead (sky) */}
        <Link href="/leads" className="bg-sky-50/40 border-2 border-sky-100 rounded-xl p-4 hover:border-sky-200 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📥</span>
              <span className="text-xs font-bold text-sky-900">리드 — 문의 단계</span>
            </div>
            <span className="text-[10px] text-sky-700">활성 {cnt(leadActive)}건</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-sky-800">
              <span>· 신규 (유입)</span>
              <span className="font-bold">{cnt(leadNew)}건</span>
            </div>
            <div className="flex items-center justify-between text-sky-800">
              <span>· 응답·정리 대기</span>
              <span className="font-bold">{cnt(leadAwaiting)}건</span>
            </div>
            <div className="flex items-center justify-between text-sky-700/80">
              <span>· 7일 내 리마인드</span>
              <span className="font-bold">{(reminders ?? []).length}건</span>
            </div>
          </div>
        </Link>

        {/* 📜 sale (violet) */}
        <Link href="/sales/report" className="bg-violet-50/40 border-2 border-violet-100 rounded-xl p-4 hover:border-violet-200 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">📜</span>
              <span className="text-xs font-bold text-violet-900">계약 운영실</span>
            </div>
            <span className="text-[10px] text-violet-700">활성 {cnt(saleActive)}건</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-violet-800">
              <span>· 운영 분류 미설정</span>
              <span className="font-bold">{cnt(saleNoMainType)}건</span>
            </div>
            <div className="flex items-center justify-between text-violet-800">
              <span>· 계약 담당 미지정</span>
              <span className="font-bold">{cnt(saleNoAssignee)}건</span>
            </div>
            <div className="flex items-center justify-between text-violet-700/80">
              <span>· 결제 일정 미설정</span>
              <span className="font-bold">{saleNoScheduleCount}건</span>
            </div>
          </div>
        </Link>

        {/* ◈ project (amber) */}
        <Link href="/projects" className="bg-amber-50/40 border-2 border-amber-100 rounded-xl p-4 hover:border-amber-200 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">◈</span>
              <span className="text-xs font-bold text-amber-900">프로젝트 — 실행 운영실</span>
            </div>
            <span className="text-[10px] text-amber-700">활성 {cnt(projectActive)}건</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between text-amber-800">
              <span>· 운영 분류 미설정</span>
              <span className="font-bold">{cnt(projectNoMainType)}건</span>
            </div>
            <div className="flex items-center justify-between text-amber-800">
              <span>· 자료 폴더 미연결</span>
              <span className="font-bold">{cnt(projectDropboxMiss)}건</span>
            </div>
            <div className="flex items-center justify-between text-amber-700/80">
              <span>· 진행중 (전체)</span>
              <span className="font-bold">{cnt(projectActive)}건</span>
            </div>
          </div>
        </Link>
      </div>

      {/* ──────────── 🚨 누락·경고 / 운영 알림 (Phase 9) ──────────── */}
      {(() => {
        const totalDbxMiss = cnt(leadDropboxMiss) + cnt(saleDropboxMiss) + cnt(projectDropboxMiss)
        const totalClassMiss = cnt(saleNoMainType) + cnt(projectNoMainType)
        const totalAlerts = totalDbxMiss + totalClassMiss + cnt(saleNoAssignee) + saleNoScheduleCount
        if (totalAlerts === 0) return null
        return (
          <div className="bg-red-50/40 border-2 border-red-100 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🚨</span>
              <span className="text-xs font-bold text-red-900">놓치면 안 되는 누락 — 지금 정리하면 운영 사고 방지</span>
              <span className="ml-auto text-[10px] text-red-700">총 {totalAlerts}건</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Link href="/projects?alert=no_dropbox" className="bg-white border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">📁 자료 폴더 미연결</p>
                <p className="text-base font-bold text-red-700">{cnt(projectDropboxMiss)}건 <span className="text-[10px] font-normal text-red-400 ml-0.5">바로 보기 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">프로젝트 미연결 (전체 {totalDbxMiss}건)</p>
              </Link>
              <Link href="/projects?alert=no_main_type" className="bg-white border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">🧭 운영 분류 미설정</p>
                <p className="text-base font-bold text-amber-700">{cnt(projectNoMainType)}건 <span className="text-[10px] font-normal text-amber-500 ml-0.5">바로 보기 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">프로젝트 (전체 {totalClassMiss}건)</p>
              </Link>
              <Link href="/sales/report?alert=no_contract_assignee" className="bg-white border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">📜 계약 담당 미지정</p>
                <p className="text-base font-bold text-violet-700">{cnt(saleNoAssignee)}건 <span className="text-[10px] font-normal text-violet-500 ml-0.5">바로 보기 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">활성 sale 중</p>
              </Link>
              <Link href="/sales/report?alert=no_payment_schedule" className="bg-white border border-red-100 rounded-lg px-3 py-2 hover:bg-red-50 hover:border-red-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">💵 결제 일정 미설정</p>
                <p className="text-base font-bold text-violet-700">{saleNoScheduleCount}건 <span className="text-[10px] font-normal text-violet-500 ml-0.5">바로 보기 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">활성 sale 중</p>
              </Link>
            </div>
          </div>
        )
      })()}

      {/* (Flow UX) ⚠️ 업무 미완료 경고 — 담당자/기한/3일+ 지연 */}
      {(() => {
        const taskWarnTotal = (isAdmin ? noAssigneeCount : 0) + noDueCount + overdue3Count
        if (taskWarnTotal === 0) return null
        return (
          <div className="bg-amber-50/40 border-2 border-amber-100 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⚠️</span>
              <span className="text-xs font-bold text-amber-900">업무 미완료 경고 — 정리 필요한 task</span>
              <span className="ml-auto text-[10px] text-amber-700">총 {taskWarnTotal}건</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {isAdmin && (
                <Link href="/tasks?alert=missing_assignee" className="bg-white border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-50 hover:border-amber-200 transition-colors block">
                  <p className="text-[10px] text-gray-500 mb-0.5">👤 담당자 없음</p>
                  <p className="text-base font-bold text-amber-700">{noAssigneeCount}건 <span className="text-[10px] font-normal text-amber-500 ml-0.5">바로 처리 ↗</span></p>
                  <p className="text-[10px] text-gray-400 mt-0.5">미완료 task 중</p>
                </Link>
              )}
              <Link href="/tasks?alert=missing_due" className="bg-white border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-50 hover:border-amber-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">📅 기한 없음</p>
                <p className="text-base font-bold text-amber-700">{noDueCount}건 <span className="text-[10px] font-normal text-amber-500 ml-0.5">바로 처리 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">{isAdmin ? '미완료 task 중' : '내 미완료 task 중'}</p>
              </Link>
              <Link href="/tasks?alert=overdue_3plus" className="bg-white border border-amber-100 rounded-lg px-3 py-2 hover:bg-amber-50 hover:border-amber-200 transition-colors block">
                <p className="text-[10px] text-gray-500 mb-0.5">🔥 3일 이상 지연</p>
                <p className="text-base font-bold text-red-700">{overdue3Count}건 <span className="text-[10px] font-normal text-red-500 ml-0.5">바로 처리 ↗</span></p>
                <p className="text-[10px] text-gray-400 mt-0.5">{isAdmin ? '미완료 task 중' : '내 미완료 task 중'}</p>
              </Link>
            </div>
          </div>
        )
      })()}

      {/* (Flow UX) 📅 주간 리마인드 — 이번 주 + 다음 주 */}
      {(thisWeekTasks.length > 0 || nextWeekTasks.length > 0) && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4" style={SHADOW}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">📅</span>
            <span className="text-sm font-bold text-gray-900">주간 리마인드</span>
            <span className="ml-auto text-[10px] text-gray-400">{isAdmin ? '전체' : '내 담당'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 이번 주 미완료 Top 8 */}
            <div>
              <p className="text-[11px] font-bold text-gray-700 mb-2">🗓 이번 주 미완료 ({thisWeekTasks.length}건)</p>
              {thisWeekTasks.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">없음</p>
              ) : (
                <ul className="space-y-1">
                  {thisWeekTasks.map(t => {
                    const diff = t.due_date ? dday(t.due_date) : null
                    const badge = diff !== null ? ddayLabel(diff) : null
                    return (
                      <li key={t.id} className="flex items-center gap-2 text-xs py-1">
                        {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${badge.cls}`}>{badge.text}</span>}
                        <span className="flex-1 truncate text-gray-700">{t.title}</span>
                        {t.priority === '긴급' && <span className="text-[10px] text-red-500 font-bold flex-shrink-0">긴급</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            {/* 다음 주 우선순위 Top 3 */}
            <div>
              <p className="text-[11px] font-bold text-gray-700 mb-2">📌 다음 주 우선순위 Top {nextWeekTasks.length}</p>
              {nextWeekTasks.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">없음</p>
              ) : (
                <ul className="space-y-1">
                  {nextWeekTasks.map(t => (
                    <li key={t.id} className="flex items-center gap-2 text-xs py-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">{t.priority || '보통'}</span>
                      <span className="flex-1 truncate text-gray-700">{t.title}</span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">{t.due_date?.slice(5)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🤖 빵빵이에게 쏟아내기 (빠른 메모/명령) */}
      <div className="mb-4">
        <BrainDump />
      </div>

      {/* 🤖 빵빵이의 오늘 할 일 — 모든 활성 리드/프로젝트의 다음 액션 종합 */}
      <div className={`${CARD} mb-4`} style={SHADOW}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={SECTION_HDR + ' mb-0'}>🤖 빵빵이의 오늘 할 일</h3>
          <span className="text-xs text-gray-400">{allActions.length}건</span>
        </div>
        {allActions.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400 mb-2">아직 빵빵이가 분석한 액션이 없어요</p>
            <p className="text-[11px] text-gray-300">리드/프로젝트에 들어가서 [🤖 빵빵이 분석] 또는 [🤖 다시 분석]을 누르면 여기에 모입니다</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allActions.slice(0, 12).map(a => {
              const svcColor = SVC_COLOR[a.service_type ?? ''] ?? '#6B7280'
              return (
                <Link key={`${a.type}-${a.id}`} href={a.href}
                  className="flex items-start gap-3 py-2.5 px-2 hover:bg-gray-50 rounded transition-colors -mx-2">
                  <span className={`text-xs sm:text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 mt-0.5 ${
                    a.type === 'lead' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {a.type === 'lead' ? '리드' : '프로젝트'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-blue-700 font-medium leading-snug">🤖 {a.action}</p>
                    <p className="text-xs sm:text-[11px] text-gray-500 mt-0.5 truncate">
                      <span className="font-medium text-gray-700">{a.name}</span>
                      {a.subtitle !== '—' && <span className="text-gray-400"> · {a.subtitle}</span>}
                    </p>
                  </div>
                  {a.service_type && (
                    <span className="text-xs sm:text-[10px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 mt-0.5"
                      style={{ color: svcColor, borderColor: svcColor + '40', background: svcColor + '10' }}>
                      {a.service_type}
                    </span>
                  )}
                </Link>
              )
            })}
            {allActions.length > 12 && (
              <p className="text-[11px] text-gray-400 text-center pt-2">+{allActions.length - 12}건 더</p>
            )}
          </div>
        )}
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
            const projectUrl = t.project_id ? taskProjectMap[t.project_id] : null
            const href = projectUrl ? `/projects/${projectUrl}` : '/tasks'
            return (
              <Link key={t.id} href={href}
                className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
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
              </Link>
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

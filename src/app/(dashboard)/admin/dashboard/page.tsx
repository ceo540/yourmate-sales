// 신규 대시보드 (admin only — yourmate-spec.md §4.8)
// 기존 /dashboard는 그대로 유지. 검증 후 통합 결정.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdminOrManager } from '@/lib/permissions'
import { calculateUrgencyScore, LEVEL_LABEL, LEVEL_COLOR, type UrgencyLevel } from '@/lib/urgency-score'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  if (!isAdminOrManager(profile?.role)) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능</div>
  }

  const today = new Date().toISOString().slice(0, 10)
  const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const [{ data: tasks }, { data: leads }, { data: activeProjects }, { data: paymentSchedules }] = await Promise.all([
    admin.from('tasks')
      .select('id, title, status, due_date, project_id, assignee_id')
      .not('status', 'in', '(완료,보류)')
      .limit(100),
    admin.from('leads')
      .select('id, project_name, client_org, remind_date, status, assignee_id')
      .lte('remind_date', sevenDays)
      .not('status', 'in', '(완료,취소)')
      .limit(50),
    admin.from('projects')
      .select('id, name, project_number, service_type, status, customer_id')
      .eq('status', '진행중')
      .order('updated_at', { ascending: false })
      .limit(20),
    admin.from('payment_schedules')
      .select('id, sale_id, amount, due_date, is_received, label')
      .eq('is_received', false)
      .lte('due_date', sevenDays)
      .limit(20),
  ])

  // 우선순위 점수 적용
  type TaskItem = {
    id: string
    title: string
    due_date: string | null
    project_id: string | null
    score: number
    level: UrgencyLevel
    reasons: string[]
  }
  const scoredTasks: TaskItem[] = (tasks ?? []).map(t => {
    const r = calculateUrgencyScore({ due_date: t.due_date })
    return {
      id: t.id, title: t.title,
      due_date: t.due_date,
      project_id: t.project_id ?? null,
      score: r.score,
      level: r.level,
      reasons: r.reasons,
    }
  }).sort((a, b) => b.score - a.score)

  // 카테고리별 그룹
  const byLevel: Record<UrgencyLevel, TaskItem[]> = { critical: [], high: [], medium: [], low: [] }
  for (const t of scoredTasks) byLevel[t.level].push(t)

  // 자금 영역 (이번주 입금 예정 vs 외주 지급)
  const weekIncoming = (paymentSchedules ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
  // 외주 지급 — sale_costs.due_date 이번주 (TODO: 별도 라운드)
  const weekOutgoing = 0

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">📌 메인 대시보드 (신규)</h1>
        <p className="text-sm text-gray-500">
          시급 할 일 + 활성 프로젝트. 자금은 후순위. (yourmate-spec.md §4.8 — 검증 단계, admin만)
        </p>
      </header>

      {/* Critical/High 박스 */}
      {(byLevel.critical.length > 0 || byLevel.high.length > 0) && (
        <section className="mb-4 space-y-2">
          {byLevel.critical.length > 0 && (
            <UrgentBlock title="🔴 Critical" items={byLevel.critical} />
          )}
          {byLevel.high.length > 0 && (
            <UrgentBlock title="🟠 High" items={byLevel.high.slice(0, 8)} />
          )}
        </section>
      )}

      {/* Medium/Low 합쳐서 표 */}
      {byLevel.medium.length + byLevel.low.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
          <summary className="cursor-pointer text-sm font-semibold text-gray-700">
            🟡 Medium ({byLevel.medium.length}) · ⚪ Low ({byLevel.low.length})
          </summary>
          <div className="mt-3 space-y-1">
            {[...byLevel.medium, ...byLevel.low].slice(0, 15).map(t => (
              <TaskRow key={t.id} item={t} />
            ))}
          </div>
        </details>
      )}

      {scoredTasks.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-sm text-yellow-700 mb-4">
          시급 할 일 없음 — 모든 task 완료 또는 보류 상태
        </div>
      )}

      {/* 활성 프로젝트 일람 */}
      <section className="mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">🚧 활성 프로젝트 ({(activeProjects ?? []).length}건)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(activeProjects ?? []).map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="bg-white border border-gray-100 rounded-xl px-3 py-2 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800 truncate flex-1">
                  {p.project_number ? `[${p.project_number}] ` : ''}{p.name}
                </p>
                {p.service_type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 ml-2 flex-shrink-0">
                    {p.service_type}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 리드 리마인드 */}
      {(leads ?? []).length > 0 && (
        <section className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">📥 리드 리마인드 ({(leads ?? []).length}건)</h2>
          <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-1">
            {(leads ?? []).slice(0, 10).map(l => (
              <Link
                key={l.id}
                href={`/leads`}
                className="block text-xs hover:bg-gray-50 px-2 py-1 rounded"
              >
                <span className="text-gray-600">{l.remind_date ?? '—'}</span>
                <span className="ml-2 text-gray-800 font-medium">{l.project_name || l.client_org}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 자금 — 후순위 (접힘, "돈은 그 다음, 일부터" §4.8) */}
      <details className="bg-white rounded-xl border border-gray-100 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-500">
          💰 자금 (이번 주, 접힘) — 일이 먼저, 돈은 그 다음
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="bg-green-50 rounded p-2">
            <p className="text-xs text-green-600">입금 예정</p>
            <p className="text-lg font-bold text-green-900">{(weekIncoming / 10000).toFixed(0)}만원</p>
          </div>
          <div className="bg-red-50 rounded p-2">
            <p className="text-xs text-red-600">외주 지급 예정</p>
            <p className="text-lg font-bold text-red-900">{(weekOutgoing / 10000).toFixed(0)}만원 (다음 라운드)</p>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-gray-400">자세한 자금 흐름은 <Link href="/admin/revenue" className="text-blue-500 hover:underline">/admin/revenue</Link></p>
      </details>

      <p className="mt-6 text-xs text-gray-400">
        💡 이 페이지는 신규. 기존 <Link href="/dashboard" className="text-blue-500 hover:underline">/dashboard</Link>는 그대로 유지. 검증 후 통합 결정.
      </p>
    </div>
  )
}

function UrgentBlock({ title, items }: { title: string; items: { id: string; title: string; due_date: string | null; project_id: string | null; reasons: string[]; level: UrgencyLevel }[] }) {
  if (items.length === 0) return null
  const tone = items[0]?.level
  const colorClass = tone ? LEVEL_COLOR[tone] : LEVEL_COLOR.medium
  return (
    <div className={`border rounded-xl p-3 ${colorClass}`}>
      <h3 className="text-sm font-semibold mb-2">{title} ({items.length})</h3>
      <div className="space-y-1">
        {items.map(t => <TaskRow key={t.id} item={t} />)}
      </div>
    </div>
  )
}

function TaskRow({ item }: { item: { id: string; title: string; due_date: string | null; project_id: string | null; reasons: string[]; level: UrgencyLevel } }) {
  const link = item.project_id ? `/projects/${item.project_id}` : '/tasks'
  return (
    <Link href={link} className="flex items-start gap-2 py-1 px-2 hover:bg-white/50 rounded -mx-1 text-xs">
      <span className="flex-shrink-0 mt-0.5">{LEVEL_LABEL[item.level].split(' ')[0]}</span>
      <span className="flex-1 truncate">{item.title}</span>
      {item.due_date && <span className="text-[11px] text-gray-500 flex-shrink-0">{item.due_date}</span>}
      {item.reasons.length > 0 && (
        <span className="text-[10px] text-gray-500 flex-shrink-0 hidden md:inline">
          {item.reasons.slice(0, 2).join(' · ')}
        </span>
      )}
    </Link>
  )
}

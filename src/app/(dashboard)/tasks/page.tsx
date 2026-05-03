import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createProfileMap } from '@/lib/utils'
import { isAdminOrManager } from '@/lib/permissions'
import TasksClient from './TasksClient'

type AlertKey = 'missing_assignee' | 'missing_due' | 'overdue_3plus'

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ alert?: string }> }) {
  const sp = await searchParams
  const alertParamRaw = sp?.alert ?? null
  const alertParam: AlertKey | null = (
    alertParamRaw === 'missing_assignee' || alertParamRaw === 'missing_due' || alertParamRaw === 'overdue_3plus'
  ) ? alertParamRaw : null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: profile } = await adminSupabase.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)

  // 업무 조회 (admin: 전체, member: 내 담당)
  let tasksQuery = adminSupabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false })
  if (!isAdmin) {
    tasksQuery = tasksQuery.eq('assignee_id', user.id)
  }

  const [{ data: rawTasks }, { data: profiles }, { data: sales }] = await Promise.all([
    tasksQuery,
    adminSupabase.from('profiles').select('id, name').order('name'),
    adminSupabase.from('sales').select('id, name, department').order('name'),
  ])

  const profileMap = createProfileMap(profiles)
  const saleMap = Object.fromEntries((sales ?? []).map(s => [s.id, s]))

  const tasks = (rawTasks ?? []).map(t => ({
    ...t,
    assignee: t.assignee_id ? (profileMap[t.assignee_id] ?? null) : null,
    sale: t.project_id ? (saleMap[t.project_id] ?? null) : null,
  }))

  const ALERT_INFO: Record<AlertKey, { icon: string; title: string; hint: string }> = {
    missing_assignee: { icon: '👤', title: '담당자 없음 — 미완료 업무', hint: '담당자가 비어 있어요. 행 펼쳐서 담당자 지정해주세요.' },
    missing_due:      { icon: '📅', title: '기한 없음 — 미완료 업무',   hint: '마감일이 비어 있어요. 마감 정해야 우선순위가 잡힙니다.' },
    overdue_3plus:    { icon: '🔥', title: '3일 이상 지연 — 미완료 업무', hint: '3일 넘게 지연된 업무. 완료/재조정 필요.' },
  }
  const alertInfo = alertParam ? ALERT_INFO[alertParam] : null

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">업무 관리</h1>
          <p className="text-gray-500 text-sm mt-1">{isAdmin ? '전체 업무 현황' : '내 담당 업무'}</p>
        </div>
      </div>

      {alertInfo && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-base">{alertInfo.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-900">{alertInfo.title}</p>
            <p className="text-[11px] text-amber-700 mt-0.5">{alertInfo.hint}</p>
          </div>
          <a href="/tasks" className="text-xs px-2.5 py-1 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-700 font-medium flex-shrink-0">모두 보기</a>
        </div>
      )}

      <TasksClient tasks={tasks} profiles={profiles ?? []} sales={sales ?? []} isAdmin={isAdmin} currentUserId={user.id} alert={alertParam} />
    </div>
  )
}

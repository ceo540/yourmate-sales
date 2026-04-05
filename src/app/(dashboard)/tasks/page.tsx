import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TasksClient from './TasksClient'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminSupabase = createAdminClient()

  const { data: profile } = await adminSupabase.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

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

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const saleMap = Object.fromEntries((sales ?? []).map(s => [s.id, s]))

  const tasks = (rawTasks ?? []).map(t => ({
    ...t,
    assignee: t.assignee_id ? (profileMap[t.assignee_id] ?? null) : null,
    sale: t.project_id ? (saleMap[t.project_id] ?? null) : null,
  }))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">업무 관리</h1>
          <p className="text-gray-500 text-sm mt-1">{isAdmin ? '전체 업무 현황' : '내 담당 업무'}</p>
        </div>
      </div>
      <TasksClient tasks={tasks} profiles={profiles ?? []} sales={sales ?? []} isAdmin={isAdmin} currentUserId={user.id} />
    </div>
  )
}

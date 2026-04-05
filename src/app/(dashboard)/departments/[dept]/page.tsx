import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS, Department } from '@/types'
import DeptClient from './DeptClient'

const DEPT_ICONS: Record<Department, string> = {
  sound_of_school:    '🎵',
  artkiwoom:          '🎨',
  school_store:       '🏫',
  '002_creative':     '🎬',
  yourmate:           '🏢',
  '002_entertainment':'🎤',
}

export default async function DeptPage({ params }: { params: Promise<{ dept: string }> }) {
  const { dept } = await params

  if (!DEPARTMENT_LABELS[dept as Department]) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const currentYear = new Date().getFullYear()

  // 해당 사업부 프로젝트 목록
  const { data: salesRaw } = await supabase
    .from('sales')
    .select('id, name, service_type, payment_status, revenue, inflow_date, client_org, assignee_id, memo')
    .eq('department', dept)
    .order('created_at', { ascending: false })

  // 전체 profiles (담당자 필터 + 새 건 폼용)
  const { data: allProfiles } = await supabase.from('profiles').select('id, name').order('name')
  const profileMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p.name]))

  const sales = (salesRaw ?? []).map(s => ({
    ...s,
    assignee: s.assignee_id ? { name: profileMap[s.assignee_id] ?? '' } : null,
  }))

  // 해당 사업부 목표
  const { data: goals } = await supabase
    .from('department_goals')
    .select('*')
    .eq('department', dept)
    .eq('year', currentYear)
    .order('created_at', { ascending: true })

  // 해당 사업부 업무 (sales.department = dept 인 project의 tasks)
  const admin = createAdminClient()
  const saleIds = (salesRaw ?? []).map(s => s.id)
  let tasks: any[] = []
  if (saleIds.length > 0) {
    const { data: rawTasks } = await admin
      .from('tasks')
      .select('*')
      .in('project_id', saleIds)
      .order('due_date', { ascending: true, nullsFirst: false })

    const assigneeIds = [...new Set((rawTasks ?? []).map((t: any) => t.assignee_id).filter(Boolean))]
    let taskProfileMap: Record<string, string> = {}
    if (assigneeIds.length > 0) {
      const { data: taskProfiles } = await admin.from('profiles').select('id, name').in('id', assigneeIds)
      taskProfileMap = Object.fromEntries((taskProfiles ?? []).map(p => [p.id, p.name]))
    }
    const saleNameMap = Object.fromEntries((salesRaw ?? []).map(s => [s.id, s.name]))

    tasks = (rawTasks ?? []).map((t: any) => ({
      ...t,
      assignee: t.assignee_id ? { name: taskProfileMap[t.assignee_id] ?? '' } : null,
      sale: t.project_id ? { name: saleNameMap[t.project_id] ?? '' } : null,
    }))
  }

  // 매출 건별 업무 통계 (진행률 바용)
  const taskStatsBySale: Record<string, { total: number; done: number; urgent: number }> = {}
  for (const t of tasks) {
    if (!t.project_id) continue
    if (!taskStatsBySale[t.project_id]) taskStatsBySale[t.project_id] = { total: 0, done: 0, urgent: 0 }
    taskStatsBySale[t.project_id].total++
    if (t.status === '완료') taskStatsBySale[t.project_id].done++
    if ((t.priority === '긴급' || t.priority === '높음') && t.status !== '완료' && t.status !== '보류') {
      const due = t.due_date ? new Date(t.due_date) : null
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (due && due <= new Date(today.getTime() + 3 * 86400000)) {
        taskStatsBySale[t.project_id].urgent++
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <Link href="/departments" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
          ← 사업부 목록
        </Link>
      </div>
      <DeptClient
        dept={dept}
        deptLabel={DEPARTMENT_LABELS[dept as Department]}
        deptIcon={DEPT_ICONS[dept as Department]}
        sales={sales}
        goals={goals ?? []}
        tasks={tasks}
        profiles={allProfiles ?? []}
        taskStatsBySale={taskStatsBySale}
        isAdmin={isAdmin}
        year={currentYear}
      />
    </div>
  )
}

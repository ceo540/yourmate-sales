import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import ProjectHubClient from './ProjectHubClient'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [{ data: profile }, { data: project }] = await Promise.all([
    admin.from('profiles').select('id, role, name').eq('id', user.id).single(),
    admin.from('projects').select('*').eq('id', id).single(),
  ])
  if (!project) notFound()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  const [
    { data: membersRaw },
    { data: contractsRaw },
    { data: profiles },
    { data: customers },
    { data: logsRaw },
    { data: salesOptionsRaw },
    { data: entities },
    { data: leadsRaw },
    { data: personsRaw },
  ] = await Promise.all([
    admin.from('project_members').select('profile_id, role, profiles:profile_id(id, name)').eq('project_id', id),
    admin.from('sales').select('*, payment_schedules(*)').eq('project_id', id).order('created_at'),
    admin.from('profiles').select('id, name').order('name'),
    admin.from('customers').select('id, name, type, contact_name, phone, contact_email').order('name'),
    admin.from('project_logs')
      .select('id, content, log_type, log_category, contacted_at, created_at, author_id, location, participants, outcome, sale_id')
      .eq('project_id', id)
      .order('contacted_at', { ascending: false })
      .limit(100),
    admin.from('sales').select('id, name, revenue').is('project_id', null).order('created_at', { ascending: false }).limit(200),
    admin.from('business_entities').select('id, name'),
    admin.from('leads').select('id, lead_id, project_name, status, inflow_date, assignee_id').eq('project_id', id),
    admin.from('persons').select('id, name, phone, email').order('name').limit(500),
  ])

  const contractIds = (contractsRaw ?? []).map(c => c.id)

  const [{ data: tasksRaw }, { data: costsRaw }] = await Promise.all([
    contractIds.length > 0
      ? admin.from('tasks').select('*').in('project_id', contractIds).order('created_at')
      : Promise.resolve({ data: [] }),
    contractIds.length > 0
      ? admin.from('sale_costs').select('*').in('sale_id', contractIds).order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const entityMap = Object.fromEntries((entities ?? []).map(e => [e.id, e.name]))

  const members = (membersRaw ?? []).map((m: any) => ({
    profile_id: m.profile_id,
    role: m.role,
    name: (m.profiles as any)?.name ?? '알 수 없음',
  }))

  const contracts = (contractsRaw ?? []).map(c => ({
    ...c,
    payment_schedules: (c as any).payment_schedules ?? [],
    assignee_name: (c as any).assignee_id ? (profileMap[(c as any).assignee_id]?.name ?? null) : null,
    entity_name: (c as any).entity_id ? (entityMap[(c as any).entity_id] ?? null) : null,
    entity_id: (c as any).entity_id ?? null,
    payment_date: (c as any).payment_date ?? null,
    dropbox_url: (c as any).dropbox_url ?? null,
  }))

  const tasks = (tasksRaw ?? []).map(t => ({
    ...t,
    assignee: t.assignee_id ? (profileMap[t.assignee_id] ?? null) : null,
  }))

  // 이 프로젝트에 연결된 리드들의 소통내역도 함께 조회 (계약 전환 전 히스토리 보존)
  const leadIds = (leadsRaw ?? []).map((l: any) => l.id)
  let leadLogsRaw: any[] = []
  if (leadIds.length > 0) {
    const { data } = await admin.from('project_logs')
      .select('id, content, log_type, log_category, contacted_at, created_at, author_id, location, participants, outcome, sale_id, lead_id')
      .in('lead_id', leadIds)
      .order('contacted_at', { ascending: false })
      .limit(200)
    leadLogsRaw = data ?? []
  }

  // 프로젝트 로그 + 리드 로그 모두 합산하여 author 조회
  const authorIds = [...new Set([
    ...(logsRaw ?? []).map((l: any) => l.author_id),
    ...leadLogsRaw.map((l: any) => l.author_id),
  ].filter(Boolean))]
  let logAuthorMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: logProfiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    logAuthorMap = Object.fromEntries((logProfiles ?? []).map(p => [p.id, p.name]))
  }

  // 프로젝트 로그와 리드 로그를 합쳐 contacted_at 기준 내림차순 정렬
  const projectLogs = (logsRaw ?? []).map((l: any) => ({
    ...l, lead_id: null,
    author: l.author_id ? { name: logAuthorMap[l.author_id] ?? '알 수 없음' } : null,
  }))
  const leadLogs = leadLogsRaw.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: logAuthorMap[l.author_id] ?? '알 수 없음' } : null,
  }))
  const logs = [...projectLogs, ...leadLogs].sort((a, b) => {
    const da = new Date(a.contacted_at ?? a.created_at).getTime()
    const db = new Date(b.contacted_at ?? b.created_at).getTime()
    return db - da
  })

  const customer = project.customer_id
    ? (customers ?? []).find(c => c.id === project.customer_id) ?? null
    : null

  const costs = (costsRaw ?? [])

  const leadAssigneeIds = [...new Set((leadsRaw ?? []).map((l: any) => l.assignee_id).filter(Boolean))]
  let leadAssigneeMap: Record<string, string> = {}
  if (leadAssigneeIds.length > 0) {
    const { data: lp } = await admin.from('profiles').select('id, name').in('id', leadAssigneeIds)
    leadAssigneeMap = Object.fromEntries((lp ?? []).map(p => [p.id, p.name]))
  }
  const leads = (leadsRaw ?? []).map((l: any) => ({
    id: l.id,
    lead_id: l.lead_id ?? '',
    project_name: l.project_name ?? null,
    status: l.status ?? null,
    inflow_date: l.inflow_date ?? null,
    assignee_name: l.assignee_id ? (leadAssigneeMap[l.assignee_id] ?? null) : null,
  }))

  return (
    <>
      <ProjectHubClient
        project={{
          id: project.id,
          name: project.name,
          service_type: project.service_type ?? null,
          department: project.department ?? null,
          status: project.status ?? '진행중',
          dropbox_url: project.dropbox_url ?? null,
          memo: project.memo ?? null,
          notes: project.notes ?? null,
          customer_id: project.customer_id ?? null,
          pm_id: project.pm_id ?? null,
        }}
        members={members}
        contracts={contracts}
        tasks={tasks}
        logs={logs}
        costs={costs}
        profiles={profiles ?? []}
        customers={customers ?? []}
        customer={customer}
        salesOptions={(salesOptionsRaw ?? []).map(s => ({ id: s.id, name: s.name, revenue: s.revenue ?? null }))}
        leads={leads}
        entities={entities ?? []}
        persons={(personsRaw ?? []).map((p: any) => ({ id: p.id, name: p.name, phone: p.phone ?? null, email: p.email ?? null }))}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </>
  )
}

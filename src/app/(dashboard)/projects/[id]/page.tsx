import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import { createProfileNameMap } from '@/lib/utils'
import ProjectV2Client from './ProjectV2Client'

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

  const isAdmin = isAdminOrManager(profile?.role)

  const [
    { data: membersRaw },
    { data: contractsRaw },
    { data: profilesRaw },
    { data: customer },
    { data: customersAll },
    { data: logsRaw },
    { data: leadsRaw },
    { data: memosRaw },
  ] = await Promise.all([
    admin.from('project_members').select('profile_id, role').eq('project_id', id),
    admin.from('sales').select('id, name, revenue, contract_stage, progress_status, inflow_date, payment_date, client_org, client_dept, contract_split_reason, dropbox_url, final_quote_dropbox_path, assignee_id, entity_id, payment_schedules(*)').eq('project_id', id).order('created_at'),
    admin.from('profiles').select('id, name'),
    project.customer_id
      ? admin.from('customers').select('id, name, type, contact_name, phone, contact_email').eq('id', project.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('customers').select('id, name, type').order('name').limit(500),
    admin.from('project_logs')
      .select('id, content, log_type, log_category, contacted_at, created_at, author_id, location, participants, outcome, sale_id')
      .eq('project_id', id)
      .order('contacted_at', { ascending: false })
      .limit(100),
    admin.from('leads').select('id, lead_id').eq('project_id', id),
    admin.from('project_memos').select('id, title, content, created_at, updated_at, author_id').eq('project_id', id).order('created_at', { ascending: false }),
  ])

  const { data: entitiesRaw } = await admin
    .from('business_entities')
    .select('id, name, short_name, is_primary, usage_note, status')
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .order('name')

  const profileNameMap = createProfileNameMap(profilesRaw)

  const contractIds = (contractsRaw ?? []).map(c => c.id)
  const [{ data: tasksRaw }, { data: costsRaw }, { data: rentalsRaw }] = await Promise.all([
    contractIds.length > 0
      ? admin.from('tasks').select('id, title, status, priority, due_date, project_id, assignee_id, description, bbang_suggested').in('project_id', contractIds).order('created_at')
      : Promise.resolve({ data: [] }),
    contractIds.length > 0
      ? admin.from('sale_costs').select('*').in('sale_id', contractIds).order('created_at')
      : Promise.resolve({ data: [] }),
    contractIds.length > 0
      ? admin.from('rentals').select('id, sale_id, customer_name, status, rental_start, rental_end').in('sale_id', contractIds).order('created_at')
      : Promise.resolve({ data: [] }),
  ])

  const pmMember = (membersRaw ?? []).find(m => m.role === 'PM')
  const pmId = pmMember?.profile_id ?? project.pm_id ?? null
  const pmName = pmId ? (profileNameMap[pmId] ?? null) : null

  let contactPerson: { id: string; name: string; dept: string | null; title: string | null; phone: string | null; email: string | null } | null = null
  if (project.contact_person_id) {
    // 프로젝트별로 명시적 지정된 person
    const { data: person } = await admin
      .from('persons')
      .select('id, name, phone, email')
      .eq('id', project.contact_person_id)
      .maybeSingle()
    if (person) {
      let dept: string | null = null
      let title: string | null = null
      if (project.customer_id) {
        const { data: rel } = await admin
          .from('person_org_relations')
          .select('dept, title')
          .eq('customer_id', project.customer_id)
          .eq('person_id', person.id)
          .maybeSingle()
        dept = rel?.dept ?? null
        title = rel?.title ?? null
      }
      contactPerson = {
        id: person.id,
        name: person.name,
        dept,
        title,
        phone: person.phone ?? null,
        email: person.email ?? null,
      }
    }
  } else if (project.customer_id) {
    // fallback: customer 안의 is_current=true person 1명 (기존 동작)
    const { data: rels } = await admin
      .from('person_org_relations')
      .select('dept, title, persons(id, name, phone, email)')
      .eq('customer_id', project.customer_id)
      .eq('is_current', true)
      .limit(1)
    const rel = (rels as any[])?.[0]
    if (rel?.persons) {
      contactPerson = {
        id: rel.persons.id,
        name: rel.persons.name,
        dept: rel.dept ?? null,
        title: rel.title ?? null,
        phone: rel.persons.phone ?? null,
        email: rel.persons.email ?? null,
      }
    }
  }

  // customer 안의 person list (PersonPicker용)
  let customerPersons: { id: string; name: string; dept: string | null; title: string | null }[] = []
  if (project.customer_id) {
    const { data: rels } = await admin
      .from('person_org_relations')
      .select('dept, title, persons(id, name)')
      .eq('customer_id', project.customer_id)
    customerPersons = ((rels as any[]) ?? [])
      .filter(r => r.persons)
      .map(r => ({ id: r.persons.id, name: r.persons.name, dept: r.dept ?? null, title: r.title ?? null }))
  }

  const logs = (logsRaw ?? []).map(l => ({
    id: l.id, content: l.content, log_type: l.log_type, log_category: l.log_category ?? null,
    contacted_at: l.contacted_at, created_at: l.created_at,
    author_name: l.author_id ? (profileNameMap[l.author_id] ?? null) : null,
    sale_id: l.sale_id ?? null,
    location: l.location ?? null,
    participants: l.participants ?? null,
    outcome: l.outcome ?? null,
  }))

  const totalRevenue = (contractsRaw ?? []).reduce((s, c: any) => s + (c.revenue ?? 0), 0)
  const totalCost = (costsRaw ?? []).reduce((s, c: any) => s + (c.amount ?? 0), 0)
  const totalReceived = (contractsRaw ?? []).reduce((sum, c: any) => {
    return sum + ((c.payment_schedules ?? []).filter((p: any) => p.is_received).reduce((s: number, p: any) => s + (p.amount ?? 0), 0))
  }, 0)

  return (
    <ProjectV2Client
      project={{
        id: project.id,
        name: project.name,
        project_number: project.project_number ?? null,
        service_type: project.service_type ?? null,
        department: project.department ?? null,
        status: project.status ?? '진행중',
        dropbox_url: project.dropbox_url ?? null,
        memo: project.memo ?? null,
        notes: project.notes ?? null,
        overview_summary: project.overview_summary ?? null,
        work_description: project.work_description ?? null,
        pending_discussion: project.pending_discussion ?? null,
        pending_discussion_client: project.pending_discussion_client ?? null,
        pending_discussion_internal: project.pending_discussion_internal ?? null,
        pending_discussion_vendor: project.pending_discussion_vendor ?? null,
        customer_id: project.customer_id ?? null,
        contact_person_id: project.contact_person_id ?? null,
        pm_id: pmId,
        linked_calendar_events: project.linked_calendar_events ?? null,
      }}
      customerPersons={customerPersons}
      pmName={pmName}
      customer={customer ? { id: customer.id, name: customer.name, type: customer.type ?? null, contact_name: customer.contact_name ?? null, phone: customer.phone ?? null, contact_email: customer.contact_email ?? null } : null}
      contactPerson={contactPerson}
      finance={{ revenue: totalRevenue, cost: totalCost, received: totalReceived, contractCount: (contractsRaw ?? []).length }}
      contracts={(contractsRaw ?? []).map((c: any) => ({
        id: c.id, name: c.name, revenue: c.revenue ?? null,
        contract_stage: c.contract_stage ?? null, progress_status: c.progress_status ?? null,
        client_org: c.client_org ?? null,
        client_dept: c.client_dept ?? null,
        entity_id: c.entity_id ?? null,
        dropbox_url: c.dropbox_url ?? null,
        contract_split_reason: c.contract_split_reason ?? null,
        inflow_date: c.inflow_date ?? null,
        payment_date: c.payment_date ?? null,
        final_quote_dropbox_path: c.final_quote_dropbox_path ?? null,
        payment_schedules: ((c.payment_schedules ?? []) as any[])
          .map(p => ({
            id: p.id, label: p.label, amount: p.amount ?? 0,
            due_date: p.due_date ?? null, is_received: !!p.is_received,
            received_date: p.received_date ?? null,
            sort_order: p.sort_order ?? 0,
          }))
          .sort((a, b) => a.sort_order - b.sort_order),
      }))}
      entities={(entitiesRaw ?? []).map((e: any) => ({
        id: e.id, name: e.name, short_name: e.short_name ?? null,
        is_primary: !!e.is_primary, usage_note: e.usage_note ?? null,
      }))}
      tasks={(tasksRaw ?? []).map((t: any) => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority ?? null,
        due_date: t.due_date ?? null, project_id: t.project_id ?? null,
        assignee_id: t.assignee_id ?? null,
        assignee_name: t.assignee_id ? (profileNameMap[t.assignee_id] ?? null) : null,
        description: t.description ?? null,
        bbang_suggested: !!t.bbang_suggested,
      }))}
      profiles={(profilesRaw ?? []).map(p => ({ id: p.id, name: p.name ?? '' }))}
      logs={logs}
      rentals={(rentalsRaw ?? []).map((r: any) => ({
        id: r.id, sale_id: r.sale_id, customer_name: r.customer_name ?? '',
        status: r.status ?? '', rental_start: r.rental_start ?? null, rental_end: r.rental_end ?? null,
      }))}
      leadIds={(leadsRaw ?? []).map((l: any) => l.id)}
      isAdmin={isAdmin}
      currentUserId={user.id}
      members={(membersRaw ?? []).map((m: any) => ({
        profile_id: m.profile_id,
        role: m.role,
        name: profileNameMap[m.profile_id] ?? '',
      }))}
      customersAll={(customersAll ?? []).map((c: any) => ({ id: c.id, name: c.name, type: c.type ?? null }))}
      memos={(memosRaw ?? []).map((m: any) => ({
        id: m.id,
        title: m.title ?? null,
        content: m.content ?? null,
        created_at: m.created_at,
        updated_at: m.updated_at,
        author_name: m.author_id ? (profileNameMap[m.author_id] ?? null) : null,
      }))}
    />
  )
}

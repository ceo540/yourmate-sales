import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ContractHubClient from './ContractHubClient'

export default async function ContractHubPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const { getAccessLevel } = await import('@/lib/permissions')
  const accessLevel = await getAccessLevel(profile?.role, 'sales')
  if (accessLevel === 'off') redirect('/dashboard')

  // FK 조인 없이 별도 쿼리 (이 Supabase 프로젝트는 FK 제약 없음)
  const { data: salesRaw } = await admin
    .from('sales')
    .select(`
      id, name, client_org, service_type, department,
      revenue, inflow_date, contract_stage, contract_type,
      contract_contact_name, contract_contact_phone, contract_docs,
      assignee_id, entity_id
    `)
    .not('contract_stage', 'is', null)
    .order('inflow_date', { ascending: false })

  // 담당자 + 사업자 별도 조회
  const [{ data: profiles }, { data: entities }] = await Promise.all([
    admin.from('profiles').select('id, name').order('name'),
    admin.from('business_entities').select('id, name').order('name'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const entityMap = Object.fromEntries((entities ?? []).map(e => [e.id, e]))

  // 수금 일정 조회
  const saleIds = (salesRaw ?? []).map((s: any) => s.id)
  const { data: schedulesRaw } = saleIds.length > 0
    ? await admin
        .from('payment_schedules')
        .select('id, sale_id, label, amount, due_date, received_date, is_received, note, sort_order')
        .in('sale_id', saleIds)
        .order('sort_order', { ascending: true })
    : { data: [] }

  const schedulesBySale: Record<string, any[]> = {}
  for (const s of (schedulesRaw ?? [])) {
    if (!schedulesBySale[s.sale_id]) schedulesBySale[s.sale_id] = []
    schedulesBySale[s.sale_id].push(s)
  }

  const sales = (salesRaw ?? []).map((s: any) => ({
    ...s,
    assignee: s.assignee_id ? (profileMap[s.assignee_id] ?? null) : null,
    entity: s.entity_id ? (entityMap[s.entity_id] ?? null) : null,
    contract_docs: s.contract_docs ?? null,
    payment_schedules: schedulesBySale[s.id] ?? [],
  }))

  return <ContractHubClient sales={sales} />
}

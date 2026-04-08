import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import LeadsClient from './LeadsClient'


export default async function LeadsPage({ searchParams }: { searchParams: any }) {
  const params = await searchParams
  const initialClientOrg = params?.new === '1' ? (params?.client_org || '') : ''

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const role = profile?.role || 'member'

  const leadsQuery = admin.from('leads').select('*').order('inflow_date', { ascending: false })
  const [{ data: leadsRaw }, { data: profilesRaw }, { data: personsRaw }] = await Promise.all([
    role === 'member' ? leadsQuery.eq('assignee_id', user.id) : leadsQuery,
    admin.from('profiles').select('id, name').order('name'),
    admin.from('persons').select('id, name, phone, email, person_org_relations(dept, title, is_current, customers(id, name))').order('name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p]))

  // 담당자 맵 (person_id → 이름 + 현재 소속)
  const personMap = Object.fromEntries((personsRaw ?? []).map((p: any) => {
    const cur = (p.person_org_relations ?? []).find((r: any) => r.is_current)
    return [p.id, {
      id: p.id, name: p.name, phone: p.phone || '', email: p.email || '',
      currentOrg: cur?.customers?.name || '',
      title: cur?.title || '',
    }]
  }))

  // persons 선택용 목록 (폼에서 사용)
  const personOptions = (personsRaw ?? []).map((p: any) => {
    const cur = (p.person_org_relations ?? []).find((r: any) => r.is_current)
    return { id: p.id, name: p.name, phone: p.phone || '', email: p.email || '', currentOrg: cur?.customers?.name || '', title: cur?.title || '' }
  })

  // 연관 매출건 조회 (lead_id 기반)
  const leadIds = (leadsRaw ?? []).map((l: any) => l.id)
  const { data: relatedSalesRaw } = leadIds.length > 0
    ? await admin.from('sales').select('id, name, payment_status, progress_status, revenue, lead_id').in('lead_id', leadIds)
    : { data: [] }

  const relatedSalesMap: Record<string, any[]> = {}
  for (const s of (relatedSalesRaw ?? [])) {
    if (s.lead_id) {
      if (!relatedSalesMap[s.lead_id]) relatedSalesMap[s.lead_id] = []
      relatedSalesMap[s.lead_id].push(s)
    }
  }

  const leads = (leadsRaw ?? []).map((l: any) => ({
    ...l,
    assignee: l.assignee_id ? (profileMap[l.assignee_id] ?? null) : null,
    person: l.person_id ? (personMap[l.person_id] ?? null) : null,
    relatedSales: relatedSalesMap[l.id] ?? [],
  }))

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리드 관리</h1>
          <p className="text-gray-500 text-sm mt-1">잠재 고객 문의 및 영업 파이프라인</p>
        </div>
      </div>
      <LeadsClient
        leads={leads}
        profiles={profilesRaw ?? []}
        persons={personOptions}
        currentUserId={user.id}
        isAdmin={role === 'admin' || role === 'manager'}
        initialClientOrg={initialClientOrg}
      />
    </div>
  )
}

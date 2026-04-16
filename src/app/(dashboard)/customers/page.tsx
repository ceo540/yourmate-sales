import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomersClient from './CustomersClient'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  // 기관 + 소속관계(담당자 포함)
  const { data: customersRaw } = await supabase
    .from('customers')
    .select(`
      *,
      person_org_relations(
        id, dept, title, started_at, ended_at, is_current,
        persons(id, name, phone, email)
      )
    `)
    .order('name')

  // 담당자 + 소속이력(기관명 포함)
  const { data: personsRaw } = await supabase
    .from('persons')
    .select(`
      *,
      person_org_relations(
        id, dept, title, started_at, ended_at, is_current,
        customers(id, name)
      )
    `)
    .order('name')

  // 기관별 매출 집계 (customer_id 연결된 것만, 필요한 컬럼만 선택)
  const { data: salesAgg } = await supabase
    .from('sales')
    .select('id, customer_id, revenue, title, service_type, created_at')
    .not('customer_id', 'is', null)

  // 기관 데이터 가공
  const customers = (customersRaw ?? []).map((c: any) => {
    const orgSales = (salesAgg ?? []).filter((s: any) => s.customer_id === c.id)
    const totalSales = orgSales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
    const contacts = (c.person_org_relations ?? []).map((r: any) => ({
      id:          r.id,
      person_id:   r.persons?.id,
      person_name: r.persons?.name,
      person_phone: r.persons?.phone,
      person_email: r.persons?.email,
      dept:        r.dept,
      title:       r.title,
      started_at:  r.started_at,
      ended_at:    r.ended_at,
      is_current:  r.is_current,
    }))
    const lastSale = orgSales.sort((a: any, b: any) => b.created_at?.localeCompare(a.created_at))[0]
    return {
      id: c.id, name: c.name, type: c.type || '기타',
      region: c.region || '', phone: c.phone || '', notes: c.notes || '',
      created_at: c.created_at,
      total_sales: totalSales,
      sales_count: orgSales.length,
      last_deal_date: lastSale?.created_at?.slice(0, 10) || null,
      contacts,
      sales: orgSales.map((s: any) => ({
        id: s.id, title: s.title, amount: s.revenue || 0,
        service_type: s.service_type, date: s.created_at?.slice(0, 10),
      })),
    }
  })

  // 담당자별 리드 이력 조회
  const personIds = (personsRaw ?? []).map((p: any) => p.id)
  const { data: personLeadsRaw } = personIds.length > 0
    ? await supabase.from('leads').select('id, lead_id, client_org, service_type, status, inflow_date, converted_sale_id, person_id').in('person_id', personIds).order('inflow_date', { ascending: false })
    : { data: [] }

  const leadsByPerson: Record<string, any[]> = {}
  for (const l of (personLeadsRaw ?? [])) {
    if (l.person_id) {
      if (!leadsByPerson[l.person_id]) leadsByPerson[l.person_id] = []
      leadsByPerson[l.person_id].push(l)
    }
  }

  // 담당자 리드에 연결된 매출건 조회
  const personLeadIds = (personLeadsRaw ?? []).map((l: any) => l.id)
  const { data: personSalesRaw } = personLeadIds.length > 0
    ? await supabase.from('sales').select('id, lead_id, name, revenue, payment_status, service_type').in('lead_id', personLeadIds)
    : { data: [] }

  const personSalesByLead: Record<string, any[]> = {}
  for (const s of (personSalesRaw ?? [])) {
    if (s.lead_id) {
      if (!personSalesByLead[s.lead_id]) personSalesByLead[s.lead_id] = []
      personSalesByLead[s.lead_id].push(s)
    }
  }

  // 담당자 데이터 가공
  const persons = (personsRaw ?? []).map((p: any) => {
    const job_history = (p.person_org_relations ?? [])
      .sort((a: any, b: any) => (a.started_at || '').localeCompare(b.started_at || ''))
      .map((r: any) => ({
        id:           r.id,
        customer_id:  r.customers?.id,
        customer_name: r.customers?.name,
        dept:         r.dept,
        title:        r.title,
        started_at:   r.started_at,
        ended_at:     r.ended_at,
        is_current:   r.is_current,
      }))
    const personLeads = leadsByPerson[p.id] ?? []
    const personSales = personLeads.flatMap((l: any) => personSalesByLead[l.id] ?? [])
    const totalSales = personSales.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
    return {
      id: p.id, name: p.name, phone: p.phone || '',
      email: p.email || '', notes: p.notes || '',
      channeltalk_user_id: p.channeltalk_user_id || null,
      created_at: p.created_at,
      job_history,
      leads: personLeads,
      sales: personSales.map((s: any) => ({ id: s.id, name: s.name, revenue: s.revenue || 0, payment_status: s.payment_status, service_type: s.service_type })),
      total_sales: totalSales,
    }
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">고객 DB</h1>
          <p className="text-gray-500 text-sm mt-1">기관·담당자 통합 관리 — 이직 이력 추적</p>
        </div>
      </div>
      <CustomersClient
        customers={customers}
        persons={persons}
        isAdmin={isAdmin}
      />
    </div>
  )
}

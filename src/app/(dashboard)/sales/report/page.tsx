import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SalesReportClient from './SalesReportClient'

export default async function SalesReportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: vendors }, { data: entities }, { data: profiles }, { data: customersRaw }] = await Promise.all([
    supabase.from('profiles').select('id, role, departments').eq('id', user.id).single(),
    supabase.from('vendors').select('id, name, type').order('name'),
    supabase.from('business_entities').select('id, name, entity_type').order('name'),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('customers').select('id, name, type').order('name'),
  ])
  const customers = (customersRaw ?? []) as { id: string; name: string; type: string }[]

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'
  const rawDepts = (profile as any)?.departments
  const myDepts: string[] = Array.isArray(rawDepts) ? rawDepts : (typeof rawDepts === 'string' ? (() => { try { return JSON.parse(rawDepts) } catch { return [] } })() : [])

  let salesQuery = supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    const uid = profile?.id ?? user.id
    if (myDepts.length > 0) {
      salesQuery = salesQuery.or(`department.in.(${myDepts.join(',')}),assignee_id.eq.${uid}`)
    } else {
      salesQuery = salesQuery.eq('assignee_id', uid)
    }
  }

  const [{ data: salesRaw }, { data: allCosts }] = await Promise.all([
    salesQuery,
    supabase.from('sale_costs').select('*'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))
  const entityMap = Object.fromEntries((entities ?? []).map(e => [e.id, { id: e.id, name: e.name }]))
  const costsMap: Record<string, any[]> = {}
  for (const cost of (allCosts ?? [])) {
    if (!costsMap[cost.sale_id]) costsMap[cost.sale_id] = []
    costsMap[cost.sale_id].push(cost)
  }

  const sales = (salesRaw ?? []).map((s: any) => ({
    ...s,
    assignee: s.assignee_id ? (profileMap[s.assignee_id] ?? null) : null,
    entity: s.entity_id ? (entityMap[s.entity_id] ?? null) : null,
    sale_costs: costsMap[s.id] ?? [],
  }))

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계약 목록</h1>
          <p className="text-gray-500 text-sm mt-1">전체 계약 건 목록 및 원가 관리</p>
        </div>
        <Link
          href="/sales/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 새 매출 건
        </Link>
      </div>
      <SalesReportClient sales={sales ?? []} vendors={vendors ?? []} entities={entities ?? []} profiles={profiles ?? []} customers={customers} isAdmin={isAdmin} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SalesReportClient from './SalesReportClient'

export default async function SalesReportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: profile }, { data: vendors }, { data: entities }, { data: profiles }] = await Promise.all([
    supabase.from('profiles').select('id, role, departments').eq('id', user!.id).single(),
    supabase.from('vendors').select('id, name, type').order('name'),
    supabase.from('business_entities').select('id, name, entity_type').order('name'),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'
  const myDepts: string[] = profile?.departments ?? []

  let salesQuery = supabase
    .from('sales')
    .select('*, assignee:profiles!assignee_id(id, name), entity:business_entities!entity_id(id, name), sale_costs(*)')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    if (myDepts.length > 0) {
      salesQuery = salesQuery.or(`department.in.(${myDepts.join(',')}),assignee_id.eq.${profile!.id}`)
    } else {
      salesQuery = salesQuery.eq('assignee_id', profile!.id)
    }
  }

  const { data: sales } = await salesQuery

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 보고서</h1>
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
      <SalesReportClient sales={sales ?? []} vendors={vendors ?? []} entities={entities ?? []} profiles={profiles ?? []} isAdmin={isAdmin} />
    </div>
  )
}

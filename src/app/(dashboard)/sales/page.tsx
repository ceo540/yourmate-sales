import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SalesClient from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role, departments').eq('id', user.id).single()
  const { getAccessLevel } = await import('@/lib/permissions')
  const accessLevel = await getAccessLevel(profile?.role, 'sales')
  if (accessLevel === 'off') redirect('/dashboard')

  const isAdmin = profile?.role === 'admin'
  const showAll = isAdmin || accessLevel === 'full' || accessLevel === 'read'
  const myDepts: string[] = (profile as any)?.departments ?? []

  const [{ data: vendors }, { data: entities }] = await Promise.all([
    supabase.from('vendors').select('id, name, type').order('name'),
    supabase.from('business_entities').select('id, name, business_number').order('name'),
  ])

  let salesQuery = supabase
    .from('sales')
    .select('*, assignee:profiles!assignee_id(id, name), entity:business_entities!entity_id(id, name), sale_costs(*)')
    .order('created_at', { ascending: false })

  if (!showAll) {
    const uid = profile?.id ?? user.id
    if (myDepts.length > 0) {
      salesQuery = salesQuery.or(`department.in.(${myDepts.join(',')}),assignee_id.eq.${uid}`)
    } else {
      salesQuery = salesQuery.eq('assignee_id', uid)
    }
  }

  const { data: sales } = await salesQuery

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 관리</h1>
          <p className="text-gray-500 text-sm mt-1">전사 매출 · 원가 · 수익 현황</p>
        </div>
        <Link
          href="/sales/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 새 매출 건
        </Link>
      </div>
      <SalesClient sales={sales ?? []} vendors={vendors ?? []} entities={entities ?? []} isAdmin={isAdmin} />
    </div>
  )
}

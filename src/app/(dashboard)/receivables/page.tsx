import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createProfileMap } from '@/lib/utils'
import ReceivablesClient from './ReceivablesClient'

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { getAccessLevel } = await import('@/lib/permissions')
  const accessLevel = await getAccessLevel(profile?.role, 'receivables')
  if (accessLevel === 'off') redirect('/dashboard')

  const [{ data: salesRaw }, { data: entities }, { data: profiles }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, name, revenue, contract_stage, inflow_date, created_at, assignee_id, entity_id')
      .neq('contract_stage', '잔금')
      .not('contract_stage', 'is', null)
      .neq('contract_stage', '계약')
      .gt('revenue', 0)
      .order('created_at', { ascending: false }),
    supabase.from('business_entities').select('id, name').order('name'),
    supabase.from('profiles').select('id, name'),
  ])

  const profileMap = createProfileMap(profiles)
  const entityMap = Object.fromEntries((entities ?? []).map(e => [e.id, { id: e.id, name: e.name }]))
  const sales = (salesRaw ?? []).map((s: any) => ({
    ...s,
    entity: s.entity_id ? (entityMap[s.entity_id] ?? null) : null,
    assignee: s.assignee_id ? (profileMap[s.assignee_id] ?? null) : null,
  }))

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">미수금 현황</h1>
        <p className="text-gray-500 text-sm mt-1">미수금 계약 전체 목록</p>
      </div>
      <ReceivablesClient sales={(sales ?? []) as any[]} entities={entities ?? []} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
      .select('id, name, revenue, payment_status, inflow_date, created_at, assignee_id, entity_id')
      .neq('payment_status', '완납')
      .not('payment_status', 'is', null)
      .neq('payment_status', '계약전')
      .gt('revenue', 0)
      .order('created_at', { ascending: false }),
    supabase.from('business_entities').select('id, name').order('name'),
    supabase.from('profiles').select('id, name'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, { id: p.id, name: p.name }]))
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

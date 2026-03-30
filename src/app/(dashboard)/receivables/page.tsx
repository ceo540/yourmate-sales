import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReceivablesClient from './ReceivablesClient'

export default async function ReceivablesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: sales }, { data: entities }] = await Promise.all([
    supabase
      .from('sales')
      .select('id, name, revenue, payment_status, inflow_date, created_at, entity:business_entities!left(id, name), assignee:profiles!left(id, name)')
      .neq('payment_status', '완납')
      .not('payment_status', 'is', null)
      .neq('payment_status', '계약전')
      .gt('revenue', 0)
      .order('created_at', { ascending: false }),
    supabase.from('business_entities').select('id, name').order('name'),
  ])

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

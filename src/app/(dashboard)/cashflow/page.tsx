import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CashflowClient from './CashflowClient'

export default async function CashflowPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const [accountsResult, txResult] = await Promise.all([
    admin.from('financial_accounts').select('*').order('business_entity').order('created_at'),
    admin.from('cashflow').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
  ])
  if (accountsResult.error) console.error('[cashflow] accounts error:', accountsResult.error)
  if (txResult.error) console.error('[cashflow] transactions error:', txResult.error)
  const accounts = accountsResult.data
  const transactions = txResult.data

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">자금일보</h1>
        <p className="text-gray-500 text-sm mt-1">계좌별 일별 자금 현황</p>
      </div>
      <CashflowClient accounts={accounts ?? []} transactions={transactions ?? []} />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import VendorLedgerClient from './VendorLedgerClient'

export default async function VendorLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: vendor }, { data: costs }, { data: payments }] = await Promise.all([
    supabase.from('vendors').select('id, name, type, phone, bank_info, memo').eq('id', id).single(),
    supabase
      .from('sale_costs')
      .select('id, item, amount, category, memo, sale:sales(id, name, inflow_date, contract_stage)')
      .eq('vendor_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendor_payments')
      .select('id, amount, paid_date, memo')
      .eq('vendor_id', id)
      .order('paid_date', { ascending: false }),
  ])

  if (!vendor) notFound()

  return (
    <VendorLedgerClient
      vendor={vendor}
      costs={(costs ?? []) as any}
      payments={payments ?? []}
    />
  )
}

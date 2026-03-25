import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SalesClient from './SalesClient'

export default async function SalesPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: vendors }] = await Promise.all([
    supabase.from('sales').select('*, assignee:profiles(id, name), sale_costs(*)').order('created_at', { ascending: false }),
    supabase.from('vendors').select('id, name, type').order('name'),
  ])

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">매출 관리</h1>
          <p className="text-gray-500 text-sm mt-1">전사 매출 · 원가 · 수익 현황</p>
        </div>
        <Link
          href="/sales/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 새 매출 건
        </Link>
      </div>
      <SalesClient sales={sales ?? []} vendors={vendors ?? []} />
    </div>
  )
}

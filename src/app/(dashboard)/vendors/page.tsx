import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import VendorList from './VendorList'

export default async function VendorsPage() {
  const supabase = await createClient()

  const { data: vendors } = await supabase
    .from('vendors')
    .select('*, sale_costs!vendor_id(amount, is_paid)')
    .order('type')
    .order('name')

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">거래처 DB</h1>
          <p className="text-gray-500 text-sm mt-1">프리랜서 · 업체 관리</p>
        </div>
        <Link
          href="/vendors/new"
          className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 거래처 추가
        </Link>
      </div>
      <VendorList vendors={vendors ?? []} />
    </div>
  )
}

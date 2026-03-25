import { createClient } from '@/lib/supabase/server'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()

  const { data: costs } = await supabase
    .from('sale_costs')
    .select('*, sale:sales(name, department), vendor:vendors(name, type, phone, bank_info)')
    .eq('category', '외부원가')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">지급 관리</h1>
        <p className="text-gray-500 text-sm mt-1">프리랜서 · 업체 미지급 현황</p>
      </div>
      <PaymentsClient costs={costs ?? []} />
    </div>
  )
}

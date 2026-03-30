import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, departments')
    .eq('id', user.id)
    .single()

  const isAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager'

  let saleIds: string[] | null = null

  if (!isAdminOrManager) {
    const myDepts: string[] = profile?.departments ?? []
    let salesQuery = supabase.from('sales').select('id')
    if (myDepts.length > 0) {
      salesQuery = salesQuery.or(`assignee_id.eq.${user.id},department.in.(${myDepts.join(',')})`)
    } else {
      salesQuery = salesQuery.eq('assignee_id', user.id)
    }
    const { data: mySales } = await salesQuery
    saleIds = mySales?.map(s => s.id) ?? []
  }

  let costsQuery = supabase
    .from('sale_costs')
    .select('*, sale:sales(name, department), vendor:vendors(name, type, phone, bank_info)')
    .eq('category', '외부원가')
    .order('created_at', { ascending: false })

  if (saleIds !== null) {
    if (saleIds.length === 0) {
      return (
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">지급 관리</h1>
            <p className="text-gray-500 text-sm mt-1">프리랜서 · 업체 미지급 현황</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-sm text-gray-400">
            담당 매출 건이 없어요.
          </div>
        </div>
      )
    }
    costsQuery = costsQuery.in('sale_id', saleIds)
  }

  const { data: costs } = await costsQuery

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

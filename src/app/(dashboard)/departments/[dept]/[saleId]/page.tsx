import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS } from '@/types'
import SaleHubClient from '@/app/(dashboard)/sales/[id]/SaleHubClient'

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  '계약전':    'bg-gray-100 text-gray-500',
  '계약완료':  'bg-blue-50 text-blue-600',
  '선금수령':  'bg-yellow-50 text-yellow-700',
  '중도금수령': 'bg-orange-50 text-orange-600',
  '완납':      'bg-green-50 text-green-600',
}

export default async function DeptSalePage({
  params,
}: {
  params: Promise<{ dept: string; saleId: string }>
}) {
  const { dept, saleId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  const { data: sale } = await admin.from('sales').select('*, notes, project_overview').eq('id', saleId).single()
  if (!sale) notFound()
  if (!isAdmin && sale.assignee_id !== profile?.id) redirect(`/departments/${dept}`)

  const [{ data: profiles }, { data: entities }, { data: customers }, { data: rawTasks }, logsResult] = await Promise.all([
    admin.from('profiles').select('id, name').order('name'),
    admin.from('business_entities').select('id, name').order('name'),
    admin.from('customers').select('id, name, contact_name, type').order('name'),
    admin.from('tasks').select('*').eq('project_id', saleId).order('created_at'),
    admin.from('project_logs').select('*, profiles:author_id(name)').eq('sale_id', saleId).order('created_at', { ascending: false }).limit(50),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const tasks = (rawTasks ?? []).map(t => ({
    ...t,
    assignee: t.assignee_id ? (profileMap[t.assignee_id] ?? null) : null,
  }))

  const logs = (logsResult.data ?? []).map((l: any) => ({
    ...l,
    author: l.profiles ?? null,
  }))

  const deptLabel = (DEPARTMENT_LABELS as any)[dept] ?? dept
  const statusBadge = PAYMENT_STATUS_BADGE[sale.payment_status ?? '계약전'] ?? 'bg-gray-100 text-gray-500'

  return (
    <div className="max-w-2xl mx-auto">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <Link href={`/departments/${dept}`} className="text-gray-400 hover:text-gray-700 transition-colors">
          ← {deptLabel}
        </Link>
        {sale.service_type && (
          <>
            <span className="text-gray-300">/</span>
            <span className="text-gray-400">{sale.service_type}</span>
          </>
        )}
      </div>

      {/* 프로젝트 타이틀 */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-gray-900 leading-tight flex-1">{sale.name}</h1>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusBadge}`}>
          {sale.payment_status ?? '계약전'}
        </span>
      </div>

      {/* 업무 허브 */}
      <SaleHubClient
        sale={{
          id: sale.id,
          name: sale.name,
          memo: sale.memo,
          payment_status: sale.payment_status,
          service_type: sale.service_type,
          department: sale.department,
          dropbox_url: sale.dropbox_url,
          client_org: sale.client_org,
          revenue: sale.revenue,
          inflow_date: sale.inflow_date,
          payment_date: sale.payment_date,
          contract_type: sale.contract_type,
          entity_id: sale.entity_id,
          assignee_id: sale.assignee_id,
          customer_id: sale.customer_id ?? null,
          notes: sale.notes ?? null,
          project_overview: sale.project_overview ?? null,
        }}
        tasks={tasks}
        logs={logs}
        profiles={profiles ?? []}
        entities={entities ?? []}
        customers={customers ?? []}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS } from '@/types'
import SaleHubClient from '@/app/(dashboard)/sales/[id]/SaleHubClient'

const CONTRACT_STAGE_BADGE: Record<string, string> = {
  '계약':       'bg-blue-50 text-blue-600',
  '착수':       'bg-purple-50 text-purple-600',
  '선금':       'bg-yellow-50 text-yellow-700',
  '중도금':     'bg-orange-50 text-orange-600',
  '완수':       'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금':       'bg-green-50 text-green-600',
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

  const { data: costPerm } = profile?.role !== 'admin'
    ? await admin.from('role_permissions').select('access_level').eq('role', profile?.role ?? 'member').eq('page_key', 'cost_internal').single()
    : { data: null }
  const showInternalCosts = profile?.role === 'admin' || (costPerm?.access_level ?? 'full') !== 'off'

  const { data: sale } = await admin.from('sales').select('*, notes, project_overview').eq('id', saleId).single()
  if (!sale) notFound()

  const uid = profile?.id
  const isProjectAssignee = sale.assignee_id === uid
  const isContractAssignee = (sale as any).contract_assignee_id === uid
  const viewMode = 'full' as const

  const [{ data: profiles }, { data: entities }, { data: customers }, { data: rawTasks }, logsResult, { data: costs }, { data: vendors }] = await Promise.all([
    admin.from('profiles').select('id, name').order('name'),
    admin.from('business_entities').select('id, name').order('name'),
    admin.from('customers').select('id, name, contact_name, type').order('name'),
    admin.from('tasks').select('*').eq('project_id', saleId).order('created_at'),
    admin.from('project_logs').select('id, content, log_type, contacted_at, created_at, author_id').eq('sale_id', saleId).order('created_at', { ascending: false }).limit(50),
    admin.from('sale_costs').select('*').eq('sale_id', saleId).order('created_at'),
    admin.from('vendors').select('id, name, type').order('name'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  const tasks = (rawTasks ?? []).map(t => ({
    ...t,
    assignee: t.assignee_id ? (profileMap[t.assignee_id] ?? null) : null,
  }))

  const logs = (logsResult.data ?? []).map((l: any) => ({
    ...l,
    contacted_at: l.contacted_at ?? l.created_at,
    author: l.author_id ? { name: profileMap[l.author_id]?.name ?? null } : null,
  }))

  const deptLabel = (DEPARTMENT_LABELS as any)[dept] ?? dept
  const statusBadge = CONTRACT_STAGE_BADGE[sale.contract_stage ?? '계약'] ?? 'bg-gray-100 text-gray-500'

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
          {sale.contract_stage ?? '계약'}
        </span>
      </div>

      {/* 업무 허브 */}
      <SaleHubClient
        sale={{
          id: sale.id,
          name: sale.name,
          memo: sale.memo,
          contract_stage: sale.contract_stage,
          progress_status: sale.progress_status ?? null,
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
          contract_assignee_id: (sale as any).contract_assignee_id ?? null,
          customer_id: sale.customer_id ?? null,
          notes: sale.notes ?? null,
          project_overview: sale.project_overview ?? null,
          notion_page_id: (sale as any).notion_page_id ?? null,
        }}
        tasks={tasks}
        logs={logs}
        profiles={profiles ?? []}
        entities={entities ?? []}
        customers={customers ?? []}
        costs={costs ?? []}
        vendors={vendors ?? []}
        showInternalCosts={showInternalCosts}
        viewMode={viewMode}
        isAdmin={isAdmin}
        currentUserId={user.id}
      />
    </div>
  )
}

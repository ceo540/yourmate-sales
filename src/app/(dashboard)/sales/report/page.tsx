import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import SalesReportClient from './SalesReportClient'
import { parseDepartments, createProfileMap } from '@/lib/utils'
import { isAdminOrManager } from '@/lib/permissions'

export default async function SalesReportPage({ searchParams }: { searchParams: Promise<{ alert?: string }> }) {
  const sp = await searchParams
  const alertParam = (sp?.alert ?? null) as 'no_contract_assignee' | 'no_payment_schedule' | 'no_main_type' | null

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: vendors }, { data: entities }, { data: profiles }, { data: customersRaw }] = await Promise.all([
    supabase.from('profiles').select('id, role, departments').eq('id', user.id).single(),
    supabase.from('vendors').select('id, name, type').order('name'),
    supabase.from('business_entities').select('id, name, entity_type').order('name'),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('customers').select('id, name, type').order('name'),
  ])
  const customers = (customersRaw ?? []) as { id: string; name: string; type: string }[]

  const isAdmin = isAdminOrManager(profile?.role)
  const myDepts = parseDepartments((profile as any)?.departments)

  let salesQuery = supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    const uid = profile?.id ?? user.id
    if (myDepts.length > 0) {
      salesQuery = salesQuery.or(`department.in.(${myDepts.join(',')}),assignee_id.eq.${uid}`)
    } else {
      salesQuery = salesQuery.eq('assignee_id', uid)
    }
  }

  // alert 진입 시 server-side 필터 적용 (Phase 9.1)
  if (alertParam === 'no_contract_assignee') {
    salesQuery = salesQuery.is('contract_assignee_id', null).not('contract_stage', 'eq', '취소')
  } else if (alertParam === 'no_main_type') {
    salesQuery = salesQuery.is('main_type', null).not('contract_stage', 'eq', '취소')
  }
  // no_payment_schedule 은 별도 후처리 (sale row 자체 컬럼 X)

  const { data: salesRawPre } = await salesQuery
  let salesRaw = salesRawPre

  if (alertParam === 'no_payment_schedule' && salesRaw && salesRaw.length > 0) {
    const allIds = (salesRaw as any[]).map(s => s.id)
    const { data: schedules } = await supabase.from('payment_schedules').select('sale_id').in('sale_id', allIds)
    const scheduledSet = new Set((schedules ?? []).map((p: any) => p.sale_id))
    salesRaw = (salesRaw as any[]).filter(s => !scheduledSet.has(s.id) && s.contract_stage !== '취소')
  }

  // 로드된 매출 건에 해당하는 원가만 조회 (전체 X)
  const saleIds = (salesRaw ?? []).map((s: any) => s.id)
  const { data: allCosts } = saleIds.length > 0
    ? await supabase.from('sale_costs').select('*').in('sale_id', saleIds)
    : { data: [] }

  const profileMap = createProfileMap(profiles)
  const entityMap = Object.fromEntries((entities ?? []).map(e => [e.id, { id: e.id, name: e.name }]))
  const costsMap: Record<string, any[]> = {}
  for (const cost of (allCosts ?? [])) {
    if (!costsMap[cost.sale_id]) costsMap[cost.sale_id] = []
    costsMap[cost.sale_id].push(cost)
  }

  const sales = (salesRaw ?? []).map((s: any) => ({
    ...s,
    assignee: s.assignee_id ? (profileMap[s.assignee_id] ?? null) : null,
    entity: s.entity_id ? (entityMap[s.entity_id] ?? null) : null,
    sale_costs: costsMap[s.id] ?? [],
  }))

  // alert 진입 안내 (Phase 9.1)
  const ALERT_INFO: Record<string, { icon: string; title: string; hint: string }> = {
    no_contract_assignee: { icon: '📜', title: '계약 담당 미지정 — 활성 계약', hint: '계약 진행을 책임질 담당자가 비어 있어요. 각 sale 진입 후 [계약 진행] 탭에서 지정.' },
    no_payment_schedule:  { icon: '💵', title: '결제 일정 미설정 — 활성 계약', hint: '계약금/중도금/잔금 흐름이 정리되지 않은 sale. 각 sale 의 결제 일정 등록 필요.' },
    no_main_type:         { icon: '🧭', title: '운영 분류 미설정 — 활성 계약', hint: '메인유형이 정해져야 프로젝트로 매끄럽게 이어집니다.' },
  }
  const alertInfo = alertParam ? ALERT_INFO[alertParam] ?? null : null

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">계약 목록</h1>
          <p className="text-gray-500 text-sm mt-1">전체 계약 건 목록 및 원가 관리</p>
        </div>
        <Link
          href="/projects"
          className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          + 새 프로젝트
        </Link>
      </div>

      {alertInfo && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center gap-3">
          <span className="text-base">{alertInfo.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-900">{alertInfo.title} — {(sales ?? []).length}건</p>
            <p className="text-[11px] text-red-700 mt-0.5">{alertInfo.hint}</p>
          </div>
          <Link
            href="/sales/report"
            className="text-xs px-2.5 py-1 rounded border border-red-300 bg-white hover:bg-red-50 text-red-700 font-medium flex-shrink-0"
          >
            모두 보기
          </Link>
        </div>
      )}

      <SalesReportClient sales={sales ?? []} vendors={vendors ?? []} entities={entities ?? []} profiles={profiles ?? []} customers={customers} isAdmin={isAdmin} initialFilterAllYears={!!alertInfo} />
    </div>
  )
}

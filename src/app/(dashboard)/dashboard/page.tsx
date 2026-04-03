import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function formatMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만원`
  if (n >= 10000) return `${Math.round(n / 10000)}만원`
  return n.toLocaleString() + '원'
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  '계약전': 'bg-gray-100 text-gray-500',
  '계약완료': 'bg-blue-50 text-blue-600',
  '선금수령': 'bg-yellow-50 text-yellow-700',
  '중도금수령': 'bg-orange-50 text-orange-600',
  '완납': 'bg-green-50 text-green-600',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const { getAccessLevel } = await import('@/lib/permissions')
  const [salesAccessLevel, dashFinanceLevel] = await Promise.all([
    getAccessLevel(profile?.role, 'sales'),
    getAccessLevel(profile?.role, 'dashboard_finance'),
  ])
  const showAll = isAdmin || salesAccessLevel === 'full' || salesAccessLevel === 'read'
  const showCashBalance = dashFinanceLevel !== 'off'

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const monthStart = `${thisYear}-${String(thisMonth).padStart(2, '0')}-01`
  const nextMonthStart = thisMonth === 12
    ? `${thisYear + 1}-01-01`
    : `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}-01`

  const admin = createAdminClient()
  let salesQuery = supabase
    .from('sales')
    .select('id, name, revenue, payment_status, inflow_date, created_at, entity_id')
    .order('created_at', { ascending: false })
  if (!showAll) salesQuery = salesQuery.eq('assignee_id', profile!.id)

  const [{ data: salesRaw }, { data: allEntities }, { data: allCosts }, { data: payrollRows }, { data: faAccounts }, { data: cashflowTxs }] = await Promise.all([
    salesQuery,
    supabase.from('business_entities').select('id, name'),
    supabase.from('sale_costs').select('id, sale_id, amount, is_paid, category'),
    isAdmin
      ? supabase.from('payroll').select('base_salary, meal_allowance, mileage_allowance, allowances, fixed_bonus, bonus, unpaid_leave').eq('year', thisYear).eq('month', thisMonth)
      : Promise.resolve({ data: [] }),
    showCashBalance ? admin.from('financial_accounts').select('id, initial_balance, type') : Promise.resolve({ data: [] }),
    showCashBalance ? admin.from('cashflow').select('account_id, type, amount, transfer_account_id') : Promise.resolve({ data: [] }),
  ])

  const entityMapDash = Object.fromEntries((allEntities ?? []).map(e => [e.id, { id: e.id, name: e.name }]))
  const costsMapDash: Record<string, any[]> = {}
  for (const c of (allCosts ?? [])) {
    if (!costsMapDash[c.sale_id]) costsMapDash[c.sale_id] = []
    costsMapDash[c.sale_id].push(c)
  }
  const sales = (salesRaw ?? []).map((s: any) => ({
    ...s,
    entity: s.entity_id ? (entityMapDash[s.entity_id] ?? null) : null,
    sale_costs: costsMapDash[s.id] ?? [],
  }))

  // 이번 달 입금 건 (inflow_date 기준)
  const thisMonthSales = sales.filter(s => s.inflow_date && s.inflow_date >= monthStart && s.inflow_date < nextMonthStart)
  const thisMonthRevenue = thisMonthSales.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const thisMonthCosts = thisMonthSales.reduce((s, r) => s + r.sale_costs.reduce((cs: number, c: any) => cs + c.amount, 0), 0)
  const thisMonthProfit = thisMonthRevenue - thisMonthCosts
  const profitRate = thisMonthRevenue > 0 ? Math.round((thisMonthProfit / thisMonthRevenue) * 100) : 0

  // 미수금 (완납 아닌 것)
  const receivables = sales.filter(s => s.payment_status && s.payment_status !== '완납' && s.payment_status !== '계약전' && (s.revenue ?? 0) > 0)
  const totalReceivables = receivables.reduce((s, r) => s + (r.revenue ?? 0), 0)

  // 미지급 외부원가
  const unpaidCosts = sales.flatMap(s => s.sale_costs.filter((c: any) => !c.is_paid && c.category === '외부원가'))
  const totalUnpaidCosts = unpaidCosts.reduce((s: number, c: any) => s + c.amount, 0)

  // 이번 달 인건비
  const thisMonthPayroll = (payrollRows ?? []).reduce((s: number, r: any) => {
    return s + (r.base_salary ?? 0) + (r.meal_allowance ?? 0) + (r.mileage_allowance ?? 0) +
      (r.allowances ?? 0) + (r.fixed_bonus ?? 0) + (r.bonus ?? 0) - (r.unpaid_leave ?? 0)
  }, 0)

  // 자금 잔고 계산
  let totalCashBalance = 0
  if (showCashBalance && faAccounts && cashflowTxs) {
    const balMap: Record<string, number> = {}
    for (const a of faAccounts) balMap[a.id] = a.initial_balance ?? 0
    for (const t of cashflowTxs) {
      if (t.account_id in balMap) {
        if (t.type === 'income') balMap[t.account_id] += t.amount
        else balMap[t.account_id] -= t.amount
      }
      if (t.transfer_account_id && t.transfer_account_id in balMap) balMap[t.transfer_account_id] += t.amount
    }
    totalCashBalance = (faAccounts as any[])
      .filter(a => a.type !== 'loan')
      .reduce((s, a) => s + (balMap[a.id] ?? 0), 0)
  }

  // 사업자별 이번 달 매출
  const entityMap: Record<string, { name: string; revenue: number; count: number }> = {}
  for (const s of thisMonthSales) {
    const key = (s.entity as any)?.id ?? '__none__'
    const name = (s.entity as any)?.name ?? '미지정'
    if (!entityMap[key]) entityMap[key] = { name, revenue: 0, count: 0 }
    entityMap[key].revenue += s.revenue ?? 0
    entityMap[key].count++
  }
  const entityStats = Object.values(entityMap).sort((a, b) => b.revenue - a.revenue)

  // 최근 계약 8건
  const recentSales = sales.slice(0, 8)

  // 리드 리마인드 (오늘 이하, 완료/취소 제외)
  const today = now.toISOString().slice(0, 10)
  let leadsReminderQuery = supabase
    .from('leads')
    .select('id, lead_id, client_org, contact_name, status, remind_date, service_type')
    .lte('remind_date', today)
    .not('status', 'in', '(완료,취소)')
    .order('remind_date', { ascending: true })
    .limit(5)
  if (!isAdmin) leadsReminderQuery = leadsReminderQuery.eq('assignee_id', profile!.id)
  const { data: leadsReminder } = await leadsReminderQuery

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 text-sm mt-1">{thisYear}년 {thisMonth}월 현황</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">이번 달 입금</p>
          <p className="text-xl font-bold text-gray-900">{formatMoney(thisMonthRevenue)}</p>
          <p className="text-xs text-gray-400 mt-1">{thisMonthSales.length}건</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">이번 달 원가</p>
          <p className="text-xl font-bold text-gray-700">{formatMoney(thisMonthCosts)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${thisMonthProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-400 mb-1">이번 달 이익</p>
          <p className={`text-xl font-bold ${thisMonthProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatMoney(thisMonthProfit)}</p>
          {thisMonthRevenue > 0 && <p className="text-xs text-gray-400 mt-1">이익률 {profitRate}%</p>}
        </div>
        <div className={`rounded-xl border p-4 ${totalReceivables > 0 ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-400 mb-1">미수금</p>
          <p className={`text-xl font-bold ${totalReceivables > 0 ? 'text-orange-500' : 'text-gray-400'}`}>{formatMoney(totalReceivables)}</p>
          <p className="text-xs text-gray-400 mt-1">{receivables.length}건</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalUnpaidCosts > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
          <p className="text-xs text-gray-400 mb-1">미지급 원가</p>
          <p className={`text-xl font-bold ${totalUnpaidCosts > 0 ? 'text-red-500' : 'text-gray-400'}`}>{formatMoney(totalUnpaidCosts)}</p>
        </div>
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">이번 달 인건비</p>
            <p className="text-xl font-bold text-gray-700">{formatMoney(thisMonthPayroll)}</p>
          </div>
        )}
        {showCashBalance && (
          <div className="bg-white rounded-xl border-2 p-4" style={{ borderColor: '#FFCE00' }}>
            <p className="text-xs text-gray-400 mb-1">총 자금 잔고</p>
            <p className="text-xl font-bold text-gray-900">{formatMoney(totalCashBalance)}</p>
            {isAdmin && <Link href="/cashflow" className="text-xs text-gray-400 hover:text-gray-600 mt-1 inline-block">자금일보 →</Link>}
          </div>
        )}
      </div>

      {/* 리드 리마인드 위젯 */}
      {(leadsReminder ?? []).length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-orange-100">
            <h2 className="text-sm font-semibold text-orange-700">🔔 리드 리마인드 {(leadsReminder ?? []).length}건</h2>
            <Link href="/leads" className="text-xs text-orange-500 hover:text-orange-700">전체 보기 →</Link>
          </div>
          <div className="divide-y divide-orange-100">
            {(leadsReminder ?? []).map(l => {
              const target = new Date(l.remind_date)
              target.setHours(0, 0, 0, 0)
              const diffDays = Math.round((target.getTime() - now.setHours(0,0,0,0)) / 86400000)
              const dday = diffDays === 0 ? 'D-day' : diffDays < 0 ? `D${diffDays}` : `D-${diffDays}`
              const ddayColor = diffDays <= 0 ? 'text-red-600 font-bold' : diffDays <= 3 ? 'text-orange-600 font-semibold' : 'text-yellow-600'
              return (
                <Link key={l.id} href="/leads" className="flex items-center gap-3 px-5 py-2.5 hover:bg-orange-100 transition-colors">
                  <span className={`text-xs w-12 shrink-0 ${ddayColor}`}>{dday}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.client_org || '-'}</p>
                    {l.contact_name && <p className="text-xs text-gray-400">{l.contact_name}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.service_type && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">{l.service_type}</span>}
                    <span className="text-xs text-gray-500">{l.status}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 최근 계약 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">최근 계약</h2>
            <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentSales.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">계약 내역이 없습니다.</p>
            ) : recentSales.map(s => (
              <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">{formatDate(s.inflow_date ?? s.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-700">{formatMoney(s.revenue ?? 0)}</p>
                  {s.payment_status && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[s.payment_status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {s.payment_status}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 미수금 현황 미리보기 + 사업자별 */}
        <div className="space-y-4">
          {/* 미수금 미리보기 */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">미수금 현황</h2>
              <Link href="/receivables" className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</Link>
            </div>
            {receivables.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">미수금이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {receivables.slice(0, 4).map(s => (
                  <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${PAYMENT_STATUS_COLORS[s.payment_status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                        {s.payment_status}
                      </span>
                      <span className="text-sm font-semibold text-orange-500">{formatMoney(s.revenue ?? 0)}</span>
                    </div>
                  </Link>
                ))}
                {receivables.length > 4 && (
                  <div className="px-5 py-2.5 text-xs text-gray-400 text-center">
                    +{receivables.length - 4}건 더 있음 · <Link href="/receivables" className="text-blue-500 hover:underline">전체 보기</Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 이번 달 사업자별 매출 */}
          {entityStats.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">이번 달 사업자별 입금</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {entityStats.map(e => (
                  <div key={e.name} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{e.name}</p>
                      <p className="text-xs text-gray-400">{e.count}건</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-700">{formatMoney(e.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

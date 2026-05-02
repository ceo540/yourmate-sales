// 매출 3종 대시보드 (yourmate-spec.md §3.4.1)
// - 회계 매출 = sales.revenue WHERE progress_status='완수'
// - 세무 매출 = sales.payment_date 시점 (세금계산서 발행 추정)
// - 현금 매출 = payment_schedules.received_date 시점

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/permissions'
import RevenueClient from './RevenueClient'

export default async function RevenuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!isAdmin(profile?.role)) {
    return <div className="p-8 text-red-500">관리자만 접근 가능</div>
  }

  // 최근 12개월 시작일
  const start = new Date()
  start.setMonth(start.getMonth() - 11)
  start.setDate(1)
  const startISO = start.toISOString().slice(0, 10)

  const [{ data: sales }, { data: schedules }] = await Promise.all([
    admin.from('sales')
      .select('id, revenue, contract_stage, progress_status, inflow_date, payment_date')
      .gte('inflow_date', startISO)
      .order('inflow_date'),
    admin.from('payment_schedules')
      .select('id, sale_id, amount, due_date, received_date, is_received')
      .gte('due_date', startISO),
  ])

  // 월별 4종 합산 (회계·세무·현금·유입)
  // 사용자 추가 요청: 유입 시점 매출도 같이 보고 싶음
  type MonthBucket = { ym: string; accounting: number; tax: number; cash: number; inflow: number }
  const buckets: Record<string, MonthBucket> = {}
  for (let i = 0; i < 12; i++) {
    const d = new Date(start)
    d.setMonth(start.getMonth() + i)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets[ym] = { ym, accounting: 0, tax: 0, cash: 0, inflow: 0 }
  }

  for (const s of (sales ?? [])) {
    const rev = s.revenue ?? 0
    // 유입 시점 — inflow_date 모든 active sale (영업 활동 시점)
    if (s.inflow_date) {
      const ym = (s.inflow_date as string).slice(0, 7)
      if (buckets[ym]) buckets[ym].inflow += rev
    }
    // 회계 매출 — progress_status='완수' & inflow_date 월
    if (s.progress_status === '완수' && s.inflow_date) {
      const ym = (s.inflow_date as string).slice(0, 7)
      if (buckets[ym]) buckets[ym].accounting += rev
    }
    // 세무 매출 — payment_date 월
    if (s.payment_date) {
      const ym = (s.payment_date as string).slice(0, 7)
      if (buckets[ym]) buckets[ym].tax += rev
    }
  }

  // 현금 매출 — received_date 월
  for (const p of (schedules ?? [])) {
    if (p.is_received && p.received_date) {
      const ym = (p.received_date as string).slice(0, 7)
      if (buckets[ym]) buckets[ym].cash += p.amount ?? 0
    }
  }

  const months = Object.values(buckets).sort((a, b) => a.ym.localeCompare(b.ym))

  const totalAccounting = months.reduce((s, m) => s + m.accounting, 0)
  const totalTax = months.reduce((s, m) => s + m.tax, 0)
  const totalCash = months.reduce((s, m) => s + m.cash, 0)
  const totalInflow = months.reduce((s, m) => s + m.inflow, 0)

  return (
    <RevenueClient
      months={months}
      totals={{ accounting: totalAccounting, tax: totalTax, cash: totalCash, inflow: totalInflow }}
    />
  )
}

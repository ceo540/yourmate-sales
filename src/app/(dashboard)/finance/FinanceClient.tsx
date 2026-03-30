'use client'
import { useState, useMemo } from 'react'

interface SaleCost { amount: number; category: string; is_paid: boolean }
interface Sale {
  id: string
  name: string
  revenue: number | null
  payment_status: string | null
  inflow_date: string | null
  entity: { id: string; name: string }[] | null
  sale_costs: SaleCost[]
}
interface FixedCost {
  name: string
  category: string | null
  amount: number
  business_entity: string | null
  is_active: boolean
}
interface PayrollRow {
  year: number
  month: number
  employee_name: string
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  bonus: number
  unpaid_leave: number
  business_entity: string | null
  payment_confirmed: boolean
}
interface Props {
  sales: Sale[]
  fixedCosts: FixedCost[]
  payroll: PayrollRow[]
  year: number
}

function fmt(n: number) {
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (Math.abs(n) >= 10000000) return `${Math.round(n / 10000000) * 10}백만`
  if (Math.abs(n) >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}
function fmtFull(n: number) { return n.toLocaleString() + '원' }

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]

export default function FinanceClient({ sales, fixedCosts, payroll, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [filterEntity, setFilterEntity] = useState('all')

  const entities = useMemo(() => {
    const set = new Set<string>()
    sales.forEach(s => { if (s.entity?.[0]?.name) set.add(s.entity[0].name) })
    return Array.from(set).sort()
  }, [sales])

  // 월별 손익 계산
  const monthlyData = useMemo(() => {
    return MONTHS.map(m => {
      const mStr = `${year}-${String(m).padStart(2, '0')}`
      const mSales = sales.filter(s =>
        s.inflow_date?.startsWith(mStr) &&
        (filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
      )
      const revenue = mSales.reduce((s, r) => s + (r.revenue ?? 0), 0)
      const costItems = mSales.reduce((s, r) => s + r.sale_costs.reduce((cs, c) => cs + c.amount, 0), 0)
      const vat = mSales.reduce((s, r) => s + ((r.revenue ?? 0) > 0 ? Math.round((r.revenue ?? 0) * 0.1) : 0), 0)
      const totalCost = costItems + vat
      const grossProfit = revenue - totalCost

      const fixedTotal = filterEntity === 'all'
        ? fixedCosts.reduce((s, f) => s + f.amount, 0)
        : fixedCosts.filter(f => f.business_entity === filterEntity).reduce((s, f) => s + f.amount, 0)

      const payrollTotal = payroll
        .filter(p => p.month === m && (filterEntity === 'all' || p.business_entity === filterEntity))
        .reduce((s, p) => s + p.base_salary + p.meal_allowance + p.mileage_allowance + p.allowances + p.fixed_bonus + p.bonus - p.unpaid_leave, 0)

      const operatingProfit = grossProfit - fixedTotal - payrollTotal

      return { month: m, revenue, totalCost, grossProfit, fixedTotal, payrollTotal, operatingProfit, salesCount: mSales.length }
    })
  }, [sales, fixedCosts, payroll, year, filterEntity])

  const selected = monthlyData[selectedMonth - 1]

  // 선택 월 상세
  const selectedSales = useMemo(() => {
    const mStr = `${year}-${String(selectedMonth).padStart(2, '0')}`
    return sales.filter(s =>
      s.inflow_date?.startsWith(mStr) &&
      (filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
    )
  }, [sales, selectedMonth, year, filterEntity])

  const selectedPayroll = payroll.filter(p =>
    p.month === selectedMonth &&
    (filterEntity === 'all' || p.business_entity === filterEntity)
  )

  // 미수금 (완납 아닌 것, 매출 있는 것)
  const receivables = sales.filter(s =>
    s.payment_status && s.payment_status !== '완납' && s.payment_status !== '계약전' && (s.revenue ?? 0) > 0 &&
    (filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
  )
  const totalReceivables = receivables.reduce((s, r) => s + (r.revenue ?? 0), 0)

  // 미지급 원가
  const unpaidCosts = sales
    .filter(s => filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
    .flatMap(s => s.sale_costs.filter(c => !c.is_paid && c.category === '외부원가'))
  const totalUnpaid = unpaidCosts.reduce((s, c) => s + c.amount, 0)

  // 연간 합계
  const yearTotal = monthlyData.reduce((acc, m) => ({
    revenue: acc.revenue + m.revenue,
    totalCost: acc.totalCost + m.totalCost,
    grossProfit: acc.grossProfit + m.grossProfit,
    operatingProfit: acc.operatingProfit + m.operatingProfit,
  }), { revenue: 0, totalCost: 0, grossProfit: 0, operatingProfit: 0 })

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1)

  const labelCls = 'text-xs text-gray-400 mb-0.5'
  const valueCls = 'text-lg font-bold text-gray-900'

  return (
    <div className="space-y-5">

      {/* 필터 */}
      <div className="flex items-center gap-2">
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
          <option value="all">전체 사업자</option>
          {entities.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* 연간 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: `${year}년 누적 매출`, value: yearTotal.revenue, color: 'text-gray-900' },
          { label: '누적 원가', value: yearTotal.totalCost, color: 'text-gray-600' },
          { label: '누적 매출총이익', value: yearTotal.grossProfit, color: yearTotal.grossProfit >= 0 ? 'text-blue-600' : 'text-red-500' },
          { label: '누적 영업이익', value: yearTotal.operatingProfit, color: yearTotal.operatingProfit >= 0 ? 'text-green-600' : 'text-red-500' },
        ].map(item => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className={labelCls}>{item.label}</p>
            <p className={`${valueCls} ${item.color}`}>{fmt(item.value)}<span className="text-xs font-normal text-gray-400 ml-0.5">원</span></p>
          </div>
        ))}
      </div>

      {/* 월별 바 차트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-500 mb-4">월별 매출 · 영업이익 ({year}년)</p>
        <div className="flex items-end gap-1.5 h-28">
          {monthlyData.map(m => {
            const revenueH = maxRevenue > 0 ? Math.round((m.revenue / maxRevenue) * 100) : 0
            const isSelected = m.month === selectedMonth
            return (
              <button key={m.month} onClick={() => setSelectedMonth(m.month)}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t transition-all ${isSelected ? '' : 'opacity-60 hover:opacity-80'}`}
                    style={{
                      height: `${revenueH}%`,
                      backgroundColor: m.operatingProfit >= 0 ? '#FFCE00' : '#fca5a5',
                      minHeight: m.revenue > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <span className={`text-xs ${isSelected ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{m.month}월</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#FFCE00' }} /><span className="text-xs text-gray-400">흑자</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-200" /><span className="text-xs text-gray-400">적자</span></div>
        </div>
      </div>

      {/* 선택 월 손익계산서 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">{selectedMonth}월 손익계산서</h2>
          <div className="flex gap-1">
            {MONTHS.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`w-7 h-7 rounded-lg text-xs transition-colors ${m === selectedMonth ? 'font-bold text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                style={m === selectedMonth ? { backgroundColor: '#FFCE00' } : {}}
              >{m}</button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4 space-y-0">
          {/* 매출 */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">매출</span>
            <span className="text-sm font-bold text-gray-900">{fmtFull(selected.revenue)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-4 text-xs text-gray-500">
            <span>건 수</span>
            <span>{selected.salesCount}건</span>
          </div>

          {/* 원가 */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">원가</span>
            <span className="text-sm font-semibold text-red-400">- {fmtFull(selected.totalCost)}</span>
          </div>

          {/* 매출총이익 */}
          <div className={`flex items-center justify-between py-2.5 border-b border-gray-100 rounded-lg px-2 -mx-2 ${selected.grossProfit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
            <span className="text-sm font-bold text-gray-700">매출총이익</span>
            <span className={`text-sm font-bold ${selected.grossProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmtFull(selected.grossProfit)}</span>
          </div>

          <div className="py-1" />

          {/* 고정비 */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">고정비</span>
            <span className="text-sm font-semibold text-gray-500">- {fmtFull(selected.fixedTotal)}</span>
          </div>

          {/* 인건비 */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">인건비</span>
            <span className="text-sm font-semibold text-gray-500">- {fmtFull(selected.payrollTotal)}</span>
          </div>
          {selectedPayroll.length > 0 && (
            <div className="pl-4 pb-1 space-y-0.5">
              {selectedPayroll.map((p, i) => {
                const gross = p.base_salary + p.meal_allowance + p.mileage_allowance + p.allowances + p.fixed_bonus + p.bonus - p.unpaid_leave
                return (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-400 py-0.5">
                    <span>{p.employee_name} {p.business_entity ? `(${p.business_entity})` : ''}</span>
                    <span>{gross.toLocaleString()}원</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 영업이익 */}
          <div className={`flex items-center justify-between py-3 rounded-xl px-3 -mx-1 mt-1 ${selected.operatingProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className="text-base font-bold text-gray-800">영업이익</span>
            <div className="text-right">
              <span className={`text-base font-bold ${selected.operatingProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtFull(selected.operatingProfit)}
              </span>
              {selected.revenue > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  이익률 {Math.round((selected.operatingProfit / selected.revenue) * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 이번 달 매출 건 목록 */}
        {selectedSales.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 px-5 pt-3 pb-2">매출 상세</p>
            <div className="divide-y divide-gray-50">
              {selectedSales.map(s => {
                const cost = s.sale_costs.reduce((cs, c) => cs + c.amount, 0) + ((s.revenue ?? 0) > 0 ? Math.round((s.revenue ?? 0) * 0.1) : 0)
                const profit = (s.revenue ?? 0) - cost
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.entity?.[0]?.name ?? '-'}</p>
                    </div>
                    <div className="text-right text-xs flex-shrink-0 space-y-0.5">
                      <p className="font-semibold text-gray-700">{fmt(s.revenue ?? 0)}원</p>
                      <p className={profit >= 0 ? 'text-green-600' : 'text-red-400'}>이익 {fmt(profit)}원</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 미수금 + 미지급 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-orange-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">미수금</h2>
            <span className="text-sm font-bold text-orange-500">{fmtFull(totalReceivables)}</span>
          </div>
          {receivables.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">미수금 없음</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {receivables.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{s.name}</p>
                    <span className="text-xs text-orange-500">{s.payment_status}</span>
                  </div>
                  <span className="text-sm font-semibold text-orange-400 flex-shrink-0">{fmt(s.revenue ?? 0)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">미지급 원가</h2>
            <span className="text-sm font-bold text-red-400">{fmtFull(totalUnpaid)}</span>
          </div>
          {unpaidCosts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">미지급 없음</p>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-500">{unpaidCosts.length}건 · {fmtFull(totalUnpaid)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

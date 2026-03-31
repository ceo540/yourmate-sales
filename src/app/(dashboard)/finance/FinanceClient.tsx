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

function fmt(n: number) { return n.toLocaleString() }
function fmtW(n: number) { return n.toLocaleString() + '원' }

const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12]
type PeriodType = 'monthly' | 'quarterly' | 'halfyear' | 'yearly'

export default function FinanceClient({ sales, fixedCosts, payroll, year }: Props) {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [selectedQuarter, setSelectedQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3))
  const [selectedHalf, setSelectedHalf] = useState(now.getMonth() < 6 ? 1 : 2)
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
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

  // 선택된 기간의 월 목록
  const activeMonths = useMemo(() => {
    if (periodType === 'monthly') return [selectedMonth]
    if (periodType === 'quarterly') return [1, 2, 3].map(i => (selectedQuarter - 1) * 3 + i)
    if (periodType === 'halfyear') return Array.from({ length: 6 }, (_, i) => (selectedHalf - 1) * 6 + i + 1)
    return MONTHS
  }, [periodType, selectedMonth, selectedQuarter, selectedHalf])

  // 기간 합산 데이터
  const periodData = useMemo(() => {
    return activeMonths.reduce((acc, m) => {
      const d = monthlyData[m - 1]
      return {
        revenue: acc.revenue + d.revenue,
        totalCost: acc.totalCost + d.totalCost,
        grossProfit: acc.grossProfit + d.grossProfit,
        fixedTotal: acc.fixedTotal + d.fixedTotal,
        payrollTotal: acc.payrollTotal + d.payrollTotal,
        operatingProfit: acc.operatingProfit + d.operatingProfit,
        salesCount: acc.salesCount + d.salesCount,
      }
    }, { revenue: 0, totalCost: 0, grossProfit: 0, fixedTotal: 0, payrollTotal: 0, operatingProfit: 0, salesCount: 0 })
  }, [activeMonths, monthlyData])

  const periodSales = useMemo(() => {
    return sales.filter(s => {
      if (!s.inflow_date?.startsWith(String(year))) return false
      const m = parseInt(s.inflow_date.slice(5, 7))
      return activeMonths.includes(m) && (filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
    })
  }, [sales, activeMonths, year, filterEntity])

  const periodPayroll = useMemo(() => {
    return payroll.filter(p =>
      activeMonths.includes(p.month) &&
      (filterEntity === 'all' || p.business_entity === filterEntity)
    )
  }, [payroll, activeMonths, filterEntity])

  const periodLabel = useMemo(() => {
    if (periodType === 'monthly') return `${selectedMonth}월`
    if (periodType === 'quarterly') return `${selectedQuarter}분기 (${(selectedQuarter - 1) * 3 + 1}–${selectedQuarter * 3}월)`
    if (periodType === 'halfyear') return selectedHalf === 1 ? '상반기 (1–6월)' : '하반기 (7–12월)'
    return `${year}년 전체`
  }, [periodType, selectedMonth, selectedQuarter, selectedHalf, year])

  // 미수금 / 미지급
  const receivables = sales.filter(s =>
    s.payment_status && s.payment_status !== '완납' && s.payment_status !== '계약전' && (s.revenue ?? 0) > 0 &&
    (filterEntity === 'all' || s.entity?.[0]?.name === filterEntity)
  )
  const totalReceivables = receivables.reduce((s, r) => s + (r.revenue ?? 0), 0)
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
            <p className={`${valueCls} ${item.color}`}>{fmtW(item.value)}</p>
          </div>
        ))}
      </div>

      {/* 월별 바 차트 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs font-semibold text-gray-500 mb-4">월별 매출 · 영업이익 ({year}년)</p>
        <div className="flex items-end gap-1.5 h-28">
          {monthlyData.map(m => {
            const revenueH = maxRevenue > 0 ? Math.round((m.revenue / maxRevenue) * 100) : 0
            const isSelected = activeMonths.includes(m.month)
            return (
              <button key={m.month} onClick={() => { setPeriodType('monthly'); setSelectedMonth(m.month) }}
                className="flex-1 flex flex-col items-center gap-1 group"
              >
                <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                  <div
                    className={`w-full rounded-t transition-all ${isSelected ? '' : 'opacity-40 hover:opacity-70'}`}
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

      {/* 손익계산서 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">{periodLabel} 손익계산서</h2>
            {/* 기간 타입 선택 */}
            <div className="flex gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {([['monthly', '월별'], ['quarterly', '분기별'], ['halfyear', '반기별'], ['yearly', '년별']] as const).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setPeriodType(type)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${periodType === type ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 하위 선택 */}
          {periodType === 'monthly' && (
            <div className="flex gap-1 flex-wrap">
              {MONTHS.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className={`w-7 h-7 rounded-lg text-xs transition-colors ${m === selectedMonth ? 'font-bold text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                  style={m === selectedMonth ? { backgroundColor: '#FFCE00' } : {}}
                >{m}</button>
              ))}
            </div>
          )}
          {periodType === 'quarterly' && (
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(q => (
                <button key={q} onClick={() => setSelectedQuarter(q)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${q === selectedQuarter ? 'text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                  style={q === selectedQuarter ? { backgroundColor: '#FFCE00' } : {}}
                >Q{q}</button>
              ))}
            </div>
          )}
          {periodType === 'halfyear' && (
            <div className="flex gap-1.5">
              {[['상반기', 1], ['하반기', 2]].map(([label, h]) => (
                <button key={h} onClick={() => setSelectedHalf(h as number)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${h === selectedHalf ? 'text-gray-900' : 'text-gray-400 hover:bg-gray-100'}`}
                  style={h === selectedHalf ? { backgroundColor: '#FFCE00' } : {}}
                >{label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-0">
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">매출</span>
            <span className="text-sm font-bold text-gray-900">{fmtW(periodData.revenue)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-4 text-xs text-gray-500">
            <span>건 수</span>
            <span>{periodData.salesCount}건</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">원가</span>
            <span className="text-sm font-semibold text-red-400">- {fmtW(periodData.totalCost)}</span>
          </div>
          <div className={`flex items-center justify-between py-2.5 border-b border-gray-100 rounded-lg px-2 -mx-2 ${periodData.grossProfit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
            <span className="text-sm font-bold text-gray-700">매출총이익</span>
            <span className={`text-sm font-bold ${periodData.grossProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmtW(periodData.grossProfit)}</span>
          </div>
          <div className="py-1" />
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">고정비</span>
            <span className="text-sm font-semibold text-gray-500">- {fmtW(periodData.fixedTotal)}</span>
          </div>
          <div className="flex items-center justify-between py-2.5 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">인건비</span>
            <span className="text-sm font-semibold text-gray-500">- {fmtW(periodData.payrollTotal)}</span>
          </div>
          {periodPayroll.length > 0 && (
            <div className="pl-4 pb-1 space-y-0.5">
              {periodPayroll.map((p, i) => {
                const gross = p.base_salary + p.meal_allowance + p.mileage_allowance + p.allowances + p.fixed_bonus + p.bonus - p.unpaid_leave
                return (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-400 py-0.5">
                    <span>{p.employee_name}{p.business_entity ? ` (${p.business_entity})` : ''}{periodType !== 'monthly' ? ` · ${p.month}월` : ''}</span>
                    <span>{gross.toLocaleString()}원</span>
                  </div>
                )
              })}
            </div>
          )}
          <div className={`flex items-center justify-between py-3 rounded-xl px-3 -mx-1 mt-1 ${periodData.operatingProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className="text-base font-bold text-gray-800">영업이익</span>
            <div className="text-right">
              <span className={`text-base font-bold ${periodData.operatingProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtW(periodData.operatingProfit)}
              </span>
              {periodData.revenue > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  이익률 {Math.round((periodData.operatingProfit / periodData.revenue) * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {periodSales.length > 0 && (
          <div className="border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 px-5 pt-3 pb-2">매출 상세</p>
            <div className="divide-y divide-gray-50">
              {periodSales.map(s => {
                const cost = s.sale_costs.reduce((cs, c) => cs + c.amount, 0) + ((s.revenue ?? 0) > 0 ? Math.round((s.revenue ?? 0) * 0.1) : 0)
                const profit = (s.revenue ?? 0) - cost
                return (
                  <div key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.entity?.[0]?.name ?? '-'}{s.inflow_date && periodType !== 'monthly' ? ` · ${s.inflow_date.slice(5, 7)}월` : ''}</p>
                    </div>
                    <div className="text-right text-xs flex-shrink-0 space-y-0.5">
                      <p className="font-semibold text-gray-700">{fmtW(s.revenue ?? 0)}</p>
                      <p className={profit >= 0 ? 'text-green-600' : 'text-red-400'}>이익 {fmtW(profit)}</p>
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
            <span className="text-sm font-bold text-orange-500">{fmtW(totalReceivables)}</span>
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
                  <span className="text-sm font-semibold text-orange-400 flex-shrink-0">{fmtW(s.revenue ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">미지급 원가</h2>
            <span className="text-sm font-bold text-red-400">{fmtW(totalUnpaid)}</span>
          </div>
          {unpaidCosts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">미지급 없음</p>
          ) : (
            <p className="px-5 py-4 text-sm text-gray-500">{unpaidCosts.length}건 · {fmtW(totalUnpaid)}</p>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { DEPT_SERVICE_GROUPS } from '@/types'

interface CostItem {
  id: string
  item: string
  amount: number
  memo?: string | null
  category: string
}

interface Sale {
  id: string
  name: string
  department: string | null
  service_type: string | null
  revenue: number | null
  payment_status: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
  created_at: string
  assignee: { id: string; name: string } | null
  entity: { id: string; name: string } | null
  sale_costs: CostItem[]
}

interface BusinessEntity {
  id: string
  name: string
  business_number?: string | null
}

interface Props {
  sales: Sale[]
  vendors: unknown[]
  entities: BusinessEntity[]
  isAdmin: boolean
}

function formatMoney(n: number) {
  if (n === 0) return '0'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

function ExportButton() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export/monthly?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('다운로드 실패')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `유어메이트_${year}년${month}월_세무자료.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={year}
        onChange={e => setYear(Number(e.target.value))}
        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
      >
        {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
      </select>
      <select
        value={month}
        onChange={e => setMonth(Number(e.target.value))}
        className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
      >
        {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
      </select>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        {loading ? '생성 중...' : '세무자료 엑셀'}
      </button>
    </div>
  )
}

function getQuarter(date: string | null) {
  if (!date) return null
  const m = new Date(date).getMonth() + 1
  return Math.ceil(m / 3)
}

function matchesFilter(sale: Sale, year: number | null, period: string) {
  const dateStr = sale.inflow_date
  if (!year || !dateStr) return !year
  const d = new Date(dateStr)
  if (d.getFullYear() !== year) return false
  if (period === 'all') return true
  if (period.startsWith('Q')) {
    return getQuarter(dateStr) === Number(period[1])
  }
  return (d.getMonth() + 1) === Number(period)
}

export default function SalesClient({ sales, entities, isAdmin }: Props) {
  const [filterYear, setFilterYear] = useState<number | null>(CURRENT_YEAR)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterService, setFilterService] = useState<string>('all')
  const [filterEntity, setFilterEntity] = useState<string>('all')

  const filtered = sales
    .filter(s => filterYear ? matchesFilter(s, filterYear, filterPeriod) : true)
    .filter(s => {
      if (filterService === 'all') return true
      // group filter: matches if sale's dept is in the group
      const group = DEPT_SERVICE_GROUPS.find(g => g.label === filterService)
      if (group) return group.depts.some(d => s.department === d) || group.services.some(sv => s.service_type === sv)
      return s.service_type === filterService
    })
    .filter(s => filterEntity === 'all' ? true : (s.entity?.id ?? '') === filterEntity)

  // 전사 통계
  const totalRevenue = filtered.reduce((s, p) => s + (p.revenue ?? 0), 0)
  const totalCost = filtered.reduce((s, p) => s + p.sale_costs.reduce((sc, c) => sc + c.amount, 0), 0)
  const totalProfit = totalRevenue - totalCost
  const profitRate = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  // 사업부+서비스 계층 통계
  const groupStats = DEPT_SERVICE_GROUPS.map(g => {
    const groupSales = filtered.filter(s =>
      g.depts.some(d => s.department === d) || g.services.some(sv => s.service_type === sv)
    )
    const revenue = groupSales.reduce((s, p) => s + (p.revenue ?? 0), 0)
    const cost = groupSales.reduce((s, p) => s + p.sale_costs.reduce((sc, c) => sc + c.amount, 0), 0)
    const serviceStats = g.services.map(svc => {
      const svcSales = filtered.filter(s => s.service_type === svc)
      const svcRev = svcSales.reduce((s, p) => s + (p.revenue ?? 0), 0)
      const svcCost = svcSales.reduce((s, p) => s + p.sale_costs.reduce((sc, c) => sc + c.amount, 0), 0)
      return { name: svc, revenue: svcRev, cost: svcCost, profit: svcRev - svcCost, count: svcSales.length }
    }).filter(sv => sv.count > 0 || sv.revenue > 0)
    return { label: g.label, revenue, cost, profit: revenue - cost, count: groupSales.length, serviceStats }
  }).filter(g => g.count > 0 || g.revenue > 0)


  return (
    <>
      {/* 필터 + 다운로드 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterYear ?? 'all'}
          onChange={e => { setFilterYear(e.target.value === 'all' ? null : Number(e.target.value)); setFilterPeriod('all') }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
        >
          <option value="all">전체 연도</option>
          {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>

        <select
          value={filterPeriod}
          onChange={e => setFilterPeriod(e.target.value)}
          disabled={!filterYear}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700 disabled:opacity-40"
        >
          <option value="all">전체 기간</option>
          <option value="Q1">1분기</option>
          <option value="Q2">2분기</option>
          <option value="Q3">3분기</option>
          <option value="Q4">4분기</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={String(m)}>{m}월</option>
          ))}
        </select>

        <select
          value={filterService}
          onChange={e => setFilterService(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
        >
          <option value="all">전체 사업부</option>
          {DEPT_SERVICE_GROUPS.map(g => (
            <optgroup key={g.label} label={g.label}>
              {g.services.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ))}
        </select>

        {entities.length > 0 && (
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
          >
            <option value="all">전체 사업자</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        )}
      </div>
      {isAdmin && <ExportButton />}
      </div>

      {/* ── 매출 통계 ── */}
      <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {[
              { label: '총 매출', value: totalRevenue, sub: `${totalRevenue.toLocaleString()}원`, color: '#FFCE00' },
              { label: '총 원가', value: totalCost, sub: `${totalCost.toLocaleString()}원`, color: '#EF4444' },
              { label: '총 이익', value: totalProfit, sub: `${totalProfit.toLocaleString()}원`, color: '#10B981' },
              { label: '이익률', value: null, display: `${profitRate}%`, sub: '매출 대비 이익', color: '#8B5CF6' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-xs text-gray-500 mb-2">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {item.value !== null ? formatMoney(item.value) : item.display}
                </p>
                <p className="text-xs text-gray-400 mt-1">{item.sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">사업부별 현황</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 py-2.5 pr-4">사업부 / 서비스</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">건수</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">매출</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">원가</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 pl-4">이익 (이익률)</th>
                </tr>
              </thead>
              <tbody>
                {groupStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                      매출 데이터가 없어요. 매출 보고서에서 추가해주세요.
                    </td>
                  </tr>
                )}
                {groupStats.map(g => {
                  const rate = g.revenue > 0 ? Math.round((g.profit / g.revenue) * 100) : 0
                  return (
                    <>
                      <tr key={g.label} className="border-t border-gray-100 bg-gray-50/50">
                        <td className="py-2.5 pr-4 text-sm font-semibold text-gray-900">{g.label}</td>
                        <td className="py-2.5 px-4 text-right text-sm text-gray-500">{g.count}건</td>
                        <td className="py-2.5 px-4 text-right text-sm font-medium text-gray-800">{formatMoney(g.revenue)}</td>
                        <td className="py-2.5 px-4 text-right text-sm text-gray-500">{formatMoney(g.cost)}</td>
                        <td className="py-2.5 pl-4 text-right">
                          <span className={`text-sm font-semibold ${g.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {formatMoney(g.profit)}
                          </span>
                          <span className="text-xs text-gray-400 ml-1.5">({rate}%)</span>
                        </td>
                      </tr>
                      {g.serviceStats.map(sv => {
                        const svRate = sv.revenue > 0 ? Math.round((sv.profit / sv.revenue) * 100) : 0
                        return (
                          <tr key={sv.name} className="border-t border-gray-50">
                            <td className="py-2 pr-4 text-xs text-gray-500 pl-4">└ {sv.name}</td>
                            <td className="py-2 px-4 text-right text-xs text-gray-400">{sv.count}건</td>
                            <td className="py-2 px-4 text-right text-xs text-gray-600">{formatMoney(sv.revenue)}</td>
                            <td className="py-2 px-4 text-right text-xs text-gray-400">{formatMoney(sv.cost)}</td>
                            <td className="py-2 pl-4 text-right">
                              <span className={`text-xs ${sv.profit >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                {formatMoney(sv.profit)}
                              </span>
                              <span className="text-xs text-gray-300 ml-1">({svRate}%)</span>
                            </td>
                          </tr>
                        )
                      })}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

    </>
  )
}

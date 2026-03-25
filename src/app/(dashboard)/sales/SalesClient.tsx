'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type Department } from '@/types'
import CostModal from './CostModal'
import { deleteSale } from './actions'

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
  revenue: number | null
  payment_status: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
  created_at: string
  assignee: { id: string; name: string } | null
  sale_costs: CostItem[]
}

interface Vendor {
  id: string
  name: string
  type: string
}

interface Props {
  sales: Sale[]
  vendors: Vendor[]
  isAdmin: boolean
}

function formatMoney(n: number) {
  if (n === 0) return '0'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
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

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

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

export default function SalesClient({ sales, vendors, isAdmin }: Props) {
  const [tab, setTab] = useState<'stats' | 'report'>('stats')
  const [costModal, setCostModal] = useState<Sale | null>(null)
  const [filterYear, setFilterYear] = useState<number | null>(CURRENT_YEAR)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterDept, setFilterDept] = useState<string>('all')
  const router = useRouter()

  const filtered = sales
    .filter(s => filterYear ? matchesFilter(s, filterYear, filterPeriod) : true)
    .filter(s => filterDept === 'all' ? true : s.department === filterDept)

  // 전사 통계
  const totalRevenue = filtered.reduce((s, p) => s + (p.revenue ?? 0), 0)
  const totalCost = sales.reduce((s, p) => s + p.sale_costs.reduce((sc, c) => sc + c.amount, 0), 0)
  const totalProfit = totalRevenue - totalCost
  const profitRate = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0

  // 사업부별 통계
  const deptStats = Object.entries(DEPARTMENT_LABELS).map(([key, label]) => {
    const deptSales = filtered.filter(s => s.department === key)
    const revenue = deptSales.reduce((s, p) => s + (p.revenue ?? 0), 0)
    const cost = deptSales.reduce((s, p) => s + p.sale_costs.reduce((sc, c) => sc + c.amount, 0), 0)
    return { key, label, revenue, cost, profit: revenue - cost, count: deptSales.length }
  }).filter(d => d.revenue > 0 || d.count > 0)

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠어요?')) return
    await deleteSale(id)
    router.refresh()
  }

  return (
    <>
      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* 연도 */}
        <button
          onClick={() => { setFilterYear(null); setFilterPeriod('all') }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filterYear ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}
        >
          전체
        </button>
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => { setFilterYear(y); setFilterPeriod('all') }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterYear === y ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}
          >
            {y}년
          </button>
        ))}

        {/* 분기/월 (연도 선택 시만) */}
        {filterYear && (
          <>
            <span className="text-gray-300 text-xs">|</span>
            {[
              { label: '전체', value: 'all' },
              { label: '1분기', value: 'Q1' },
              { label: '2분기', value: 'Q2' },
              { label: '3분기', value: 'Q3' },
              { label: '4분기', value: 'Q4' },
            ].map(p => (
              <button
                key={p.value}
                onClick={() => setFilterPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPeriod === p.value ? 'text-yellow-800 font-semibold' : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'}`}
                style={filterPeriod === p.value ? { backgroundColor: '#FFCE00' } : {}}
              >
                {p.label}
              </button>
            ))}
            <span className="text-gray-300 text-xs">|</span>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button
                key={m}
                onClick={() => setFilterPeriod(String(m))}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterPeriod === String(m) ? 'text-yellow-800 font-semibold' : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'}`}
                style={filterPeriod === String(m) ? { backgroundColor: '#FFCE00' } : {}}
              >
                {m}월
              </button>
            ))}
          </>
        )}
      </div>

      {/* 사업부 필터 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilterDept('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === 'all' ? 'text-yellow-800 font-semibold' : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'}`}
          style={filterDept === 'all' ? { backgroundColor: '#FFCE00' } : {}}
        >
          전체 사업부
        </button>
        {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterDept(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterDept === key ? 'text-yellow-800 font-semibold' : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'}`}
            style={filterDept === key ? { backgroundColor: '#FFCE00' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {(['stats', 'report'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'stats' ? '매출 통계' : '매출 보고서'}
          </button>
        ))}
      </div>

      {/* ── 매출 통계 탭 ── */}
      {tab === 'stats' && (
        <div>
          <div className="grid grid-cols-4 gap-4 mb-6">
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
                  <th className="text-left text-xs font-semibold text-gray-500 py-2.5 pr-4">사업부</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">건수</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">매출</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 px-4">원가</th>
                  <th className="text-right text-xs font-semibold text-gray-500 py-2.5 pl-4">이익 (이익률)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deptStats.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                      매출 데이터가 없어요. 보고서 탭에서 추가해주세요.
                    </td>
                  </tr>
                )}
                {deptStats.map(d => {
                  const rate = d.revenue > 0 ? Math.round((d.profit / d.revenue) * 100) : 0
                  return (
                    <tr key={d.key}>
                      <td className="py-3 pr-4 text-sm font-medium text-gray-900">{d.label}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-400">{d.count}건</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-700">{formatMoney(d.revenue)}</td>
                      <td className="py-3 px-4 text-right text-sm text-gray-500">{formatMoney(d.cost)}</td>
                      <td className="py-3 pl-4 text-right">
                        <span className={`text-sm font-medium ${d.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {formatMoney(d.profit)}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">({rate}%)</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 매출 보고서 탭 ── */}
      {tab === 'report' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">건명</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">사업부</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">담당자</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">유입일</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">결제일</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">매출액</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">원가 ↗</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">이익</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">수금상태</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">메모</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-sm text-gray-400">
                      해당 기간에 매출 건이 없어요.{' '}
                      <Link href="/sales/new" className="text-yellow-600 font-medium hover:underline">
                        새 매출 건 추가하기 →
                      </Link>
                    </td>
                  </tr>
                )}
                {filtered.map(sale => {
                  const cost = sale.sale_costs.reduce((s, c) => s + c.amount, 0)
                  const revenue = sale.revenue ?? 0
                  const profit = revenue - cost
                  const payStatus = sale.payment_status ?? '계약전'

                  return (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      {/* 건명 (Dropbox 링크) */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        {sale.dropbox_url ? (
                          <a
                            href={sale.dropbox_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 truncate"
                            title={sale.name}
                          >
                            <span className="truncate">{sale.name}</span>
                            <span className="text-xs flex-shrink-0">↗</span>
                          </a>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 truncate block" title={sale.name}>
                            {sale.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {sale.department ? DEPARTMENT_LABELS[sale.department as Department] ?? sale.department : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                        {(sale.assignee as any)?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(sale.inflow_date)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(sale.payment_date)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                        {revenue > 0 ? revenue.toLocaleString() : <span className="text-gray-300">-</span>}
                      </td>
                      {/* 원가 클릭 → 세부 원가 모달 */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => setCostModal(sale)}
                          className="text-sm text-gray-600 hover:text-yellow-700 font-medium underline decoration-dashed underline-offset-2 transition-colors"
                          title="클릭하면 세부 원가 입력"
                        >
                          {cost > 0 ? cost.toLocaleString() : <span className="text-gray-300">-</span>}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {revenue > 0 ? (
                          <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {profit.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_COLORS[payStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                          {payStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[120px] truncate" title={sale.memo ?? ''}>
                        {sale.memo || '-'}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex gap-1.5">
                          <Link
                            href={`/sales/${sale.id}`}
                            className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => handleDelete(sale.id)}
                            className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 세부 원가 모달 */}
      {costModal && (
        <CostModal
          saleId={costModal.id}
          saleName={costModal.name}
          revenue={costModal.revenue ?? 0}
          initialItems={costModal.sale_costs}
          vendors={vendors}
          onClose={() => setCostModal(null)}
        />
      )}
    </>
  )
}

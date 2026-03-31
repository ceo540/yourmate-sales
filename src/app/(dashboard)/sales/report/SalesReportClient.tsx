'use client'
import React, { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type Department } from '@/types'
import SaleExpandEditor from './SaleExpandEditor'
import { bulkDeleteSales, bulkUpdateSalesStatus, updateEntityType } from '../actions'

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
  client_org: string | null
  service_type: string | null
  revenue: number | null
  payment_status: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
  contract_type: string | null
  created_at: string
  assignee: { id: string; name: string } | null
  entity: { id: string; name: string } | null
  sale_costs: CostItem[]
}

interface Vendor {
  id: string
  name: string
  type: string
}

interface BusinessEntity {
  id: string
  name: string
  entity_type?: string | null
}

interface Profile {
  id: string
  name: string
}

interface Props {
  sales: Sale[]
  vendors: Vendor[]
  entities: BusinessEntity[]
  profiles: Profile[]
  isAdmin: boolean
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

const CONTRACT_BADGE_COLORS: Record<string, string> = {
  '나라장터': 'bg-green-50 text-green-700',
  '세금계산서': 'bg-blue-50 text-blue-700',
  '카드결제': 'bg-purple-50 text-purple-700',
  '기타': 'bg-gray-100 text-gray-500',
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const LIMIT_MAP: Record<string, number> = { '일반기업': 22_000_000, '여성기업': 55_000_000 }

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
  if (period.startsWith('Q')) return getQuarter(dateStr) === Number(period[1])
  return (d.getMonth() + 1) === Number(period)
}

export default function SalesReportClient({ sales: initialSales, vendors, entities, profiles, isAdmin }: Props) {
  const [sales, setSales] = useState(initialSales)
  const [filterYear, setFilterYear] = useState<number | null>(CURRENT_YEAR)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  const [entityTypes, setEntityTypes] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const e of entities) map[e.id] = e.entity_type ?? '일반기업'
    return map
  })
  const [, startTransition] = useTransition()
  const router = useRouter()

  const limitYear = filterYear ?? CURRENT_YEAR
  const limitRows = useMemo(() => {
    const map = new Map<string, { entityId: string; entityName: string; clientOrg: string; total: number }>()
    for (const s of sales) {
      if (!s.client_org || !s.entity || !s.inflow_date) continue
      if (new Date(s.inflow_date).getFullYear() !== limitYear) continue
      const key = `${s.entity.id}||${s.client_org}`
      const existing = map.get(key)
      if (existing) { existing.total += s.revenue ?? 0 }
      else map.set(key, { entityId: s.entity.id, entityName: s.entity.name, clientOrg: s.client_org, total: s.revenue ?? 0 })
    }
    return Array.from(map.values()).sort((a, b) =>
      a.entityName !== b.entityName ? a.entityName.localeCompare(b.entityName) : b.total - a.total
    )
  }, [sales, limitYear])

  const handleEntityTypeChange = async (entityId: string, newType: string) => {
    setEntityTypes(prev => ({ ...prev, [entityId]: newType }))
    await updateEntityType(entityId, newType)
  }

  const filtered = sales
    .filter(s => filterYear ? matchesFilter(s, filterYear, filterPeriod) : true)
    .filter(s => filterDept === 'all' ? true : s.department === filterDept)
    .filter(s => filterEntity === 'all' ? true : (s.entity?.id ?? '') === filterEntity)
    .filter(s => filterStatus === 'all' ? true : (s.payment_status ?? '계약전') === filterStatus)

  const summary = filtered.reduce((acc, s) => {
    const revenue = s.revenue ?? 0
    const cost = s.sale_costs.reduce((c, i) => c + i.amount, 0) + (revenue > 0 ? Math.round(revenue * 0.1) : 0)
    return { revenue: acc.revenue + revenue, cost: acc.cost + cost, profit: acc.profit + (revenue - cost) }
  }, { revenue: 0, cost: 0, profit: 0 })

  const allFilteredIds = filtered.map(s => s.id)
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id))

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const next = new Set(prev); allFilteredIds.forEach(id => next.delete(id)); return next })
    } else {
      setSelectedIds(prev => new Set([...prev, ...allFilteredIds]))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제하시겠어요?`)) return
    setBulkLoading(true)
    await bulkDeleteSales([...selectedIds])
    setSales(prev => prev.filter(s => !selectedIds.has(s.id)))
    setSelectedIds(new Set())
    setBulkLoading(false)
    startTransition(() => router.refresh())
  }

  const handleBulkStatus = async (status: string) => {
    if (!status) return
    setBulkLoading(true)
    await bulkUpdateSalesStatus([...selectedIds], status)
    setSales(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, payment_status: status } : s))
    setBulkLoading(false)
    startTransition(() => router.refresh())
  }

  const handleSaleSaved = (updated: Sale) => {
    setSales(prev => prev.map(s => s.id === updated.id ? updated : s))
    setExpandedSaleId(null)
  }

  const handleSaleDeleted = (id: string) => {
    setSales(prev => prev.filter(s => s.id !== id))
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    setExpandedSaleId(null)
  }

  return (
    <>
      {/* 필터 */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
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
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
        >
          <option value="all">전체 사업부</option>
          {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {entities.length > 0 && (
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
          >
            <option value="all">전체 사업자</option>
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
        >
          <option value="all">전체 수금상태</option>
          {Object.keys(PAYMENT_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-2">{filtered.length}건</span>
      </div>

      {/* 수의계약 한도 현황 */}
      {limitRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">수의계약 한도 현황</h2>
            <span className="text-xs text-gray-400">{limitYear}년 기준 · 발주처 입력된 건만 집계</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">계약 사업자</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">발주처</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">구분</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">계약 총액</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">한도</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">잔여</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 w-36">사용률</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {limitRows.map(row => {
                  const eType = entityTypes[row.entityId] ?? '일반기업'
                  const limit = LIMIT_MAP[eType] ?? 22_000_000
                  const pct = Math.min(100, Math.round((row.total / limit) * 100))
                  const remaining = limit - row.total
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-green-400'
                  const amtColor = pct >= 100 ? 'text-red-600 font-bold' : pct >= 80 ? 'text-orange-500 font-semibold' : 'text-gray-900 font-medium'
                  return (
                    <tr key={`${row.entityId}-${row.clientOrg}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{row.entityName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.clientOrg}</td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <select
                            value={eType}
                            onChange={e => handleEntityTypeChange(row.entityId, e.target.value)}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-yellow-400"
                          >
                            <option value="일반기업">일반기업</option>
                            <option value="여성기업">여성기업</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{eType}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm ${amtColor}`}>{row.total.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">{limit.toLocaleString()}원</td>
                      <td className="px-4 py-3 text-right text-sm">
                        {remaining > 0
                          ? <span className="text-gray-600">{remaining.toLocaleString()}원</span>
                          : <span className="text-red-500 font-semibold">초과</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs w-8 text-right ${pct >= 80 ? amtColor : 'text-gray-500'}`}>{pct}%</span>
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

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-yellow-50 border-b border-yellow-100">
            <span className="text-sm font-medium text-yellow-800">{selectedIds.size}건 선택됨</span>
            <div className="flex items-center gap-2 ml-2">
              <select
                defaultValue=""
                onChange={e => { handleBulkStatus(e.target.value); e.target.value = '' }}
                disabled={bulkLoading}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-yellow-400 disabled:opacity-50"
              >
                <option value="" disabled>수금상태 일괄 변경</option>
                {Object.keys(PAYMENT_STATUS_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {isAdmin && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  일괄 삭제
                </button>
              )}
            </div>
            <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-gray-900 transition-colors">
              선택 해제
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              {filtered.length > 0 && (
                <tr className="border-b-2 border-gray-200 bg-yellow-50">
                  <td colSpan={10} className="px-4 py-3 text-xs font-semibold text-gray-600">합계 ({filtered.length}건)</td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900 whitespace-nowrap">{summary.revenue.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-600 whitespace-nowrap">{summary.cost.toLocaleString()}원</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`text-sm font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{summary.profit.toLocaleString()}원</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              )}
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3.5 w-8">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-yellow-400 cursor-pointer" />
                </th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">건명</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">사업부</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">서비스</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">사업자</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">발주처</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">계약방법</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">담당자</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">유입일</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">결제일</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">매출액</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">원가</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">이익</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">수금상태</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-16 text-center text-sm text-gray-400">
                    해당 기간에 매출 건이 없어요.{' '}
                    <Link href="/sales/new" className="text-yellow-600 font-medium hover:underline">
                      새 매출 건 추가하기 →
                    </Link>
                  </td>
                </tr>
              )}
              {filtered.map(sale => {
                const revenue = sale.revenue ?? 0
                const cost = sale.sale_costs.reduce((s, c) => s + c.amount, 0) + (revenue > 0 ? Math.round(revenue * 0.1) : 0)
                const profit = revenue - cost
                const payStatus = sale.payment_status ?? '계약전'
                const isExpanded = expandedSaleId === sale.id

                return (
                  <React.Fragment key={sale.id}>
                  <tr
                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                    className={`cursor-pointer transition-colors ${isExpanded ? 'bg-yellow-50' : selectedIds.has(sale.id) ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3.5 w-8" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(sale.id)} onChange={() => toggleOne(sale.id)} className="w-3.5 h-3.5 accent-yellow-400 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3.5 max-w-[180px]">
                      {sale.dropbox_url ? (
                        <a href={sale.dropbox_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 truncate" title={sale.name}>
                          <span className="truncate">{sale.name}</span>
                          <span className="text-xs flex-shrink-0">↗</span>
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 truncate block" title={sale.name}>{sale.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {sale.department ? DEPARTMENT_LABELS[sale.department as Department] ?? sale.department : '-'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {sale.service_type
                        ? <span className="text-xs px-2 py-1 rounded-full bg-purple-50 text-purple-700">{sale.service_type}</span>
                        : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {sale.entity ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">{sale.entity.name}</span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 max-w-[140px] truncate" title={sale.client_org ?? ''}>
                      {sale.client_org || <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {sale.contract_type ? (
                        <span className={`text-xs px-2 py-1 rounded-full ${CONTRACT_BADGE_COLORS[sale.contract_type] ?? 'bg-gray-100 text-gray-500'}`}>
                          {sale.contract_type}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{(sale.assignee as any)?.name ?? '-'}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(sale.inflow_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(sale.payment_date)}</td>
                    <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                      {revenue > 0 ? revenue.toLocaleString() : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm text-gray-600 whitespace-nowrap">
                      {cost > 0 ? cost.toLocaleString() : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {revenue > 0 ? (
                        <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{profit.toLocaleString()}</span>
                      ) : <span className="text-gray-300 text-sm">-</span>}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${PAYMENT_STATUS_COLORS[payStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                        {payStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[120px] truncate" title={sale.memo ?? ''}>{sale.memo || '-'}</td>
                  </tr>
                  {isExpanded && (
                    <SaleExpandEditor
                      sale={sale}
                      colSpan={15}
                      entities={entities}
                      vendors={vendors}
                      profiles={profiles}
                      isAdmin={isAdmin}
                      onClose={() => setExpandedSaleId(null)}
                      onSaved={handleSaleSaved}
                      onDeleted={handleSaleDeleted}
                    />
                  )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </>
  )
}

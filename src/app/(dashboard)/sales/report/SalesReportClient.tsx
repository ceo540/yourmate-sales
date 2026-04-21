'use client'
import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DEPT_SERVICE_GROUPS } from '@/types'
import SaleExpandEditor from './SaleExpandEditor'
import { bulkDeleteSales, bulkUpdateSalesStage } from '../actions'

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
  client_dept: string | null
  customer_id: string | null
  service_type: string | null
  revenue: number | null
  contract_stage: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
  contract_type: string | null
  cost_confirmed?: boolean | null
  created_at: string
  project_id: string | null
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

interface Customer { id: string; name: string; type: string }

interface Props {
  sales: Sale[]
  vendors: Vendor[]
  entities: BusinessEntity[]
  profiles: Profile[]
  customers: Customer[]
  isAdmin: boolean
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const CONTRACT_STAGE_COLORS: Record<string, string> = {
  '계약': 'bg-blue-50 text-blue-600',
  '착수': 'bg-purple-50 text-purple-600',
  '선금': 'bg-yellow-50 text-yellow-700',
  '중도금': 'bg-orange-50 text-orange-600',
  '완수': 'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금': 'bg-green-50 text-green-600',
}

const CONTRACT_BADGE_COLORS: Record<string, string> = {
  '나라장터': 'bg-green-50 text-green-700',
  '세금계산서': 'bg-blue-50 text-blue-700',
  '카드결제': 'bg-purple-50 text-purple-700',
  '기타': 'bg-gray-100 text-gray-500',
}

const SERVICE_COLORS: Record<string, string> = {
  '002ENT':   'bg-blue-50 text-blue-700',
  'SOS':       'bg-indigo-50 text-indigo-700',
  '교육프로그램': 'bg-emerald-50 text-emerald-700',
  '납품설치':   'bg-orange-50 text-orange-700',
  '유지보수':   'bg-amber-50 text-amber-700',
  '교구대여':   'bg-yellow-50 text-yellow-700',
  '제작인쇄':   'bg-lime-50 text-lime-700',
  '콘텐츠제작':  'bg-purple-50 text-purple-700',
  '행사운영':   'bg-pink-50 text-pink-700',
  '행사대여':   'bg-fuchsia-50 text-fuchsia-700',
  '프로젝트':   'bg-rose-50 text-rose-700',
}

function SortTh({ field, label, sortField, sortDir, onSort, className = '' }: {
  field: SortField
  label: string
  sortField: SortField | null
  sortDir: SortDir
  onSort: (f: SortField) => void
  className?: string
}) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`text-xs font-semibold px-4 py-3.5 whitespace-nowrap cursor-pointer select-none group/th ${active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'} ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          <span className="text-blue-500">{sortDir === 'asc' ? '↑' : '↓'}</span>
        ) : (
          <span className="text-gray-300 opacity-0 group-hover/th:opacity-100 transition-opacity">↕</span>
        )}
      </span>
    </th>
  )
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

const CONTRACT_STAGE_ORDER = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']

type SortField = 'name' | 'service_type' | 'client_org' | 'entity' | 'assignee' | 'inflow_date' | 'payment_date' | 'revenue' | 'cost' | 'profit' | 'contract_stage'
type SortDir = 'asc' | 'desc'

// 선택적으로 숨길 수 있는 컬럼 목록
const OPTIONAL_COLS = ['사업자', '발주처', '계약방법', '담당자', '결제일', '메모'] as const
type OptionalCol = typeof OPTIONAL_COLS[number]

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

export default function SalesReportClient({ sales: initialSales, vendors, entities, profiles, customers, isAdmin }: Props) {
  const [sales, setSales] = useState(initialSales)
  const [filterYear, setFilterYear] = useState<number | null>(CURRENT_YEAR)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null)
  // 기본으로 숨길 컬럼
  const [hiddenCols, setHiddenCols] = useState<Set<OptionalCol>>(new Set(['발주처', '계약방법', '결제일', '메모']))
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [, startTransition] = useTransition()
  const router = useRouter()

  const show = (col: OptionalCol) => !hiddenCols.has(col)
  const toggleCol = (col: OptionalCol) => setHiddenCols(prev => {
    const n = new Set(prev)
    n.has(col) ? n.delete(col) : n.add(col)
    return n
  })
  // 항상 표시: checkbox, 건명, 서비스, 유입일, 매출액, 원가, 이익, 수금상태 = 8
  const totalCols = 8 + OPTIONAL_COLS.filter(c => show(c)).length

  const filtered = sales
    .filter(s => filterYear ? matchesFilter(s, filterYear, filterPeriod) : true)
    .filter(s => {
      if (filterDept === 'all') return true
      return s.service_type === filterDept
    })
    .filter(s => filterEntity === 'all' ? true : (s.entity?.id ?? '') === filterEntity)
    .filter(s => filterStatus === 'all' ? true : (s.contract_stage ?? '계약') === filterStatus)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortField(null) }
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const getSaleValues = (s: Sale) => {
    const revenue = s.revenue ?? 0
    const cost = s.sale_costs.reduce((c, i) => c + i.amount, 0) + (revenue > 0 ? Math.round(revenue * 0.1) : 0)
    return { revenue, cost, profit: revenue - cost }
  }

  const sorted = sortField ? [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortField) {
      case 'name': return dir * a.name.localeCompare(b.name, 'ko')
      case 'service_type': return dir * (a.service_type ?? '').localeCompare(b.service_type ?? '', 'ko')
      case 'client_org': return dir * (a.client_org ?? '').localeCompare(b.client_org ?? '', 'ko')
      case 'entity': return dir * (a.entity?.name ?? '').localeCompare(b.entity?.name ?? '', 'ko')
      case 'assignee': return dir * ((a.assignee as { name: string } | null)?.name ?? '').localeCompare((b.assignee as { name: string } | null)?.name ?? '', 'ko')
      case 'inflow_date': return dir * (a.inflow_date ?? '').localeCompare(b.inflow_date ?? '')
      case 'payment_date': return dir * (a.payment_date ?? '').localeCompare(b.payment_date ?? '')
      case 'revenue': return dir * ((a.revenue ?? 0) - (b.revenue ?? 0))
      case 'cost': return dir * (getSaleValues(a).cost - getSaleValues(b).cost)
      case 'profit': return dir * (getSaleValues(a).profit - getSaleValues(b).profit)
      case 'contract_stage': {
        const ai = CONTRACT_STAGE_ORDER.indexOf(a.contract_stage ?? '계약')
        const bi = CONTRACT_STAGE_ORDER.indexOf(b.contract_stage ?? '계약')
        return dir * (ai - bi)
      }
      default: return 0
    }
  }) : filtered

  const summary = sorted.reduce((acc, s) => {
    const revenue = s.revenue ?? 0
    const cost = s.sale_costs.reduce((c, i) => c + i.amount, 0) + (revenue > 0 ? Math.round(revenue * 0.1) : 0)
    return { revenue: acc.revenue + revenue, cost: acc.cost + cost, profit: acc.profit + (revenue - cost) }
  }, { revenue: 0, cost: 0, profit: 0 })

  const allFilteredIds = sorted.map(s => s.id)
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
    await bulkUpdateSalesStage([...selectedIds], status)
    setSales(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, contract_stage: status } : s))
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
      <div className="flex items-center gap-2 mb-4 flex-wrap">
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
          <option value="all">전체 사업부/서비스</option>
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
            {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        )}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700"
        >
          <option value="all">전체 계약단계</option>
          {Object.keys(CONTRACT_STAGE_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-sm text-gray-400 ml-1">{sorted.length}건</span>
        {sortField && (
          <button
            onClick={() => setSortField(null)}
            className="flex items-center gap-1 ml-1 text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
            </svg>
            정렬 중 · 해제
          </button>
        )}
      </div>

      {/* 컬럼 토글 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs text-gray-400">컬럼:</span>
        {OPTIONAL_COLS.map(col => (
          <button
            key={col}
            onClick={() => toggleCol(col)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              show(col)
                ? 'bg-gray-100 text-gray-700 border-gray-200'
                : 'bg-white text-gray-300 border-gray-100'
            }`}
          >
            {col}
          </button>
        ))}
      </div>

      {/* 합계 바 */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-5 px-4 py-2.5 mb-3 bg-yellow-50 border border-yellow-100 rounded-xl text-sm flex-wrap">
          <span className="text-xs text-gray-500 font-semibold">{sorted.length}건 합계</span>
          <span>
            <span className="text-xs text-gray-400 mr-1">매출</span>
            <span className="font-bold text-gray-900">{summary.revenue.toLocaleString()}원</span>
          </span>
          <span>
            <span className="text-xs text-gray-400 mr-1">원가</span>
            <span className="font-semibold text-gray-600">{summary.cost.toLocaleString()}원</span>
          </span>
          <span>
            <span className="text-xs text-gray-400 mr-1">이익</span>
            <span className={`font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{summary.profit.toLocaleString()}원</span>
          </span>
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
                <option value="" disabled>계약단계 일괄 변경</option>
                {Object.keys(CONTRACT_STAGE_COLORS).map(s => <option key={s} value={s}>{s}</option>)}
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
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-50 w-[48px] px-4 py-3.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 accent-yellow-400 cursor-pointer" />
                </th>
                <SortTh field="name" label="건명" sortField={sortField} sortDir={sortDir} onSort={handleSort}
                  className="sticky left-[48px] z-20 bg-gray-50 text-left after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-200" />
                <SortTh field="service_type" label="서비스" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                {show('사업자') && <SortTh field="entity" label="사업자" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                {show('발주처') && <SortTh field="client_org" label="발주처" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                {show('계약방법') && <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 whitespace-nowrap">계약방법</th>}
                {show('담당자') && <SortTh field="assignee" label="담당자" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                <SortTh field="inflow_date" label="유입일" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                {show('결제일') && <SortTh field="payment_date" label="결제일" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                <SortTh field="revenue" label="매출액" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortTh field="cost" label="원가" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortTh field="profit" label="이익" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                <SortTh field="contract_stage" label="계약단계" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                {show('메모') && <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5 whitespace-nowrap">메모</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="py-16 text-center text-sm text-gray-400">
                    해당 기간에 매출 건이 없어요.{' '}
                    <Link href="/sales/new" className="text-yellow-600 font-medium hover:underline">
                      새 매출 건 추가하기 →
                    </Link>
                  </td>
                </tr>
              )}
              {sorted.map(sale => {
                const revenue = sale.revenue ?? 0
                const cost = sale.sale_costs.reduce((s, c) => s + c.amount, 0) + (revenue > 0 ? Math.round(revenue * 0.1) : 0)
                const profit = revenue - cost
                const payStatus = sale.contract_stage ?? '계약'
                const isExpanded = expandedSaleId === sale.id
                const isHighlighted = isExpanded || selectedIds.has(sale.id)
                const hasCosts = sale.sale_costs.length > 0
                const costConfirmed = sale.cost_confirmed === true
                // sticky cell background: must match row bg and support hover
                const stickyBg = isHighlighted ? 'bg-yellow-50' : 'bg-white'

                return (
                  <React.Fragment key={sale.id}>
                    <tr
                      onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                      className={`group cursor-pointer transition-colors ${isHighlighted ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}
                    >
                      {/* sticky: 체크박스 */}
                      <td
                        className={`sticky left-0 z-10 w-[48px] px-4 py-3.5 transition-colors ${isHighlighted ? 'bg-yellow-50 group-hover:bg-yellow-100' : 'bg-white group-hover:bg-gray-50'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <input type="checkbox" checked={selectedIds.has(sale.id)} onChange={() => toggleOne(sale.id)} className="w-3.5 h-3.5 accent-yellow-400 cursor-pointer" />
                      </td>
                      {/* sticky: 건명 + 원가 완료 표시 */}
                      <td className={`sticky left-[48px] z-10 px-4 py-3.5 max-w-[200px] transition-colors after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-gray-100 ${isHighlighted ? 'bg-yellow-50 group-hover:bg-yellow-100' : 'bg-white group-hover:bg-gray-50'}`}>
                        <div className="flex items-center gap-1.5">
                          {costConfirmed ? (
                            <span className="flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 font-medium">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              원가
                            </span>
                          ) : hasCosts ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" title="원가 입력됨 (미확인)" />
                          ) : null}
                          {sale.dropbox_url ? (
                            <a href={sale.dropbox_url} target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 truncate min-w-0" title={sale.name}>
                              <span className="truncate">{sale.name}</span>
                              <span className="text-xs flex-shrink-0">↗</span>
                            </a>
                          ) : (
                            <span className="text-sm font-medium text-gray-900 truncate" title={sale.name}>{sale.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {sale.service_type
                          ? <span className={`text-xs px-2 py-1 rounded-full ${SERVICE_COLORS[sale.service_type] ?? 'bg-gray-100 text-gray-600'}`}>{sale.service_type}</span>
                          : <span className="text-xs text-gray-300">-</span>}
                      </td>
                      {show('사업자') && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {sale.entity
                            ? <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">{sale.entity.name}</span>
                            : <span className="text-xs text-gray-300">-</span>}
                        </td>
                      )}
                      {show('발주처') && (
                        <td className="px-4 py-3.5 text-xs text-gray-600 max-w-[140px]" title={sale.client_org ?? ''}>
                          <div className="flex items-center gap-1 truncate">
                            <span className="truncate">{sale.client_org || <span className="text-gray-300">-</span>}</span>
                            {sale.customer_id && (
                              <a href="/customers" className="shrink-0 text-yellow-500 hover:text-yellow-700" title="고객 DB 연결됨">🗂️</a>
                            )}
                          </div>
                        </td>
                      )}
                      {show('계약방법') && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {sale.contract_type
                            ? <span className={`text-xs px-2 py-1 rounded-full ${CONTRACT_BADGE_COLORS[sale.contract_type] ?? 'bg-gray-100 text-gray-500'}`}>{sale.contract_type}</span>
                            : <span className="text-xs text-gray-300">-</span>}
                        </td>
                      )}
                      {show('담당자') && (
                        <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{(sale.assignee as any)?.name ?? '-'}</td>
                      )}
                      <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(sale.inflow_date)}</td>
                      {show('결제일') && (
                        <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">{formatDate(sale.payment_date)}</td>
                      )}
                      <td className="px-4 py-3.5 text-right text-sm font-medium text-gray-900 whitespace-nowrap">
                        {revenue > 0 ? revenue.toLocaleString() : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm whitespace-nowrap">
                        {hasCosts ? (
                          <span className="text-gray-600">{cost.toLocaleString()}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {revenue > 0
                          ? <span className={`text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{profit.toLocaleString()}</span>
                          : <span className="text-gray-300 text-sm">-</span>}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${CONTRACT_STAGE_COLORS[payStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                          {payStatus}
                        </span>
                      </td>
                      {show('메모') && (
                        <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[120px] truncate" title={sale.memo ?? ''}>{sale.memo || '-'}</td>
                      )}
                    </tr>
                    {isExpanded && (
                      <SaleExpandEditor
                        sale={sale}
                        colSpan={totalCols}
                        entities={entities}
                        vendors={vendors}
                        profiles={profiles}
                        customers={customers}
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

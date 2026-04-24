'use client'
import { useState } from 'react'
import Link from 'next/link'
import { CONTRACT_STAGE_BADGE as CONTRACT_STAGE_COLORS } from '@/lib/constants'

interface Sale {
  id: string
  name: string
  revenue: number | null
  contract_stage: string | null
  inflow_date: string | null
  created_at: string
  entity: { id: string; name: string } | null
  assignee: { id: string; name: string } | null
}

interface Entity {
  id: string
  name: string
}

interface Props {
  sales: Sale[]
  entities: Entity[]
}

function formatMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

const STATUS_ORDER: Record<string, number> = {
  '계약': 0,
  '착수': 1,
  '선금': 2,
  '중도금': 3,
  '완수': 4,
  '계산서발행': 5,
  '잔금': 6,
}

export default function ReceivablesClient({ sales, entities }: Props) {
  const [filterEntity, setFilterEntity] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')

  const filtered = sales
    .filter(s => {
      if (filterEntity && (s.entity as any)?.id !== filterEntity) return false
      if (filterStatus && s.contract_stage !== filterStatus) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return (b.revenue ?? 0) - (a.revenue ?? 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalRevenue = filtered.reduce((s, r) => s + (r.revenue ?? 0), 0)

  // 상태별 집계
  const statusGroups: Record<string, { count: number; amount: number }> = {}
  for (const s of sales) {
    const key = s.contract_stage ?? ''
    if (!statusGroups[key]) statusGroups[key] = { count: 0, amount: 0 }
    statusGroups[key].count++
    statusGroups[key].amount += s.revenue ?? 0
  }

  return (
    <div>
      {/* 상태별 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <div
          className={`rounded-xl border p-4 cursor-pointer transition-colors ${!filterStatus ? 'border-yellow-400 bg-yellow-50' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
          onClick={() => setFilterStatus('')}
        >
          <p className="text-xs text-gray-400 mb-1">전체 미수금</p>
          <p className="text-xl font-bold text-orange-500">{formatMoney(sales.reduce((s, r) => s + (r.revenue ?? 0), 0))}원</p>
          <p className="text-xs text-gray-400 mt-1">{sales.length}건</p>
        </div>
        {Object.entries(statusGroups)
          .sort(([a], [b]) => (STATUS_ORDER[a] ?? 9) - (STATUS_ORDER[b] ?? 9))
          .map(([status, { count, amount }]) => (
            <div
              key={status}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${filterStatus === status ? 'border-yellow-400 bg-yellow-50' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
              onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONTRACT_STAGE_COLORS[status] ?? 'bg-gray-100 text-gray-500'}`}>{status}</span>
              </div>
              <p className="text-lg font-bold text-gray-800">{formatMoney(amount)}원</p>
              <p className="text-xs text-gray-400 mt-0.5">{count}건</p>
            </div>
          ))}
      </div>

      {/* 필터 + 정렬 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
        >
          <option value="">전체 사업자</option>
          {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs ml-auto">
          <button
            onClick={() => setSortBy('date')}
            className={`px-3 py-2 transition-colors ${sortBy === 'date' ? 'bg-yellow-400 font-semibold text-gray-900' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >최신순</button>
          <button
            onClick={() => setSortBy('amount')}
            className={`px-3 py-2 transition-colors ${sortBy === 'amount' ? 'bg-yellow-400 font-semibold text-gray-900' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >금액순</button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
          <span className="text-sm font-semibold text-gray-700">{filtered.length}건</span>
          <span className="text-sm font-bold text-orange-500">합계 {formatMoney(totalRevenue)}원</span>
        </div>

        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">해당하는 미수금이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(s => (
              <Link
                key={s.id}
                href={`/sales/${s.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                    {s.entity && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex-shrink-0">{s.entity.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{formatDate(s.inflow_date ?? s.created_at)}</span>
                    {s.assignee && <span>{s.assignee.name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {s.contract_stage && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CONTRACT_STAGE_COLORS[s.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                      {s.contract_stage}
                    </span>
                  )}
                  <span className="text-base font-bold text-gray-800">{formatMoney(s.revenue ?? 0)}원</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

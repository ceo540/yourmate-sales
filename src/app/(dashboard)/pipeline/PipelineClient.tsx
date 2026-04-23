'use client'
import { useState, useMemo } from 'react'
import { createProfileNameMap } from '@/lib/utils'

// ─── 파이프라인 3컬럼 정의 ──────────────────────────────────────
const COLUMNS = [
  {
    key: 'lead',
    label: '리드',
    sub: '유입 · 견적 · 협의',
    color: 'border-blue-200 bg-blue-50',
    dot: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'active',
    label: '계약 · 진행',
    sub: '계약완료 · 착수중',
    color: 'border-yellow-200 bg-yellow-50',
    dot: 'bg-yellow-400',
    badge: 'bg-yellow-100 text-yellow-700',
  },
  {
    key: 'done',
    label: '완수 · 잔금',
    sub: '완수 · 잔금 대기',
    color: 'border-green-200 bg-green-50',
    dot: 'bg-green-400',
    badge: 'bg-green-100 text-green-700',
  },
] as const

type ColumnKey = 'lead' | 'active' | 'done'

interface PipelineCard {
  id: string
  type: 'lead' | 'sale'
  column: ColumnKey
  stageLabel: string
  org: string
  service: string | null
  assigneeId: string | null
  revenue: number | null
  dday: number | null
  href: string
}

const SERVICE_COLORS: Record<string, string> = {
  'SOS':         'bg-blue-50 text-blue-600',
  '교구대여':     'bg-teal-50 text-teal-600',
  '교육프로그램': 'bg-purple-50 text-purple-600',
  '납품설치':     'bg-amber-50 text-amber-700',
  '행사운영':     'bg-orange-50 text-orange-600',
  '콘텐츠제작':   'bg-pink-50 text-pink-600',
  '002ENT':      'bg-indigo-50 text-indigo-600',
  '유지보수':     'bg-gray-50 text-gray-600',
  '제작인쇄':     'bg-cyan-50 text-cyan-600',
  '행사대여':     'bg-rose-50 text-rose-600',
  '프로젝트':     'bg-violet-50 text-violet-600',
}

const STAGE_LABEL_COLORS: Record<string, string> = {
  '유입':          'text-blue-500',
  '회신대기':      'text-sky-500',
  '견적발송':      'text-orange-500',
  '조율중':        'text-purple-500',
  '진행중(리드)':  'text-green-500',
  '계약전':        'text-gray-500',
  '계약완료':      'text-yellow-600',
  '선금수령':      'text-amber-600',
  '중도금수령':    'text-orange-600',
  '완수':          'text-teal-600',
  '완수(잔금대기)':'text-teal-600',
}

function fmt(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}천만`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return `${n.toLocaleString()}원`
}

function calcDday(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function DdayBadge({ dday }: { dday: number | null }) {
  if (dday === null) return null
  if (dday < 0)   return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold shrink-0">D+{Math.abs(dday)}</span>
  if (dday === 0) return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold shrink-0">D-day</span>
  if (dday <= 3)  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold shrink-0">D-{dday}</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 shrink-0">D-{dday}</span>
}

interface Props {
  leads: any[]
  sales: any[]
  profiles: { id: string; name: string }[]
  currentUserId: string
}

export default function PipelineClient({ leads, sales, profiles }: Props) {
  const [assigneeFilter, setAssigneeFilter] = useState('전체')
  const [serviceFilter, setServiceFilter] = useState('전체')

  const profileMap = createProfileNameMap(profiles)

  // 리드와 매출건을 카드 형태로 통합
  const cards: PipelineCard[] = useMemo(() => {
    const result: PipelineCard[] = []

    // 리드 → column 매핑
    for (const lead of leads) {
      let column: ColumnKey = 'lead'
      const stageLabel = lead.status === '진행중' ? '진행중(리드)' : lead.status
      result.push({
        id: lead.id,
        type: 'lead',
        column,
        stageLabel,
        org: lead.client_org || '(기관 없음)',
        service: lead.service_type,
        assigneeId: lead.assignee_id,
        revenue: null,
        dday: calcDday(lead.remind_date),
        href: '/leads',
      })
    }

    // 매출건 → column 매핑
    for (const sale of sales) {
      const ps = sale.contract_stage ?? '계약'
      const prog = sale.progress_status ?? '착수전'
      let column: ColumnKey
      let stageLabel: string

      if (ps === '잔금') {
        column = 'done'
        stageLabel = ps
      } else {
        column = 'active'
        stageLabel = ps
      }

      // 운영 진행이 완수이면 done 컬럼으로
      if (prog === '완수' && column === 'active') {
        column = 'done'
        stageLabel = '완수(잔금대기)'
      }

      result.push({
        id: sale.id,
        type: 'sale',
        column,
        stageLabel,
        org: sale.client_org || sale.name,
        service: sale.service_type,
        assigneeId: sale.assignee_id,
        revenue: sale.revenue,
        dday: calcDday(sale.remind_date),
        href: `/sales/${sale.id}`,
      })
    }

    return result
  }, [leads, sales])

  // 필터 적용
  const filtered = cards.filter(c => {
    const matchAssignee = assigneeFilter === '전체' || (c.assigneeId && profileMap[c.assigneeId] === assigneeFilter)
    const matchService  = serviceFilter === '전체' || c.service === serviceFilter
    return matchAssignee && matchService
  })

  const columnData = COLUMNS.map(col => {
    const items = filtered.filter(c => c.column === col.key)
    return {
      ...col,
      items,
      total: items.reduce((acc, c) => acc + (c.revenue ?? 0), 0),
    }
  })

  // 요약
  const totalActive    = filtered.filter(c => c.column !== 'done').length
  const totalRevenue   = filtered.reduce((a, c) => a + (c.revenue ?? 0), 0)
  const pendingRevenue = filtered.filter(c => c.column === 'done').reduce((a, c) => a + (c.revenue ?? 0), 0)
  const urgentCount    = filtered.filter(c => c.dday !== null && c.dday >= 0 && c.dday <= 3).length

  // 서비스 목록 (데이터 기반)
  const allServices = Array.from(new Set(cards.map(c => c.service).filter(Boolean))) as string[]

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">파이프라인</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
          리드 {leads.length} · 매출건 {sales.length}
        </span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '진행 중',     value: `${totalActive}건` },
          { label: '총 예상 매출', value: totalRevenue ? fmt(totalRevenue) : '-' },
          { label: '완수 잔금 대기', value: pendingRevenue ? fmt(pendingRevenue) : '-' },
          { label: '긴급 (D-3)',   value: `${urgentCount}건`, red: urgentCount > 0 },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400">{c.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${c.red ? 'text-red-500' : 'text-gray-900'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* 담당자 탭 */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {['전체', ...profiles.map(p => p.name)].map(name => (
            <button key={name} onClick={() => setAssigneeFilter(name)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                assigneeFilter === name ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>{name}</button>
          ))}
        </div>

        {/* 서비스 필터 */}
        <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
          <option value="전체">전체 서비스</option>
          {allServices.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* 칸반 3컬럼 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columnData.map(col => (
          <div key={col.key} className={`rounded-2xl border p-3 ${col.color}`}>
            {/* 컬럼 헤더 */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-bold text-gray-800">{col.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>{col.items.length}</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 ml-3.5">{col.sub}</p>
              </div>
              {col.total > 0 && (
                <span className="text-sm font-bold text-gray-700">{fmt(col.total)}</span>
              )}
            </div>

            {/* 카드 목록 */}
            <div className="space-y-2">
              {col.items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl h-20 flex items-center justify-center">
                  <span className="text-xs text-gray-300">없음</span>
                </div>
              ) : col.items.map(card => (
                <a key={`${card.type}-${card.id}`} href={card.href}
                  className="block bg-white border border-gray-100 rounded-xl px-3.5 py-3 hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer">
                  {/* 단계 + D-day */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-semibold ${STAGE_LABEL_COLORS[card.stageLabel] ?? 'text-gray-400'}`}>
                        {card.stageLabel}
                      </span>
                      {card.type === 'lead' && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-400">리드</span>
                      )}
                    </div>
                    <DdayBadge dday={card.dday} />
                  </div>

                  {/* 기관명 */}
                  <p className="text-sm font-semibold text-gray-800 leading-tight mb-1">{card.org}</p>

                  {/* 서비스 + 담당자 */}
                  <div className="flex items-center justify-between">
                    {card.service ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[card.service] ?? 'bg-gray-100 text-gray-500'}`}>
                        {card.service}
                      </span>
                    ) : <span />}
                    <span className="text-[11px] text-gray-400">
                      {card.assigneeId ? (profileMap[card.assigneeId] ?? '') : ''}
                    </span>
                  </div>

                  {/* 매출 */}
                  {card.revenue != null && card.revenue > 0 && (
                    <p className="text-xs font-bold text-gray-700 mt-1.5">{fmt(card.revenue)}</p>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

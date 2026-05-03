'use client'

// 계약 운영실 핵심 현황판 (Phase 8)
// sale 상세 진입 즉시 보여야 할 6~7개 핵심 KPI + 다음 액션 + 연결된 프로젝트
// project 허브와 다른 "계약 시야"가 화면에서 느껴지도록.

import Link from 'next/link'
import DropboxStatusBadge, { resolveDropboxStatus } from '@/components/DropboxStatus'

const MAIN_TYPE_BADGE: Record<string, string> = {
  '학교공연형':   'bg-purple-50 text-purple-700 border-purple-200',
  '교육운영형':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  '복합행사형':   'bg-amber-50 text-amber-700 border-amber-200',
  '렌탈·납품형':  'bg-blue-50 text-blue-700 border-blue-200',
  '콘텐츠제작형': 'bg-pink-50 text-pink-700 border-pink-200',
}

const STAGE_FLOW = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const

export interface SaleHeroSale {
  id: string
  name: string
  contract_stage: string | null
  service_type: string | null
  dropbox_url: string | null
  revenue: number | null
  cost_confirmed: boolean | null
  assignee_id: string | null
  contract_assignee_id: string | null
  main_type: string | null
  expansion_tags: string[] | null
  project_id: string | null
}

export interface SaleHeroPaymentSchedule {
  id: string
  amount: number
  is_received: boolean
  due_date: string | null
}

export interface SaleHeroCost {
  amount: number | null
  vendor_name?: string | null
}

export interface SaleHeroConnectedProject {
  id: string
  name: string
  project_number: string | null
  main_type: string | null
}

function fmtMoney(n: number | null | undefined) {
  if (!n) return '0'
  return `${(n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`
}

function pickNextAction(input: {
  sale: SaleHeroSale
  totalCost: number
  paymentReceived: number
  paymentTotal: number
}): { label: string; tone: 'red' | 'amber' | 'blue' | 'gray'; hint?: string } {
  const { sale, totalCost, paymentReceived, paymentTotal } = input

  // 1) Dropbox 미연결 = 가장 시급
  const dbx = resolveDropboxStatus({ dropbox_url: sale.dropbox_url, stage: 'sale' })
  if (dbx.kind === 'not_connected') {
    return { label: '자료 폴더 연결', tone: 'red', hint: '폴더가 아직 연결되지 않았어요.' }
  }
  // 2) 운영 분류 미정리
  if (!sale.main_type) {
    return { label: '운영 분류 정리', tone: 'amber', hint: '메인유형을 정해야 프로젝트 단계로 이어집니다.' }
  }
  // 3) 원가 미확인
  if (sale.cost_confirmed !== true && totalCost === 0) {
    return { label: '원가 확인', tone: 'amber', hint: '원가가 아직 입력·확정되지 않았어요.' }
  }
  // 4) 계약 단계별 안내
  const stage = sale.contract_stage ?? '계약'
  if (stage === '계약')        return { label: '착수 단계로 이동', tone: 'blue' }
  if (stage === '착수')        return { label: '선금 청구', tone: 'blue' }
  if (stage === '선금')        return { label: '중도금 일정 확인', tone: 'blue' }
  if (stage === '중도금')      return { label: '완수 정리', tone: 'blue' }
  if (stage === '완수')        return { label: '계산서 발행', tone: 'blue' }
  if (stage === '계산서발행')  return { label: '잔금 청구', tone: 'blue' }
  if (stage === '잔금')        {
    if (paymentTotal > 0 && paymentReceived < paymentTotal) {
      return { label: '잔금 입금 확인', tone: 'amber' }
    }
    return { label: '계약 마무리 정리', tone: 'gray' }
  }
  return { label: '연결된 프로젝트에서 실행', tone: 'gray' }
}

export default function SaleHeroPanel({
  sale,
  costs,
  paymentSchedules,
  connectedProject,
  assigneeName,
  contractAssigneeName,
  showInternalCosts,
}: {
  sale: SaleHeroSale
  costs: SaleHeroCost[]
  paymentSchedules: SaleHeroPaymentSchedule[]
  connectedProject: SaleHeroConnectedProject | null
  assigneeName: string | null
  contractAssigneeName: string | null
  showInternalCosts: boolean
}) {
  const totalCost = (costs ?? []).reduce((s, c) => s + (c.amount ?? 0), 0)
  const paymentReceived = paymentSchedules.filter(p => p.is_received).reduce((s, p) => s + p.amount, 0)
  const paymentTotal = paymentSchedules.reduce((s, p) => s + p.amount, 0)
  const paymentReceivedCount = paymentSchedules.filter(p => p.is_received).length
  const paymentTotalCount = paymentSchedules.length

  const stage = sale.contract_stage ?? '계약'
  const stageIdx = STAGE_FLOW.indexOf(stage as typeof STAGE_FLOW[number])
  const nextAction = pickNextAction({ sale, totalCost, paymentReceived, paymentTotal })

  const TONE_BG: Record<typeof nextAction.tone, string> = {
    red:   'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    gray:  'bg-gray-50 text-gray-600 border-gray-200',
  }

  const profitText = sale.revenue && totalCost > 0 && showInternalCosts
    ? `${fmtMoney(sale.revenue - totalCost)}원`
    : null

  return (
    <section className="bg-white border-2 border-violet-100 rounded-2xl overflow-hidden mb-3">
      {/* 헤더 */}
      <div className="bg-violet-50/40 border-b border-violet-100 px-4 py-2 flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold text-violet-900">📜 계약 운영실</span>
        <span className="text-[10px] text-violet-700">— 계약 진행·정산·운영 분류를 정리하는 단계</span>
      </div>

      {/* 단계 진행 미니 stepper */}
      <div className="px-4 py-2.5 border-b border-gray-50 flex items-center gap-1 overflow-x-auto">
        {STAGE_FLOW.map((s, i) => {
          const active = i === stageIdx
          const done = stageIdx >= 0 && i < stageIdx
          return (
            <div key={s} className="flex items-center gap-1 flex-shrink-0">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                active ? 'bg-violet-100 text-violet-900 border-violet-300 font-bold'
                : done ? 'bg-gray-100 text-gray-500 border-gray-200'
                : 'bg-white text-gray-400 border-gray-200'
              }`}>
                {done && '✓ '}{s}
              </span>
              {i < STAGE_FLOW.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
            </div>
          )
        })}
      </div>

      {/* KPI 그리드 */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-b border-gray-50">
        <Kpi label="계약 담당" value={contractAssigneeName ?? assigneeName ?? '미지정'} tone={contractAssigneeName || assigneeName ? 'gray' : 'amber'} />
        <Kpi label="매출" value={`${fmtMoney(sale.revenue)}원`} tone="gray" />
        {showInternalCosts && (
          <Kpi
            label="원가"
            value={totalCost > 0 ? `${fmtMoney(totalCost)}원` : (sale.cost_confirmed ? '0원 (확인됨)' : '미확인')}
            tone={sale.cost_confirmed === true ? 'green' : 'amber'}
          />
        )}
        {profitText && <Kpi label="영업이익" value={profitText} tone="green" />}
        <Kpi
          label="입금 진행"
          value={paymentTotalCount > 0 ? `${paymentReceivedCount}/${paymentTotalCount}건 (${fmtMoney(paymentReceived)}/${fmtMoney(paymentTotal)})` : '일정 없음'}
          tone={paymentTotalCount === 0 ? 'gray' : (paymentReceivedCount === paymentTotalCount ? 'green' : 'amber')}
        />
        <div>
          <p className="text-[10px] text-gray-500 mb-0.5">운영 분류</p>
          <div className="flex items-center gap-1 flex-wrap">
            {sale.main_type ? (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${MAIN_TYPE_BADGE[sale.main_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                🧭 {sale.main_type}
              </span>
            ) : (
              <span className="text-[11px] text-amber-700">미설정</span>
            )}
            {sale.expansion_tags && sale.expansion_tags.length > 0 && (
              <span className="text-[10px] text-gray-400" title={sale.expansion_tags.join(', ')}>
                +{sale.expansion_tags.length}
              </span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-gray-500 mb-0.5">자료 폴더</p>
          <DropboxStatusBadge dropbox_url={sale.dropbox_url} stage="sale" />
        </div>
      </div>

      {/* 다음 액션 + 연결된 프로젝트 */}
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">다음 액션</span>
          <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${TONE_BG[nextAction.tone]}`}>
            ▶ {nextAction.label}
          </span>
          {nextAction.hint && (
            <span className="text-[10px] text-gray-500 truncate">{nextAction.hint}</span>
          )}
        </div>
        {connectedProject && (
          <Link
            href={`/projects/${connectedProject.id}`}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 flex-shrink-0"
          >
            <span className="text-[10px] text-gray-400">🔗 연결된 프로젝트</span>
            {connectedProject.project_number && (
              <span className="text-[10px] font-mono text-gray-500">[{connectedProject.project_number}]</span>
            )}
            <span className="font-medium truncate max-w-[200px]">{connectedProject.name}</span>
            <span className="text-gray-400">↗</span>
          </Link>
        )}
      </div>
    </section>
  )
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'gray' | 'green' | 'amber' | 'red' }) {
  const valueCls =
    tone === 'green' ? 'text-emerald-700' :
    tone === 'amber' ? 'text-amber-700' :
    tone === 'red'   ? 'text-red-700' :
    'text-gray-900'
  return (
    <div>
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${valueCls}`}>{value}</p>
    </div>
  )
}

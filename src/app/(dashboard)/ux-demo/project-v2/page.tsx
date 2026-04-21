'use client'

import { useState, useRef, useEffect } from 'react'

// ══════════════════════════════════════════════════════════════
// 목업 데이터
// 시나리오 A: 2개 리드 → 1 프로젝트 병합
// 시나리오 B: 1 프로젝트 → 3개 계약으로 쪼개기 (수의계약 한도)
// ══════════════════════════════════════════════════════════════

const PROJECT = {
  id: 'proj-001',
  code: 'PRJ-260414-001',
  name: '경기도특수교육원 2026 진드페+e페스티벌',
  service_type: '교육프로그램',
  department: '아트키움',
  status: '진행중',
  customer: { name: '경기도교육청 특수교육원', type: '공공기관' },
  inflow_date: '2026-04-14',
  event_dates: ['2026-06-11', '2026-11-05'],
  notes: '공공기관 수의계약 한도(5,000만) 초과로 계약 3건으로 분리. 감사 이슈 없도록 계약서별 발행사 분리 필요.',
}

// 연결된 리드들 (시나리오 A: 2개 리드 → 1 프로젝트)
const LINKED_LEADS = [
  {
    id: 'lead-001', lead_id: 'LEAD20260310-0001',
    title: '진드페 운영 문의', status: '진행중',
    inflow_date: '2026-03-10', contact: '김미현 주무관',
    note: '최초 유입 리드 — 진드페 행사 운영 문의',
    is_primary: true,
  },
  {
    id: 'lead-002', lead_id: 'LEAD20260401-0012',
    title: 'e페스티벌 추가 문의', status: '진행중',
    inflow_date: '2026-04-01', contact: '박성준 팀장',
    note: '기존 진드페 계약 중 e페스티벌 추가 요청 — 프로젝트 병합 처리',
    is_primary: false,
  },
]

// 계약들 (시나리오 B: 1 프로젝트 → 3개 계약)
const CONTRACTS = [
  {
    id: 'sale-001',
    name: '강사·운영 용역계약 (진드페)',
    entity: '(주)유어메이트',
    revenue: 38000000,
    contract_stage: '선금',
    signed_date: '2026-04-12',
    payment_date: '2026-06-25',
    assignee: '임지영',
    split_reason: '수의계약 A — 강사 및 행사 운영',
    payments: [
      { label: '선금 30%', amount: 11400000, done: true, date: '2026-04-14' },
      { label: '잔금 70%', amount: 26600000, done: false, date: '2026-06-25' },
    ],
    costs: [
      { item: '강사비 (음악치료사 2명)', cat: '인건비', amount: 8000000 },
      { item: '강사비 (무용치료사 1명)', cat: '인건비', amount: 3000000 },
      { item: '운영 인건비', cat: '인건비', amount: 4000000 },
      { item: '기타 운영비', cat: '기타', amount: 6000000 },
    ],
  },
  {
    id: 'sale-002',
    name: '음향·무대장비 임차계약',
    entity: 'Sound OF School',
    revenue: 9500000,
    contract_stage: '계약',
    signed_date: '2026-04-15',
    payment_date: '2026-06-20',
    assignee: '유제민',
    split_reason: '수의계약 B — 음향 및 무대 장비 임차',
    payments: [
      { label: '전액', amount: 9500000, done: false, date: '2026-06-20' },
    ],
    costs: [
      { item: '음향장비 렌탈', cat: '장비', amount: 5500000 },
      { item: '무대 설치·철거', cat: '장비', amount: 1800000 },
    ],
  },
  {
    id: 'sale-003',
    name: 'e페스티벌 운영 용역계약',
    entity: '(주)유어메이트',
    revenue: 14000000,
    contract_stage: '계약',
    signed_date: null,
    payment_date: '2026-11-10',
    assignee: '임지영',
    split_reason: '수의계약 C — e페스티벌 (11월 별도 계약)',
    payments: [
      { label: '선금 30%', amount: 4200000, done: false, date: '2026-09-01' },
      { label: '잔금 70%', amount: 9800000, done: false, date: '2026-11-10' },
    ],
    costs: [
      { item: '강사비', cat: '인건비', amount: 5000000 },
      { item: '음향·장비', cat: '장비', amount: 2500000 },
      { item: '기타', cat: '기타', amount: 1500000 },
    ],
  },
]

const TASKS = [
  { id: 1, title: '강사 섭외 및 계약', status: '진행중', assignee: '임지영', due: '2026-04-25', priority: '긴급', sale_id: 'sale-001' },
  { id: 2, title: '음향 장비 사전 점검', status: '할 일', assignee: '유제민', due: '2026-05-10', priority: '높음', sale_id: 'sale-002' },
  { id: 3, title: '행사 진행 매뉴얼 작성', status: '할 일', assignee: '임지영', due: '2026-05-20', priority: '보통', sale_id: null },
  { id: 4, title: 'e페스티벌 계약서 기안', status: '할 일', assignee: '방준영', due: '2026-08-01', priority: '보통', sale_id: 'sale-003' },
  { id: 5, title: '사전답사 보고서 작성', status: '완료', assignee: '임지영', due: '2026-04-22', priority: '높음', sale_id: null },
]

const LOGS = [
  { id: 1, date: '2026-04-20', type: '출장', author: '임지영', content: '곤지암리조트 사전답사 완료. 음향 위치 B구역 확정.', outcome: '조명 추가 견적 필요', sale_id: null },
  { id: 2, date: '2026-04-16', type: '내부회의', author: '방준영', content: '수의계약 3건 분리 방식 확정. 계약서별 발행사 분리로 감사 리스크 최소화.', outcome: '계약 A: 유어메이트, 계약 B: SOS, 계약 C: 유어메이트', sale_id: null },
  { id: 3, date: '2026-04-15', type: '통화', author: '임지영', content: '김미현 주무관 통화 — e페스티벌 건 추가 확인. 11월 일정으로 별도 계약 진행 동의.', sale_id: 'sale-003' },
  { id: 4, date: '2026-04-10', type: '이메일', author: '방준영', content: '1차 견적서 발송 (강사·운영 용역 38,000,000원).', sale_id: 'sale-001' },
]

// ── 스타일 상수 ───────────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  계약: 'bg-blue-100 text-blue-700', 착수: 'bg-purple-100 text-purple-700',
  선금: 'bg-yellow-100 text-yellow-700', 중도금: 'bg-orange-100 text-orange-700',
  완수: 'bg-teal-100 text-teal-700', 계산서발행: 'bg-indigo-100 text-indigo-700',
  잔금: 'bg-green-100 text-green-700',
}
const STATUS_STYLE: Record<string, string> = {
  '완료': 'bg-green-100 text-green-700', '진행중': 'bg-blue-100 text-blue-700',
  '할 일': 'bg-gray-100 text-gray-500', '보류': 'bg-red-100 text-red-500',
}
const LOG_STYLE: Record<string, { badge: string; label: string }> = {
  통화:    { badge: 'bg-blue-50 text-blue-700 border-blue-100',   label: '📞 통화' },
  이메일:  { badge: 'bg-violet-50 text-violet-700 border-violet-100', label: '✉ 이메일' },
  방문:    { badge: 'bg-green-50 text-green-700 border-green-100',  label: '🏢 방문' },
  미팅:    { badge: 'bg-teal-50 text-teal-700 border-teal-100',    label: '🤝 미팅' },
  출장:    { badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',    label: '🚗 출장' },
  내부회의: { badge: 'bg-orange-50 text-orange-700 border-orange-100', label: '💬 내부회의' },
  메모:    { badge: 'bg-yellow-50 text-yellow-700 border-yellow-100', label: '📝 메모' },
}
const PRIORITY_DOT: Record<string, string> = {
  긴급: 'bg-red-500', 높음: 'bg-orange-400', 보통: 'bg-gray-300', 낮음: 'bg-gray-200',
}
const AVATAR_COLORS = ['bg-yellow-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400']
const PROFILES = ['임지영', '유제민', '방준영', '조민현', '이하나']

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만원`
  return `${Math.round(n / 10000)}만원`
}
function fmtShort(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만`
  return `${Math.round(n / 10000)}만`
}
function Avatar({ name, idx = 0, size = 'sm' }: { name: string; idx?: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'
  return (
    <div className={`${s} ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} rounded-full flex items-center justify-center font-semibold text-gray-900 flex-shrink-0`}>
      {name[0]}
    </div>
  )
}

// ── 계약 카드 컴포넌트 ─────────────────────────────────────────
function ContractCard({ contract, index, tasks }: {
  contract: typeof CONTRACTS[0]; index: number; tasks: typeof TASKS
}) {
  const [expanded, setExpanded] = useState(index === 0)
  const [finTab, setFinTab] = useState<'payment' | 'cost'>('payment')

  const totalCost = contract.costs.reduce((s, c) => s + c.amount, 0)
  const profit = contract.revenue - totalCost
  const margin = Math.round((profit / contract.revenue) * 100)
  const receivedAmount = contract.payments.filter(p => p.done).reduce((s, p) => s + p.amount, 0)
  const contractTasks = tasks.filter(t => t.sale_id === contract.id)

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'border-gray-200 shadow-sm' : 'border-gray-100'}`}>
      {/* 계약 헤더 */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
      >
        {/* 번호 배지 */}
        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{contract.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[contract.contract_stage]}`}>
              {contract.contract_stage}
            </span>
            <span className="text-xs text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">{contract.entity}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500 font-medium">{fmtMoney(contract.revenue)}</span>
            <span className="text-xs text-gray-400">{contract.split_reason}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* 입금 프로그레스 */}
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full"
                style={{ width: `${Math.round(receivedAmount / contract.revenue * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-400">{Math.round(receivedAmount / contract.revenue * 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Avatar name={contract.assignee} idx={PROFILES.indexOf(contract.assignee)} size="sm" />
          </div>
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 계약 상세 */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* 계약 분리 사유 메모 */}
          <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-blue-700">
              <span className="font-medium">계약 분리 사유:</span> {contract.split_reason}
              {contract.signed_date
                ? <span className="ml-2 text-blue-500">서명일: {contract.signed_date}</span>
                : <span className="ml-2 text-orange-500 font-medium">⚠ 계약서 미작성</span>
              }
            </p>
          </div>

          {/* 재무 탭 */}
          <div className="flex border-b border-gray-100">
            {(['payment', 'cost'] as const).map(t => (
              <button key={t} onClick={() => setFinTab(t)}
                className={`px-4 py-2 text-xs font-medium transition-all ${finTab === t ? 'text-gray-900 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-600'}`}>
                {t === 'payment' ? '입금 현황' : `원가 (마진 ${margin}%)`}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {finTab === 'payment' ? (
              <div className="space-y-2">
                {contract.payments.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${p.done ? 'bg-green-400' : 'bg-gray-200'}`}>
                      {p.done && <span className="text-white text-xs leading-none">✓</span>}
                    </div>
                    <span className="text-sm text-gray-700 flex-1">{p.label}</span>
                    <span className={`text-sm font-medium ${p.done ? 'text-green-600' : 'text-gray-500'}`}>
                      {fmtMoney(p.amount)}
                    </span>
                    <span className="text-xs text-gray-400">{p.date}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                  <span className="text-gray-500">수령 / 계약 총액</span>
                  <span className="font-semibold text-gray-800">
                    {fmtMoney(receivedAmount)} / {fmtMoney(contract.revenue)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {contract.costs.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">{c.cat}</span>
                    <span className="flex-1 text-gray-600">{c.item}</span>
                    <span className="text-gray-800 font-medium">{fmtShort(c.amount)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <p className="text-gray-400">매출</p>
                    <p className="font-semibold text-gray-800">{fmtShort(contract.revenue)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">원가</p>
                    <p className="font-semibold text-gray-800">{fmtShort(totalCost)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400">이익</p>
                    <p className="font-semibold text-green-600">{fmtShort(profit)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 이 계약 관련 업무 */}
          {contractTasks.length > 0 && (
            <div className="px-4 pb-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mt-2 mb-1.5">이 계약의 업무</p>
              <div className="space-y-1">
                {contractTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    <span className={t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-600'}>{t.title}</span>
                    <span className={`ml-auto px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────
export default function ProjectV2Demo() {
  const [tasks, setTasks] = useState(TASKS)
  const [logs] = useState(LOGS)
  const [logFilter, setLogFilter] = useState<'전체' | string>('전체')
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending'>('pending')
  const [pm, setPm] = useState(['임지영'])
  const [members, setMembers] = useState(['유제민', '방준영'])
  const [showLeadDetail, setShowLeadDetail] = useState(false)
  const [addingContract, setAddingContract] = useState(false)

  const PIPELINE = ['유입', '협의중', '견적발송', '계약', '진행중', '완료']
  const pipelineIdx = PIPELINE.indexOf(PROJECT.status === '진행중' ? '진행중' : '완료')

  const totalRevenue = CONTRACTS.reduce((s, c) => s + c.revenue, 0)
  const totalCost = CONTRACTS.reduce((s, c) => s + c.costs.reduce((cs, cc) => cs + cc.amount, 0), 0)
  const totalReceived = CONTRACTS.reduce((s, c) => s + c.payments.filter(p => p.done).reduce((ps, p) => ps + p.amount, 0), 0)
  const totalProfit = totalRevenue - totalCost
  const totalMargin = Math.round(totalProfit / totalRevenue * 100)
  const pendingTasks = tasks.filter(t => t.status !== '완료')
  const shownTasks = taskFilter === 'pending' ? pendingTasks : tasks

  const filteredLogs = logFilter === '전체' ? logs
    : logFilter === '프로젝트 전체'
      ? logs.filter(l => l.sale_id === null)
      : logs.filter(l => l.sale_id === logFilter)

  return (
    <div className="min-h-screen bg-[#F5F5F3]">

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-400 font-mono">{PROJECT.code}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{PROJECT.service_type}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">{PROJECT.department}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{PROJECT.name}</h1>
              {/* PM + 팀원 */}
              <div className="flex items-center gap-5 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">PM</span>
                  <div className="flex items-center gap-1">
                    {pm.map((n, i) => <Avatar key={n} name={n} idx={PROFILES.indexOf(n)} />)}
                    <span className="text-xs text-gray-700 ml-1">{pm.join(', ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">팀원</span>
                  <div className="flex -space-x-1">
                    {members.map((n, i) => <Avatar key={n} name={n} idx={PROFILES.indexOf(n)} />)}
                  </div>
                  <span className="text-xs text-gray-500">{members.join(', ')}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm px-3 py-1.5 rounded-full font-medium bg-blue-100 text-blue-700">진행중</span>
              <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">편집</button>
            </div>
          </div>

          {/* 파이프라인 */}
          <div className="flex items-center gap-0 mt-3">
            {PIPELINE.map((stage, i) => (
              <div key={stage} className="flex items-center">
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                  i < pipelineIdx ? 'text-gray-400' : i === pipelineIdx ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'text-gray-300'
                }`}>
                  {i < pipelineIdx && <span className="text-green-500">✓</span>}
                  {stage}
                </div>
                {i < PIPELINE.length - 1 && <span className="text-gray-200 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex gap-5 items-start">

        {/* ─── 좌측 ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 프로젝트 전체 요약 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '총 계약 금액', value: fmtMoney(totalRevenue), sub: `${CONTRACTS.length}개 계약`, color: 'text-gray-900' },
              { label: `총 마진 ${totalMargin}%`, value: fmtMoney(totalProfit), sub: `원가 ${fmtShort(totalCost)}원`, color: 'text-green-600' },
              { label: '수령 완료', value: fmtMoney(totalReceived), sub: `${Math.round(totalReceived / totalRevenue * 100)}% 입금`, color: 'text-blue-600' },
              { label: '진행 업무', value: `${pendingTasks.length}건`, sub: `전체 ${tasks.length}건`, color: pendingTasks.length > 0 ? 'text-orange-500' : 'text-green-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className={`text-base font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* 주의 메모 */}
          {PROJECT.notes && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">⚠ 유의사항</p>
              <p className="text-sm text-orange-800 leading-relaxed">{PROJECT.notes}</p>
            </div>
          )}

          {/* ── 연결된 리드 (시나리오 A 표시) ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setShowLeadDetail(s => !s)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">연결된 리드</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{LINKED_LEADS.length}건</span>
                <span className="text-xs text-gray-400">이 프로젝트로 병합된 리드들</span>
              </div>
              <span className="text-gray-300 text-xs">{showLeadDetail ? '▲' : '▼'}</span>
            </button>
            {showLeadDetail && (
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {LINKED_LEADS.map(l => (
                  <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                    <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${l.is_primary ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800">{l.title}</span>
                        {l.is_primary && <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">최초 리드</span>}
                        <span className="text-xs font-mono text-gray-400">{l.lead_id}</span>
                      </div>
                      <p className="text-xs text-gray-500">{l.note}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{l.contact} · 유입 {l.inflow_date}</p>
                    </div>
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">{l.status}</span>
                  </div>
                ))}
                <div className="px-4 py-2.5">
                  <button className="text-xs text-gray-400 hover:text-gray-700">+ 리드 연결 추가</button>
                </div>
              </div>
            )}
          </div>

          {/* ── 계약 목록 (시나리오 B 핵심) ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">계약 목록</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{CONTRACTS.length}건</span>
                {/* 계약 합산 */}
                <span className="text-xs text-gray-400">합계 {fmtMoney(totalRevenue)}</span>
              </div>
              <button onClick={() => setAddingContract(s => !s)}
                className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                + 계약 추가
              </button>
            </div>

            {/* 계약 추가 폼 (간략) */}
            {addingContract && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">새 계약 추가 — 수의계약 분리 또는 추가 계약</p>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="계약명" className="col-span-2 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                  <input placeholder="금액 (만원)" className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                </div>
                <div className="flex gap-2 mt-2">
                  <select className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400">
                    <option>발행사 선택</option>
                    <option>(주)유어메이트</option>
                    <option>Sound OF School</option>
                  </select>
                  <button onClick={() => setAddingContract(false)}
                    className="px-3 py-1.5 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">추가</button>
                  <button onClick={() => setAddingContract(false)}
                    className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
                </div>
              </div>
            )}

            {/* 계약 카드들 */}
            <div className="p-3 space-y-2">
              {CONTRACTS.map((c, i) => (
                <ContractCard key={c.id} contract={c} index={i} tasks={tasks} />
              ))}
            </div>

            {/* 프로젝트 재무 합산 */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <div className="grid grid-cols-4 gap-4 text-center text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">총 매출</p>
                  <p className="font-bold text-gray-900">{fmtMoney(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">총 원가</p>
                  <p className="font-bold text-gray-700">{fmtMoney(totalCost)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">수령 완료</p>
                  <p className="font-bold text-green-600">{fmtMoney(totalReceived)}</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">총 이익 ({totalMargin}%)</p>
                  <p className="font-bold text-green-600">{fmtMoney(totalProfit)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── 업무 (프로젝트 전체 레벨) ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">업무</h2>
                <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5">
                  {(['pending', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)}
                      className={`text-xs px-2.5 py-0.5 rounded-full transition-all ${taskFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                      {f === 'pending' ? `진행중 ${pendingTasks.length}` : `전체 ${tasks.length}`}
                    </button>
                  ))}
                </div>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 추가</button>
            </div>
            <div className="divide-y divide-gray-50">
              {shownTasks.map(t => {
                const linkedContract = CONTRACTS.find(c => c.id === t.sale_id)
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                    <button onClick={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: x.status === '완료' ? '할 일' : '완료' } : x))}
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${t.status === '완료' ? 'border-green-400 bg-green-400' : 'border-gray-300 hover:border-gray-500'}`}>
                      {t.status === '완료' && <span className="text-white text-xs leading-none">✓</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-800'}`}>{t.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Avatar name={t.assignee} idx={PROFILES.indexOf(t.assignee)} size="sm" />
                        <span className="text-xs text-gray-400">{t.assignee}</span>
                        {t.due && <span className="text-xs text-gray-400">· {t.due}</span>}
                        {/* 계약 연결 표시 */}
                        {linkedContract && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                            {linkedContract.name.slice(0, 10)}...
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 소통 내역 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">소통 내역</h2>
                {/* 계약별 필터 */}
                <div className="flex gap-1 flex-wrap">
                  {(['전체', '프로젝트 전체', ...CONTRACTS.map(c => c.id)] as string[]).map((f, i) => {
                    const label = f === '전체' ? '전체' : f === '프로젝트 전체' ? '공통' : CONTRACTS.find(c => c.id === f)?.name.slice(0, 6) + '...'
                    return (
                      <button key={f} onClick={() => setLogFilter(f)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-all ${logFilter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <span className="text-xs text-gray-400">{filteredLogs.length}건</span>
            </div>

            {/* 입력 */}
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="flex gap-2">
                <textarea placeholder="소통 내용 입력..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  rows={2} />
                <div className="flex flex-col gap-1">
                  <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none">
                    <option>전체 프로젝트</option>
                    {CONTRACTS.map(c => <option key={c.id} value={c.id}>{c.name.slice(0, 12)}...</option>)}
                  </select>
                  <button className="px-3 py-1 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">저장</button>
                </div>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {filteredLogs.map(l => {
                const linkedContract = CONTRACTS.find(c => c.id === l.sale_id)
                const style = LOG_STYLE[l.type] ?? { badge: 'bg-gray-100 text-gray-600 border-gray-200', label: l.type }
                return (
                  <div key={l.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
                      <span className="text-xs text-gray-400">{l.date}</span>
                      <Avatar name={l.author} idx={PROFILES.indexOf(l.author)} size="sm" />
                      <span className="text-xs text-gray-500">{l.author}</span>
                      {/* 어떤 계약 관련인지 */}
                      {linkedContract ? (
                        <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {linkedContract.name.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="ml-auto text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">프로젝트 공통</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{l.content}</p>
                    {l.outcome && (
                      <div className="mt-1.5 bg-yellow-50 border border-yellow-100 rounded-lg px-2.5 py-1.5">
                        <p className="text-xs text-yellow-800"><span className="font-medium">결정: </span>{l.outcome}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>

        {/* ─── 우측 사이드바 ─────────────────────────────── */}
        <div className="w-72 flex-shrink-0 sticky top-20 space-y-4">

          {/* 고객 카드 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-50">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <h2 className="text-sm font-semibold text-gray-800">고객 카드</h2>
            </div>
            <div className="px-4 py-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">경</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{PROJECT.customer.name}</p>
                  <p className="text-xs text-gray-400">{PROJECT.customer.type}</p>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">이 프로젝트</span>
                  <span className="text-gray-700 font-medium">{CONTRACTS.length}개 계약 · {fmtMoney(totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">누적 거래</span>
                  <span className="text-gray-700 font-medium">5건 · 2.4억원</span>
                </div>
              </div>
            </div>
          </div>

          {/* 프로젝트 재무 요약 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">프로젝트 재무 요약</h2>
              <p className="text-xs text-gray-400 mt-0.5">{CONTRACTS.length}개 계약 합산</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              {/* 계약별 금액 바 */}
              {CONTRACTS.map((c, i) => (
                <div key={c.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500 truncate flex-1 mr-2">계약 {i + 1}</span>
                    <span className="text-xs font-medium text-gray-800 flex-shrink-0">{fmtShort(c.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-300 rounded-full"
                      style={{ width: `${Math.round(c.revenue / totalRevenue * 100)}%` }} />
                  </div>
                </div>
              ))}

              <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">총 매출</span>
                  <span className="font-bold text-gray-900">{fmtMoney(totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">수령 완료</span>
                  <span className="font-bold text-green-600">{fmtMoney(totalReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">미수령</span>
                  <span className="font-bold text-orange-500">{fmtMoney(totalRevenue - totalReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">총 이익 ({totalMargin}%)</span>
                  <span className="font-bold text-green-600">{fmtMoney(totalProfit)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>
            </div>
            <div className="px-4 py-3 space-y-2 text-xs">
              {[
                { k: '유입일', v: PROJECT.inflow_date },
                { k: '행사일', v: PROJECT.event_dates.join(', ') },
                { k: '서비스', v: PROJECT.service_type },
                { k: '사업부', v: PROJECT.department },
              ].map(r => (
                <div key={r.k} className="flex justify-between gap-2">
                  <span className="text-gray-400 flex-shrink-0">{r.k}</span>
                  <span className="text-gray-700 text-right">{r.v}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

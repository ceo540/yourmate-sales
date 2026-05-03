'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { updateSaleDetail } from '../contract-action'
import { updateProgressStatus } from '../../actions'
import { syncSaleName, type SyncResult } from '../sync-name-action'
import { DEPARTMENT_LABELS, PROGRESS_STATUSES, ProgressStatus } from '@/types'

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const
const CONTRACT_STAGE_MAP: Record<string, number> = {
  '계약': 0, '착수': 1, '선금': 2, '중도금': 3, '완수': 4, '계산서발행': 5, '잔금': 6,
}

// 단계별 의미 — 계약 담당자가 한 줄로 이해 가능
const STAGE_HINT: Record<typeof CONTRACT_STAGES[number], string> = {
  '계약':       '계약 체결 직후 — 발주처 정보·매출액·운영 분류를 정리하는 단계',
  '착수':       '실제 업무 진행 시작 — 결제 일정 확정 + 외부 인력 섭외 단계',
  '선금':       '계약 후 첫 청구 — 통상 매출액의 일부를 선금으로 청구',
  '중도금':     '진행 중 청구 — 일정에 따른 중도금 청구·입금 확인',
  '완수':       '실제 업무 완료 — 결과물·정산 마무리 직전',
  '계산서발행': '세금계산서 발행 — 잔금 청구 직전 행정 절차',
  '잔금':       '잔금 청구·입금 완료 — 계약 종료 직전',
}

interface Profile { id: string; name: string }
interface BusinessEntity { id: string; name: string }
interface Customer { id: string; name: string; contact_name: string | null; type: string | null }
interface Sale {
  id: string; name: string
  contract_stage: string | null; progress_status: string | null
  department: string | null; dropbox_url: string | null
  client_org: string | null; customer_id: string | null
  revenue: number | null; inflow_date: string | null
  payment_date: string | null; contract_type: string | null
  entity_id: string | null; assignee_id: string | null
  contract_assignee_id: string | null
  notion_page_id: string | null
}

interface PaymentSchedule {
  id: string
  label?: string | null
  amount: number
  is_received: boolean
  due_date: string | null
  received_date?: string | null
  note?: string | null
}

interface ConnectedProject {
  id: string
  name: string
  project_number: string | null
}

interface Props {
  sale: Sale
  profiles: Profile[]
  entities: BusinessEntity[]
  customers: Customer[]
  paymentSchedules?: PaymentSchedule[]
  totalCost?: number
  mainType?: string | null
  connectedProject?: ConnectedProject | null
}

function fmtMoney(n: number) {
  return `${(n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}만`
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return d.slice(0, 10)
}

export default function ContractTab({ sale, profiles, entities, customers, paymentSchedules = [], totalCost = 0, mainType = null, connectedProject = null }: Props) {
  const stageIdx = CONTRACT_STAGE_MAP[sale.contract_stage ?? '계약'] ?? 0
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>((sale.progress_status as ProgressStatus) ?? '착수전')

  function handleProgressChange(status: ProgressStatus) {
    setProgressStatus(status)
    startTransition(async () => {
      await updateProgressStatus(sale.id, status)
    })
  }
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(sale.customer_id ?? '')
  const [clientOrgText, setClientOrgText] = useState(sale.client_org ?? '')

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact_name ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  async function handleSubmit(formData: FormData) {
    formData.set('customer_id', selectedCustomerId)
    formData.set('client_org', selectedCustomer?.name ?? clientOrgText)
    startTransition(async () => {
      await updateSaleDetail(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  // ──────────── 다음 액션 체크리스트 (본문 상세) ────────────
  const currentStage = sale.contract_stage ?? '계약'
  const stageHint = STAGE_HINT[currentStage as typeof CONTRACT_STAGES[number]] ?? ''
  const nextStage = stageIdx < CONTRACT_STAGES.length - 1 ? CONTRACT_STAGES[stageIdx + 1] : null

  const totalAmount = paymentSchedules.reduce((s, p) => s + p.amount, 0)
  const receivedAmount = paymentSchedules.filter(p => p.is_received).reduce((s, p) => s + p.amount, 0)
  const remainingAmount = totalAmount - receivedAmount
  const receivedCount = paymentSchedules.filter(p => p.is_received).length
  const totalCount = paymentSchedules.length

  const checklist: { done: boolean; label: string; hint?: string }[] = [
    { done: !!mainType, label: '운영 분류(메인유형) 정리', hint: '미설정 시 프로젝트 단계로 매끄럽게 이어지지 않아요.' },
    { done: !!sale.contract_assignee_id, label: '계약 담당 지정', hint: '계약 진행을 책임질 담당자' },
    { done: !!sale.revenue && sale.revenue > 0, label: '매출액 입력' },
    { done: totalCount > 0, label: '결제 일정 등록', hint: '계약금/중도금/잔금 흐름이 보이도록' },
    { done: totalCost > 0, label: '원가 입력', hint: '영업이익 계산을 위해 필요' },
    { done: !!sale.dropbox_url, label: '계약 자료 폴더 연결' },
    { done: !!sale.entity_id, label: '계약 사업자 지정' },
  ]
  const checklistDone = checklist.filter(c => c.done).length
  const checklistTotal = checklist.length

  return (
    <div className="space-y-4">
      {/* ──────────── 1. 현재 단계 강조 ──────────── */}
      <div className="bg-violet-50/40 border-2 border-violet-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[10px] text-violet-700 font-semibold uppercase tracking-wider">현재 계약 단계</span>
          <span className="text-base px-3 py-1 rounded-full bg-violet-100 text-violet-900 font-bold border border-violet-300">
            {currentStage}
          </span>
          {nextStage && (
            <>
              <span className="text-violet-400 text-sm">→</span>
              <span className="text-xs text-violet-700">다음: <strong className="text-violet-900">{nextStage}</strong></span>
            </>
          )}
        </div>
        {stageHint && <p className="text-xs text-violet-800 leading-relaxed">{stageHint}</p>}
      </div>

      {/* ──────────── 2. 결제 일정 / 입금 진행 ──────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-xs font-bold text-gray-700">💵 결제 일정 / 입금 진행</p>
          {totalCount > 0 && (
            <p className="text-[11px] text-gray-500">
              <span className="text-emerald-700 font-bold">{receivedCount}건 입금</span>
              {' / '}
              <span>전체 {totalCount}건</span>
              {' · '}
              <span>잔여 <strong className="text-amber-700">{fmtMoney(remainingAmount)}원</strong></span>
            </p>
          )}
        </div>
        {totalCount === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-gray-500">결제 일정이 아직 등록되지 않았어요.</p>
            <p className="text-xs text-gray-400 mt-1">계약금·중도금·잔금 흐름을 정리하면 단계별 청구·입금 추적이 자동으로 됩니다.</p>
            <p className="text-[10px] text-gray-400 mt-2">결제 일정 등록은 [개요] 탭의 결제 영역 또는 별도 결제 모달에서 가능합니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paymentSchedules.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className={`text-xs flex-shrink-0 ${p.is_received ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {p.is_received ? '✓' : '⏳'}
                </span>
                <span className="font-medium text-gray-800 min-w-[80px] flex-shrink-0">{p.label ?? '항목 없음'}</span>
                <span className="text-gray-700 font-semibold tabular-nums">{fmtMoney(p.amount)}원</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {p.is_received
                    ? <>입금 {fmtDate(p.received_date ?? p.due_date)}</>
                    : <>예정 {fmtDate(p.due_date)}</>
                  }
                </span>
                {p.note && <span className="text-[10px] text-gray-400 italic max-w-[160px] truncate">{p.note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────── 3. 계약 문서 / 자료 폴더 ──────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
          <p className="text-xs font-bold text-gray-700">📄 계약 문서 / 자료 폴더</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {sale.dropbox_url ? (
            <a
              href={sale.dropbox_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800"
            >
              <span>📁</span>
              <span className="font-medium flex-1 truncate">자료 폴더 (드롭박스)</span>
              <span className="text-xs">열기 ↗</span>
            </a>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50/40 text-red-700">
              <span>📁</span>
              <span className="font-medium">자료 폴더 미연결</span>
              <span className="text-[10px] ml-auto">개요 탭에서 다시 연결</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/40 text-gray-500">
            <span>📃</span>
            <span className="font-medium flex-1">견적·계약서</span>
            <span className="text-[10px] text-gray-400">자료 폴더에서 확인</span>
          </div>
        </div>
        <p className="px-4 pb-3 text-[10px] text-gray-400">
          견적서·계약서 별도 관리는 다음 라운드. 현재는 자료 폴더 안에 저장된 문서를 직접 확인합니다.
        </p>
      </div>

      {/* ──────────── 4. 계약 담당자 다음 액션 체크리스트 ──────────── */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-700">▶ 계약 담당자 다음 액션</p>
          <p className="text-[11px] text-gray-500">
            <span className="font-bold text-emerald-700">{checklistDone}</span>
            <span> / {checklistTotal} 정리 완료</span>
          </p>
        </div>
        <ul className="divide-y divide-gray-50">
          {checklist.map((item, i) => (
            <li key={i} className="px-4 py-2 flex items-start gap-2.5 text-sm">
              <span className={`text-xs mt-0.5 flex-shrink-0 ${item.done ? 'text-emerald-600' : 'text-amber-500'}`}>
                {item.done ? '✓' : '○'}
              </span>
              <div className="flex-1 min-w-0">
                <span className={item.done ? 'text-gray-500 line-through' : 'text-gray-800 font-medium'}>{item.label}</span>
                {!item.done && item.hint && <span className="text-[11px] text-gray-400 ml-2">— {item.hint}</span>}
              </div>
            </li>
          ))}
        </ul>
        {connectedProject && (
          <div className="px-4 py-2.5 bg-blue-50/40 border-t border-blue-100 text-xs text-blue-800">
            🔗 실행 관련 업무·일정·결과물은
            <Link href={`/projects/${connectedProject.id}`} className="font-semibold underline mx-1 hover:text-blue-600">
              연결된 프로젝트 ↗
            </Link>
            에서 관리하세요.
          </div>
        )}
      </div>

      {/* ──────────── 5. 수금 단계 stepper (작은 시각화) ──────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">수금 단계</p>
        <div className="flex items-center">
          {CONTRACT_STAGES.map((status, i) => {
            const done = i < stageIdx; const current = i === stageIdx
            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center px-0.5 ${current ? 'text-gray-900 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
                </div>
                {i < CONTRACT_STAGES.length - 1 && <div className={`h-0.5 flex-1 -mt-4 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 운영 진행 트랙 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">운영 진행</p>
        <div className="flex gap-2">
          {PROGRESS_STATUSES.map(status => (
            <button key={status} type="button"
              onClick={() => handleProgressChange(status)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                progressStatus === status
                  ? status === '완수'   ? 'bg-teal-500 text-white border-teal-500'
                  : status === '착수중' ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
              }`}>{status}</button>
          ))}
        </div>
      </div>

      {/* 이름 동기화 */}
      {(sale.dropbox_url || sale.notion_page_id) && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">이름 동기화</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                건명 변경 후 드롭박스 폴더{sale.notion_page_id ? ' · 노션 페이지' : ''}를 현재 이름으로 업데이트
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSyncing(true)
                setSyncResult(null)
                const result = await syncSaleName(sale.id)
                setSyncResult(result)
                setSyncing(false)
              }}
              disabled={syncing}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              {syncing ? '동기화 중...' : '🔄 동기화'}
            </button>
          </div>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.success ? 'text-green-600' : 'text-red-500'}`}>
              {syncResult.message}
            </p>
          )}
        </div>
      )}

      {/* ──────────── 6. 계약 정보 수정 폼 (접힘 — 자주 안 쓰는 편집 영역) ──────────── */}
      <details className="bg-white border border-gray-100 rounded-xl overflow-hidden group">
        <summary className="px-5 py-3 cursor-pointer list-none flex items-center justify-between hover:bg-gray-50">
          <span className="text-xs font-bold text-gray-700">⚙️ 계약 정보 수정</span>
          <span className="text-[11px] text-gray-400">건명·발주처·매출액·계약 단계·드롭박스 URL 등 직접 편집</span>
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-gray-50">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={sale.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">건명 *</label>
            <input name="name" required defaultValue={sale.name}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>

          {/* 발주처 — 고객 DB 연결 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">발주처 (고객 DB)</label>
            <div className="relative">
              <div
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer flex items-center justify-between focus:outline-none focus:border-yellow-400 bg-white"
                onClick={() => setShowCustomerDropdown(v => !v)}
              >
                <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedCustomer ? selectedCustomer.name : '고객 선택 또는 직접 입력'}
                </span>
                <span className="text-gray-400 text-xs">▼</span>
              </div>
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="검색..."
                      className="w-full text-sm px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setSelectedCustomerId(''); setClientOrgText(''); setShowCustomerDropdown(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50">
                      선택 안함 (직접 입력)
                    </button>
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomerId(c.id); setShowCustomerDropdown(false); setCustomerSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors">
                        <span className="font-medium text-gray-800">{c.name}</span>
                        {c.contact_name && <span className="text-xs text-gray-400 ml-2">{c.contact_name}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!selectedCustomer && (
              <input value={clientOrgText} onChange={e => setClientOrgText(e.target.value)}
                placeholder="직접 입력"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사업부</label>
              <select name="department" defaultValue={sale.department ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">업무 실무자</label>
              <select name="assignee_id" defaultValue={sale.assignee_id ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 실무자</label>
            <select name="contract_assignee_id" defaultValue={sale.contract_assignee_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
              <input type="number" name="revenue" defaultValue={sale.revenue ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">계약 방법</label>
              <select name="contract_type" defaultValue={sale.contract_type ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {['나라장터','세금계산서','카드결제','기타'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">유입일자</label>
              <input type="date" name="inflow_date" defaultValue={sale.inflow_date ? sale.inflow_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">결제일자</label>
              <input type="date" name="payment_date" defaultValue={sale.payment_date ? sale.payment_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 사업자</label>
            <select name="entity_id" defaultValue={sale.entity_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 단계</label>
            <div className="flex gap-2 flex-wrap">
              {CONTRACT_STAGES.map(status => (
                <label key={status} className="cursor-pointer">
                  <input type="radio" name="contract_stage" value={status}
                    defaultChecked={(sale.contract_stage ?? '계약') === status} className="sr-only peer" />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">드롭박스 폴더 링크</label>
            <input name="dropbox_url" type="url" defaultValue={sale.dropbox_url ?? ''}
              placeholder="https://www.dropbox.com/home/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            <p className="text-[10px] text-gray-400 mt-1">Finder 우클릭 링크(/scl/fo/...)는 안 됩니다. 드롭박스 웹 → 폴더 열기 → 주소창 URL 복사</p>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {saved ? '✓ 저장됨' : isPending ? '저장 중...' : '저장'}
          </button>
        </form>
        </div>
      </details>
    </div>
  )
}

'use client'

import { useState, useTransition } from 'react'
import {
  updateContractStage, updateContractProgressStatus, updateContractInfo,
  togglePaymentReceived, addPaymentSchedule, deletePaymentSchedule,
  addSaleCost, deleteSaleCost,
} from '../project-actions'
import Avatar from './Avatar'
import { TASK_STATUS_STYLE as STATUS_STYLE, PRIORITY_DOT } from '@/lib/constants'

const STAGE_COLORS: Record<string, string> = {
  계약: 'bg-blue-100 text-blue-700', 착수: 'bg-purple-100 text-purple-700',
  선금: 'bg-yellow-100 text-yellow-700', 중도금: 'bg-orange-100 text-orange-700',
  완수: 'bg-teal-100 text-teal-700', 계산서발행: 'bg-indigo-100 text-indigo-700',
  잔금: 'bg-green-100 text-green-700',
}
const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
const PROGRESS_OPTIONS = ['착수전', '착수중', '완수']
const COST_CATEGORIES = ['인건비', '장비', '자재', '외주', '교통', '식비', '기타']

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000)  return `${Math.round(n / 10000000) * 10}백만`
  if (n >= 10000)     return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}
function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

interface Profile { id: string; name: string }
interface PaymentSchedule { id: string; label: string; amount: number; is_received: boolean; due_date: string | null }
export interface Contract {
  id: string; name: string; revenue: number | null; contract_stage: string | null
  progress_status: string | null; inflow_date: string | null; payment_date: string | null
  client_org: string | null; contract_split_reason: string | null; dropbox_url: string | null
  payment_schedules: PaymentSchedule[]
  assignee_name: string | null; entity_name: string | null; assignee_id: string | null; entity_id: string | null
}
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; assignee: { id: string; name: string } | null
  project_id: string | null; description: string | null
}
interface CostItem { id: string; item: string; amount: number; category: string; sale_id: string }
interface Entity { id: string; name: string }

interface Props {
  contract: Contract
  index: number
  tasks: Task[]
  costs: CostItem[]
  projectId: string
  entities: Entity[]
  profiles: Profile[]
  onContractChange: (contractId: string, patch: Partial<Contract>) => void
  onCostAdd: (cost: CostItem) => void
  onCostDelete: (costId: string) => void
}

export default function ContractCard({
  contract, index, tasks, costs, projectId, entities,
  onContractChange, onCostAdd, onCostDelete,
}: Props) {
  const [expanded, setExpanded] = useState(index === 0)
  const [finTab, setFinTab] = useState<'payment' | 'cost'>('payment')
  const [isPending, startTransition] = useTransition()

  const [editingInfo, setEditingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({
    name: contract.name, revenue: String(contract.revenue ?? 0),
    entity_id: contract.entity_id ?? '', client_org: contract.client_org ?? '',
    contract_split_reason: contract.contract_split_reason ?? '',
    inflow_date: contract.inflow_date ?? '', payment_date: contract.payment_date ?? '',
    dropbox_url: contract.dropbox_url ?? '',
  })

  const [showAddPay, setShowAddPay] = useState(false)
  const [payLabel, setPayLabel] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDue, setPayDue] = useState('')

  const [showAddCost, setShowAddCost] = useState(false)
  const [costItem, setCostItem] = useState('')
  const [costAmount, setCostAmount] = useState('')
  const [costCategory, setCostCategory] = useState('인건비')

  const [quickEditRevenue, setQuickEditRevenue] = useState(false)
  const [quickRevenueInput, setQuickRevenueInput] = useState(String(contract.revenue ?? 0))

  const contractCosts = costs.filter(c => c.sale_id === contract.id)
  const contractTasks = tasks.filter(t => t.project_id === contract.id)
  const revenue = contract.revenue ?? 0
  const totalCost = contractCosts.reduce((s, c) => s + c.amount, 0)
  const profit = revenue - totalCost
  const margin = revenue > 0 ? Math.round(profit / revenue * 100) : 0
  const received = contract.payment_schedules.filter(p => p.is_received).reduce((s, p) => s + p.amount, 0)
  const receivedPct = revenue > 0 ? Math.round(received / revenue * 100) : 0

  function handleStage(stage: string) {
    startTransition(async () => {
      await updateContractStage(contract.id, stage, projectId)
      onContractChange(contract.id, { contract_stage: stage })
    })
  }
  function handleProgress(status: string) {
    startTransition(async () => {
      await updateContractProgressStatus(contract.id, status, projectId)
      onContractChange(contract.id, { progress_status: status })
    })
  }
  function handleSaveInfo() {
    startTransition(async () => {
      const rev = Number(infoForm.revenue) || 0
      await updateContractInfo(contract.id, {
        name: infoForm.name || undefined, revenue: rev,
        entity_id: infoForm.entity_id || null,
        contract_split_reason: infoForm.contract_split_reason || null,
        inflow_date: infoForm.inflow_date || null, payment_date: infoForm.payment_date || null,
        client_org: infoForm.client_org || null, dropbox_url: infoForm.dropbox_url || null,
      }, projectId)
      const entity_name = infoForm.entity_id ? (entities.find(e => e.id === infoForm.entity_id)?.name ?? null) : null
      onContractChange(contract.id, {
        name: infoForm.name || contract.name, revenue: rev, entity_id: infoForm.entity_id || null, entity_name,
        contract_split_reason: infoForm.contract_split_reason || null,
        inflow_date: infoForm.inflow_date || null, payment_date: infoForm.payment_date || null,
        client_org: infoForm.client_org || null, dropbox_url: infoForm.dropbox_url || null,
      })
      setEditingInfo(false)
    })
  }
  function handlePayToggle(scheduleId: string, isReceived: boolean) {
    startTransition(async () => {
      await togglePaymentReceived(scheduleId, isReceived, projectId)
      onContractChange(contract.id, { payment_schedules: contract.payment_schedules.map(p => p.id === scheduleId ? { ...p, is_received: isReceived } : p) })
    })
  }
  function handleAddPayment() {
    if (!payLabel.trim() || !payAmount) return
    startTransition(async () => {
      const result = await addPaymentSchedule(contract.id, payLabel, Number(payAmount), payDue || null, projectId)
      if (result) {
        onContractChange(contract.id, { payment_schedules: [...contract.payment_schedules, result] })
        setPayLabel(''); setPayAmount(''); setPayDue(''); setShowAddPay(false)
      }
    })
  }
  function handleDeletePayment(scheduleId: string) {
    startTransition(async () => {
      await deletePaymentSchedule(scheduleId, projectId)
      onContractChange(contract.id, { payment_schedules: contract.payment_schedules.filter(p => p.id !== scheduleId) })
    })
  }
  function handleAddCost() {
    if (!costItem.trim() || !costAmount) return
    startTransition(async () => {
      const result = await addSaleCost(contract.id, costItem, Number(costAmount), costCategory, projectId)
      if (result) { onCostAdd(result); setCostItem(''); setCostAmount(''); setCostCategory('인건비'); setShowAddCost(false) }
    })
  }
  function handleDeleteCost(costId: string) {
    startTransition(async () => { await deleteSaleCost(costId, projectId); onCostDelete(costId) })
  }
  function handleSaveQuickRevenue() {
    const rev = Number(quickRevenueInput) || 0
    startTransition(async () => {
      await updateContractInfo(contract.id, { revenue: rev }, projectId)
      onContractChange(contract.id, { revenue: rev })
      setQuickEditRevenue(false)
    })
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${expanded ? 'border-gray-200 shadow-sm' : 'border-gray-100'}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left">
        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{contract.name}</span>
            {contract.contract_stage && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[contract.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>{contract.contract_stage}</span>
            )}
            {contract.progress_status && (
              <span className="text-xs text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">{contract.progress_status}</span>
            )}
            {contract.entity_name && (
              <span className="text-xs text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">{contract.entity_name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {quickEditRevenue ? (
              <input
                type="number" value={quickRevenueInput}
                onChange={e => setQuickRevenueInput(e.target.value)}
                onBlur={handleSaveQuickRevenue}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveQuickRevenue(); if (e.key === 'Escape') setQuickEditRevenue(false) }}
                className="text-xs border border-yellow-300 rounded px-1.5 py-0.5 w-28 focus:outline-none"
                autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <span
                onClick={e => { e.stopPropagation(); setQuickRevenueInput(String(contract.revenue ?? 0)); setQuickEditRevenue(true) }}
                className={`text-xs font-medium cursor-pointer hover:underline hover:decoration-dotted ${revenue === 0 ? 'text-orange-400' : 'text-gray-500'}`}
                title="클릭하여 계약금액 수정">
                {revenue === 0 ? '💰 금액 미입력 (클릭)' : `${fmtMoney(revenue)}원`}
              </span>
            )}
            {contract.client_org && <span className="text-xs text-gray-400 truncate max-w-[160px]">{contract.client_org}</span>}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-400 rounded-full" style={{ width: `${receivedPct}%` }} />
            </div>
            <span className="text-xs text-gray-400">{receivedPct}%</span>
          </div>
          {contract.assignee_name && <Avatar name={contract.assignee_name} size="sm" />}
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* 단계 */}
          <div className="px-4 py-2.5 border-b border-gray-50 space-y-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">단계</span>
              {CONTRACT_STAGES.map(stage => (
                <button key={stage} onClick={() => handleStage(stage)} disabled={isPending}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all disabled:opacity-50 ${
                    contract.contract_stage === stage ? (STAGE_COLORS[stage] ?? 'bg-gray-200 text-gray-700') : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}>{stage}</button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-gray-400 w-12 flex-shrink-0">진행</span>
              {PROGRESS_OPTIONS.map(s => (
                <button key={s} onClick={() => handleProgress(s)} disabled={isPending}
                  className={`text-xs px-2.5 py-0.5 rounded-full border transition-all disabled:opacity-50 ${
                    contract.progress_status === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* 정보 편집 */}
          {editingInfo ? (
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '계약명', key: 'name', type: 'text' },
                  { label: '매출액 (원)', key: 'revenue', type: 'number' },
                  { label: '의뢰기관', key: 'client_org', type: 'text' },
                  { label: '유입일', key: 'inflow_date', type: 'date' },
                  { label: '계약일', key: 'payment_date', type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
                    <input type={type} value={(infoForm as Record<string, string>)[key]}
                      onChange={e => setInfoForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">법인</label>
                  <select value={infoForm.entity_id} onChange={e => setInfoForm(f => ({ ...f, entity_id: e.target.value }))}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                    <option value="">선택 안 함</option>
                    {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">계약 분리 사유</label>
                <input value={infoForm.contract_split_reason} onChange={e => setInfoForm(f => ({ ...f, contract_split_reason: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">Dropbox URL</label>
                <input value={infoForm.dropbox_url} onChange={e => setInfoForm(f => ({ ...f, dropbox_url: e.target.value }))}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveInfo} disabled={isPending}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                <button onClick={() => setEditingInfo(false)}
                  className="px-3 py-1.5 text-xs border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-50">취소</button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                {contract.inflow_date && <span>유입 {fmtDate(contract.inflow_date)}</span>}
                {contract.payment_date && <span>계약 {fmtDate(contract.payment_date)}</span>}
                {contract.contract_split_reason && <span className="text-blue-500 truncate max-w-[200px]">분리: {contract.contract_split_reason}</span>}
                {contract.dropbox_url && <a href={contract.dropbox_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Dropbox ↗</a>}
                {!contract.inflow_date && !contract.payment_date && !contract.contract_split_reason && !contract.dropbox_url && (
                  <span className="text-gray-300">날짜·분리사유·Dropbox 미입력</span>
                )}
              </div>
              <button onClick={() => {
                setInfoForm({ name: contract.name, revenue: String(contract.revenue ?? 0), entity_id: contract.entity_id ?? '',
                  client_org: contract.client_org ?? '', contract_split_reason: contract.contract_split_reason ?? '',
                  inflow_date: contract.inflow_date ?? '', payment_date: contract.payment_date ?? '', dropbox_url: contract.dropbox_url ?? '' })
                setEditingInfo(true)
              }} className="text-xs text-gray-500 hover:text-gray-800 ml-2 flex-shrink-0">✏ 편집</button>
            </div>
          )}

          {/* 탭 */}
          <div className="flex border-b border-gray-100">
            {(['payment', 'cost'] as const).map(t => (
              <button key={t} onClick={() => setFinTab(t)}
                className={`px-4 py-2 text-xs font-medium transition-all ${finTab === t ? 'text-gray-900 border-b-2 border-yellow-400' : 'text-gray-400 hover:text-gray-600'}`}>
                {t === 'payment' ? '입금 현황' : `원가 (마진 ${margin}%)`}
              </button>
            ))}
          </div>

          {/* 입금 현황 */}
          {finTab === 'payment' && (
            <div className="px-4 py-3">
              <div className="space-y-1.5">
                {contract.payment_schedules.length === 0 && !showAddPay && <p className="text-xs text-gray-400 py-1">입금 일정 없음</p>}
                {contract.payment_schedules.map(ps => (
                  <div key={ps.id} className="flex items-center gap-2 group">
                    <button onClick={() => handlePayToggle(ps.id, !ps.is_received)} disabled={isPending}
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${ps.is_received ? 'border-green-400 bg-green-400' : 'border-gray-300 hover:border-gray-500'}`}>
                      {ps.is_received && <span className="text-white text-xs leading-none">✓</span>}
                    </button>
                    <span className="text-sm text-gray-700 flex-1">{ps.label}</span>
                    <span className={`text-sm font-medium ${ps.is_received ? 'text-green-600' : 'text-gray-500'}`}>{fmtMoney(ps.amount)}원</span>
                    {ps.due_date && !ps.is_received && <span className="text-xs text-gray-400">{fmtDate(ps.due_date)}</span>}
                    <button onClick={() => handleDeletePayment(ps.id)} disabled={isPending}
                      className="text-gray-200 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
              {showAddPay ? (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input autoFocus value={payLabel} onChange={e => setPayLabel(e.target.value)} placeholder="항목명 (예: 선금)"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="금액"
                      className="w-28 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <input type="date" value={payDue} onChange={e => setPayDue(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={handleAddPayment} disabled={!payLabel.trim() || !payAmount || isPending}
                      className="px-3 py-1 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
                    <button onClick={() => { setShowAddPay(false); setPayLabel(''); setPayAmount(''); setPayDue('') }}
                      className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddPay(true)} className="mt-2 text-xs text-gray-400 hover:text-gray-700">+ 항목 추가</button>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs">
                <span className="text-gray-500">수령 / 계약 총액</span>
                <span className="font-semibold text-gray-800">{fmtMoney(received)}원 / {fmtMoney(revenue)}원</span>
              </div>
            </div>
          )}

          {/* 원가 */}
          {finTab === 'cost' && (
            <div className="px-4 py-3">
              <div className="space-y-1.5">
                {contractCosts.length === 0 && !showAddCost && <p className="text-xs text-gray-400 py-1">원가 없음</p>}
                {contractCosts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs group">
                    <span className="text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded w-12 text-center flex-shrink-0">{c.category}</span>
                    <span className="flex-1 text-gray-600">{c.item}</span>
                    <span className="text-gray-800 font-medium">{fmtMoney(c.amount)}</span>
                    <button onClick={() => handleDeleteCost(c.id)} disabled={isPending}
                      className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
              {showAddCost ? (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex gap-1.5">
                    <select value={costCategory} onChange={e => setCostCategory(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input autoFocus value={costItem} onChange={e => setCostItem(e.target.value)} placeholder="항목명"
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} placeholder="금액"
                      className="w-24 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={handleAddCost} disabled={!costItem.trim() || !costAmount || isPending}
                      className="px-3 py-1 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
                    <button onClick={() => { setShowAddCost(false); setCostItem(''); setCostAmount('') }}
                      className="px-3 py-1 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddCost(true)} className="mt-2 text-xs text-gray-400 hover:text-gray-700">+ 원가 추가</button>
              )}
              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-3 gap-2 text-xs text-center">
                <div><p className="text-gray-400">매출</p><p className="font-semibold text-gray-800">{fmtMoney(revenue)}</p></div>
                <div><p className="text-gray-400">원가</p><p className="font-semibold text-gray-800">{fmtMoney(totalCost)}</p></div>
                <div><p className="text-gray-400">이익</p><p className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtMoney(profit)}</p></div>
              </div>
            </div>
          )}

          {contractTasks.length > 0 && (
            <div className="px-4 pb-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mt-2 mb-1.5">이 계약의 업무</p>
              <div className="space-y-1">
                {contractTasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority ?? '보통'] ?? 'bg-gray-300'}`} />
                    <span className={`flex-1 ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-600'}`}>{t.title}</span>
                    <span className={`px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
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

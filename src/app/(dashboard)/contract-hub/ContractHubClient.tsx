'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import Link from 'next/link'
import { updateContractStage, updateContractContact, updateContractDocs, savePaymentSchedules, type PaymentScheduleInput } from './actions'

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const

const STAGE_COLORS: Record<string, string> = {
  '계약':       'bg-blue-50 text-blue-600 border-blue-200',
  '착수':       'bg-purple-50 text-purple-600 border-purple-200',
  '선금':       'bg-yellow-50 text-yellow-700 border-yellow-200',
  '중도금':     'bg-orange-50 text-orange-600 border-orange-200',
  '완수':       'bg-teal-50 text-teal-600 border-teal-200',
  '계산서발행': 'bg-indigo-50 text-indigo-600 border-indigo-200',
  '잔금':       'bg-green-50 text-green-600 border-green-200',
}

const STAGE_DOT: Record<string, string> = {
  '계약':       'bg-blue-400',
  '착수':       'bg-purple-400',
  '선금':       'bg-yellow-400',
  '중도금':     'bg-orange-400',
  '완수':       'bg-teal-400',
  '계산서발행': 'bg-indigo-400',
  '잔금':       'bg-green-400',
}

const SCHEDULE_LABELS = ['계약금', '착수금', '선금', '중도금', '완수금', '계산서', '잔금', '기타'] as const

interface DocItem { id: string; text: string; done: boolean }

interface PaymentSchedule {
  id: string
  sale_id: string
  label: string
  amount: number
  due_date: string | null
  received_date: string | null
  is_received: boolean
  note: string | null
  sort_order: number
}

interface Sale {
  id: string
  name: string
  client_org: string | null
  service_type: string | null
  department: string | null
  revenue: number | null
  inflow_date: string | null
  contract_stage: string | null
  contract_type: string | null
  contract_contact_name: string | null
  contract_contact_phone: string | null
  contract_docs: DocItem[] | null
  payment_schedules: PaymentSchedule[]
  assignee: { id: string; name: string } | null
  entity: { id: string; name: string } | null
}

interface Props {
  sales: Sale[]
}

function fmt(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

export default function ContractHubClient({ sales }: Props) {
  const [, startTransition] = useTransition()
  const [filterStage, setFilterStage] = useState<string>('전체')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(sales[0]?.id ?? null)

  // 디테일 패널 상태
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [newDocText, setNewDocText] = useState('')
  const [savingDocs, setSavingDocs] = useState(false)
  const [stageSaving, setStageSaving] = useState(false)
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([])
  const [savingSchedules, setSavingSchedules] = useState(false)
  const [salesSchedulesMap, setSalesSchedulesMap] = useState<Record<string, PaymentSchedule[]>>(
    () => Object.fromEntries(sales.map(s => [s.id, s.payment_schedules ?? []]))
  )
  const newDocRef = useRef<HTMLInputElement>(null)

  const selected = sales.find(s => s.id === selectedId) ?? null

  useEffect(() => {
    if (!selected) return
    setContactName(selected.contract_contact_name ?? '')
    setContactPhone(selected.contract_contact_phone ?? '')
    setDocs(Array.isArray(selected.contract_docs) ? selected.contract_docs : [])
    setSchedules(selected.payment_schedules ?? [])
  }, [selected?.id])

  const filtered = sales
    .filter(s => filterStage === '전체' || (s.contract_stage ?? '계약') === filterStage)
    .filter(s => {
      if (!search) return true
      const q = search.toLowerCase()
      return (s.name.toLowerCase().includes(q) || (s.client_org ?? '').toLowerCase().includes(q))
    })

  async function handleStageClick(stage: string) {
    if (!selected || stageSaving) return
    setStageSaving(true)
    startTransition(async () => {
      await updateContractStage(selected.id, stage)
      setStageSaving(false)
    })
  }

  async function handleSaveContact() {
    if (!selected) return
    setSavingContact(true)
    await updateContractContact(selected.id, { contract_contact_name: contactName, contract_contact_phone: contactPhone })
    setSavingContact(false)
  }

  async function handleToggleDoc(docId: string) {
    if (!selected) return
    const next = docs.map(d => d.id === docId ? { ...d, done: !d.done } : d)
    setDocs(next)
    await updateContractDocs(selected.id, next)
  }

  async function handleAddDoc() {
    if (!selected || !newDocText.trim()) return
    const next = [...docs, { id: crypto.randomUUID(), text: newDocText.trim(), done: false }]
    setDocs(next)
    setNewDocText('')
    await updateContractDocs(selected.id, next)
    newDocRef.current?.focus()
  }

  async function handleRemoveDoc(docId: string) {
    if (!selected) return
    const next = docs.filter(d => d.id !== docId)
    setDocs(next)
    await updateContractDocs(selected.id, next)
  }

  function handleAddScheduleRow() {
    const newRow: PaymentSchedule = {
      id: crypto.randomUUID(),
      sale_id: selectedId!,
      label: '계약금',
      amount: 0,
      due_date: null,
      received_date: null,
      is_received: false,
      note: null,
      sort_order: schedules.length,
    }
    setSchedules(prev => [...prev, newRow])
  }

  function handleScheduleChange(id: string, field: keyof PaymentSchedule, value: any) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function handleToggleReceived(id: string) {
    setSchedules(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s
        const nextReceived = !s.is_received
        return { ...s, is_received: nextReceived, received_date: nextReceived ? new Date().toISOString().slice(0, 10) : null }
      })
      if (selectedId) setSalesSchedulesMap(m => ({ ...m, [selectedId]: next }))
      return next
    })
  }

  function handleRemoveSchedule(id: string) {
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  async function handleSaveSchedules() {
    if (!selected) return
    setSavingSchedules(true)
    await savePaymentSchedules(selected.id, schedules as PaymentScheduleInput[])
    setSavingSchedules(false)
  }

  const stageIdx = CONTRACT_STAGES.indexOf((selected?.contract_stage ?? '계약') as typeof CONTRACT_STAGES[number])

  const stageCounts = CONTRACT_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = sales.filter(x => (x.contract_stage ?? '계약') === s).length
    return acc
  }, {})

  // 이달 수금 집계
  const thisMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
  const allSchedules = Object.values(salesSchedulesMap).flat()
  const monthReceived = allSchedules
    .filter(p => p.is_received && (p.received_date ?? '').startsWith(thisMonth))
    .reduce((s, p) => s + p.amount, 0)
  const monthPending = allSchedules
    .filter(p => !p.is_received && (p.due_date ?? '').startsWith(thisMonth))
    .reduce((s, p) => s + p.amount, 0)
  const totalUnreceived = allSchedules
    .filter(p => !p.is_received)
    .reduce((s, p) => s + p.amount, 0)

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ── 왼쪽: 계약 목록 ── */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 flex flex-col bg-white">

        {/* 이달 수금 현황 */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {new Date().getMonth() + 1}월 수금 현황
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-gray-400">수령완료</p>
              <p className="text-sm font-bold text-green-600">{fmt(monthReceived)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">이달예정</p>
              <p className="text-sm font-bold text-blue-600">{fmt(monthPending)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">전체미수</p>
              <p className="text-sm font-bold text-orange-500">{fmt(totalUnreceived)}</p>
            </div>
          </div>
        </div>

        {/* 검색 */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="건명 / 기관 검색"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:border-yellow-400 bg-gray-50"
          />
        </div>

        {/* 단계 필터 */}
        <div className="px-3 py-2.5 border-b border-gray-100 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStage('전체')}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${filterStage === '전체' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
          >
            전체 {sales.length}
          </button>
          {CONTRACT_STAGES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStage(s)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${filterStage === s ? `${STAGE_COLORS[s]} font-medium` : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200'}`}
            >
              {s} {stageCounts[s] > 0 ? stageCounts[s] : ''}
            </button>
          ))}
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">조건에 맞는 계약이 없어요</div>
          )}
          {filtered.map(sale => {
            const stage = sale.contract_stage ?? '계약'
            const isSelected = sale.id === selectedId
            return (
              <button
                key={sale.id}
                onClick={() => setSelectedId(sale.id)}
                className={`w-full text-left px-4 py-3.5 border-b border-gray-50 transition-colors ${isSelected ? 'bg-yellow-50 border-l-2 border-l-yellow-400' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium text-gray-800 truncate leading-tight">{sale.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-500 border-gray-100'}`}>{stage}</span>
                </div>
                <div className="flex items-center gap-2">
                  {sale.client_org && <p className="text-xs text-gray-400 truncate">{sale.client_org}</p>}
                  {sale.revenue ? <span className="text-xs font-medium text-gray-600 flex-shrink-0 ml-auto">{fmt(sale.revenue)}원</span> : null}
                </div>
                {sale.assignee && <p className="text-[10px] text-gray-300 mt-0.5">{sale.assignee.name}</p>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 오른쪽: 상세 패널 ── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center text-sm text-gray-300">계약을 선택해 주세요</div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-gray-50">
          <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

            {/* 헤더 */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">{selected.client_org ?? '-'} · {selected.service_type ?? '-'}</p>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  {selected.inflow_date && <span className="text-xs text-gray-400">유입 {selected.inflow_date.slice(0, 10)}</span>}
                  {selected.revenue && <span className="text-xs font-semibold text-gray-600">{fmt(selected.revenue)}원</span>}
                  {selected.entity && <span className="text-xs text-gray-400">{selected.entity.name}</span>}
                </div>
              </div>
              <Link href={`/sales/${selected.id}`} className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors">
                상세 보기 →
              </Link>
            </div>

            {/* 계약 단계 스텝퍼 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">계약 단계</p>
              <div className="flex items-center gap-0">
                {CONTRACT_STAGES.map((stage, i) => {
                  const done = i < stageIdx
                  const current = i === stageIdx
                  return (
                    <div key={stage} className="flex items-center flex-1 min-w-0">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <button
                          onClick={() => handleStageClick(stage)}
                          disabled={stageSaving}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                            current ? 'bg-yellow-400 border-yellow-400 text-white shadow-sm scale-110' :
                            done ? 'bg-green-400 border-green-400 text-white' :
                            'bg-white border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
                          }`}
                          title={stage}
                        >
                          {done ? '✓' : i + 1}
                        </button>
                        <span className={`text-[9px] mt-1 font-medium text-center leading-tight max-w-[48px] ${current ? 'text-yellow-600' : done ? 'text-green-500' : 'text-gray-300'}`}>
                          {stage}
                        </span>
                      </div>
                      {i < CONTRACT_STAGES.length - 1 && (
                        <div className={`h-0.5 flex-1 -mt-4 mx-0.5 ${done ? 'bg-green-300' : 'bg-gray-100'}`} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 계약 담당자 연락처 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">기관 계약 담당자</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">이름</label>
                  <input
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="담당자 이름"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-gray-50"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-400 mb-1">연락처</label>
                  <input
                    value={contactPhone}
                    onChange={e => setContactPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-gray-50"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveContact}
                disabled={savingContact}
                className="mt-3 w-full py-2 rounded-lg text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 text-yellow-900 transition-colors disabled:opacity-50"
              >
                {savingContact ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 계약 서류 체크리스트 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">계약 서류</p>
                <span className="text-xs text-gray-400">{docs.filter(d => d.done).length}/{docs.length}</span>
              </div>

              {/* 진행률 바 */}
              {docs.length > 0 && (
                <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4">
                  <div
                    className="h-1.5 bg-green-400 rounded-full transition-all"
                    style={{ width: `${Math.round((docs.filter(d => d.done).length / docs.length) * 100)}%` }}
                  />
                </div>
              )}

              {/* 서류 목록 */}
              <div className="space-y-2 mb-3">
                {docs.length === 0 && (
                  <p className="text-xs text-gray-300 py-2 text-center">아래에서 서류를 추가하세요</p>
                )}
                {docs.map(doc => (
                  <div key={doc.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => handleToggleDoc(doc.id)}
                      className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${doc.done ? 'bg-green-400 border-green-400 text-white' : 'border-gray-200 hover:border-green-300'}`}
                    >
                      {doc.done && <span className="text-[10px] font-bold">✓</span>}
                    </button>
                    <span className={`text-sm flex-1 ${doc.done ? 'line-through text-gray-300' : 'text-gray-700'}`}>{doc.text}</span>
                    <button
                      onClick={() => handleRemoveDoc(doc.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-all"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* 서류 추가 */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                <input
                  ref={newDocRef}
                  value={newDocText}
                  onChange={e => setNewDocText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddDoc()}
                  placeholder="서류명 입력 후 Enter"
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-gray-50"
                />
                <button
                  onClick={handleAddDoc}
                  disabled={!newDocText.trim()}
                  className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  추가
                </button>
              </div>
            </div>

            {/* 수금 일정 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">수금 일정</p>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {schedules.length > 0 && (
                    <>
                      <span>예정 <span className="font-semibold text-gray-600">{fmt(schedules.reduce((a, s) => a + (s.amount || 0), 0))}원</span></span>
                      <span>수령 <span className="font-semibold text-green-600">{fmt(schedules.filter(s => s.is_received).reduce((a, s) => a + (s.amount || 0), 0))}원</span></span>
                    </>
                  )}
                </div>
              </div>

              {/* 진행률 바 */}
              {schedules.length > 0 && (() => {
                const total = schedules.reduce((a, s) => a + (s.amount || 0), 0)
                const received = schedules.filter(s => s.is_received).reduce((a, s) => a + (s.amount || 0), 0)
                const pct = total > 0 ? Math.round((received / total) * 100) : 0
                return (
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4">
                    <div className="h-1.5 bg-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )
              })()}

              {/* 일정 목록 */}
              {schedules.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-3">수금 일정을 추가하세요</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {schedules.map(s => (
                    <div key={s.id} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${s.is_received ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                      {/* 수령 체크 */}
                      <button
                        onClick={() => handleToggleReceived(s.id)}
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${s.is_received ? 'bg-green-400 border-green-400 text-white' : 'border-gray-300 hover:border-green-300'}`}
                      >
                        {s.is_received && <span className="text-[10px] font-bold">✓</span>}
                      </button>

                      {/* 구분 */}
                      <select
                        value={s.label}
                        onChange={e => handleScheduleChange(s.id, 'label', e.target.value)}
                        className="text-xs border-0 bg-transparent text-gray-600 font-medium focus:outline-none w-16 flex-shrink-0"
                      >
                        {SCHEDULE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>

                      {/* 금액 */}
                      <input
                        type="number"
                        value={s.amount || ''}
                        onChange={e => handleScheduleChange(s.id, 'amount', Number(e.target.value))}
                        placeholder="금액"
                        className="w-24 text-xs border-0 bg-transparent text-gray-700 focus:outline-none text-right"
                      />
                      <span className="text-xs text-gray-400 flex-shrink-0">원</span>

                      {/* 예정일 */}
                      <input
                        type="date"
                        value={s.due_date ?? ''}
                        onChange={e => handleScheduleChange(s.id, 'due_date', e.target.value || null)}
                        className="text-xs border-0 bg-transparent text-gray-400 focus:outline-none ml-auto"
                      />

                      {/* 수령일 (수령됐을 때만) */}
                      {s.is_received && (
                        <span className="text-[10px] text-green-500 flex-shrink-0">{s.received_date ?? '오늘'}</span>
                      )}

                      {/* 삭제 */}
                      <button onClick={() => handleRemoveSchedule(s.id)} className="text-gray-200 hover:text-red-400 text-xs transition-colors flex-shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                <button
                  onClick={handleAddScheduleRow}
                  className="flex-1 py-2 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-yellow-300 hover:text-yellow-600 transition-colors"
                >
                  + 일정 추가
                </button>
                <button
                  onClick={handleSaveSchedules}
                  disabled={savingSchedules}
                  className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-yellow-900 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {savingSchedules ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

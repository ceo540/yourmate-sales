'use client'

import { useMemo, useState, useTransition } from 'react'
import { createQuote, type CreateQuoteInput } from './actions'

interface EntityOption {
  id: string
  name: string
  short_name: string | null
}

interface CustomerOption {
  id: string
  name: string
}

interface SaleOption {
  id: string
  name: string
  client_org: string | null
}

interface ProjectOption {
  id: string
  name: string
  client_org: string | null
}

interface LeadOption {
  id: string
  client_org: string | null
}

interface ItemRow {
  name: string
  description: string
  qty: string         // 입력 편의상 string 보관, 제출 시 Number
  unit_price: string
  amount: string      // 자동계산 결과 표시 + override
  category: string
}

interface Props {
  open: boolean
  onClose: () => void
  entities: EntityOption[]
  customers: CustomerOption[]
  sales: SaleOption[]
  projects: ProjectOption[]
  leads: LeadOption[]
  // 상위 컨텍스트가 미리 정해진 연결 ID — 있으면 select 잠금
  fixed?: { sale_id?: string; project_id?: string; lead_id?: string }
  defaultProjectName?: string
  defaultClientOrg?: string
  defaultEntityId?: string
}

const NEW_ROW: ItemRow = { name: '', description: '', qty: '1', unit_price: '0', amount: '0', category: '' }

export default function QuoteCreateModal({
  open,
  onClose,
  entities,
  customers,
  sales,
  projects,
  leads,
  fixed,
  defaultProjectName,
  defaultClientOrg,
  defaultEntityId,
}: Props) {
  const supportedEntities = useMemo(() => entities.filter(e => !!e.short_name), [entities])
  const [pending, startTransition] = useTransition()

  // 연결
  const [saleId, setSaleId] = useState(fixed?.sale_id ?? '')
  const [projectId, setProjectId] = useState(fixed?.project_id ?? '')
  const [leadId, setLeadId] = useState(fixed?.lead_id ?? '')

  // 헤더
  const [entityId, setEntityId] = useState(defaultEntityId ?? supportedEntities[0]?.id ?? '')
  const [customerId, setCustomerId] = useState('')
  const [clientOrg, setClientOrg] = useState(defaultClientOrg ?? '')
  const [clientDept, setClientDept] = useState('')
  const [clientManager, setClientManager] = useState('')
  const [projectName, setProjectName] = useState(defaultProjectName ?? '')
  const [vatIncluded, setVatIncluded] = useState(true)
  const [notes, setNotes] = useState('')

  // 항목
  const [items, setItems] = useState<ItemRow[]>([{ ...NEW_ROW }])

  if (!open) return null

  function addRow() {
    setItems(prev => [...prev, { ...NEW_ROW }])
  }
  function removeRow(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, patch: Partial<ItemRow>) {
    setItems(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const next = { ...r, ...patch }
      // qty 또는 unit_price 변경 시 amount 자동 계산 (사용자가 amount를 직접 수정한 경우엔 그대로)
      if (('qty' in patch || 'unit_price' in patch) && !('amount' in patch)) {
        const q = Number(next.qty) || 0
        const u = Number(next.unit_price) || 0
        next.amount = String(Math.round(q * u))
      }
      return next
    }))
  }

  const itemsTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0)
  const supply = vatIncluded ? Math.round(itemsTotal / 1.1) : itemsTotal
  const vat = vatIncluded ? itemsTotal - supply : Math.round(supply * 0.1)
  const total = supply + vat

  function buildInput(): CreateQuoteInput | null {
    if (!entityId) {
      alert('사업자를 선택해줘')
      return null
    }
    if (!projectName.trim()) {
      alert('프로젝트명(견적 건명) 필수')
      return null
    }
    const cleanedItems = items
      .filter(it => it.name.trim())
      .map(it => ({
        name: it.name.trim(),
        description: it.description.trim() || undefined,
        qty: Number(it.qty) || 0,
        unit_price: Number(it.unit_price) || 0,
        amount: Number(it.amount) || 0,
        category: it.category.trim() || undefined,
      }))
    if (!cleanedItems.length) {
      alert('항목을 1개 이상 추가해줘 (품명 비어있는 행은 제외됨)')
      return null
    }
    return {
      sale_id: saleId || undefined,
      project_id: projectId || undefined,
      lead_id: leadId || undefined,
      entity_id: entityId,
      customer_id: customerId || undefined,
      client_org: clientOrg.trim() || undefined,
      client_dept: clientDept.trim() || undefined,
      client_manager: clientManager.trim() || undefined,
      project_name: projectName.trim(),
      items: cleanedItems,
      notes: notes.trim() || undefined,
      vat_included: vatIncluded,
    }
  }

  async function handlePreview() {
    const input = buildInput()
    if (!input) return
    const res = await fetch('/api/quotes/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: input.entity_id,
        client_org: input.client_org,
        client_dept: input.client_dept,
        client_manager: input.client_manager,
        project_name: input.project_name,
        items: input.items,
        notes: input.notes,
        vat_included: input.vat_included,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(`미리보기 실패: ${err.error ?? res.status}`)
      return
    }
    const html = await res.text()
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  function handleSubmit() {
    const input = buildInput()
    if (!input) return
    startTransition(async () => {
      const result = await createQuote(input)
      if (!result.ok) {
        alert(`저장 실패: ${result.error}`)
        return
      }
      const msg = [
        `견적 생성됨: ${result.quote_number}`,
        result.html_path ? `Dropbox: ${result.html_path}` : null,
        result.warning ? `⚠️ ${result.warning}` : null,
      ].filter(Boolean).join('\n')
      alert(msg)
      onClose()
    })
  }

  const fixedConnection = !!(fixed?.sale_id || fixed?.project_id || fixed?.lead_id)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h2 className="text-lg font-bold">새 견적 만들기</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 연결 */}
          {!fixedConnection && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-600">계약(sale)</label>
                <select value={saleId} onChange={e => setSaleId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">선택 안 함</option>
                  {sales.map(s => <option key={s.id} value={s.id}>{s.name}{s.client_org ? ` (${s.client_org})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">프로젝트</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">선택 안 함</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.client_org ? ` (${p.client_org})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">리드</label>
                <select value={leadId} onChange={e => setLeadId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                  <option value="">선택 안 함</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.client_org ?? l.id.slice(0, 8)}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* 헤더 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600">사업자(우리 측) *</label>
              <select value={entityId} onChange={e => setEntityId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">선택</option>
                {supportedEntities.map(e => <option key={e.id} value={e.id}>{e.name} ({e.short_name})</option>)}
              </select>
              {entities.length > supportedEntities.length && (
                <p className="text-xs text-gray-400 mt-0.5">⚠️ short_name 미설정 사업자는 견적 템플릿이 없어서 가려짐</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">고객(customer) — 선택</label>
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full border rounded px-2 py-1.5 text-sm">
                <option value="">선택 안 함</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">거래처명 (client_org)</label>
              <input value={clientOrg} onChange={e => setClientOrg(e.target.value)} placeholder="비우면 sale/project에서 자동" className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">담당부서 / 담당자명</label>
              <div className="flex gap-2">
                <input value={clientDept} onChange={e => setClientDept(e.target.value)} placeholder="부서" className="flex-1 border rounded px-2 py-1.5 text-sm" />
                <input value={clientManager} onChange={e => setClientManager(e.target.value)} placeholder="담당자" className="flex-1 border rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-gray-600">프로젝트명(견적 건명) *</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="예: 26-04 OO 행사 기획·운영" className="w-full border rounded px-2 py-1.5 text-sm" />
            </div>
          </div>

          {/* 항목 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-gray-600">항목</label>
              <button onClick={addRow} className="text-xs text-blue-600 hover:underline">+ 행 추가</button>
            </div>
            <table className="w-full text-xs border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-1 py-1 w-16">분류</th>
                  <th className="border px-1 py-1">품명</th>
                  <th className="border px-1 py-1">세부내용</th>
                  <th className="border px-1 py-1 w-14">수량</th>
                  <th className="border px-1 py-1 w-24">단가</th>
                  <th className="border px-1 py-1 w-28">금액</th>
                  <th className="border px-1 py-1 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td className="border p-0.5"><input value={it.category} onChange={e => updateRow(i, { category: e.target.value })} className="w-full px-1 py-0.5" placeholder="옵션" /></td>
                    <td className="border p-0.5"><input value={it.name} onChange={e => updateRow(i, { name: e.target.value })} className="w-full px-1 py-0.5" /></td>
                    <td className="border p-0.5"><input value={it.description} onChange={e => updateRow(i, { description: e.target.value })} className="w-full px-1 py-0.5" /></td>
                    <td className="border p-0.5"><input value={it.qty} onChange={e => updateRow(i, { qty: e.target.value })} className="w-full px-1 py-0.5 text-right" inputMode="decimal" /></td>
                    <td className="border p-0.5"><input value={it.unit_price} onChange={e => updateRow(i, { unit_price: e.target.value })} className="w-full px-1 py-0.5 text-right" inputMode="numeric" /></td>
                    <td className="border p-0.5"><input value={it.amount} onChange={e => updateRow(i, { amount: e.target.value })} className="w-full px-1 py-0.5 text-right bg-yellow-50" inputMode="numeric" /></td>
                    <td className="border p-0.5 text-center"><button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700" title="삭제">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-gray-400 mt-1">금액(노란칸)은 자동 계산. 직접 수정도 가능 (할인·반올림용).</p>
          </div>

          {/* 합계 */}
          <div className="flex items-end justify-between bg-gray-50 rounded p-3">
            <label className="text-xs flex items-center gap-2">
              <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} />
              <span>입력 단가가 부가세 포함 (체크 해제 시 단가는 공급가, 부가세 별도 계산)</span>
            </label>
            <div className="text-sm">
              <div>공급가액 <span className="font-bold ml-3">₩{supply.toLocaleString('ko-KR')}</span></div>
              <div>부가세 <span className="font-bold ml-3">₩{vat.toLocaleString('ko-KR')}</span></div>
              <div className="text-base border-t mt-1 pt-1">총 계 <span className="font-bold ml-3">₩{total.toLocaleString('ko-KR')}</span></div>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="text-xs font-bold text-gray-600">안내사항(notes)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        <div className="px-5 py-3 border-t sticky bottom-0 bg-white flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">취소</button>
          <button onClick={handlePreview} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">미리보기</button>
          <button onClick={handleSubmit} disabled={pending} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {pending ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

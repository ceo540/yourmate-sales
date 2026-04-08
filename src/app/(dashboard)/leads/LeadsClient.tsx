'use client'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Lead, LeadStatus, LEAD_STATUSES, LEAD_CHANNELS, LEAD_SOURCES } from '@/types'
import { createLead, updateLead, deleteLead, convertLeadToSale, addSaleToLead, createLeadFolder, updateLeadDropboxUrl } from './actions'
import { createLeadLog, getLeadLogs, deleteLeadLog } from './lead-log-actions'

const LABEL_CLS = 'block text-xs font-medium text-gray-500 mb-1'
const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'

type PersonOption = { id: string; name: string; phone: string; email: string; currentOrg: string; title: string }

interface LeadFormProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isPending: boolean
  isAdmin: boolean
  profiles: { id: string; name: string }[]
  persons: PersonOption[]
}

function LeadForm({ form, setForm, onSubmit, onCancel, isPending, isAdmin, profiles, persons }: LeadFormProps) {
  const [personSearch, setPersonSearch] = useState(form.contact_name)
  const [showPersonDrop, setShowPersonDrop] = useState(false)

  const selectedPerson = form.person_id ? persons.find(p => p.id === form.person_id) : null
  const matchingPersons = persons
    .filter(p => !personSearch || p.name.includes(personSearch) || p.currentOrg.includes(personSearch))
    .slice(0, 6)

  function selectPerson(p: PersonOption) {
    setForm(f => ({
      ...f,
      person_id: p.id,
      contact_name: p.name,
      phone: f.phone || p.phone,
      email: f.email || p.email,
    }))
    setPersonSearch(p.name)
    setShowPersonDrop(false)
  }

  function clearPerson() {
    setForm(f => ({ ...f, person_id: '' }))
    setPersonSearch('')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* 담당자 선택 */}
      <div>
        <label className={LABEL_CLS}>담당자 (고객 DB 연결)</label>
        {selectedPerson ? (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedPerson.name}</p>
              <p className="text-xs text-gray-500">{selectedPerson.currentOrg}{selectedPerson.title ? ` · ${selectedPerson.title}` : ''}</p>
            </div>
            <button type="button" onClick={clearPerson} className="text-xs text-gray-400 hover:text-red-400 ml-2">✕</button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={personSearch}
              onChange={e => { setPersonSearch(e.target.value); setShowPersonDrop(true); setForm(f => ({ ...f, contact_name: e.target.value, person_id: '' })) }}
              onFocus={() => setShowPersonDrop(true)}
              onBlur={() => setTimeout(() => setShowPersonDrop(false), 150)}
              placeholder="이름으로 검색하거나 직접 입력..."
              className={INPUT_CLS}
            />
            {showPersonDrop && matchingPersons.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {matchingPersons.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => selectPerson(p)}
                    className="w-full px-3 py-2 text-left hover:bg-yellow-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.currentOrg}{p.title ? ` · ${p.title}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={LABEL_CLS}>기관명 *</label>
          <input className={INPUT_CLS} value={form.client_org} onChange={e => setForm(f => ({ ...f, client_org: e.target.value }))} required /></div>
        <div><label className={LABEL_CLS}>담당자명 / 직급</label>
          <input className={INPUT_CLS} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={LABEL_CLS}>휴대폰</label>
          <input className={INPUT_CLS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><label className={LABEL_CLS}>이메일</label>
          <input className={INPUT_CLS} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={LABEL_CLS}>서비스 분류</label>
          <select className={INPUT_CLS} value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}>
            <option value="">선택</option>
            {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div><label className={LABEL_CLS}>상태</label>
          <select className={INPUT_CLS} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}>
            {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={LABEL_CLS}>최초 유입일</label>
          <input className={INPUT_CLS} type="date" value={form.inflow_date} onChange={e => setForm(f => ({ ...f, inflow_date: e.target.value }))} /></div>
        <div><label className={LABEL_CLS}>리마인드 날짜</label>
          <input className={INPUT_CLS} type="date" value={form.remind_date} onChange={e => setForm(f => ({ ...f, remind_date: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={LABEL_CLS}>소통 경로</label>
          <select className={INPUT_CLS} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            <option value="">선택</option>
            {LEAD_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div><label className={LABEL_CLS}>유입 경로</label>
          <select className={INPUT_CLS} value={form.inflow_source} onChange={e => setForm(f => ({ ...f, inflow_source: e.target.value }))}>
            <option value="">선택</option>
            {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
          </select></div>
      </div>
      {isAdmin && (
        <div><label className={LABEL_CLS}>담당자</label>
          <select className={INPUT_CLS} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
            <option value="">미지정</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
      )}
      <div><label className={LABEL_CLS}>최초 유입 내용</label>
        <textarea className={INPUT_CLS} rows={2} value={form.initial_content} onChange={e => setForm(f => ({ ...f, initial_content: e.target.value }))} /></div>
      <div><label className={LABEL_CLS}>메모</label>
        <textarea className={INPUT_CLS} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
          {isPending ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  )
}

// FormState 타입 (LeadForm props에서 참조)
type FormState = {
  person_id: string; inflow_date: string; remind_date: string; service_type: string
  contact_name: string; client_org: string; phone: string
  office_phone: string; email: string; initial_content: string
  assignee_id: string; status: LeadStatus; channel: string
  inflow_source: string; notes: string
}

const SERVICE_TYPES = [
  'SOS', '교육프로그램', '납품설치', '유지보수', '교구대여', '제작인쇄',
  '콘텐츠제작', '행사운영', '행사대여', '프로젝트', '002ENT',
]

const LOG_TYPE_COLORS: Record<string, string> = {
  통화: 'bg-blue-50 text-blue-600', 이메일: 'bg-purple-50 text-purple-600',
  방문: 'bg-green-50 text-green-600', 메모: 'bg-yellow-50 text-yellow-700',
  내부회의: 'bg-orange-50 text-orange-600', 기타: 'bg-gray-100 text-gray-500',
}

interface LeadLog {
  id: string; content: string; log_type: string
  contacted_at: string | null; created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  author: any
}

const STATUS_BADGE: Record<string, string> = {
  '유입':    'bg-blue-100 text-blue-700',
  '회신대기': 'bg-yellow-100 text-yellow-700',
  '견적발송': 'bg-orange-100 text-orange-700',
  '조율중':   'bg-purple-100 text-purple-700',
  '진행중':   'bg-green-100 text-green-700',
  '완료':    'bg-gray-100 text-gray-500',
  '취소':    'bg-red-100 text-red-400',
}

const STATUS_BAR: Record<string, string> = {
  '유입':    'bg-blue-500',
  '회신대기': 'bg-yellow-400',
  '견적발송': 'bg-orange-400',
  '조율중':   'bg-purple-400',
  '진행중':   'bg-green-500',
  '완료':    'bg-gray-300',
  '취소':    'bg-red-300',
}

function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function getDday(remindDate: string | null) {
  if (!remindDate) return null
  const diff = daysFromToday(remindDate)
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-700 font-bold',           rowBg: 'bg-red-50/60',    diff }
  if (diff === 0) return { label: 'D-day',    color: 'bg-red-500 text-white font-bold',              rowBg: 'bg-red-50/60',    diff }
  if (diff <= 3)  return { label: `D-${diff}`, color: 'bg-orange-100 text-orange-700 font-semibold', rowBg: 'bg-orange-50/60', diff }
  if (diff <= 7)  return { label: `D-${diff}`, color: 'bg-yellow-100 text-yellow-700',               rowBg: 'bg-yellow-50/40', diff }
  return { label: `D-${diff}`, color: 'bg-gray-100 text-gray-400', rowBg: '', diff }
}

function sortByDday(a: Lead, b: Lead): number {
  const da = a.remind_date && !['완료','취소'].includes(a.status) ? daysFromToday(a.remind_date) : 9999
  const db = b.remind_date && !['완료','취소'].includes(b.status) ? daysFromToday(b.remind_date) : 9999
  return da - db
}


interface Props {
  leads: Lead[]
  profiles: { id: string; name: string }[]
  persons: PersonOption[]
  currentUserId: string
  isAdmin: boolean
  initialClientOrg?: string
}

const EMPTY_FORM: FormState = {
  person_id: '', inflow_date: new Date().toISOString().slice(0, 10),
  remind_date: '', service_type: '', contact_name: '', client_org: '',
  phone: '', office_phone: '', email: '', initial_content: '',
  assignee_id: '', status: '유입', channel: '', inflow_source: '',
  notes: '',
}

export default function LeadsClient({ leads, profiles, persons, currentUserId, isAdmin, initialClientOrg }: Props) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(!!initialClientOrg)
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialClientOrg ? { client_org: initialClientOrg } : {}) })
  const [editMode, setEditMode] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [convertingId, setConvertingId] = useState<string | null>(null)

  // 드롭박스
  const [dropboxInput, setDropboxInput] = useState('')
  const [showDropboxInput, setShowDropboxInput] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)

  // 추가 계약건 폼
  const [showAddSaleForm, setShowAddSaleForm] = useState(false)
  const [addSaleForm, setAddSaleForm] = useState({ name: '', service_type: '', revenue: '', memo: '' })
  const [addingSale, setAddingSale] = useState(false)

  // 견적서 생성 모달
  type QuoteItem = { category: string; name: string; detail: string; qty: number; months: number; unit: string; price: number }
  const EMPTY_QUOTE_ITEM: QuoteItem = { category: '', name: '', detail: '', qty: 1, months: 1, unit: '식', price: 0 }
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [quoteType, setQuoteType] = useState<'렌탈' | '002크리에이티브'>('렌탈')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10))
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([{ ...EMPTY_QUOTE_ITEM }])
  const [generatingQuote, setGeneratingQuote] = useState(false)
  const [generatedQuoteUrl, setGeneratedQuoteUrl] = useState<string | null>(null)
  const [draftingQuote, setDraftingQuote] = useState(false)

  async function handleDraftQuote() {
    if (!selectedLead) return
    setDraftingQuote(true)
    try {
      const res = await fetch('/api/quotation/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, quoteType }),
      })
      const result = await res.json()
      if (result.items) {
        setQuoteItems(result.items.map((it: any) => ({
          category: it.category ?? '',
          name: it.name ?? '',
          detail: it.detail ?? '',
          qty: Number(it.qty) || 1,
          months: Number(it.months) || 1,
          unit: it.unit ?? '식',
          price: Number(it.price) || 0,
        })))
      } else {
        alert('초안 생성 실패: ' + (result.error ?? '알 수 없는 오류'))
      }
    } catch {
      alert('초안 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setDraftingQuote(false)
    }
  }

  async function handleGenerateQuote() {
    if (!selectedLead) return
    setGeneratingQuote(true)
    setGeneratedQuoteUrl(null)
    try {
      const res = await fetch('/api/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          quoteType,
          clientName: selectedLead.client_org || '기관명 없음',
          issueDate: quoteDate,
          items: quoteItems.filter(i => i.name.trim()),
          contactPerson: selectedLead.contact_name,
        }),
      })
      const result = await res.json()
      if (result.url) { setGeneratedQuoteUrl(result.url) }
      else { alert('견적서 생성 실패: ' + (result.error ?? '알 수 없는 오류')) }
    } catch {
      alert('견적서 생성 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setGeneratingQuote(false)
    }
  }

  // 소통 로그 (project_logs)
  const [leadLogs, setLeadLogs] = useState<LeadLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [newLeadLog, setNewLeadLog] = useState('')
  const [newLeadLogType, setNewLeadLogType] = useState('통화')
  const [leadLogContactedAt, setLeadLogContactedAt] = useState(() => {
    const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [leadLogError, setLeadLogError] = useState<string | null>(null)

  // leads 업데이트 시 선택된 리드 동기화
  useEffect(() => {
    if (!selectedLead) return
    const updated = leads.find(l => l.id === selectedLead.id)
    if (updated) setSelectedLead(updated)
  }, [leads])

  // 리드 선택 시 소통 로그 로드
  const refreshLeadLogs = useCallback(async (leadId: string) => {
    setLoadingLogs(true)
    const logs = await getLeadLogs(leadId)
    setLeadLogs(logs as unknown as LeadLog[])
    setLoadingLogs(false)
  }, [])

  useEffect(() => {
    if (!selectedLead) { setLeadLogs([]); return }
    refreshLeadLogs(selectedLead.id)
    setShowAddSaleForm(false)
    setShowDropboxInput(false)
    setDropboxInput('')
  }, [selectedLead?.id])

  const filtered = leads
    .filter(l => {
      const matchStatus = statusFilter === '전체' || l.status === statusFilter
      const matchSearch = !searchTerm || [l.client_org, l.contact_name, l.lead_id]
        .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()))
      return matchStatus && matchSearch
    })
    .sort(sortByDday)

  // 요약 카드
  const stats = {
    total: leads.length,
    유입: leads.filter(l => l.status === '유입').length,
    진행중: leads.filter(l => l.status === '진행중').length,
    remindOverdue: leads.filter(l =>
      l.remind_date && !['완료','취소'].includes(l.status) && daysFromToday(l.remind_date) <= 0
    ).length,
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, assignee_id: currentUserId })
    setShowCreateModal(true)
  }

  function openEdit(lead: Lead) {
    setForm({
      person_id: lead.person_id || '',
      inflow_date: lead.inflow_date || '', remind_date: lead.remind_date || '',
      service_type: lead.service_type || '', contact_name: lead.contact_name || '',
      client_org: lead.client_org || '', phone: lead.phone || '',
      office_phone: lead.office_phone || '', email: lead.email || '',
      initial_content: lead.initial_content || '', assignee_id: lead.assignee_id || '',
      status: (lead.status || '유입') as LeadStatus, channel: lead.channel || '',
      inflow_source: lead.inflow_source || '', notes: lead.notes || '',
    })
    setEditMode(true)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v) fd.set(k, v as string) })
    startTransition(async () => { await createLead(fd); setShowCreateModal(false); setForm({ ...EMPTY_FORM }) })
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLead) return
    startTransition(async () => {
      await updateLead(selectedLead.id, {
        person_id: form.person_id || null,
        inflow_date: form.inflow_date || null, remind_date: form.remind_date || null,
        service_type: form.service_type || null, contact_name: form.contact_name || null,
        client_org: form.client_org || null, phone: form.phone || null,
        office_phone: form.office_phone || null, email: form.email || null,
        initial_content: form.initial_content || null, assignee_id: form.assignee_id || null,
        status: form.status, channel: form.channel || null,
        inflow_source: form.inflow_source || null, notes: form.notes || null,
      })
      setEditMode(false)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('이 리드를 영구 삭제할까요?\n고객 DB(거래처 탭)의 연락처는 유지됩니다.')) return
    startTransition(() => deleteLead(id))
    setSelectedLead(null)
  }

  async function handleConvert(leadId: string) {
    if (!confirm('매출건으로 전환할까요?')) return
    setConvertingId(leadId)
    const result = await convertLeadToSale(leadId)
    setConvertingId(null)
    if ('error' in result) { alert('전환 실패: ' + result.error) }
    else { router.push(`/sales/${result.sale_id}`) }
  }

  async function handleCreateLeadFolder(leadId: string) {
    setCreatingFolder(true)
    const result = await createLeadFolder(leadId)
    setCreatingFolder(false)
    if (result.error) alert('폴더 생성 실패: ' + result.error)
    else if (!result.url) alert('서비스 타입이 없어서 폴더를 만들 수 없어요. URL을 직접 입력해주세요.')
  }

  async function handleSaveDropboxUrl(leadId: string) {
    if (!dropboxInput.trim()) return
    await updateLeadDropboxUrl(leadId, dropboxInput.trim())
    setDropboxInput('')
    setShowDropboxInput(false)
  }

  async function handleAddSale(leadId: string) {
    if (!addSaleForm.name.trim()) { alert('건명을 입력하세요.'); return }
    setAddingSale(true)
    const result = await addSaleToLead(leadId, {
      name: addSaleForm.name,
      service_type: addSaleForm.service_type || null,
      revenue: Number(addSaleForm.revenue) || 0,
      memo: addSaleForm.memo || null,
    })
    setAddingSale(false)
    if ('error' in result) { alert('등록 실패: ' + result.error) }
    else {
      setShowAddSaleForm(false)
      setAddSaleForm({ name: '', service_type: '', revenue: '', memo: '' })
    }
  }

  function handleAddLeadLog(type: string) {
    if (!newLeadLog.trim() || !selectedLead) return
    setNewLeadLogType(type)
    setLeadLogError(null)
    startTransition(async () => {
      try {
        await createLeadLog(
          selectedLead.id,
          newLeadLog,
          type,
          leadLogContactedAt ? new Date(leadLogContactedAt).toISOString() : undefined,
        )
        setNewLeadLog('')
        const now = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
        setLeadLogContactedAt(`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)
        await refreshLeadLogs(selectedLead.id)
      } catch (e: any) {
        setLeadLogError('저장 실패: ' + (e?.message ?? String(e)))
      }
    })
  }

  function handleDeleteLeadLog(logId: string) {
    if (!selectedLead || !confirm('이 소통 기록을 삭제할까요?')) return
    startTransition(async () => {
      await deleteLeadLog(logId)
      await refreshLeadLogs(selectedLead.id)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체 리드', value: stats.total, color: 'text-gray-800', bg: 'bg-white' },
          { label: '신규 유입', value: stats.유입, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '진행중', value: stats.진행중, color: 'text-green-600', bg: 'bg-green-50' },
          { label: '리마인드 초과', value: stats.remindOverdue, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 필터 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5">
          {['전체', ...LEAD_STATUSES].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={statusFilter === s ? { backgroundColor: '#FFCE00' } : {}}>
              {s}
              {s !== '전체' && <span className="ml-1 opacity-60">({leads.filter(l => l.status === s).length})</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2 ml-auto">
          <input type="text" placeholder="기관명, 담당자, ID 검색..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
          {isAdmin && (
            <button onClick={openCreate}
              className="px-4 py-1.5 text-sm font-semibold rounded-lg whitespace-nowrap"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 새 리드
            </button>
          )}
        </div>
      </div>

      {/* 스플릿 뷰 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-360px)] md:min-h-[520px]">

        {/* 왼쪽: 리드 목록 — 모바일에서 상세 선택 시 숨김 */}
        <div className={`${selectedLead ? 'hidden md:flex' : 'flex'} md:w-[55%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="w-1 p-0" />
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-24 whitespace-nowrap">D-day</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">기관명</th>
                  <th className="hidden sm:table-cell text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
                  <th className="hidden sm:table-cell text-left px-3 py-3 text-xs font-semibold text-gray-500">담당</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    {leads.length === 0 ? '등록된 리드가 없어요. 빵빵이한테 말하거나 + 새 리드를 눌러 추가하세요.' : '검색 결과가 없어요.'}
                  </td></tr>
                ) : filtered.map(lead => {
                  const dday = getDday(lead.remind_date)
                  const isSelected = selectedLead?.id === lead.id
                  return (
                    <tr key={lead.id}
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' :
                        dday?.rowBg ? `${dday.rowBg} hover:brightness-95` : 'hover:bg-gray-50'
                      }`}
                      onClick={() => { setSelectedLead(isSelected ? null : lead); setNewLeadLog('') }}>
                      <td className="p-0">
                        <div className={`w-1 min-h-[52px] ${STATUS_BAR[lead.status] || 'bg-gray-200'}`} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {dday
                          ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${dday.color}`}>{dday.label}</span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 text-sm leading-tight">{lead.client_org || '-'}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{lead.contact_name || ''}</div>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3">
                        {lead.service_type
                          ? <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{(lead.assignee as any)?.name || '-'}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[lead.status] || 'bg-gray-100 text-gray-500'}`}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 — 모바일에서 선택 시만 표시 */}
        <div className={`${selectedLead ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          {!selectedLead ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">👈</span>
              <p className="text-sm">왼쪽에서 리드를 선택하세요</p>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 shrink-0">
                <button onClick={() => setSelectedLead(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2">
                  ← 목록으로
                </button>
                <p className="text-xs text-gray-400">{selectedLead.lead_id}</p>
                <h2 className="text-base font-bold text-gray-900 leading-tight">{selectedLead.client_org || '기관명 없음'}</h2>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selectedLead.status] || ''}`}>
                    {selectedLead.status}
                  </span>
                  {selectedLead.service_type && (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{selectedLead.service_type}</span>
                  )}
                  {selectedLead.remind_date && (() => {
                    const d = getDday(selectedLead.remind_date)
                    return d ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${d.color}`}>{d.label} ({selectedLead.remind_date})</span> : null
                  })()}
                  {selectedLead.converted_sale_id && (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">매출건 전환완료</span>
                  )}
                </div>
              </div>

              {/* 스크롤 콘텐츠 */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* 담당자 카드 (고객 DB 연결 시) */}
                {selectedLead.person && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">담당자 (고객 DB 연결됨)</p>
                    <a href={`/customers`} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 hover:border-blue-300 transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                        {selectedLead.person.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-700">{selectedLead.person.name}</p>
                        <p className="text-xs text-gray-500 truncate">{selectedLead.person.currentOrg}{selectedLead.person.title ? ` · ${selectedLead.person.title}` : ''}</p>
                      </div>
                      <span className="text-xs text-blue-300 group-hover:text-blue-500">→</span>
                    </a>
                  </div>
                )}

                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                  {[
                    ['담당자', selectedLead.contact_name],
                    ['담당 직원', (selectedLead.assignee as any)?.name],
                    ['휴대폰', selectedLead.phone],
                    ['사무실', selectedLead.office_phone],
                    ['이메일', selectedLead.email],
                    ['유입경로', selectedLead.inflow_source],
                    ['소통경로', selectedLead.channel],
                    ['유입일', selectedLead.inflow_date],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <span className="text-gray-400 text-xs">{k}</span>
                      <p className="text-gray-800 text-sm font-medium">{(v as string) || '-'}</p>
                    </div>
                  ))}
                </div>

                {/* 리마인드 날짜 인라인 편집 */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">리마인드 날짜</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      key={selectedLead.id + '-remind'}
                      type="date"
                      defaultValue={selectedLead.remind_date || ''}
                      onBlur={e => {
                        const val = e.target.value || null
                        if (val !== (selectedLead.remind_date || null)) {
                          startTransition(async () => {
                            await updateLead(selectedLead.id, { remind_date: val })
                          })
                        }
                      }}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-300 text-gray-800"
                    />
                    {selectedLead.remind_date && (() => {
                      const d = getDday(selectedLead.remind_date)
                      return d ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${d.color}`}>{d.label}</span> : null
                    })()}
                  </div>
                </div>

                {/* 드롭박스 폴더 */}
                <div>
                  <p className="text-xs text-gray-400 mb-1.5">드롭박스</p>
                  {selectedLead.dropbox_url ? (
                    <a href={selectedLead.dropbox_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg px-3 py-2">
                      <span>📁</span>
                      <span className="underline truncate">드롭박스 폴더 열기</span>
                    </a>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateLeadFolder(selectedLead.id)}
                          disabled={creatingFolder}
                          className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                          {creatingFolder ? '생성 중...' : '📁 폴더 자동 생성'}
                        </button>
                        <button
                          onClick={() => setShowDropboxInput(!showDropboxInput)}
                          className="text-xs px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                          URL 직접 입력
                        </button>
                      </div>
                      {showDropboxInput && (
                        <div className="flex gap-2">
                          <input
                            value={dropboxInput}
                            onChange={e => setDropboxInput(e.target.value)}
                            placeholder="https://www.dropbox.com/..."
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400" />
                          <button
                            onClick={() => handleSaveDropboxUrl(selectedLead.id)}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium"
                            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 견적서 URL */}
                {selectedLead.quotation_url && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">견적서</p>
                    <a href={selectedLead.quotation_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                      <span>📄</span>
                      <span className="underline truncate">구글 시트 견적서 열기</span>
                    </a>
                  </div>
                )}

                {/* 연관 매출건 */}
                {(selectedLead.relatedSales && selectedLead.relatedSales.length > 0) && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">연관 매출건 ({selectedLead.relatedSales.length})</p>
                    <div className="space-y-1.5">
                      {selectedLead.relatedSales.map((sale: any) => (
                        <a key={sale.id} href={`/sales/${sale.id}`}
                          className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 hover:border-yellow-300 transition-colors group">
                          <div>
                            <p className="text-sm font-medium text-gray-800 group-hover:text-yellow-700 transition-colors">{sale.name}</p>
                            {sale.revenue > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {sale.revenue >= 10000000 ? `${(sale.revenue / 10000000).toFixed(1)}천만` :
                                 sale.revenue >= 10000 ? `${Math.round(sale.revenue / 10000)}만` :
                                 `${sale.revenue.toLocaleString()}원`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              sale.payment_status === '완납' ? 'bg-gray-100 text-gray-400' :
                              sale.payment_status === '계약전' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>{sale.payment_status}</span>
                            {sale.progress_status && sale.progress_status !== '착수전' && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                sale.progress_status === '완수' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'
                              }`}>{sale.progress_status}</span>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최초 유입 내용 */}
                {selectedLead.initial_content && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">최초 유입 내용</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedLead.initial_content}</p>
                  </div>
                )}

                {/* 소통 내역 (project_logs 기반) */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">소통 내역 ({leadLogs.length}건)</p>

                  {/* 소통 입력 폼 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-3">
                    <textarea
                      value={newLeadLog}
                      onChange={e => setNewLeadLog(e.target.value)}
                      placeholder="소통 내용을 기록하세요..."
                      rows={2}
                      className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400 mb-2"
                    />
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs text-gray-400 shrink-0">소통 일시</label>
                      <input type="datetime-local" value={leadLogContactedAt}
                        onChange={e => setLeadLogContactedAt(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['통화','이메일','방문','내부회의','메모','기타'].map(type => (
                        <button key={type}
                          onClick={() => handleAddLeadLog(type)}
                          disabled={isPending || !newLeadLog.trim()}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-all disabled:opacity-40 ${
                            newLeadLogType === type ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500 hover:border-yellow-300'
                          }`}>{type}로 저장</button>
                      ))}
                    </div>
                    {leadLogError && (
                      <p className="text-xs text-red-500 mt-1">{leadLogError}</p>
                    )}
                  </div>

                  {/* 로그 목록 */}
                  {loadingLogs ? (
                    <p className="text-xs text-gray-300 text-center py-3">불러오는 중...</p>
                  ) : leadLogs.length === 0 ? (
                    <p className="text-xs text-gray-300 italic py-1">아직 소통 내역이 없어요.</p>
                  ) : (
                    <div className="space-y-2">
                      {leadLogs.map(log => (
                        <div key={log.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 group">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${LOG_TYPE_COLORS[log.log_type] ?? 'bg-gray-100 text-gray-500'}`}>{log.log_type}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(log.contacted_at || log.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-xs text-gray-400 ml-auto">{(log.author as any)?.name ?? '-'}</span>
                            {isAdmin && (
                              <button onClick={() => handleDeleteLeadLog(log.id)}
                                className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-400 transition-all">✕</button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 메모 */}
                {selectedLead.notes && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">메모</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                )}
              </div>

              {/* 추가 계약건 폼 */}
              {showAddSaleForm && (
                <div className="px-5 py-3 border-t border-gray-100 bg-yellow-50 shrink-0 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">추가 계약건 등록</p>
                  <input value={addSaleForm.name} onChange={e => setAddSaleForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="건명 *" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400" />
                  <div className="flex gap-2">
                    <select value={addSaleForm.service_type} onChange={e => setAddSaleForm(f => ({ ...f, service_type: e.target.value }))}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                      <option value="">서비스 (선택)</option>
                      {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input type="number" value={addSaleForm.revenue} onChange={e => setAddSaleForm(f => ({ ...f, revenue: e.target.value }))}
                      placeholder="매출액" className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAddSale(selectedLead.id)} disabled={addingSale}
                      className="flex-1 text-xs px-3 py-1.5 font-semibold rounded-lg disabled:opacity-50"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                      {addingSale ? '등록 중...' : '등록'}
                    </button>
                    <button onClick={() => setShowAddSaleForm(false)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                </div>
              )}

              {/* 하단 액션 버튼 */}
              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0 flex-wrap">
                {isAdmin && (
                  <>
                    <button onClick={() => openEdit(selectedLead)}
                      className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                      수정
                    </button>
                    <button
                      onClick={() => { setShowQuoteModal(true); setGeneratedQuoteUrl(null); setQuoteItems([{ category: '', name: '', detail: '', qty: 1, months: 1, unit: '식', price: 0 }]) }}
                      className="px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                      견적서 생성
                    </button>
                    <button onClick={() => setShowAddSaleForm(!showAddSaleForm)}
                      className="flex-1 px-3 py-2 text-sm font-semibold border border-yellow-300 bg-yellow-50 text-yellow-800 rounded-lg hover:bg-yellow-100">
                      {showAddSaleForm ? '닫기' : '+ 계약건 추가'}
                    </button>
                    {(selectedLead.relatedSales?.length ?? 0) === 0 && (
                      <button onClick={() => handleConvert(selectedLead.id)}
                        disabled={convertingId === selectedLead.id}
                        className="px-3 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {convertingId === selectedLead.id ? '전환 중...' : '바로 전환'}
                      </button>
                    )}
                    {selectedLead.status !== '취소' && (
                      <button onClick={() => handleDelete(selectedLead.id)}
                        className="px-3 py-2 text-sm text-red-400 hover:text-red-600 border border-red-100 rounded-lg hover:bg-red-50">
                        삭제
                      </button>
                    )}
                    {selectedLead.status === '취소' && (
                      <button onClick={() => handleDelete(selectedLead.id)}
                        className="px-3 py-2 text-sm text-gray-300 hover:text-red-400 border border-gray-100 rounded-lg hover:bg-red-50 text-xs">
                        ···
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 수정 모달 (센터) */}
      {editMode && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditMode(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">리드 수정</h2>
            <LeadForm form={form} setForm={setForm} onSubmit={handleUpdate} onCancel={() => setEditMode(false)} isPending={isPending} isAdmin={isAdmin} profiles={profiles} persons={persons} />
          </div>
        </div>
      )}

      {/* 생성 모달 (센터) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 리드 등록</h2>
            <LeadForm form={form} setForm={setForm} onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} isPending={isPending} isAdmin={isAdmin} profiles={profiles} persons={persons} />
          </div>
        </div>
      )}

      {/* 견적서 생성 모달 */}
      {showQuoteModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowQuoteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">견적서 생성</h2>
            <p className="text-sm text-gray-400 mb-4">{selectedLead.client_org || '기관명 없음'}</p>

            {/* 견적서 종류 + 날짜 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className={LABEL_CLS}>견적서 종류</label>
                <select className={INPUT_CLS} value={quoteType} onChange={e => setQuoteType(e.target.value as '렌탈' | '002크리에이티브')}>
                  <option value="렌탈">유어메이트 렌탈</option>
                  <option value="002크리에이티브">002크리에이티브</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLS}>발행일</label>
                <input type="date" className={INPUT_CLS} value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
              </div>
            </div>

            {/* 품목 입력 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL_CLS}>품목 목록</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleDraftQuote}
                    disabled={draftingQuote}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    {draftingQuote ? '⏳ AI 작성 중...' : '✨ AI 초안 작성'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteItems(prev => [...prev, { category: '', name: '', detail: '', qty: 1, months: 1, unit: '식', price: 0 }])}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                    + 행 추가
                  </button>
                </div>
              </div>
              {draftingQuote && (
                <p className="text-xs text-yellow-600 mt-1 text-right">Claude AI가 소통 내역을 분석 중입니다. 보통 10~20초 소요됩니다.</p>
              )}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* 헤더 */}
                <div className={`grid text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-2 gap-2 ${quoteType === '렌탈' ? 'grid-cols-[2fr_1.5fr_0.6fr_0.6fr_1fr_auto]' : 'grid-cols-[1fr_2fr_1.5fr_0.6fr_0.7fr_1fr_auto]'}`}>
                  {quoteType === '렌탈' ? (
                    <><span>품목명</span><span>세부내용</span><span>수량</span><span>개월</span><span>단가(원)</span><span className="w-5" /></>
                  ) : (
                    <><span>구분</span><span>품명</span><span>세부내역</span><span>수량</span><span>단위</span><span>단가(원)</span><span className="w-5" /></>
                  )}
                </div>
                {/* 행 */}
                {quoteItems.map((item, idx) => (
                  <div key={idx} className={`grid items-center gap-2 px-3 py-1.5 border-t border-gray-100 ${quoteType === '렌탈' ? 'grid-cols-[2fr_1.5fr_0.6fr_0.6fr_1fr_auto]' : 'grid-cols-[1fr_2fr_1.5fr_0.6fr_0.7fr_1fr_auto]'}`}>
                    {quoteType === '002크리에이티브' && (
                      <input
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
                        placeholder="구분"
                        value={item.category}
                        onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, category: e.target.value } : it))} />
                    )}
                    <input
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
                      placeholder="품목명"
                      value={item.name}
                      onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))} />
                    <input
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400"
                      placeholder="세부내용"
                      value={item.detail}
                      onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, detail: e.target.value } : it))} />
                    <input type="number" min="1"
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center"
                      value={item.qty}
                      onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) || 1 } : it))} />
                    {quoteType === '렌탈' ? (
                      <input type="number" min="1"
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center"
                        value={item.months}
                        onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, months: Number(e.target.value) || 1 } : it))} />
                    ) : (
                      <input
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center"
                        placeholder="식"
                        value={item.unit}
                        onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} />
                    )}
                    <input type="number" min="0"
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-right"
                      value={item.price}
                      onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, price: Number(e.target.value) || 0 } : it))} />
                    <button type="button"
                      onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 text-sm w-5 text-center">✕</button>
                  </div>
                ))}
              </div>
              {/* 합계 미리보기 */}
              <p className="text-right text-xs text-gray-400 mt-1.5 pr-1">
                소계: {quoteItems.reduce((sum, it) => sum + it.price * it.qty * (quoteType === '렌탈' ? it.months : 1), 0).toLocaleString()}원
                &nbsp;/ VAT포함: {Math.round(quoteItems.reduce((sum, it) => sum + it.price * it.qty * (quoteType === '렌탈' ? it.months : 1), 0) * 1.1).toLocaleString()}원
              </p>
            </div>

            {/* 생성 결과 */}
            {generatedQuoteUrl && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs text-green-700 font-semibold mb-1">견적서 생성 완료!</p>
                <a href={generatedQuoteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-green-800 underline break-all">{generatedQuoteUrl}</a>
              </div>
            )}

            {/* 버튼 */}
            {generatingQuote && (
              <p className="text-xs text-gray-400 text-right mb-2">구글 시트에 견적서를 생성 중입니다. 보통 15~30초 소요됩니다.</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">닫기</button>
              <button type="button" onClick={handleGenerateQuote} disabled={generatingQuote || quoteItems.every(i => !i.name.trim())}
                className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {generatingQuote ? '생성 중...' : generatedQuoteUrl ? '다시 생성' : '견적서 생성'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

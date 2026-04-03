'use client'
import { useState, useTransition, useEffect } from 'react'
import { Lead, LeadStatus, LEAD_STATUSES, LEAD_CHANNELS, LEAD_SOURCES } from '@/types'
import { createLead, updateLead, deleteLead, convertLeadToSale } from './actions'

const SERVICE_TYPES = [
  'SOS', '교육프로그램', '납품설치', '유지보수', '교구대여', '제작인쇄',
  '콘텐츠제작', '행사운영', '행사대여', '프로젝트', '002ENT',
]

const STATUS_BADGE: Record<string, string> = {
  '신규':    'bg-blue-100 text-blue-700',
  '회신대기': 'bg-yellow-100 text-yellow-700',
  '견적발송': 'bg-orange-100 text-orange-700',
  '진행중':   'bg-green-100 text-green-700',
  '완료':    'bg-gray-100 text-gray-500',
  '취소':    'bg-red-100 text-red-400',
}

const STATUS_BAR: Record<string, string> = {
  '신규':    'bg-blue-500',
  '회신대기': 'bg-yellow-400',
  '견적발송': 'bg-orange-400',
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

// contact_1/2/3 텍스트에서 날짜 파싱: "[2026-04-03] 내용" 형식
function parseContact(text: string): { date: string | null; body: string } {
  const m = text.match(/^\[(\d{4}-\d{2}-\d{2})\] ([\s\S]+)$/)
  return m ? { date: m[1], body: m[2] } : { date: null, body: text }
}

interface Props {
  leads: Lead[]
  profiles: { id: string; name: string }[]
  currentUserId: string
  isAdmin: boolean
}

type FormState = {
  inflow_date: string; remind_date: string; service_type: string
  contact_name: string; client_org: string; phone: string
  office_phone: string; email: string; initial_content: string
  assignee_id: string; status: LeadStatus; channel: string
  inflow_source: string; notes: string
  contact_1: string; contact_2: string; contact_3: string
}

const EMPTY_FORM: FormState = {
  inflow_date: new Date().toISOString().slice(0, 10),
  remind_date: '', service_type: '', contact_name: '', client_org: '',
  phone: '', office_phone: '', email: '', initial_content: '',
  assignee_id: '', status: '신규', channel: '', inflow_source: '',
  notes: '', contact_1: '', contact_2: '', contact_3: '',
}

export default function LeadsClient({ leads, profiles, currentUserId, isAdmin }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [editMode, setEditMode] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [showAddContact, setShowAddContact] = useState(false)
  const [addContactText, setAddContactText] = useState('')

  // leads 업데이트 시 선택된 리드 동기화
  useEffect(() => {
    if (!selectedLead) return
    const updated = leads.find(l => l.id === selectedLead.id)
    if (updated) setSelectedLead(updated)
  }, [leads])

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
    신규: leads.filter(l => l.status === '신규').length,
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
      inflow_date: lead.inflow_date || '', remind_date: lead.remind_date || '',
      service_type: lead.service_type || '', contact_name: lead.contact_name || '',
      client_org: lead.client_org || '', phone: lead.phone || '',
      office_phone: lead.office_phone || '', email: lead.email || '',
      initial_content: lead.initial_content || '', assignee_id: lead.assignee_id || '',
      status: (lead.status || '신규') as LeadStatus, channel: lead.channel || '',
      inflow_source: lead.inflow_source || '', notes: lead.notes || '',
      contact_1: lead.contact_1 || '', contact_2: lead.contact_2 || '', contact_3: lead.contact_3 || '',
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
        inflow_date: form.inflow_date || null, remind_date: form.remind_date || null,
        service_type: form.service_type || null, contact_name: form.contact_name || null,
        client_org: form.client_org || null, phone: form.phone || null,
        office_phone: form.office_phone || null, email: form.email || null,
        initial_content: form.initial_content || null, assignee_id: form.assignee_id || null,
        status: form.status, channel: form.channel || null,
        inflow_source: form.inflow_source || null, notes: form.notes || null,
        contact_1: form.contact_1 || null, contact_2: form.contact_2 || null, contact_3: form.contact_3 || null,
      })
      setEditMode(false)
    })
  }

  function handleDelete(id: string) {
    if (!confirm('이 리드를 삭제할까요?')) return
    startTransition(() => deleteLead(id))
    setSelectedLead(null)
  }

  async function handleConvert(leadId: string) {
    if (!confirm('매출건으로 전환할까요?')) return
    setConvertingId(leadId)
    const result = await convertLeadToSale(leadId)
    setConvertingId(null)
    if (result.error) { alert('전환 실패: ' + result.error) }
    else { alert('매출건으로 전환됐어! /sales/report 에서 확인해줘.') }
  }

  function handleAddContact() {
    if (!selectedLead || !addContactText.trim()) return
    const date = new Date().toISOString().slice(0, 10)
    const text = `[${date}] ${addContactText.trim()}`
    const nextField = !selectedLead.contact_1 ? 'contact_1'
      : !selectedLead.contact_2 ? 'contact_2'
      : !selectedLead.contact_3 ? 'contact_3' : null
    if (!nextField) {
      alert('소통 내역이 3개 가득 찼어요. 수정에서 직접 편집해주세요.')
      return
    }
    startTransition(async () => {
      await updateLead(selectedLead.id, { [nextField]: text })
      setAddContactText('')
      setShowAddContact(false)
    })
  }

  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'
  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'

  function LeadForm({ onSubmit }: { onSubmit: (e: React.FormEvent) => void }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>기관명 *</label>
            <input className={inputCls} value={form.client_org} onChange={e => setForm(f => ({ ...f, client_org: e.target.value }))} required /></div>
          <div><label className={labelCls}>담당자명 / 직급</label>
            <input className={inputCls} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>휴대폰</label>
            <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          <div><label className={labelCls}>이메일</label>
            <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>서비스 분류</label>
            <select className={inputCls} value={form.service_type} onChange={e => setForm(f => ({ ...f, service_type: e.target.value }))}>
              <option value="">선택</option>
              {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><label className={labelCls}>상태</label>
            <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}>
              {LEAD_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>최초 유입일</label>
            <input className={inputCls} type="date" value={form.inflow_date} onChange={e => setForm(f => ({ ...f, inflow_date: e.target.value }))} /></div>
          <div><label className={labelCls}>리마인드 날짜</label>
            <input className={inputCls} type="date" value={form.remind_date} onChange={e => setForm(f => ({ ...f, remind_date: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>소통 경로</label>
            <select className={inputCls} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
              <option value="">선택</option>
              {LEAD_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className={labelCls}>유입 경로</label>
            <select className={inputCls} value={form.inflow_source} onChange={e => setForm(f => ({ ...f, inflow_source: e.target.value }))}>
              <option value="">선택</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>
        {isAdmin && (
          <div><label className={labelCls}>담당자</label>
            <select className={inputCls} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
              <option value="">미지정</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
        )}
        <div><label className={labelCls}>최초 유입 내용</label>
          <textarea className={inputCls} rows={2} value={form.initial_content} onChange={e => setForm(f => ({ ...f, initial_content: e.target.value }))} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['contact_1', 'contact_2', 'contact_3'] as const).map((k, i) => (
            <div key={k}><label className={labelCls}>{i + 1}차 소통</label>
              <textarea className={inputCls} rows={2} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
        </div>
        <div><label className={labelCls}>메모</label>
          <textarea className={inputCls} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => { setShowCreateModal(false); setEditMode(false) }}
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

  // 소통 내역 목록 (contact_1/2/3 중 값 있는 것만)
  const contactEntries = selectedLead
    ? ([selectedLead.contact_1, selectedLead.contact_2, selectedLead.contact_3] as (string | null)[])
        .map((c, i) => c ? { index: i + 1, ...parseContact(c) } : null)
        .filter(Boolean) as { index: number; date: string | null; body: string }[]
    : []

  const contactsFull = contactEntries.length >= 3

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체 리드', value: stats.total, color: 'text-gray-800', bg: 'bg-white' },
          { label: '신규 문의', value: stats.신규, color: 'text-blue-600', bg: 'bg-blue-50' },
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
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">담당</th>
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
                      onClick={() => { setSelectedLead(isSelected ? null : lead); setShowAddContact(false); setAddContactText('') }}>
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
                      <td className="px-3 py-3">
                        {lead.service_type
                          ? <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span>
                          : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{(lead.assignee as any)?.name || '-'}</td>
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

                {/* 최초 유입 내용 */}
                {selectedLead.initial_content && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1.5">최초 유입 내용</p>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selectedLead.initial_content}</p>
                  </div>
                )}

                {/* 소통 내역 타임라인 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">소통 내역 ({contactEntries.length}/3)</p>
                    {!contactsFull && (
                      <button
                        onClick={() => setShowAddContact(v => !v)}
                        className="text-xs px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors">
                        {showAddContact ? '취소' : '+ 소통 추가'}
                      </button>
                    )}
                  </div>

                  {/* 기존 소통 내역 */}
                  {contactEntries.length === 0 && !showAddContact ? (
                    <p className="text-xs text-gray-300 italic py-1">아직 소통 내역이 없어요.</p>
                  ) : (
                    <div className="relative pl-5">
                      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />
                      <div className="space-y-3">
                        {contactEntries.map(c => (
                          <div key={c.index} className="relative flex gap-2">
                            <div className="absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: '#FFCE00' }} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-gray-500">{c.index}차</span>
                                {c.date && <span className="text-xs text-gray-300">{c.date}</span>}
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2.5 text-sm text-gray-700 whitespace-pre-wrap">{c.body}</div>
                            </div>
                          </div>
                        ))}

                        {/* 소통 추가 인라인 폼 */}
                        {showAddContact && (
                          <div className="relative flex gap-2">
                            <div className="absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-dashed border-yellow-400 bg-white" />
                            <div className="flex-1">
                              <div className="text-xs font-semibold text-gray-500 mb-1">
                                {contactEntries.length + 1}차 소통 추가
                                <span className="ml-1.5 text-gray-400 font-normal">{new Date().toISOString().slice(0,10)}</span>
                              </div>
                              <textarea
                                className="w-full border border-yellow-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none bg-yellow-50/30"
                                rows={3}
                                placeholder="소통 내용을 입력하세요..."
                                value={addContactText}
                                onChange={e => setAddContactText(e.target.value)}
                                autoFocus
                              />
                              <div className="flex justify-end mt-1.5">
                                <button
                                  onClick={handleAddContact}
                                  disabled={!addContactText.trim() || isPending}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-40"
                                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                                  {isPending ? '저장 중...' : '추가'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {contactsFull && (
                    <p className="text-xs text-gray-400 mt-1">소통 내역 3개 모두 사용 중. 수정에서 편집하세요.</p>
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

              {/* 하단 액션 버튼 */}
              <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                {isAdmin && (
                  <>
                    <button onClick={() => openEdit(selectedLead)}
                      className="flex-1 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                      수정
                    </button>
                    {!selectedLead.converted_sale_id && (
                      <button onClick={() => handleConvert(selectedLead.id)}
                        disabled={convertingId === selectedLead.id}
                        className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {convertingId === selectedLead.id ? '전환 중...' : '매출건으로 전환'}
                      </button>
                    )}
                    <button onClick={() => handleDelete(selectedLead.id)}
                      className="px-3 py-2 text-sm text-red-400 hover:text-red-600 border border-red-100 rounded-lg hover:bg-red-50">
                      삭제
                    </button>
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
            <LeadForm onSubmit={handleUpdate} />
          </div>
        </div>
      )}

      {/* 생성 모달 (센터) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 리드 등록</h2>
            <LeadForm onSubmit={handleCreate} />
          </div>
        </div>
      )}
    </div>
  )
}

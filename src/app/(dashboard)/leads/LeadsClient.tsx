'use client'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { Lead, LeadStatus, LEAD_STATUSES, LEAD_CHANNELS, LEAD_SOURCES } from '@/types'
import { createLead, updateLead, deleteLead, convertLeadToSale, addSaleToLead, createLeadFolder, updateLeadDropboxUrl, updateLeadNotes, syncLeadDropboxFolderName, createPerson, updateLeadPersonAndCustomer, previewProjectNumber, refreshLeadBrief, createAndLinkLeadCalendarEvent, unlinkLeadCalendarEvent } from './actions'
import { createLeadLog, getLeadLogs, deleteLeadLog } from './lead-log-actions'
import ProjectClaudeChat from '@/components/ProjectClaudeChat'
import MarkdownNoteBlock from '@/components/MarkdownNoteBlock'
import { LOG_TYPE_COLORS } from '@/lib/constants'

const LABEL_CLS = 'block text-xs font-medium text-gray-500 mb-1'
const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'

type PersonOption = {
  id: string; name: string; phone: string; email: string
  currentOrg: string; title: string; dept: string
  customerId: string | null; customerRegion: string; customerType: string; relationId: string | null
}

type CustomerOptionForm = { id: string; name: string; type: string | null }

interface LeadFormProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isPending: boolean
  isAdmin: boolean
  profiles: { id: string; name: string }[]
  persons: PersonOption[]
  customers: CustomerOptionForm[]
}

function LeadForm({ form, setForm, onSubmit, onCancel, isPending, isAdmin, profiles, persons, customers }: LeadFormProps) {
  const [personSearch, setPersonSearch] = useState(form.contact_name)
  const [showPersonDrop, setShowPersonDrop] = useState(false)
  const [localPersons, setLocalPersons] = useState<PersonOption[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [isAddingPerson, setIsAddingPerson] = useState(false)

  // 기관(고객사) 검색·추가 패턴 — 메모리 정책: 항상 "선택 + 직접 추가"
  const [customerSearch, setCustomerSearch] = useState(form.client_org)
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)
  const [localCustomers, setLocalCustomers] = useState<CustomerOptionForm[]>([])
  const [isAddingCustomer, setIsAddingCustomer] = useState(false)
  const allCustomers = [...customers, ...localCustomers]
  const matchingCustomers = allCustomers
    .filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase()))
    .slice(0, 6)
  const exactCustomerMatch = allCustomers.some(c => c.name === customerSearch.trim())

  async function handleAddCustomer() {
    if (!customerSearch.trim()) return
    setIsAddingCustomer(true)
    try {
      const { quickCreateCustomer } = await import('../customers/actions')
      const result = await quickCreateCustomer(customerSearch.trim())
      if ('error' in result) { alert('고객사 추가 실패: ' + result.error); return }
      const newCust: CustomerOptionForm = { id: result.id, name: customerSearch.trim(), type: '기타' }
      setLocalCustomers(prev => [...prev, newCust])
      setForm(f => ({ ...f, client_org: customerSearch.trim() }))
      setShowCustomerDrop(false)
    } finally {
      setIsAddingCustomer(false)
    }
  }

  const allPersons = [...persons, ...localPersons]
  const selectedPerson = form.person_id ? allPersons.find(p => p.id === form.person_id) : null
  const matchingPersons = allPersons
    .filter(p => !personSearch || p.name.includes(personSearch) || p.currentOrg.includes(personSearch))
    .slice(0, 6)

  function selectPerson(p: PersonOption) {
    setForm(f => ({
      ...f,
      person_id: p.id,
      contact_name: p.name,
      phone: f.phone || p.phone,
      email: f.email || p.email,
      client_org: f.client_org || p.currentOrg,
    }))
    setPersonSearch(p.name)
    setShowPersonDrop(false)
    setShowAddForm(false)
  }

  function clearPerson() {
    setForm(f => ({ ...f, person_id: '' }))
    setPersonSearch('')
    setShowAddForm(false)
  }

  async function handleAddPerson() {
    if (!personSearch.trim()) return
    setIsAddingPerson(true)
    try {
      const result = await createPerson({
        name: personSearch.trim(),
        phone: newPhone || undefined,
        email: newEmail || undefined,
        dept: newDept || undefined,
        title: newTitle || undefined,
        customer_name: form.client_org || undefined,
      })
      if ('error' in result) { alert('추가 실패: ' + result.error); return }
      const newP: PersonOption = {
        id: result.id, name: result.name, phone: result.phone, email: result.email,
        currentOrg: form.client_org || '', title: newTitle, dept: newDept,
        customerId: null, customerRegion: '', customerType: '', relationId: null,
      }
      setLocalPersons(prev => [...prev, newP])
      selectPerson(newP)
      setNewPhone(''); setNewEmail(''); setNewDept(''); setNewTitle('')
    } finally {
      setIsAddingPerson(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLS}>담당자 (고객 DB 연결)</label>
        {selectedPerson ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">
                  {selectedPerson.name}
                  {selectedPerson.title ? <span className="ml-1 text-xs text-gray-500">· {selectedPerson.title}</span> : ''}
                  {selectedPerson.dept ? <span className="ml-1 text-xs text-gray-400">({selectedPerson.dept})</span> : ''}
                </p>
                {selectedPerson.currentOrg && (
                  <p className="text-xs text-gray-600">
                    {selectedPerson.currentOrg}
                    {selectedPerson.customerRegion ? ` · ${selectedPerson.customerRegion}` : ''}
                    {selectedPerson.customerType ? ` [${selectedPerson.customerType}]` : ''}
                  </p>
                )}
                {(selectedPerson.phone || selectedPerson.email) && (
                  <p className="text-xs text-gray-400">
                    {selectedPerson.phone}{selectedPerson.phone && selectedPerson.email ? ' · ' : ''}{selectedPerson.email}
                  </p>
                )}
              </div>
              <button type="button" onClick={clearPerson} className="text-xs text-gray-400 hover:text-red-400 ml-2 mt-0.5">✕</button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              value={personSearch}
              onChange={e => { setPersonSearch(e.target.value); setShowPersonDrop(true); setShowAddForm(false); setForm(f => ({ ...f, contact_name: e.target.value, person_id: '' })) }}
              onFocus={() => setShowPersonDrop(true)}
              onBlur={() => setTimeout(() => setShowPersonDrop(false), 150)}
              placeholder="이름으로 검색하거나 직접 입력..."
              className={INPUT_CLS}
            />
            {showPersonDrop && (
              <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                {matchingPersons.map(p => (
                  <button key={p.id} type="button" onMouseDown={() => selectPerson(p)}
                    className="w-full px-3 py-2 text-left hover:bg-yellow-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">
                      {p.name}
                      {p.title ? <span className="text-gray-400 font-normal"> · {p.title}</span> : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.currentOrg || '소속 없음'}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </p>
                  </button>
                ))}
                {personSearch.trim() && (
                  <button type="button" onMouseDown={() => { setShowAddForm(true); setShowPersonDrop(false) }}
                    className="w-full px-3 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 font-medium border-t border-gray-100">
                    + &quot;{personSearch.trim()}&quot; 새 담당자로 추가
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {showAddForm && !selectedPerson && (
          <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-blue-50 space-y-2">
            <p className="text-xs font-semibold text-blue-700">새 담당자 추가 — {personSearch.trim()}</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="부서 (수의계약 한도용)" className={INPUT_CLS + ' text-xs'} />
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="직급" className={INPUT_CLS + ' text-xs'} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="휴대폰 (선택)" className={INPUT_CLS + ' text-xs'} />
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="이메일 (선택)" className={INPUT_CLS + ' text-xs'} />
            </div>
            {form.client_org && (
              <p className="text-[11px] text-gray-500">기관: <b>{form.client_org}</b> 와 자동 연결됩니다</p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleAddPerson} disabled={isAddingPerson}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {isAddingPerson ? '추가 중...' : '추가하기'}
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">취소</button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL_CLS}>프로젝트명</label>
        <input className={INPUT_CLS} value={form.project_name} onChange={e => setForm(f => ({ ...f, project_name: e.target.value }))}
          placeholder="예: 2026 용인중학교 악기렌탈" />
        <p className="text-xs text-gray-400 mt-1">입력 시 목록·드롭박스 폴더명으로 사용됩니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>기관명</label>
          <div className="relative">
            <input
              className={INPUT_CLS}
              value={customerSearch}
              onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true); setForm(f => ({ ...f, client_org: e.target.value })) }}
              onFocus={() => setShowCustomerDrop(true)}
              onBlur={() => setTimeout(() => setShowCustomerDrop(false), 150)}
              placeholder="기관 검색하거나 직접 입력..."
            />
            {showCustomerDrop && (matchingCustomers.length > 0 || (customerSearch.trim() && !exactCustomerMatch)) && (
              <div className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                {matchingCustomers.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={() => { setForm(f => ({ ...f, client_org: c.name })); setCustomerSearch(c.name); setShowCustomerDrop(false) }}
                    className="w-full px-3 py-2 text-left hover:bg-yellow-50 border-b border-gray-50 last:border-0">
                    <p className="text-sm font-medium text-gray-800">
                      {c.name}
                      {c.type ? <span className="text-gray-400 font-normal"> · {c.type}</span> : ''}
                    </p>
                  </button>
                ))}
                {customerSearch.trim() && !exactCustomerMatch && (
                  <button type="button" onMouseDown={handleAddCustomer} disabled={isAddingCustomer}
                    className="w-full px-3 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 font-medium border-t border-gray-100 disabled:opacity-50">
                    {isAddingCustomer ? '추가 중...' : `+ "${customerSearch.trim()}" 새 기관으로 추가`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className={LABEL_CLS}>담당자명</label>
          {selectedPerson ? (
            <div className={INPUT_CLS + ' bg-gray-50 text-gray-500 cursor-default text-sm'}>
              {selectedPerson.name}{selectedPerson.title ? ` · ${selectedPerson.title}` : ''}
              <span className="ml-2 text-xs text-blue-400">DB 연결됨</span>
            </div>
          ) : (
            <input className={INPUT_CLS} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLS}>휴대폰</label>
          {selectedPerson ? (
            <div className={INPUT_CLS + ' bg-gray-50 text-gray-500 cursor-default text-sm'}>
              {selectedPerson.phone || '미등록'}<span className="ml-2 text-xs text-blue-400">DB 연결됨</span>
            </div>
          ) : (
            <input className={INPUT_CLS} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          )}
        </div>
        <div>
          <label className={LABEL_CLS}>사무실 번호</label>
          <input className={INPUT_CLS} value={form.office_phone} onChange={e => setForm(f => ({ ...f, office_phone: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className={LABEL_CLS}>이메일</label>
        {selectedPerson ? (
          <div className={INPUT_CLS + ' bg-gray-50 text-gray-500 cursor-default text-sm'}>
            {selectedPerson.email || '미등록'}<span className="ml-2 text-xs text-blue-400">DB 연결됨</span>
          </div>
        ) : (
          <input className={INPUT_CLS} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        )}
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
        <div><label className={LABEL_CLS}>담당자 (직원)</label>
          <select className={INPUT_CLS} value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}>
            <option value="">미지정</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
      )}
      <div><label className={LABEL_CLS}>최초 유입 내용</label>
        <textarea className={INPUT_CLS} rows={2} value={form.initial_content} onChange={e => setForm(f => ({ ...f, initial_content: e.target.value }))} /></div>
      <div><label className={LABEL_CLS}>메모 / 요약</label>
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

// ── Types ────────────────────────────────────────────────────────
type FormState = {
  person_id: string; inflow_date: string; remind_date: string; service_type: string
  project_name: string; contact_name: string; client_org: string; phone: string
  office_phone: string; email: string; initial_content: string
  assignee_id: string; status: LeadStatus; channel: string
  inflow_source: string; notes: string
}

const SERVICE_TYPES = [
  'SOS', '교육프로그램', '납품설치', '유지보수', '교구대여', '제작인쇄',
  '콘텐츠제작', '행사운영', '행사대여', '프로젝트', '002ENT',
]

// 한국어 조사: 받침 있으면 '으로', 없거나 ㄹ 받침이면 '로'
const LOG_TYPE_PARTICLE: Record<string, string> = {
  방문: '으로', 미팅: '으로', 출장: '으로',
}

interface LeadLog {
  id: string; content: string; log_type: string
  contacted_at: string | null; created_at: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  author: any
}

// ── Status / Service visual config ───────────────────────────────
const STATUS_CFG: Record<string, { dot: string; badge: string }> = {
  '유입':    { dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700' },
  '회신대기': { dot: 'bg-yellow-400',  badge: 'bg-yellow-100 text-yellow-700' },
  '견적발송': { dot: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  '조율중':   { dot: 'bg-purple-400',  badge: 'bg-purple-100 text-purple-700' },
  '진행중':   { dot: 'bg-green-400',   badge: 'bg-green-100 text-green-700' },
  '완료':    { dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  '취소':    { dot: 'bg-red-300',     badge: 'bg-red-100 text-red-400' },
}

const SVC_CLR: Record<string, string> = {
  'SOS':        'text-yellow-700 bg-yellow-50 border-yellow-200',
  '교육프로그램': 'text-blue-700 bg-blue-50 border-blue-200',
  '납품설치':    'text-indigo-700 bg-indigo-50 border-indigo-200',
  '유지보수':    'text-teal-700 bg-teal-50 border-teal-200',
  '교구대여':    'text-cyan-700 bg-cyan-50 border-cyan-200',
  '제작인쇄':    'text-pink-700 bg-pink-50 border-pink-200',
  '콘텐츠제작':  'text-purple-700 bg-purple-50 border-purple-200',
  '행사운영':    'text-orange-700 bg-orange-50 border-orange-200',
  '행사대여':    'text-amber-700 bg-amber-50 border-amber-200',
  '프로젝트':    'text-violet-700 bg-violet-50 border-violet-200',
  '002ENT':     'text-rose-700 bg-rose-50 border-rose-200',
}

const STATUS_CLR: Record<string, string> = {
  '활성':    '#374151',
  '전체':    '#6B7280',
  '유입':    '#3B82F6',
  '회신대기': '#F59E0B',
  '견적발송': '#F97316',
  '조율중':   '#8B5CF6',
  '진행중':   '#10B981',
  '완료':    '#059669',
  '취소':    '#EF4444',
}

// ── Utility ──────────────────────────────────────────────────────
function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function getDdayNum(remindDate: string | null | undefined): number | null {
  if (!remindDate) return null
  return daysFromToday(remindDate)
}

function getDdayBadge(remindDate: string | null | undefined): { label: string; color: string } | null {
  if (!remindDate) return null
  const diff = daysFromToday(remindDate)
  if (diff < 0)   return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-700 font-bold' }
  if (diff === 0) return { label: 'D-day',    color: 'bg-red-500 text-white font-bold' }
  if (diff <= 3)  return { label: `D-${diff}`, color: 'bg-orange-100 text-orange-700 font-semibold' }
  if (diff <= 7)  return { label: `D-${diff}`, color: 'bg-yellow-100 text-yellow-700' }
  return { label: `D-${diff}`, color: 'bg-gray-100 text-gray-400' }
}

function sortByDday(a: Lead, b: Lead): number {
  const da = a.remind_date && !['완료', '취소'].includes(a.status) ? daysFromToday(a.remind_date) : 9999
  const db = b.remind_date && !['완료', '취소'].includes(b.status) ? daysFromToday(b.remind_date) : 9999
  return da - db
}

// ── LogItem component ─────────────────────────────────────────────
function LogItem({ log, isAdmin, onDelete }: { log: LeadLog; isAdmin: boolean; onDelete: () => void }) {
  const long = log.content.length > 100
  const [exp, setExp] = useState(!long)
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" />
        <div className="w-px flex-1 bg-gray-100 my-1.5 min-h-[16px]" />
      </div>
      <div className="pb-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${LOG_TYPE_COLORS[log.log_type] ?? 'bg-gray-100 text-gray-500'}`}>{log.log_type}</span>
          <span className="text-xs text-gray-400">
            {new Date(log.contacted_at || log.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-gray-400">{log.author?.name ?? '-'}</span>
          {isAdmin && (
            <button onClick={onDelete} className="ml-auto text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">삭제</button>
          )}
        </div>
        <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${!exp ? 'line-clamp-2' : ''}`}>{log.content}</p>
        {long && (
          <button onClick={() => setExp(v => !v)} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
            {exp ? '▲ 접기' : '▼ 전체 보기'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Props / EMPTY_FORM ────────────────────────────────────────────
interface CustomerOption { id: string; name: string; type: string | null }

interface Props {
  leads: Lead[]
  profiles: { id: string; name: string }[]
  persons: PersonOption[]
  customers: CustomerOption[]
  currentUserId: string
  isAdmin: boolean
  initialClientOrg?: string
}

const EMPTY_FORM: FormState = {
  person_id: '', inflow_date: new Date().toISOString().slice(0, 10),
  remind_date: '', service_type: '', project_name: '', contact_name: '', client_org: '',
  phone: '', office_phone: '', email: '', initial_content: '',
  assignee_id: '', status: '유입', channel: '', inflow_source: '', notes: '',
}

// ── Main Component ────────────────────────────────────────────────
export default function LeadsClient({ leads, profiles, persons, customers, currentUserId, isAdmin, initialClientOrg }: Props) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('활성')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(!!initialClientOrg)
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialClientOrg ? { client_org: initialClientOrg } : {}) })
  const [isPending, startTransition] = useTransition()
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertPreviewNum, setConvertPreviewNum] = useState('')
  const [convertDone, setConvertDone] = useState(false)
  const [convertResult, setConvertResult] = useState<{ sale_id: string; project_id: string | null; project_number: string } | null>(null)

  // Tab / inline editing
  const [tab, setTab] = useState<'main' | 'customer' | 'edit'>('main')
  const [inlineEdit, setInlineEdit] = useState<'status' | 'service' | 'remind' | null>(null)
  const [quickServiceLeadId, setQuickServiceLeadId] = useState<string | null>(null)

  // Title inline edit
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')

  // Dropbox
  const [dropboxInput, setDropboxInput] = useState('')
  const [showDropboxInput, setShowDropboxInput] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [dropboxSyncing, setDropboxSyncing] = useState(false)
  const [dropboxSyncDone, setDropboxSyncDone] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)

  // Calendar
  const [localLinkedEvents, setLocalLinkedEvents] = useState<{ id: string; calendarKey: string; title: string; date: string; color: string }[]>([])
  const [showCalCreate, setShowCalCreate] = useState(false)
  const [calCreateKey, setCalCreateKey] = useState('main')
  const [calCreateTitle, setCalCreateTitle] = useState('')
  const [calCreateDate, setCalCreateDate] = useState('')
  const [calCreateStart, setCalCreateStart] = useState('')
  const [calCreateEnd, setCalCreateEnd] = useState('')
  const [calCreateAllDay, setCalCreateAllDay] = useState(false)
  const [calCreateDesc, setCalCreateDesc] = useState('')
  const [calCreateLoading, setCalCreateLoading] = useState(false)

  // Add sale form
  const [showAddSaleForm, setShowAddSaleForm] = useState(false)
  const [addSaleForm, setAddSaleForm] = useState({ name: '', service_type: '', revenue: '', memo: '' })
  const [addingSale, setAddingSale] = useState(false)

  // Quote modal
  type QuoteItem = { category: string; name: string; detail: string; qty: number; months: number; unit: string; price: number }
  const EMPTY_QUOTE_ITEM: QuoteItem = { category: '', name: '', detail: '', qty: 1, months: 1, unit: '식', price: 0 }
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [quoteType, setQuoteType] = useState<'렌탈' | '002크리에이티브'>('렌탈')
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10))
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([{ ...EMPTY_QUOTE_ITEM }])
  const [generatingQuote, setGeneratingQuote] = useState(false)
  const [generatedQuoteUrl, setGeneratedQuoteUrl] = useState<string | null>(null)
  const [draftingQuote, setDraftingQuote] = useState(false)

  // Log state
  const [leadLogs, setLeadLogs] = useState<LeadLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [leadSummary, setLeadSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(true)
  const [newLeadLog, setNewLeadLog] = useState('')
  const [newLeadLogType, setNewLeadLogType] = useState('통화')
  const [leadLogShowDetails, setLeadLogShowDetails] = useState(false)
  const [leadLogLocation, setLeadLogLocation] = useState('')
  const [leadLogParticipants, setLeadLogParticipants] = useState('')
  const [leadLogOutcome, setLeadLogOutcome] = useState('')
  const [leadLogContactedAt, setLeadLogContactedAt] = useState(() => {
    const d = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [leadLogError, setLeadLogError] = useState<string | null>(null)

  // Person editing
  const [editingPerson, setEditingPerson] = useState(false)
  const [personEditForm, setPersonEditForm] = useState({ name: '', phone: '', email: '', title: '', dept: '', orgName: '', orgRegion: '', orgType: '' })
  const [savingPerson, setSavingPerson] = useState(false)
  const [showPersonLink, setShowPersonLink] = useState(false)
  const [personLinkSearch, setPersonLinkSearch] = useState('')
  const [contactDraft, setContactDraft] = useState<{ contact_name: string; phone: string; office_phone: string; email: string; client_org: string } | null>(null)
  const [savingContact, setSavingContact] = useState(false)

  // ── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLead) return
    const updated = leads.find(l => l.id === selectedLead.id)
    if (updated) setSelectedLead(updated)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads])

  useEffect(() => {
    if (selectedLead && !selectedLead.person) {
      setContactDraft({
        contact_name: selectedLead.contact_name || '',
        phone: selectedLead.phone || '',
        office_phone: selectedLead.office_phone || '',
        email: selectedLead.email || '',
        client_org: selectedLead.client_org || '',
      })
    } else {
      setContactDraft(null)
    }
  }, [selectedLead?.id, selectedLead?.person])

  const refreshLeadLogs = useCallback(async (leadId: string) => {
    setLoadingLogs(true)
    const logs = await getLeadLogs(leadId)
    setLeadLogs(logs as unknown as LeadLog[])
    setLoadingLogs(false)
  }, [])

  useEffect(() => {
    if (!selectedLead) return
    const nonInitial = leadLogs.filter(l => l.log_type !== '최초유입')
    if (nonInitial.length === 0) { setLeadSummary(null); return }
    let cancelled = false
    setLoadingSummary(true)
    fetch('/api/lead-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initial_content: selectedLead.initial_content ?? null,
        logs: nonInitial.map(l => ({ content: l.content, log_type: l.log_type, contacted_at: l.contacted_at })),
      }),
    })
      .then(r => r.json())
      .then(d => { if (!cancelled) setLeadSummary(d.summary ?? null) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSummary(false) })
    return () => { cancelled = true }
  }, [leadLogs, selectedLead?.id])

  useEffect(() => {
    if (!selectedLead) { setLeadLogs([]); setLeadSummary(null); setLogsCollapsed(true); return }
    refreshLeadLogs(selectedLead.id)
    setShowAddSaleForm(false)
    setShowDropboxInput(false)
    setDropboxInput('')
    setInlineEdit(null)
    setEditingTitle(false)
    setEditingPerson(false)
    setShowPersonLink(false)
    setPersonLinkSearch('')
    setLeadSummary(null)
    setLogsCollapsed(true)
    setTab('main')
    setDropboxSyncDone(false)
    setLocalLinkedEvents(selectedLead?.linked_calendar_events ?? [])
    setShowCalCreate(false)
  }, [selectedLead?.id])

  // ── Filtered list ────────────────────────────────────────────────
  const filtered = leads
    .filter(l => {
      const matchStatus = statusFilter === '전체' || (statusFilter === '활성' ? !['완료', '취소'].includes(l.status) : l.status === statusFilter)
      const matchSearch = !searchTerm || [l.project_name, l.client_org, l.contact_name, l.lead_id]
        .some(v => v?.toLowerCase().includes(searchTerm.toLowerCase()))
      return matchStatus && matchSearch
    })
    .sort(sortByDday)

  const activeCount = leads.filter(l => !['완료', '취소'].includes(l.status)).length
  const remindCount = leads.filter(l => {
    const d = getDdayNum(l.remind_date)
    return d !== null && d <= 3 && !['완료', '취소'].includes(l.status)
  }).length

  // ── Handlers ─────────────────────────────────────────────────────
  function openCreate() {
    setForm({ ...EMPTY_FORM, assignee_id: currentUserId })
    setShowCreateModal(true)
  }

  function openEditTab(lead: Lead) {
    setForm({
      person_id: lead.person_id || '',
      inflow_date: lead.inflow_date || '', remind_date: lead.remind_date || '',
      service_type: lead.service_type || '', project_name: lead.project_name || '',
      contact_name: lead.contact_name || '', client_org: lead.client_org || '',
      phone: lead.phone || '', office_phone: lead.office_phone || '', email: lead.email || '',
      initial_content: lead.initial_content || '', assignee_id: lead.assignee_id || '',
      status: (lead.status || '유입') as LeadStatus, channel: lead.channel || '',
      inflow_source: lead.inflow_source || '', notes: lead.notes || '',
    })
    setShowEditModal(true)
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
        service_type: form.service_type || null, project_name: form.project_name || null,
        contact_name: form.contact_name || null, client_org: form.client_org || null,
        phone: form.phone || null, office_phone: form.office_phone || null,
        email: form.email || null, initial_content: form.initial_content || null,
        assignee_id: form.assignee_id || null, status: form.status,
        channel: form.channel || null, inflow_source: form.inflow_source || null,
        notes: form.notes || null,
      })
      setTab('main')
    })
  }

  async function handleSavePersonAndCustomer() {
    if (!selectedLead?.person) return
    setSavingPerson(true)
    const result = await updateLeadPersonAndCustomer(
      selectedLead.id,
      selectedLead.person.id,
      { name: personEditForm.name, phone: personEditForm.phone || null, email: personEditForm.email || null },
      selectedLead.person.customerId,
      { name: personEditForm.orgName, region: personEditForm.orgRegion || null, type: personEditForm.orgType || null },
      { id: selectedLead.person.relationId, title: personEditForm.title || null, dept: personEditForm.dept || null }
    )
    setSavingPerson(false)
    if (result?.error) alert('저장 실패: ' + result.error)
    else setEditingPerson(false)
  }

  function handleDelete(id: string) {
    if (!confirm('이 리드를 영구 삭제할까요?\n고객 DB(거래처 탭)의 연락처는 유지됩니다.')) return
    startTransition(() => deleteLead(id))
    setSelectedLead(null)
  }

  async function openConvertModal() {
    const num = await previewProjectNumber()
    setConvertPreviewNum(num)
    setConvertDone(false)
    setConvertResult(null)
    setShowConvertModal(true)
  }

  async function handleConvert(leadId: string) {
    setConvertingId(leadId)
    const result = await convertLeadToSale(leadId)
    setConvertingId(null)
    if ('error' in result) {
      alert('전환 실패: ' + result.error)
      setShowConvertModal(false)
    } else {
      setConvertResult({ sale_id: result.sale_id, project_id: result.project_id ?? null, project_number: result.project_number })
      setConvertDone(true)
    }
  }

  async function handleCreateLeadFolder(leadId: string) {
    setCreatingFolder(true)
    const result = await createLeadFolder(leadId)
    setCreatingFolder(false)
    if (result.error) { alert('폴더 생성 실패: ' + result.error); return }
    if (result.url) {
      setSelectedLead(prev => prev ? { ...prev, dropbox_url: result.url } : prev)
      router.refresh()
    }
  }

  async function handleSaveDropboxUrl(leadId: string) {
    if (!dropboxInput.trim()) return
    const newUrl = dropboxInput.trim()
    const r = await updateLeadDropboxUrl(leadId, newUrl)
    if (r.error) {
      alert(`Dropbox URL 저장 실패: ${r.error}`)
      return
    }
    setSelectedLead(prev => prev ? { ...prev, dropbox_url: newUrl } : prev)
    setDropboxInput('')
    setShowDropboxInput(false)
    router.refresh()
  }

  async function handleSyncDropboxUrl() {
    if (!selectedLead?.dropbox_url || !selectedLead.project_name) return
    setDropboxSyncing(true)
    const result = await syncLeadDropboxFolderName(
      selectedLead.id,
      selectedLead.dropbox_url,
      selectedLead.project_name,
    )
    setDropboxSyncing(false)
    if ('error' in result) {
      const isDeleted = result.error.includes('deleted') || result.error.includes('삭제')
      if (isDeleted) {
        alert('드롭박스에서 폴더를 찾을 수 없어요.\n폴더가 이동되었거나 삭제된 것 같아요.\n아래 URL 입력창에 현재 폴더 URL을 다시 입력해주세요.')
      } else {
        alert('드롭박스 폴더 이름 변경 실패: ' + result.error)
      }
      return
    }
    setSelectedLead(prev => prev ? { ...prev, dropbox_url: result.newUrl } : prev)
    router.refresh()
    setDropboxSyncDone(true)
    setTimeout(() => setDropboxSyncDone(false), 2000)
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
    else { setShowAddSaleForm(false); setAddSaleForm({ name: '', service_type: '', revenue: '', memo: '' }) }
  }

  function handleAddLeadLog(type: string) {
    if (!newLeadLog.trim() || !selectedLead) return
    setNewLeadLogType(type)
    setLeadLogError(null)
    const participants = leadLogParticipants.trim()
      ? leadLogParticipants.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    startTransition(async () => {
      try {
        await createLeadLog(
          selectedLead.id, newLeadLog, type,
          leadLogContactedAt ? new Date(leadLogContactedAt).toISOString() : undefined,
          leadLogShowDetails ? leadLogLocation.trim() || undefined : undefined,
          leadLogShowDetails ? participants : undefined,
          leadLogShowDetails ? leadLogOutcome.trim() || undefined : undefined,
        )
        setNewLeadLog('')
        setLeadLogLocation(''); setLeadLogParticipants(''); setLeadLogOutcome('')
        setLeadLogShowDetails(false)
        const now = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
        setLeadLogContactedAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)
        await refreshLeadLogs(selectedLead.id)
      } catch (e: unknown) {
        setLeadLogError('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
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
        setQuoteItems(result.items.map((it: QuoteItem) => ({
          category: it.category ?? '', name: it.name ?? '', detail: it.detail ?? '',
          qty: Number(it.qty) || 1, months: Number(it.months) || 1,
          unit: it.unit ?? '식', price: Number(it.price) || 0,
        })))
      } else { alert('초안 생성 실패: ' + (result.error ?? '알 수 없는 오류')) }
    } catch { alert('초안 생성 중 오류가 발생했습니다.') }
    finally { setDraftingQuote(false) }
  }

  async function handleGenerateQuote() {
    if (!selectedLead) return
    setGeneratingQuote(true); setGeneratedQuoteUrl(null)
    try {
      const res = await fetch('/api/quotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id, quoteType,
          clientName: selectedLead.project_name || selectedLead.client_org || '기관명 없음',
          issueDate: quoteDate, items: quoteItems.filter(i => i.name.trim()),
          contactPerson: selectedLead.contact_name,
        }),
      })
      const result = await res.json()
      if (result.url) { setGeneratedQuoteUrl(result.url) }
      else { alert('견적서 생성 실패: ' + (result.error ?? '알 수 없는 오류')) }
    } catch { alert('견적서 생성 중 오류가 발생했습니다.') }
    finally { setGeneratingQuote(false) }
  }

  // ── Render ───────────────────────────────────────────────────────

  const SERVICE_BOARD_LABEL: Record<string, string> = {
    '교구대여':    '📦 렌탈 관리판',
    'SOS':        '🎵 SOS 공연판',
    '교육프로그램': '📚 교육프로그램',
    '납품설치':    '🔧 납품설치',
    '콘텐츠제작':  '🎬 콘텐츠제작',
    '002ENT':     '🎤 002ENT',
    '행사운영':    '🎭 행사운영',
    '행사대여':    '🎪 행사대여',
    '제작인쇄':    '🖨 제작인쇄',
    '유지보수':    '🔩 유지보수',
    '프로젝트':    '📋 프로젝트',
  }

  return (
    <div>

      {/* ── 계약 전환 모달 ── */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-7 w-full max-w-[460px] shadow-2xl">
            {!convertDone ? (
              <>
                <h2 className="text-lg font-black text-gray-900 mb-1">계약 전환</h2>
                <p className="text-sm text-gray-400 mb-5">리드를 프로젝트로 전환합니다. 고유번호가 자동 부여됩니다.</p>
                {/* 고유번호 프리뷰 */}
                <div className="rounded-xl p-4 mb-5 border" style={{ background: '#FFFDE7', borderColor: '#FFCE00' }}>
                  <p className="text-xs text-gray-400 mb-1">자동 부여될 고유번호</p>
                  <p className="text-3xl font-black text-gray-900 leading-none">{convertPreviewNum}</p>
                  <p className="text-xs text-gray-500 mt-1.5">프로젝트명, 드롭박스 폴더명에 자동 적용됩니다</p>
                </div>
                {/* 리드 정보 */}
                {[
                  ['리드명', selectedLead.project_name || selectedLead.client_org || '(없음)'],
                  ['고객', selectedLead.client_org || '—'],
                  ['서비스', selectedLead.service_type || '—'],
                  ['담당자', (selectedLead.assignee as { name?: string })?.name || '—'],
                  ['이동될 서비스 보드', SERVICE_BOARD_LABEL[selectedLead.service_type ?? ''] ?? '📋 프로젝트 목록'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2.5 border-b border-gray-100 text-sm last:border-0">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-semibold text-gray-900">{v}</span>
                  </div>
                ))}
                <div className="flex gap-2.5 mt-5">
                  <button onClick={() => setShowConvertModal(false)}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors">
                    취소
                  </button>
                  <button
                    onClick={() => handleConvert(selectedLead.id)}
                    disabled={!!convertingId}
                    className="flex-[2] py-2.5 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    {convertingId ? '전환 중...' : '전환 확정'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-black text-gray-900 mb-2">계약 전환 완료!</h2>
                <p className="text-3xl font-black text-gray-900 mb-3">{convertResult?.project_number}</p>
                <p className="text-sm text-gray-500 mb-6">
                  드롭박스 폴더명이 고유번호로 업데이트되었습니다.<br />
                  서비스 보드에 자동으로 추가됐습니다.
                </p>
                <button
                  onClick={() => {
                    setShowConvertModal(false)
                    setConvertDone(false)
                    if (convertResult?.project_id) router.push(`/projects/${convertResult.project_id}`)
                    else if (convertResult?.sale_id) router.push(`/sales/${convertResult.sale_id}`)
                  }}
                  className="w-full py-3 rounded-xl text-sm font-black transition-colors"
                  style={{ backgroundColor: '#121212', color: '#FFCE00' }}>
                  프로젝트로 이동 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 스플릿 뷰 */}
      <div className="flex gap-3 md:h-[calc(100vh-130px)] min-h-[520px]">

        {/* ── 왼쪽 카드 목록 ── */}
        {quickServiceLeadId && <div className="fixed inset-0 z-20" onClick={() => setQuickServiceLeadId(null)} />}
        <div className={`${selectedLead ? 'hidden md:flex' : 'flex'} md:w-[360px] flex-shrink-0 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden`}>
          {/* 헤더 */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900">
                리드 관리
                {remindCount > 0 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-bold">{remindCount}</span>
                )}
              </h2>
              <button onClick={openCreate}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                + 등록
              </button>
            </div>
            <input type="text" placeholder="이름, 기관, 프로젝트 검색..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-300" />
          </div>
          {/* 상태 필터 */}
          <div className="px-3 py-2.5 border-b border-gray-100 flex gap-1.5 overflow-x-auto flex-shrink-0 scrollbar-none">
            {(['활성', '전체', ...LEAD_STATUSES] as string[]).map(s => {
              const count = s === '전체' ? leads.length
                : s === '활성' ? leads.filter(l => !['완료', '취소'].includes(l.status)).length
                : leads.filter(l => l.status === s).length
              const clr = STATUS_CLR[s] ?? '#6B7280'
              const isActive = statusFilter === s
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-all border"
                  style={isActive
                    ? { backgroundColor: clr, color: '#fff', borderColor: clr }
                    : { backgroundColor: 'transparent', color: clr, borderColor: clr + '60' }
                  }>
                  {s} <span className="opacity-70">({count})</span>
                </button>
              )
            })}
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full py-16">
                <p className="text-sm text-gray-400">
                  {leads.length === 0 ? '등록된 리드가 없습니다.' : '검색 결과가 없습니다.'}
                </p>
              </div>
            ) : filtered.map(lead => {
              const cfg = STATUS_CFG[lead.status] || STATUS_CFG['유입']
              const dday = getDdayNum(lead.remind_date)
              const isSelected = selectedLead?.id === lead.id

              return (
                <button key={lead.id}
                  onClick={() => { setSelectedLead(isSelected ? null : lead); setBriefError(null) }}
                  className={`w-full text-left px-3 py-2.5 transition-all border-l-2 ${
                    isSelected ? 'bg-yellow-50 border-yellow-400' : 'border-transparent hover:bg-gray-50'
                  }`}>
                  {/* Row 1: D-day pill + status pill + assignee */}
                  <div className="flex items-center gap-1.5 mb-1">
                    {dday !== null && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0"
                        style={dday === 0
                          ? { background: '#EF4444', color: '#fff' }
                          : dday < 0
                          ? { background: '#FEE2E2', color: '#DC2626' }
                          : dday <= 3
                          ? { background: '#FFEDD5', color: '#EA580C' }
                          : dday <= 7
                          ? { background: '#FEF9C3', color: '#CA8A04' }
                          : { background: '#F3F4F6', color: '#6B7280' }
                        }>
                        {dday === 0 ? 'D-DAY' : dday < 0 ? `D+${Math.abs(dday)}` : `D-${dday}`}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">
                      {(lead.assignee as { name?: string })?.name || '—'}
                    </span>
                  </div>
                  {/* Row 2: project name */}
                  <p className="text-sm font-semibold text-gray-900 truncate leading-snug">
                    {lead.project_name || lead.client_org || '(프로젝트명 없음)'}
                  </p>
                  {/* Row 3: client org + service badge */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-gray-400 truncate flex-1">
                      {lead.client_org || lead.contact_name || '—'}
                    </span>
                    {/* 서비스 배지 */}
                    <div className="relative flex-shrink-0">
                      <span
                        onClick={e => { e.stopPropagation(); setSelectedLead(lead); setQuickServiceLeadId(lead.id === quickServiceLeadId ? null : lead.id) }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium cursor-pointer hover:opacity-70 transition-opacity ${
                          lead.service_type ? (SVC_CLR[lead.service_type] || 'text-gray-400 bg-gray-50 border-gray-200') : 'text-gray-300 bg-white border-dashed border-gray-300'
                        }`}>
                        {lead.service_type || '서비스?'}
                      </span>
                      {quickServiceLeadId === lead.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden min-w-[110px]">
                          {SERVICE_TYPES.map(s => (
                            <button key={s} type="button" onClick={e => {
                              e.stopPropagation()
                              startTransition(async () => {
                                await updateLead(lead.id, { service_type: s })
                                if (selectedLead?.id === lead.id) {
                                  setSelectedLead(prev => prev ? { ...prev, service_type: s } : prev)
                                }
                              })
                              setQuickServiceLeadId(null)
                            }} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${s === lead.service_type ? 'bg-gray-50 font-bold text-gray-900' : 'text-gray-600'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── 오른쪽 상세 패널 ── */}
        <div className={`${selectedLead ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden`}>
          {!selectedLead ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">👈</span>
              <p className="text-sm">왼쪽에서 리드를 선택하세요</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1 bg-gray-50">
              <div className="p-5 space-y-4">

                {/* 모바일 뒤로가기 */}
                <button onClick={() => setSelectedLead(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                  ← 목록으로
                </button>

                {/* ── 헤더 카드 ── */}
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {/* 인라인 배지 행 */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">

                        {/* D-day → 클릭 시 날짜 선택 */}
                        <div className="relative">
                          <button
                            onClick={() => setInlineEdit(inlineEdit === 'remind' ? null : 'remind')}
                            title="리마인드 날짜 수정"
                            className="transition-opacity hover:opacity-70">
                            {(() => {
                              const d = getDdayBadge(selectedLead.remind_date)
                              return d
                                ? <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${d.color}`}>{d.label}</span>
                                : <span className="text-xs text-gray-300 border border-dashed border-gray-200 px-2 py-1 rounded-lg">D-day 없음</span>
                            })()}
                          </button>
                          {inlineEdit === 'remind' && (
                            <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                              <p className="text-xs text-gray-500 mb-2 font-medium">리마인드 날짜</p>
                              <input type="date" className={INPUT_CLS}
                                defaultValue={selectedLead.remind_date || ''}
                                onChange={e => {
                                  startTransition(async () => {
                                    await updateLead(selectedLead.id, { remind_date: e.target.value || null })
                                  })
                                  setInlineEdit(null)
                                }} />
                              {selectedLead.remind_date && (
                                <button onClick={() => {
                                  startTransition(async () => {
                                    await updateLead(selectedLead.id, { remind_date: null })
                                  })
                                  setInlineEdit(null)
                                }} className="mt-2 w-full text-xs text-red-400 hover:text-red-600">삭제</button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 상태 → 클릭 시 드롭다운 */}
                        <div className="relative">
                          <button
                            onClick={() => setInlineEdit(inlineEdit === 'status' ? null : 'status')}
                            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-opacity hover:opacity-70 ${STATUS_CFG[selectedLead.status]?.badge || 'bg-gray-100 text-gray-500'}`}>
                            {selectedLead.status} ▾
                          </button>
                          {inlineEdit === 'status' && (
                            <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[110px]">
                              {LEAD_STATUSES.map(s => (
                                <button key={s} onClick={() => {
                                  startTransition(async () => { await updateLead(selectedLead.id, { status: s }) })
                                  setInlineEdit(null)
                                }} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${s === selectedLead.status ? 'bg-gray-50 font-semibold' : ''}`}>
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CFG[s]?.dot || 'bg-gray-400'}`} />
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 서비스 → 클릭 시 드롭다운 */}
                        <div className="relative">
                          <button
                            onClick={() => setInlineEdit(inlineEdit === 'service' ? null : 'service')}
                            className={`text-xs px-2 py-1 rounded border font-medium transition-opacity hover:opacity-70 ${SVC_CLR[selectedLead.service_type || ''] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                            {selectedLead.service_type || '서비스 없음'} ▾
                          </button>
                          {inlineEdit === 'service' && (
                            <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[130px]">
                              {SERVICE_TYPES.map(s => (
                                <button key={s} onClick={() => {
                                  startTransition(async () => { await updateLead(selectedLead.id, { service_type: s }) })
                                  setInlineEdit(null)
                                }} className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${s === selectedLead.service_type ? 'bg-gray-50 font-bold' : ''}`}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedLead.converted_sale_id && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">매출건 전환완료</span>
                        )}

                        {/* 팝오버 닫기 오버레이 */}
                        {inlineEdit && (
                          <div className="fixed inset-0 z-10" onClick={() => setInlineEdit(null)} />
                        )}
                      </div>

                      {/* 타이틀 */}
                      <p className="text-xs text-gray-400 mb-1">{selectedLead.lead_id}</p>
                      {editingTitle ? (
                        <input
                          autoFocus
                          value={titleInput}
                          onChange={e => setTitleInput(e.target.value)}
                          onBlur={() => {
                            const trimmed = titleInput.trim()
                            if (trimmed && trimmed !== (selectedLead.project_name || selectedLead.client_org || '')) {
                              startTransition(async () => { await updateLead(selectedLead.id, { project_name: trimmed }) })
                            }
                            setEditingTitle(false)
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingTitle(false) }}
                          className="text-xl font-bold text-gray-900 border-b-2 border-yellow-400 bg-transparent focus:outline-none w-full leading-tight"
                        />
                      ) : (
                        <h2
                          className="text-xl font-bold text-gray-900 leading-tight cursor-pointer hover:text-yellow-700 group flex items-center gap-1"
                          onClick={() => { setTitleInput(selectedLead.project_name || selectedLead.client_org || ''); setEditingTitle(true) }}>
                          {selectedLead.project_name || selectedLead.client_org || '프로젝트명 없음'}
                          <span className="text-xs text-gray-300 opacity-0 group-hover:opacity-100 font-normal">✏️</span>
                        </h2>
                      )}
                      <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-4 flex-wrap">
                        {selectedLead.client_org && <span>🏢 {selectedLead.client_org}</span>}
                        {(selectedLead.assignee as { name?: string })?.name && <span>👤 {(selectedLead.assignee as { name?: string }).name}</span>}
                        {selectedLead.inflow_source && <span>유입: {selectedLead.inflow_source}</span>}
                      </p>
                    </div>

                    {/* 우상단: 드롭박스 + 계약전환 */}
                    <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                      {selectedLead.dropbox_url ? (
                        <div className="flex items-center gap-1">
                          <a href={selectedLead.dropbox_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-xl transition-colors">
                            <span>📁</span><span>드롭박스</span>
                          </a>
                          <button
                            title={selectedLead.project_name ? '폴더명을 현재 프로젝트명으로 동기화' : '프로젝트명이 없어 동기화 불가'}
                            onClick={handleSyncDropboxUrl}
                            disabled={dropboxSyncing || !selectedLead.project_name}
                            className={`p-1.5 rounded-lg border transition-all text-sm disabled:opacity-40 ${
                              dropboxSyncing ? 'border-gray-200 text-gray-400 animate-spin' :
                              dropboxSyncDone ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                              'border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600'
                            }`}>
                            {dropboxSyncDone ? '✓' : '🔄'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCreateLeadFolder(selectedLead.id)}
                          disabled={creatingFolder}
                          className="flex items-center gap-1.5 text-sm border border-dashed border-gray-300 hover:border-gray-400 text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50">
                          <span>📁</span>{creatingFolder ? '생성 중...' : '폴더 생성'}
                        </button>
                      )}
                      <button
                        onClick={openConvertModal}
                        disabled={convertingId === selectedLead.id}
                        className="text-sm font-semibold px-4 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {convertingId === selectedLead.id ? '전환 중...' : '계약 전환 →'}
                      </button>
                    </div>
                  </div>

                  {/* 액션 버튼 strip */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openEditTab(selectedLead)}
                      className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors">
                      수정하기
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setShowAddSaleForm(v => !v)}
                        className="text-xs px-3 py-1.5 border border-yellow-300 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors">
                        계약건 추가
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => { setShowQuoteModal(true); setGeneratedQuoteUrl(null); setQuoteItems([{ ...EMPTY_QUOTE_ITEM }]) }}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors">
                        견적서 생성
                      </button>
                    )}
                    {selectedLead.dropbox_url && (
                      <button
                        onClick={() => {
                          setBriefError(null)
                          startTransition(async () => {
                            const res = await refreshLeadBrief(selectedLead.id)
                            if (!res.ok) {
                              setBriefError(res.error ?? '알 수 없는 오류')
                              setShowDropboxInput(true)
                            }
                          })
                        }}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-40">
                        📄 Brief 갱신
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(selectedLead.id)}
                      className="text-xs px-3 py-1.5 text-red-400 hover:text-red-600 border border-red-100 rounded-lg hover:bg-red-50 transition-colors ml-auto">
                      삭제
                    </button>
                  </div>

                  {/* 드롭박스 연결 오류 안내 */}
                  {briefError && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 text-sm flex-shrink-0">⚠</span>
                        <div>
                          <p className="text-sm font-medium text-red-700">드롭박스 연결 오류</p>
                          <p className="text-xs text-red-500 mt-0.5">저장된 폴더 URL이 잘못됐거나 폴더가 이동·삭제된 것 같아요. 드롭박스에서 올바른 폴더를 찾아 URL을 다시 붙여넣거나, 새 폴더를 만드세요.</p>
                        </div>
                        <button onClick={() => setBriefError(null)} className="ml-auto text-red-300 hover:text-red-500 text-xs flex-shrink-0">✕</button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={dropboxInput}
                          onChange={e => setDropboxInput(e.target.value)}
                          placeholder="https://www.dropbox.com/home/... (정확한 URL 붙여넣기)"
                          className="flex-1 text-xs border border-red-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
                        <button
                          onClick={async () => {
                            await handleSaveDropboxUrl(selectedLead.id)
                            setBriefError(null)
                          }}
                          disabled={!dropboxInput.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
                          style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                      </div>
                      {!selectedLead.dropbox_url && (
                        <button
                          onClick={() => { handleCreateLeadFolder(selectedLead.id); setBriefError(null) }}
                          disabled={creatingFolder}
                          className="text-xs text-gray-500 hover:text-gray-700 underline disabled:opacity-40">
                          {creatingFolder ? '생성 중...' : '또는 새 드롭박스 폴더 자동 생성'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 기본 정보 2열 카드 ── */}
                <div className="grid grid-cols-2 gap-4">

                  {/* 담당자 카드 */}
                  <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">담당자</p>
                      {!editingPerson && (
                        <button
                          onClick={() => {
                            if (selectedLead.person) {
                              setPersonEditForm({
                                name: selectedLead.person.name,
                                phone: selectedLead.person.phone || '',
                                email: selectedLead.person.email || '',
                                title: selectedLead.person.title || '',
                                dept: selectedLead.person.dept || '',
                                orgName: selectedLead.person.currentOrg,
                                orgRegion: selectedLead.person.customerRegion,
                                orgType: selectedLead.person.customerType,
                              })
                            }
                            setEditingPerson(true)
                          }}
                          className="text-xs text-gray-400 hover:text-blue-600 border border-gray-200 rounded px-2 py-0.5 hover:border-blue-300 transition-colors">
                          편집
                        </button>
                      )}
                    </div>

                    {/* 고객DB 연결된 담당자 편집 */}
                    {editingPerson && selectedLead.person ? (
                      <div className="border border-blue-200 rounded-xl p-3 space-y-2 bg-blue-50">
                        <p className="text-xs font-semibold text-blue-700">담당자 정보 수정</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { label: '이름', field: 'name', col: 1 },
                            { label: '휴대폰', field: 'phone', col: 1 },
                            { label: '이메일', field: 'email', col: 2, type: 'email' },
                            { label: '직급', field: 'title', col: 1 },
                            { label: '부서', field: 'dept', col: 1 },
                          ] as { label: string; field: string; col: number; type?: string }[]).map(({ label, field, col, type }) => (
                            <div key={field} className={col === 2 ? 'col-span-2' : ''}>
                              <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
                              <input type={type || 'text'}
                                value={personEditForm[field as keyof typeof personEditForm]}
                                onChange={e => setPersonEditForm(f => ({ ...f, [field]: e.target.value }))}
                                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400" />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={handleSavePersonAndCustomer} disabled={savingPerson}
                            className="flex-1 py-1.5 text-xs font-semibold bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                            {savingPerson ? '저장 중...' : '저장'}
                          </button>
                          <button onClick={() => setEditingPerson(false)}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                        </div>
                      </div>

                    ) : editingPerson && !selectedLead.person && contactDraft ? (
                      /* 고객DB 미연결 담당자 직접 편집 */
                      <div className="space-y-2">
                        {([
                          { label: '이름', field: 'contact_name', col: 1 },
                          { label: '휴대폰', field: 'phone', col: 1 },
                          { label: '이메일', field: 'email', col: 2, type: 'email' },
                          { label: '사무실', field: 'office_phone', col: 1 },
                          { label: '기관명', field: 'client_org', col: 2 },
                        ] as { label: string; field: string; col: number; type?: string }[]).map(({ label, field, col, type }) => (
                          <div key={field} className={col === 2 ? 'col-span-2' : ''}>
                            <label className="text-xs text-gray-400 mb-0.5 block">{label}</label>
                            <input type={type || 'text'} value={contactDraft[field as keyof typeof contactDraft]}
                              onChange={e => setContactDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
                          </div>
                        ))}
                        <div className="flex gap-2 pt-1">
                          <button onClick={async () => {
                            setSavingContact(true)
                            await updateLead(selectedLead.id, {
                              contact_name: contactDraft.contact_name || null,
                              phone: contactDraft.phone || null,
                              office_phone: contactDraft.office_phone || null,
                              email: contactDraft.email || null,
                              client_org: contactDraft.client_org || null,
                            } as Parameters<typeof updateLead>[1])
                            setSelectedLead(prev => prev ? {
                              ...prev,
                              contact_name: contactDraft.contact_name || null,
                              phone: contactDraft.phone || null,
                              office_phone: contactDraft.office_phone || null,
                              email: contactDraft.email || null,
                              client_org: contactDraft.client_org || null,
                            } : prev)
                            setSavingContact(false)
                            setEditingPerson(false)
                          }} disabled={savingContact}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-yellow-400 text-gray-900 hover:bg-yellow-500 disabled:opacity-50">
                            {savingContact ? '저장 중...' : '저장'}
                          </button>
                          <button onClick={() => setEditingPerson(false)}
                            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                        </div>
                      </div>

                    ) : (
                      /* 읽기 모드 */
                      <div className="space-y-2.5">
                        {([
                          ['이름', selectedLead.person?.name || selectedLead.contact_name],
                          ['전화', selectedLead.person?.phone || selectedLead.phone],
                          ['이메일', selectedLead.person?.email || selectedLead.email],
                          ['기관', selectedLead.person?.currentOrg || selectedLead.client_org],
                        ] as [string, string | null | undefined][]).map(([k, v]) => (
                          <div key={k} className="flex gap-3">
                            <span className="text-xs text-gray-400 w-10 flex-shrink-0">{k}</span>
                            <span className="text-xs text-gray-800 font-medium break-all">{v || '—'}</span>
                          </div>
                        ))}
                        {selectedLead.person && (
                          <div className="mt-2 pt-2 border-t border-gray-50">
                            <a href="/customers" className="text-[10px] text-blue-400 hover:text-blue-600">거래처DB →</a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 유입 정보 카드 */}
                  <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">유입 정보</p>
                    <div className="space-y-2.5">
                      {([
                        ['담당 직원', (selectedLead.assignee as { name?: string })?.name],
                        ['유입일', selectedLead.inflow_date],
                        ['유입 경로', selectedLead.inflow_source],
                        ['소통 채널', selectedLead.channel],
                        ...(selectedLead.office_phone ? [['사무실', selectedLead.office_phone]] : []),
                      ] as [string, string | null | undefined][]).map(([k, v]) => (
                        <div key={k} className="flex gap-3">
                          <span className="text-xs text-gray-400 w-14 flex-shrink-0">{k}</span>
                          <span className="text-xs text-gray-800 font-medium">{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── 소통 내역 ── */}
                <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    소통 내역 <span className="normal-case font-normal">{leadLogs.length}건</span>
                  </p>

                  {/* 소통 입력 폼 */}
                  <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50 mb-4">
                    <textarea
                      value={newLeadLog}
                      onChange={e => setNewLeadLog(e.target.value)}
                      placeholder="소통 내용, 전화 전사록, 이메일 내용 등 자유롭게..."
                      rows={2}
                      className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400 mb-2"
                    />
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-xs text-gray-400 shrink-0">소통 일시</label>
                      <input type="datetime-local" value={leadLogContactedAt}
                        onChange={e => setLeadLogContactedAt(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
                      <button type="button" onClick={() => setLeadLogShowDetails(s => !s)}
                        className="ml-auto text-[11px] text-gray-500 hover:text-gray-700 underline">
                        {leadLogShowDetails ? '상세 접기' : '+ 상세 (회의록)'}
                      </button>
                    </div>

                    {/* 상세 회의록 필드 */}
                    {leadLogShowDetails && (
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-[10px] text-gray-500">장소</label>
                          <input value={leadLogLocation} onChange={e => setLeadLogLocation(e.target.value)} placeholder="예: 곤지암"
                            className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500">참석자 (콤마)</label>
                          <input value={leadLogParticipants} onChange={e => setLeadLogParticipants(e.target.value)} placeholder="조민현, 방준영"
                            className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-gray-500">결정/결과</label>
                          <input value={leadLogOutcome} onChange={e => setLeadLogOutcome(e.target.value)} placeholder="합의 또는 결정사항"
                            className="w-full text-xs bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <button type="button"
                        onClick={() => {
                          const now = new Date(); const pad = (n: number) => String(n).padStart(2, '0')
                          setLeadLogContactedAt(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`)
                          if (newLeadLog.trim()) handleAddLeadLog('통화')
                        }}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                        📞 지금 통화
                      </button>
                      <span className="text-xs text-gray-400">내용 입력 후 클릭하면 바로 저장</span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {['통화', '이메일', '방문', '미팅', '내부회의', '메모', '기타'].map(type => (
                        <button key={type}
                          onClick={() => handleAddLeadLog(type)}
                          disabled={isPending || !newLeadLog.trim()}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-all disabled:opacity-40 ${
                            newLeadLogType === type ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500 hover:border-yellow-300'
                          }`}>{type}{LOG_TYPE_PARTICLE[type] ?? '로'} 저장</button>
                      ))}
                    </div>
                    {leadLogError && <p className="text-xs text-red-500 mt-1">{leadLogError}</p>}
                  </div>

                  {/* 로그 목록 */}
                  {loadingLogs ? (
                    <p className="text-xs text-gray-300 text-center py-3">불러오는 중...</p>
                  ) : leadLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">소통 내역이 없습니다.</p>
                  ) : (
                    <>
                      <div className="space-y-0">
                        {(logsCollapsed && leadLogs.length > 3 ? leadLogs.slice(0, 3) : leadLogs).map(log => (
                          <LogItem key={log.id} log={log} isAdmin={isAdmin} onDelete={() => handleDeleteLeadLog(log.id)} />
                        ))}
                      </div>
                      {leadLogs.length > 3 && (
                        <button
                          onClick={() => setLogsCollapsed(c => !c)}
                          className="w-full mt-1.5 text-xs text-gray-400 hover:text-gray-600 py-1.5 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                          {logsCollapsed ? `이전 ${leadLogs.length - 3}건 더 보기 ▾` : '접기 ▴'}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* ── 리마인드 ── */}
                <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🔔</span>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">리마인드</p>
                  </div>
                  {selectedLead.remind_date ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2 flex-1">
                        {(() => {
                          const d = getDdayBadge(selectedLead.remind_date)
                          return d ? <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${d.color}`}>{d.label}</span> : null
                        })()}
                        <span className="text-xs text-gray-600">{selectedLead.remind_date}</span>
                      </div>
                      <input
                        type="date"
                        defaultValue={selectedLead.remind_date}
                        onChange={e => {
                          startTransition(async () => {
                            await updateLead(selectedLead.id, { remind_date: e.target.value || null })
                            setSelectedLead(prev => prev ? { ...prev, remind_date: e.target.value || null } : prev)
                          })
                        }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-yellow-400"
                      />
                      <button
                        onClick={() => {
                          startTransition(async () => {
                            await updateLead(selectedLead.id, { remind_date: null })
                            setSelectedLead(prev => prev ? { ...prev, remind_date: null } : prev)
                          })
                        }}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors">삭제</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-400">리마인드가 설정되어 있지 않습니다.</span>
                      <input
                        type="date"
                        onChange={e => {
                          if (!e.target.value) return
                          startTransition(async () => {
                            await updateLead(selectedLead.id, { remind_date: e.target.value })
                            setSelectedLead(prev => prev ? { ...prev, remind_date: e.target.value } : prev)
                          })
                        }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-yellow-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>

                {/* ── 캘린더 일정 ── */}
                {(() => {
                  const CALENDAR_LABELS: Record<string, string> = { main: '개인/전체', sos: '사운드오브스쿨', rental: '렌탈일정', artqium: '아트키움' }
                  const CALENDAR_COLORS_MAP: Record<string, string> = { main: '#3B82F6', sos: '#8B5CF6', rental: '#F59E0B', artqium: '#10B981' }
                  return (
                    <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">캘린더 일정</p>
                        <button onClick={() => setShowCalCreate(v => !v)}
                          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">
                          {showCalCreate ? '취소' : '+ 일정 추가'}
                        </button>
                      </div>

                      {showCalCreate && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-xl space-y-2 border border-blue-100">
                          <select value={calCreateKey} onChange={e => setCalCreateKey(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                            {Object.entries(CALENDAR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <input value={calCreateTitle} onChange={e => setCalCreateTitle(e.target.value)}
                            placeholder="일정 제목 (예: 이화여대 미팅)"
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
                          <input type="date" value={calCreateDate} onChange={e => setCalCreateDate(e.target.value)}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
                          <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                            <input type="checkbox" checked={calCreateAllDay} onChange={e => setCalCreateAllDay(e.target.checked)} className="rounded" />
                            종일 일정
                          </label>
                          {!calCreateAllDay && (
                            <div className="flex gap-2">
                              <input type="time" value={calCreateStart} onChange={e => setCalCreateStart(e.target.value)}
                                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
                              <span className="text-xs text-gray-400 self-center">~</span>
                              <input type="time" value={calCreateEnd} onChange={e => setCalCreateEnd(e.target.value)}
                                className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white" />
                            </div>
                          )}
                          <textarea value={calCreateDesc} onChange={e => setCalCreateDesc(e.target.value)}
                            placeholder="메모 (선택)" rows={2}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400 bg-white resize-none" />
                          <button
                            disabled={calCreateLoading || !calCreateTitle.trim() || !calCreateDate}
                            onClick={async () => {
                              if (!calCreateTitle.trim() || !calCreateDate) return
                              setCalCreateLoading(true)
                              const res = await createAndLinkLeadCalendarEvent(selectedLead.id, calCreateKey, {
                                title: calCreateTitle, date: calCreateDate,
                                startTime: calCreateAllDay ? undefined : calCreateStart || undefined,
                                endTime: calCreateAllDay ? undefined : calCreateEnd || undefined,
                                isAllDay: calCreateAllDay,
                                description: calCreateDesc.trim() || undefined,
                              })
                              setCalCreateLoading(false)
                              if (res.error) { alert('오류: ' + res.error); return }
                              const newEv = { id: `ev-${Date.now()}`, calendarKey: calCreateKey, title: calCreateTitle, date: calCreateDate, color: CALENDAR_COLORS_MAP[calCreateKey] ?? '#3B82F6' }
                              setLocalLinkedEvents(prev => [...prev, newEv])
                              setShowCalCreate(false)
                              setCalCreateTitle(''); setCalCreateDate(''); setCalCreateStart(''); setCalCreateEnd(''); setCalCreateDesc(''); setCalCreateAllDay(false)
                            }}
                            className="w-full py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                            {calCreateLoading ? '등록 중...' : '구글 캘린더에 등록'}
                          </button>
                        </div>
                      )}

                      {localLinkedEvents.length === 0 ? (
                        <p className="text-xs text-gray-400">등록된 일정이 없습니다</p>
                      ) : (
                        <div className="space-y-1.5">
                          {[...localLinkedEvents].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                            <div key={ev.id} className="flex items-center gap-2 group">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                              <span className="text-xs text-gray-500 flex-shrink-0">{ev.date}</span>
                              <span className="text-xs text-gray-700 flex-1 truncate">{ev.title}</span>
                              <span className="text-[10px] text-gray-400 flex-shrink-0">{CALENDAR_LABELS[ev.calendarKey] ?? ev.calendarKey}</span>
                              <button onClick={async () => {
                                setLocalLinkedEvents(prev => prev.filter(e => e.id !== ev.id))
                                await unlinkLeadCalendarEvent(selectedLead.id, ev.id)
                              }} className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* ── Claude 협업 ── */}
                <ProjectClaudeChat
                  leadId={selectedLead.id}
                  serviceType={selectedLead.service_type}
                  projectName={selectedLead.project_name}
                  dropboxUrl={selectedLead.dropbox_url}
                />

                {/* ── 메모 (인라인 편집 + 마크다운 + 표/체크박스) ── */}
                <MarkdownNoteBlock
                  entityId={selectedLead.id}
                  title="📝 메모"
                  value={selectedLead.notes ?? null}
                  save={updateLeadNotes}
                  emptyText="메모 없음. + 추가 클릭해서 작성."
                />

                {/* ── 요약 · 최초 문의 ── */}
                {(selectedLead.initial_content || loadingSummary || leadSummary) && (
                  <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">요약 · 최초 문의</p>
                    {selectedLead.initial_content && (
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 mb-1">최초 문의 내용</p>
                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{selectedLead.initial_content}</p>
                      </div>
                    )}
                    {(loadingSummary || leadSummary) && (
                      <div className="mt-3 bg-violet-50 border border-violet-100 rounded-xl p-3.5">
                        <p className="text-[11px] font-semibold text-violet-500 mb-2.5">✦ AI 요약</p>
                        {loadingSummary ? (
                          <div className="space-y-2">
                            <div className="h-3 bg-violet-100 rounded animate-pulse w-full" />
                            <div className="h-3 bg-violet-100 rounded animate-pulse w-4/5" />
                            <div className="h-3 bg-violet-100 rounded animate-pulse w-3/5" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {(leadSummary ?? '').split('\n').filter(l => l.trim()).map((line, i) => {
                              const colonIdx = line.indexOf(':')
                              if (colonIdx === -1) return <p key={i} className="text-sm text-gray-600 leading-relaxed">{line}</p>
                              const label = line.slice(0, colonIdx).trim()
                              const body = line.slice(colonIdx + 1).trim()
                              const labelStyle: Record<string, string> = {
                                '현황': 'bg-blue-100 text-blue-700',
                                '반응': 'bg-yellow-100 text-yellow-700',
                                '다음': 'bg-green-100 text-green-700',
                              }
                              return (
                                <div key={i} className="flex gap-2 items-start">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${labelStyle[label] ?? 'bg-gray-100 text-gray-500'}`}>{label}</span>
                                  <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 연관 매출건 ── */}
                {selectedLead.relatedSales && selectedLead.relatedSales.length > 0 && (
                  <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">연관 매출건 ({selectedLead.relatedSales.length})</p>
                    <div className="space-y-1.5">
                      {selectedLead.relatedSales.map((sale: { id: string; name: string; revenue: number | null; contract_stage: string; progress_status?: string | null; project_id?: string | null }) => (
                        <a key={sale.id} href={sale.project_id ? `/projects/${sale.project_id}` : `/sales/${sale.id}`}
                          className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 hover:border-yellow-300 transition-colors group">
                          <div>
                            <p className="text-sm font-medium text-gray-800 group-hover:text-yellow-700">{sale.name}</p>
                            {(sale.revenue ?? 0) > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {(sale.revenue ?? 0) >= 10000000 ? `${((sale.revenue ?? 0) / 10000000).toFixed(1)}천만` :
                                 (sale.revenue ?? 0) >= 10000 ? `${Math.round((sale.revenue ?? 0) / 10000)}만` :
                                 `${(sale.revenue ?? 0).toLocaleString()}원`}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0 ml-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              sale.contract_stage === '잔금' ? 'bg-gray-100 text-gray-400' :
                              sale.contract_stage === '계약' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>{sale.contract_stage}</span>
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

                {/* ── 견적서 ── */}
                {selectedLead.quotation_url && (
                  <div className="bg-white rounded-2xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">견적서</p>
                    <a href={selectedLead.quotation_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 bg-green-50 rounded-lg px-3 py-2 border border-green-100">
                      <span>📄</span>
                      <span className="underline truncate">구글 시트 견적서 열기</span>
                    </a>
                  </div>
                )}

                {/* ── 계약건 추가 폼 (admin) ── */}
                {isAdmin && showAddSaleForm && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 mb-1">계약건 추가</p>
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



              </div>
            </div>
          )}
        </div>
      </div>

      {/* 리드 수정 모달 */}
      {showEditModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEditModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">리드 수정</h2>
            <LeadForm
              form={form} setForm={setForm}
              onSubmit={handleUpdate} onCancel={() => setShowEditModal(false)}
              isPending={isPending} isAdmin={isAdmin}
              profiles={profiles} persons={persons} customers={customers}
            />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">드롭박스 URL {selectedLead.dropbox_url ? '수정' : '직접 입력'}</p>
              <div className="flex gap-2">
                <input
                  value={dropboxInput !== '' ? dropboxInput : (selectedLead.dropbox_url || '')}
                  onFocus={() => { if (!dropboxInput) setDropboxInput(selectedLead.dropbox_url || '') }}
                  onChange={e => setDropboxInput(e.target.value)}
                  placeholder="https://www.dropbox.com/..."
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400" />
                <button onClick={() => handleSaveDropboxUrl(selectedLead.id)}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 신규 리드 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">새 리드 등록</h2>
            <LeadForm form={form} setForm={setForm} onSubmit={handleCreate} onCancel={() => setShowCreateModal(false)} isPending={isPending} isAdmin={isAdmin} profiles={profiles} persons={persons} customers={customers} />
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

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className={LABEL_CLS}>품목 목록</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={handleDraftQuote} disabled={draftingQuote}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50 flex items-center gap-1"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    {draftingQuote ? '⏳ AI 작성 중...' : '✨ AI 초안 작성'}
                  </button>
                  <button type="button"
                    onClick={() => setQuoteItems(prev => [...prev, { ...EMPTY_QUOTE_ITEM }])}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
                    + 행 추가
                  </button>
                </div>
              </div>
              {draftingQuote && <p className="text-xs text-yellow-600 mt-1 text-right">Claude AI가 소통 내역을 분석 중입니다. 보통 10~20초 소요됩니다.</p>}

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className={`grid text-xs font-semibold text-gray-400 bg-gray-50 px-3 py-2 gap-2 ${quoteType === '렌탈' ? 'grid-cols-[2fr_1.5fr_0.6fr_0.6fr_1fr_auto]' : 'grid-cols-[1fr_2fr_1.5fr_0.6fr_0.7fr_1fr_auto]'}`}>
                  {quoteType === '렌탈'
                    ? <><span>품목명</span><span>세부내용</span><span>수량</span><span>개월</span><span>단가(원)</span><span className="w-5" /></>
                    : <><span>구분</span><span>품명</span><span>세부내역</span><span>수량</span><span>단위</span><span>단가(원)</span><span className="w-5" /></>}
                </div>
                {quoteItems.map((item, idx) => (
                  <div key={idx} className={`grid items-center gap-2 px-3 py-1.5 border-t border-gray-100 ${quoteType === '렌탈' ? 'grid-cols-[2fr_1.5fr_0.6fr_0.6fr_1fr_auto]' : 'grid-cols-[1fr_2fr_1.5fr_0.6fr_0.7fr_1fr_auto]'}`}>
                    {quoteType === '002크리에이티브' && (
                      <input className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" placeholder="구분"
                        value={item.category} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, category: e.target.value } : it))} />
                    )}
                    <input className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" placeholder="품목명"
                      value={item.name} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))} />
                    <input className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" placeholder="세부내용"
                      value={item.detail} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, detail: e.target.value } : it))} />
                    <input type="number" min="1" className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center"
                      value={item.qty} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Number(e.target.value) || 1 } : it))} />
                    {quoteType === '렌탈'
                      ? <input type="number" min="1" className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center"
                          value={item.months} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, months: Number(e.target.value) || 1 } : it))} />
                      : <input className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-center" placeholder="식"
                          value={item.unit} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: e.target.value } : it))} />}
                    <input type="number" min="0" className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400 text-right"
                      value={item.price} onChange={e => setQuoteItems(prev => prev.map((it, i) => i === idx ? { ...it, price: Number(e.target.value) || 0 } : it))} />
                    <button type="button" onClick={() => setQuoteItems(prev => prev.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400 text-sm w-5 text-center">✕</button>
                  </div>
                ))}
              </div>
              <p className="text-right text-xs text-gray-400 mt-1.5 pr-1">
                소계: {quoteItems.reduce((sum, it) => sum + it.price * it.qty * (quoteType === '렌탈' ? it.months : 1), 0).toLocaleString()}원
                &nbsp;/ VAT포함: {Math.round(quoteItems.reduce((sum, it) => sum + it.price * it.qty * (quoteType === '렌탈' ? it.months : 1), 0) * 1.1).toLocaleString()}원
              </p>
            </div>

            {generatedQuoteUrl && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                <p className="text-xs text-green-700 font-semibold mb-1">견적서 생성 완료!</p>
                <a href={generatedQuoteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-green-800 underline break-all">{generatedQuoteUrl}</a>
              </div>
            )}
            {generatingQuote && <p className="text-xs text-gray-400 text-right mb-2">구글 시트에 견적서를 생성 중입니다. 보통 15~30초 소요됩니다.</p>}
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

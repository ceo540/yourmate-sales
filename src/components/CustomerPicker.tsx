'use client'
// 고객DB(기관 customers) 검색·선택 + 즉석 신규 추가 모달
// 모든 폼(리드/프로젝트/계약 등)에서 동일한 UX로 사용.
//
// - 자유 텍스트 입력 X. 항상 검색 → 선택 OR [+ 새 기관 추가]
// - 신규 추가는 풀 필드 (이름 필수 + 유형/지역/담당자/직책/전화/이메일 선택)
// - 담당자(persons)는 dept/title 분리 저장 (이름에 직책 같이 들어가지 않게)

import { useState, useRef, useEffect } from 'react'
import { quickCreateCustomerWithContact } from '@/app/(dashboard)/customers/actions'

export interface CustomerOption {
  id: string
  name: string
  type?: string | null
}

interface Props {
  value: string                          // 선택된 customer_id
  selectedName?: string                  // 선택된 customer 이름 (표시용 — 부모가 메모리)
  customers: CustomerOption[]            // 검색 대상
  onChange: (customerId: string, customerName: string) => void
  onCustomerCreated?: (c: CustomerOption) => void  // 새로 추가됐을 때 (부모가 list 갱신)
  placeholder?: string
  required?: boolean
  defaultName?: string                   // 첫 검색어 default (예: 프로젝트의 customer.name)
}

const CUSTOMER_TYPES = ['학교', '공공기관', '기업', '개인', '기타']

export default function CustomerPicker({
  value, selectedName, customers, onChange, onCustomerCreated,
  placeholder = '기관 검색...', required, defaultName,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 dropdown 닫기
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = query.trim()
    ? customers.filter(c => c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12)
    : customers.slice(0, 12)

  const displayValue = open ? query : (selectedName || '')

  function selectCustomer(c: CustomerOption) {
    onChange(c.id, c.name)
    setQuery('')
    setOpen(false)
  }

  function clearSelection() {
    onChange('', '')
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(selectedName || ''); setOpen(true) }}
          placeholder={placeholder}
          required={required && !value}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-8 bg-white focus:outline-none focus:border-yellow-400"
        />
        {value && !open && (
          <button type="button" onClick={clearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 text-xs">✕</button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length > 0 && (
            <ul>
              {filtered.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => selectCustomer(c)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-yellow-50">
                    <span className="text-gray-800 truncate">{c.name}</span>
                    {c.type && <span className="text-[11px] text-gray-400 flex-shrink-0">{c.type}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400">"{query}" 검색 결과 없음</p>
          )}
          <button type="button" onClick={() => { setShowCreate(true); setOpen(false) }}
            className="w-full px-3 py-2 text-left text-xs font-semibold border-t border-gray-100 hover:bg-yellow-50"
            style={{ color: '#121212' }}>
            + 새 기관 추가 {query.trim() && <span className="text-gray-400 font-normal">(이름: "{query.trim()}")</span>}
          </button>
        </div>
      )}

      {showCreate && (
        <CreateCustomerModal
          initialName={query.trim() || defaultName || ''}
          onClose={() => setShowCreate(false)}
          onCreated={(c) => {
            onCustomerCreated?.(c)
            onChange(c.id, c.name)
            setShowCreate(false)
            setQuery('')
          }}
        />
      )}
    </div>
  )
}

/* ── 신규 기관 추가 모달 (풀 필드) ────────────────────────── */
function CreateCustomerModal({
  initialName, onClose, onCreated,
}: {
  initialName: string
  onClose: () => void
  onCreated: (c: CustomerOption) => void
}) {
  const [name, setName] = useState(initialName)
  const [type, setType] = useState<string>('학교')
  const [region, setRegion] = useState('')
  const [address, setAddress] = useState('')
  // 담당자 (persons + person_org_relations)
  const [contactName, setContactName] = useState('')
  const [contactDept, setContactDept] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true); setError(null)
    const res = await quickCreateCustomerWithContact({
      name: name.trim(),
      contact: contactName.trim() ? {
        name: contactName.trim(),
        dept: contactDept.trim() || undefined,
        title: contactTitle.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        email: contactEmail.trim() || undefined,
      } : null,
    })
    setBusy(false)
    if ('error' in res) { setError(res.error); return }
    onCreated({ id: res.customer_id, name: name.trim(), type })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={submit}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold">+ 새 기관 추가</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
        </div>

        {error && <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">기관명 *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} required
              placeholder="예: 신원중학교"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">유형</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">지역</label>
              <input value={region} onChange={e => setRegion(e.target.value)} placeholder="예: 경기 수원"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">주소</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="예: 수원시 영통구 ..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-[11px] font-semibold text-gray-700 mb-2">고객 (담당자) — 선택. 이름만 있으면 OK</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="고객 이름"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
              <input value={contactTitle} onChange={e => setContactTitle(e.target.value)} placeholder="직책 (예: 과장)"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
            <input value={contactDept} onChange={e => setContactDept(e.target.value)} placeholder="부서 (예: 학생지원과 — 수의계약 한도 추적용)"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:outline-none focus:border-yellow-400" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="연락처"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
              <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="이메일"
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">취소</button>
          <button type="submit" disabled={busy || !name.trim()}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {busy ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'
import { useState, useTransition, useEffect, useRef } from 'react'
import {
  createRental, updateRental, deleteRental,
  addRentalItem, removeRentalItem, addRentalContact, updateRentalChecklist,
} from './actions'

// ─── 상수 ────────────────────────────────────────────────────────
export const RENTAL_STATUSES = ['전체','유입','견적발송','렌탈확정','진행중','수거완료','검수중','완료','취소','보류'] as const
type RentalStatus = Exclude<typeof RENTAL_STATUSES[number], '전체'>

const STATUS_FLOW = ['유입','견적발송','렌탈확정','진행중','수거완료','검수중','완료']

const STATUS_BADGE: Record<string, string> = {
  유입:     'bg-gray-100 text-gray-500',
  견적발송:  'bg-purple-100 text-purple-700',
  렌탈확정:  'bg-yellow-100 text-yellow-700',
  진행중:   'bg-green-100 text-green-700',
  수거완료:  'bg-teal-100 text-teal-700',
  검수중:   'bg-blue-100 text-blue-700',
  완료:     'bg-gray-100 text-gray-400',
  취소:     'bg-red-100 text-red-400',
  보류:     'bg-orange-100 text-orange-700',
}

const PAYMENT_STATUSES = ['미결제','결제완료'] as const
const DEPOSIT_STATUSES = ['보증금보유','환급대기','환급완료'] as const

const PAYMENT_BADGE: Record<string, string> = {
  미결제:   'bg-red-50 text-red-500',
  결제완료: 'bg-green-50 text-green-700',
}
const DEPOSIT_BADGE: Record<string, string> = {
  보증금보유: 'bg-blue-50 text-blue-600',
  환급대기:  'bg-yellow-50 text-yellow-700',
  환급완료:  'bg-gray-100 text-gray-500',
}

const CHECKLIST_GROUPS = [
  {
    label: '계약', color: 'text-purple-600', bgLight: 'bg-purple-50',
    items: [
      { key: 'contract_sent',   label: '견적서 발송' },
      { key: 'contract_signed', label: '계약서 서명' },
      { key: 'docs_received',   label: '서류 수령' },
    ],
    autoTrigger: '→ 렌탈확정',
  },
  {
    label: '배송', color: 'text-blue-600', bgLight: 'bg-blue-50',
    items: [
      { key: 'outbound_inspection', label: '출고 전 검수' },
      { key: 'packed',              label: '포장 완료' },
      { key: 'shipping_ready',      label: '발송 준비' },
      { key: 'delivered',           label: '배송 완료' },
      { key: 'delivery_confirmed',  label: '수령 확인' },
    ],
    autoTrigger: '→ 진행중 (배송완료 체크 시)',
  },
  {
    label: '반납', color: 'text-teal-600', bgLight: 'bg-teal-50',
    items: [
      { key: 'return_notified', label: '반납 안내' },
      { key: 'returned',        label: '수거 완료' },
    ],
    autoTrigger: '→ 수거완료 (수거완료 체크 시)',
  },
  {
    label: '검수', color: 'text-orange-600', bgLight: 'bg-orange-50',
    items: [
      { key: 'inspection_done', label: '검수 완료' },
      { key: 'no_issue',        label: '이상 없음' },
      { key: 'issue_resolved',  label: '이슈 조치 완료' },
    ],
    autoTrigger: '→ 검수중 / 완료',
  },
  {
    label: '정산', color: 'text-green-700', bgLight: 'bg-green-50',
    items: [
      { key: 'deposit_returned', label: '보증금 환급' },
    ],
    autoTrigger: '→ 완료 (보증금 있을 때 필수)',
  },
]

const DELIVERY_METHODS = ['착불택배','선불택배','업체배송수거','퀵','방문수령반납']
const INFLOW_SOURCES   = ['네이버','인스타','유튜브','지인','기존고객','채널톡','기타']

// ─── 타입 ────────────────────────────────────────────────────────
interface RentalItem {
  id: string; item_name: string; model_code: string | null
  quantity: number; months: number; unit_price: number; total_price: number; notes: string | null
}
interface Rental {
  id: string
  title: string | null
  customer_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  customer_type: string
  status: string
  rental_start: string | null
  rental_end: string | null
  payment_due: string | null
  delivery_method: string | null
  pickup_method: string | null
  total_amount: number
  deposit: number
  has_deposit: boolean | null
  deposit_status: string | null
  payment_status: string | null
  payment_method: string | null
  assignee_id: string | null
  assignee_name: string | null
  inflow_source: string | null
  notes: string | null
  content: string | null
  dropbox_url: string | null
  contact_1: string | null
  contact_2: string | null
  contact_3: string | null
  checklist: Record<string, boolean> | null
  items: RentalItem[]
}
interface Props {
  rentals: Rental[]
  profiles: { id: string; name: string }[]
  customers: { id: string; name: string; type: string }[]
}

// ─── 유틸 ────────────────────────────────────────────────────────
const fmt = (n: number) => (n || 0).toLocaleString()

function getDaysFromNow(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}
function getDDay(dateStr: string | null) {
  if (!dateStr) return null
  const d = getDaysFromNow(dateStr)
  if (d < 0)   return { label:`D+${Math.abs(d)}`, cls:'bg-gray-100 text-gray-400' }
  if (d === 0) return { label:'D-day', cls:'bg-red-500 text-white font-bold' }
  if (d <= 3)  return { label:`D-${d}`, cls:'bg-red-100 text-red-600 font-semibold' }
  if (d <= 7)  return { label:`D-${d}`, cls:'bg-yellow-100 text-yellow-700' }
  return { label:`D-${d}`, cls:'bg-gray-100 text-gray-400' }
}

function parseContact(text: string) {
  const m = text.match(/^\[(\d{4}-\d{2}-\d{2})\] ([\s\S]+)$/)
  return m ? { date: m[1], body: m[2] } : { date: null, body: text }
}

function getCalendarDays(year: number, month: number) {
  const first = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const DAYS_KO = ['일','월','화','수','목','금','토']

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function RentalsClient({ rentals: initialRentals, profiles, customers }: Props) {
  const [rentals, setRentals] = useState<Rental[]>(initialRentals)
  const [selected, setSelected] = useState<Rental | null>(null)
  const [isPending, startTransition] = useTransition()

  // 캘린더 뷰 상태
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  // 신규 등록 모달
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    customer_id: '', customer_name: '', contact_name: '', phone: '', customer_type: '기관',
    assignee_id: '', rental_start: '', rental_end: '', delivery_method: '착불택배',
    inflow_source: '', total_amount: '', deposit: '', has_deposit: false,
    title: '',
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8)
    : customers.slice(0, 8)

  // 편집 상태
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [newContactText, setNewContactText] = useState('')
  const [newItem, setNewItem] = useState({ item_name:'', model_code:'', quantity:'1', months:'1', unit_price:'' })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // selected를 항상 최신 rentals 기준으로 동기화
  useEffect(() => {
    if (selected) {
      const fresh = rentals.find(r => r.id === selected.id)
      if (fresh) setSelected(fresh)
    }
  }, [rentals])

  // ─── 로컬 상태 업데이트 헬퍼 ─────────────────────────────────
  function patchRental(id: string, patch: Partial<Rental>) {
    setRentals(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  // ─── 신규 등록 ───────────────────────────────────────────────
  async function handleCreate() {
    const res = await createRental({
      customer_name: newForm.customer_name,
      customer_id: newForm.customer_id || undefined,
      contact_name: newForm.contact_name || undefined,
      phone: newForm.phone || undefined,
      customer_type: newForm.customer_type,
      assignee_id: newForm.assignee_id || undefined,
      rental_start: newForm.rental_start || undefined,
      rental_end: newForm.rental_end || undefined,
      delivery_method: newForm.delivery_method || undefined,
      inflow_source: newForm.inflow_source || undefined,
      total_amount: newForm.total_amount ? parseInt(newForm.total_amount) : undefined,
      deposit: newForm.deposit ? parseInt(newForm.deposit) : undefined,
      has_deposit: newForm.has_deposit,
      title: newForm.title || undefined,  // 제목: 페이지 타이틀 + 드롭박스 폴더명에 사용
    })
    if (res.error) { alert(res.error); return }
    setShowNew(false)
    setNewForm({
      customer_id:'', customer_name:'', contact_name:'', phone:'', customer_type:'기관',
      assignee_id:'', rental_start:'', rental_end:'', delivery_method:'착불택배',
      inflow_source:'', total_amount:'', deposit:'', has_deposit: false, title:'',
    })
    window.location.reload()
  }

  // ─── 필드 인라인 저장 ────────────────────────────────────────
  async function saveField(field: string, value: unknown) {
    if (!selected) return
    startTransition(async () => {
      const res = await updateRental(selected.id, { [field]: value })
      if (!res.error) {
        patchRental(selected.id, { [field]: value } as Partial<Rental>)
      }
      setEditingField(null)
    })
  }

  // ─── 체크리스트 ─────────────────────────────────────────────
  async function toggleChecklist(key: string, val: boolean) {
    if (!selected) return
    const current = selected.checklist ?? {}
    const next = { ...current, [key]: val }
    startTransition(async () => {
      const res = await updateRentalChecklist(selected.id, next)
      const newStatus = res.newStatus ?? selected.status
      patchRental(selected.id, { checklist: next, status: newStatus })
    })
  }

  // ─── 소통내역 추가 ───────────────────────────────────────────
  async function handleAddContact() {
    if (!selected || !newContactText.trim()) return
    startTransition(async () => {
      const res = await addRentalContact(selected.id, newContactText)
      if (res.error) { alert(res.error); return }
      setNewContactText('')
      window.location.reload()
    })
  }

  // ─── 품목 추가 ───────────────────────────────────────────────
  async function handleAddItem() {
    if (!selected || !newItem.item_name) return
    const qty = parseInt(newItem.quantity) || 1
    const months = parseInt(newItem.months) || 1
    const price = parseInt(newItem.unit_price) || 0
    startTransition(async () => {
      const res = await addRentalItem(selected.id, {
        item_name: newItem.item_name,
        model_code: newItem.model_code || undefined,
        quantity: qty, months, unit_price: price,
      })
      if (res.error) { alert(res.error); return }
      setNewItem({ item_name:'', model_code:'', quantity:'1', months:'1', unit_price:'' })
      window.location.reload()
    })
  }

  // ─── 삭제 ────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected) return
    startTransition(async () => {
      await deleteRental(selected.id)
      setSelected(null)
      setShowDeleteConfirm(false)
      window.location.reload()
    })
  }

  // ─── 캘린더 필터 ────────────────────────────────────────────
  // 전체: 활성 건 모두(취소/보류 제외), 날짜 기준 rental_start
  // 배송: 상태 유입/견적발송/렌탈확정, 날짜 기준 rental_start
  // 수거: 상태 진행중/수거완료/검수중, 날짜 기준 rental_end
  // 완료: 상태 완료, 날짜 기준 rental_end
  type CalFilter = '전체' | '배송' | '수거' | '완료'
  const [calFilter, setCalFilter] = useState<CalFilter>('전체')

  const calDays = getCalendarDays(calYear, calMonth)

  // 필터에 따라 표시할 렌탈 목록과 기준 날짜 필드 결정
  const filteredCalRentals = rentals.filter(r => {
    if (calFilter === '전체') return !['취소','보류'].includes(r.status)
    if (calFilter === '배송') return ['유입','견적발송','렌탈확정'].includes(r.status)
    if (calFilter === '수거') return ['진행중','수거완료','검수중'].includes(r.status)
    if (calFilter === '완료') return r.status === '완료'
    return false
  })

  // 필터별 날짜 기준 필드
  const calDateField = (calFilter === '수거' || calFilter === '완료') ? 'rental_end' : 'rental_start'

  // 날짜별 렌탈 맵핑
  const rentalsByDate: Record<string, Rental[]> = {}
  const noDateRentals: Rental[] = []
  for (const r of filteredCalRentals) {
    const dateStr = r[calDateField as keyof Rental] as string | null
    if (!dateStr) { noDateRentals.push(r); continue }
    const d = new Date(dateStr)
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const key = d.getDate().toString()
      if (!rentalsByDate[key]) rentalsByDate[key] = []
      rentalsByDate[key].push(r)
    }
  }

  // 전체 활성 건 (취소/보류 제외) — 이달 건수 표시용
  const activeRentals = rentals.filter(r => !['취소','보류'].includes(r.status))

  const todayStr = today.toISOString().slice(0, 10)

  // ─── 패널 헬퍼 ───────────────────────────────────────────────
  function InlineText({ field, label, value, type='text', options }: {
    field: string; label: string; value: string | number | null
    type?: string; options?: string[]
  }) {
    if (editingField === field) {
      if (options) {
        return (
          <div className="flex gap-1 flex-wrap">
            {options.map(o => (
              <button key={o}
                className={`px-2 py-0.5 rounded text-xs border ${editValue === o ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                onClick={() => { setEditValue(o); saveField(field, o) }}
              >{o}</button>
            ))}
            <button className="text-xs text-gray-400 ml-1" onClick={() => setEditingField(null)}>취소</button>
          </div>
        )
      }
      return (
        <div className="flex gap-1">
          <input className="border rounded px-2 py-0.5 text-sm flex-1"
            type={type} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') saveField(field, editValue); if(e.key==='Escape') setEditingField(null) }}
            autoFocus
          />
          <button className="text-xs text-blue-600 px-1" onClick={() => saveField(field, editValue)}>저장</button>
          <button className="text-xs text-gray-400 px-1" onClick={() => setEditingField(null)}>취소</button>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 group cursor-pointer"
        onClick={() => { setEditingField(field); setEditValue(String(value ?? '')) }}>
        <span className="text-sm text-gray-400 w-20 shrink-0">{label}</span>
        <span className="text-sm text-gray-800 flex-1">{value || <span className="text-gray-300">-</span>}</span>
        <span className="opacity-0 group-hover:opacity-100 text-gray-300 text-xs">✎</span>
      </div>
    )
  }

  // ─── 렌더 ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── 좌측: 캘린더 ─────────────────────────────────────── */}
      <div className="w-[420px] shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h1 className="font-semibold text-gray-900 text-lg">교구 대여</h1>
          <button
            onClick={() => setShowNew(true)}
            className="bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium px-3 py-1.5 rounded-lg"
          >+ 신규 등록</button>
        </div>

        {/* 캘린더 필터 탭: 전체 / 배송 / 수거 / 완료 */}
        <div className="px-4 pt-2 pb-0 flex gap-1 border-b border-gray-100">
          {(['전체','배송','수거','완료'] as CalFilter[]).map(f => (
            <button key={f} onClick={() => setCalFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-t border-b-2 transition-colors
                ${calFilter === f
                  ? 'border-yellow-400 text-yellow-700 font-semibold bg-yellow-50'
                  : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >{f}</button>
          ))}
        </div>

        {/* 캘린더 네비 */}
        <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
          <button onClick={() => { const d=new Date(calYear,calMonth-1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
            className="text-gray-400 hover:text-gray-700 text-lg px-1">‹</button>
          <span className="font-medium text-gray-800 flex-1 text-center">
            {calYear}년 {calMonth + 1}월
          </span>
          <button onClick={() => { const d=new Date(calYear,calMonth+1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()) }}
            className="text-gray-400 hover:text-gray-700 text-lg px-1">›</button>
          <button onClick={() => { setCalYear(today.getFullYear()); setCalMonth(today.getMonth()) }}
            className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-2 py-0.5">오늘</button>
        </div>

        {/* 캘린더 그리드 */}
        <div className="px-3 overflow-y-auto flex-1">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1 mt-2">
            {DAYS_KO.map((d,i) => (
              <div key={d} className={`text-center text-xs font-medium py-1 ${i===0?'text-red-400':i===6?'text-blue-400':'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7 gap-px">
            {calDays.map((day, idx) => {
              if (!day) return <div key={idx} className="min-h-[64px]" />
              const isToday = new Date(calYear, calMonth, day).toISOString().slice(0,10) === todayStr
              const dayRentals = rentalsByDate[day.toString()] ?? []
              const isWeekend = (idx % 7 === 0 || idx % 7 === 6)
              return (
                <div key={idx} className={`min-h-[64px] p-0.5 rounded ${isToday ? 'bg-yellow-50 ring-1 ring-yellow-300' : 'hover:bg-gray-50'}`}>
                  <div className={`text-xs font-medium text-center mb-0.5 ${isToday ? 'text-yellow-600 font-bold' : isWeekend ? (idx%7===0?'text-red-400':'text-blue-400') : 'text-gray-500'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayRentals.slice(0,3).map(r => (
                      <div key={r.id}
                        onClick={() => setSelected(r)}
                        className={`text-[10px] leading-tight px-1 py-0.5 rounded cursor-pointer truncate
                          ${selected?.id === r.id ? 'ring-1 ring-yellow-400' : ''}
                          ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}
                        title={r.title || r.customer_name}
                      >
                        {r.title || r.customer_name}
                      </div>
                    ))}
                    {dayRentals.length > 3 && (
                      <div className="text-[10px] text-gray-400 text-center">+{dayRentals.length - 3}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 날짜 없는 건 */}
          {noDateRentals.length > 0 && (
            <div className="mt-3 mb-2">
              <div className="text-xs text-gray-400 mb-1 px-1">배송일 미정</div>
              <div className="space-y-1">
                {noDateRentals.map(r => (
                  <div key={r.id}
                    onClick={() => setSelected(r)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border text-sm
                      ${selected?.id === r.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                  >
                    <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                    <span className="flex-1 font-medium text-gray-700 truncate">{r.title || r.customer_name}</span>
                    {r.total_amount > 0 && <span className="text-xs text-gray-400">{fmt(r.total_amount)}원</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 이달 전체 목록 (간략) */}
          <div className="mt-4 mb-4">
            <div className="text-xs text-gray-400 mb-1 px-1">이달 전체 ({activeRentals.filter(r => {
              if (!r.rental_start) return false
              const d = new Date(r.rental_start)
              return d.getFullYear() === calYear && d.getMonth() === calMonth
            }).length}건)</div>
          </div>
        </div>
      </div>

      {/* ── 우측: 상세 패널 ────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          <DetailPanel
            rental={selected}
            profiles={profiles}
            isPending={isPending}
            editingField={editingField}
            editValue={editValue}
            setEditingField={setEditingField}
            setEditValue={setEditValue}
            saveField={saveField}
            toggleChecklist={toggleChecklist}
            newContactText={newContactText}
            setNewContactText={setNewContactText}
            handleAddContact={handleAddContact}
            newItem={newItem}
            setNewItem={setNewItem}
            handleAddItem={handleAddItem}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            handleDelete={handleDelete}
            onClose={() => setSelected(null)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          캘린더에서 대여 건을 선택하세요
        </div>
      )}

      {/* ── 신규 등록 모달 ───────────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-4">신규 대여 등록</h2>
            <div className="space-y-3">

              {/* 제목 */}
              <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="제목 (예: 260301 대한초등학교)"
                value={newForm.title} onChange={e => setNewForm(p => ({...p, title: e.target.value}))} />

              {/* 고객 검색 */}
              <div className="relative">
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="기관/고객명 검색"
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
                  onFocus={() => setShowCustomerDropdown(true)} />
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {filteredCustomers.map(c => (
                      <div key={c.id} className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                        onClick={() => {
                          setNewForm(p => ({...p, customer_id: c.id, customer_name: c.name}))
                          setCustomerSearch(c.name)
                          setShowCustomerDropdown(false)
                        }}>
                        {c.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 직접 입력 (검색 외) */}
              {!newForm.customer_id && (
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="기관/고객명 직접 입력"
                  value={newForm.customer_name} onChange={e => setNewForm(p => ({...p, customer_name: e.target.value}))} />
              )}

              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="담당자명"
                  value={newForm.contact_name} onChange={e => setNewForm(p => ({...p, contact_name: e.target.value}))} />
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="연락처"
                  value={newForm.phone} onChange={e => setNewForm(p => ({...p, phone: e.target.value}))} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">배송일</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={newForm.rental_start} onChange={e => setNewForm(p => ({...p, rental_start: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">수거일</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={newForm.rental_end} onChange={e => setNewForm(p => ({...p, rental_end: e.target.value}))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="총 금액"
                  type="number" value={newForm.total_amount}
                  onChange={e => setNewForm(p => ({...p, total_amount: e.target.value}))} />
                <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
                  <input type="checkbox" id="has_deposit_new"
                    checked={newForm.has_deposit}
                    onChange={e => setNewForm(p => ({...p, has_deposit: e.target.checked}))} />
                  <label htmlFor="has_deposit_new" className="text-sm text-gray-600">보증금 있음</label>
                </div>
              </div>

              {newForm.has_deposit && (
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="보증금 금액"
                  type="number" value={newForm.deposit}
                  onChange={e => setNewForm(p => ({...p, deposit: e.target.value}))} />
              )}

              <select className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newForm.delivery_method} onChange={e => setNewForm(p => ({...p, delivery_method: e.target.value}))}>
                {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>

              <select className="w-full border rounded-lg px-3 py-2 text-sm"
                value={newForm.assignee_id} onChange={e => setNewForm(p => ({...p, assignee_id: e.target.value}))}>
                <option value="">담당자 선택</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">취소</button>
              <button onClick={handleCreate}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 rounded-lg py-2 text-sm font-medium">등록</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 상세 패널 컴포넌트 ──────────────────────────────────────────
function DetailPanel({
  rental, profiles, isPending,
  editingField, editValue, setEditingField, setEditValue,
  saveField, toggleChecklist,
  newContactText, setNewContactText, handleAddContact,
  newItem, setNewItem, handleAddItem,
  showDeleteConfirm, setShowDeleteConfirm, handleDelete,
  onClose,
}: {
  rental: Rental
  profiles: { id: string; name: string }[]
  isPending: boolean
  editingField: string | null
  editValue: string
  setEditingField: (f: string | null) => void
  setEditValue: (v: string) => void
  saveField: (field: string, value: unknown) => void
  toggleChecklist: (key: string, val: boolean) => void
  newContactText: string
  setNewContactText: (v: string) => void
  handleAddContact: () => void
  newItem: { item_name: string; model_code: string; quantity: string; months: string; unit_price: string }
  setNewItem: (v: any) => void
  handleAddItem: () => void
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (v: boolean) => void
  handleDelete: () => void
  onClose: () => void
}) {
  const cl = rental.checklist ?? {}
  const contacts = [rental.contact_1, rental.contact_2, rental.contact_3].filter(Boolean) as string[]

  function InlineText({ field, label, value, type='text', options }: {
    field: string; label: string; value: string | number | null
    type?: string; options?: string[]
  }) {
    if (editingField === field) {
      if (options) {
        return (
          <div className="flex gap-1 flex-wrap">
            {options.map(o => (
              <button key={o}
                className={`px-2 py-0.5 rounded text-xs border ${value === o ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                onClick={() => saveField(field, o)}
              >{o}</button>
            ))}
            <button className="text-xs text-gray-400 ml-1" onClick={() => setEditingField(null)}>취소</button>
          </div>
        )
      }
      return (
        <div className="flex gap-1">
          <input className="border rounded px-2 py-0.5 text-sm flex-1"
            type={type} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter') saveField(field, editValue); if(e.key==='Escape') setEditingField(null) }}
            autoFocus
          />
          <button className="text-xs text-blue-600 px-1" onClick={() => saveField(field, editValue)}>저장</button>
          <button className="text-xs text-gray-400 px-1" onClick={() => setEditingField(null)}>취소</button>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 group cursor-pointer py-0.5"
        onClick={() => { setEditingField(field); setEditValue(String(value ?? '')) }}>
        <span className="text-xs text-gray-400 w-20 shrink-0">{label}</span>
        <span className="text-sm text-gray-800 flex-1">{value || <span className="text-gray-300">-</span>}</span>
        <span className="opacity-0 group-hover:opacity-100 text-gray-300 text-xs">✎</span>
      </div>
    )
  }

  // 상태 스텝퍼 인덱스
  const flowIdx = STATUS_FLOW.indexOf(rental.status)

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4 pb-20">

      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {editingField === '__title' ? (
            <div className="flex gap-2">
              <input className="border-b-2 border-yellow-400 text-xl font-bold bg-transparent flex-1 outline-none"
                value={editValue} onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') saveField('title', editValue); if(e.key==='Escape') setEditingField(null) }}
                autoFocus />
              <button className="text-sm text-blue-600" onClick={() => saveField('title', editValue)}>저장</button>
              <button className="text-sm text-gray-400" onClick={() => setEditingField(null)}>취소</button>
            </div>
          ) : (
            <h2 className="text-xl font-bold text-gray-900 cursor-pointer hover:text-yellow-600 group flex items-center gap-2"
              onClick={() => { setEditingField('__title'); setEditValue(rental.title || rental.customer_name) }}>
              {rental.title || rental.customer_name}
              <span className="opacity-0 group-hover:opacity-100 text-gray-300 text-sm">✎</span>
            </h2>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[rental.status] ?? 'bg-gray-100 text-gray-500'}`}>
              {rental.status}
            </span>
            {rental.assignee_name && <span className="text-xs text-gray-400">{rental.assignee_name}</span>}
          </div>
        </div>
        <div className="flex gap-1">
          {rental.dropbox_url && (
            <a href={rental.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-2 py-1">
              드롭박스
            </a>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 text-lg">✕</button>
        </div>
      </div>

      {/* 상태 스텝퍼 */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
        {/* 메인 흐름 스텝퍼: 유입 → 견적발송 → ... → 완료 */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUS_FLOW.map((s, i) => (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => saveField('status', s)}
                className={`text-xs px-2 py-1 rounded-full border transition-all
                  ${i === flowIdx ? 'bg-yellow-400 border-yellow-400 text-black font-semibold' :
                    i < flowIdx ? 'bg-gray-100 border-gray-200 text-gray-400' :
                    'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >{s}</button>
              {i < STATUS_FLOW.length - 1 && <span className="text-gray-200 text-xs">›</span>}
            </div>
          ))}
        </div>
        {/* 예외 상태: 보류 / 취소 (흐름과 별도로 언제든 설정 가능) */}
        <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
          <span className="text-[10px] text-gray-300">예외</span>
          <button
            onClick={() => saveField('status', '보류')}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-all
              ${rental.status === '보류'
                ? 'bg-orange-100 border-orange-300 text-orange-700 font-semibold'
                : 'border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500'}`}
          >보류</button>
          <button
            onClick={() => saveField('status', '취소')}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-all
              ${rental.status === '취소'
                ? 'bg-red-100 border-red-300 text-red-500 font-semibold'
                : 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-400'}`}
          >취소</button>
          {/* 보류/취소 상태일 때 이전 상태로 되돌리는 버튼 */}
          {(rental.status === '보류' || rental.status === '취소') && (
            <button
              onClick={() => saveField('status', '유입')}
              className="text-[10px] text-blue-400 hover:text-blue-600 ml-1"
            >↩ 유입으로 복귀</button>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">기본 정보</h3>
        <div className="space-y-1">
          <InlineText field="customer_name" label="고객/기관명" value={rental.customer_name} />
          <InlineText field="contact_name" label="담당자" value={rental.contact_name} />
          <InlineText field="phone" label="연락처" value={rental.phone} />
          <InlineText field="email" label="이메일" value={rental.email} />
          <div className="flex items-center gap-1 group cursor-pointer py-0.5"
            onClick={() => { setEditingField('assignee_id'); setEditValue(rental.assignee_id ?? '') }}>
            <span className="text-xs text-gray-400 w-20 shrink-0">담당자</span>
            {editingField === 'assignee_id' ? (
              <div className="flex gap-1 flex-wrap flex-1">
                {profiles.map(p => (
                  <button key={p.id}
                    className={`px-2 py-0.5 rounded text-xs border ${rental.assignee_id === p.id ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600 hover:border-blue-300'}`}
                    onClick={() => saveField('assignee_id', p.id)}
                  >{p.name}</button>
                ))}
                <button className="text-xs text-gray-400 ml-1" onClick={() => setEditingField(null)}>취소</button>
              </div>
            ) : (
              <>
                <span className="text-sm text-gray-800 flex-1">{rental.assignee_name || <span className="text-gray-300">-</span>}</span>
                <span className="opacity-0 group-hover:opacity-100 text-gray-300 text-xs">✎</span>
              </>
            )}
          </div>
          <InlineText field="rental_start" label="배송일" value={rental.rental_start} type="date" />
          <InlineText field="rental_end" label="수거일" value={rental.rental_end} type="date" />
          <InlineText field="delivery_method" label="배송방법" value={rental.delivery_method} options={['착불택배','선불택배','업체배송수거','퀵','방문수령반납']} />
          <InlineText field="inflow_source" label="유입경로" value={rental.inflow_source} options={['네이버','인스타','유튜브','지인','기존고객','채널톡','기타']} />
        </div>
      </div>

      {/* 결제 / 보증금 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">결제 / 보증금</h3>
        <div className="space-y-2">
          <InlineText field="total_amount" label="총 금액" value={rental.total_amount ? `${fmt(rental.total_amount)}원` : null} type="number" />

          {/* 결제 상태 */}
          <div className="flex items-center gap-1 py-0.5">
            <span className="text-xs text-gray-400 w-20 shrink-0">결제 상태</span>
            <div className="flex gap-1 flex-wrap">
              {PAYMENT_STATUSES.map(s => (
                <button key={s}
                  onClick={() => saveField('payment_status', s)}
                  className={`text-xs px-2 py-0.5 rounded border ${rental.payment_status === s ? PAYMENT_BADGE[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* 보증금 토글 */}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-gray-400 w-20 shrink-0">보증금</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className={`relative w-9 h-5 rounded-full transition-colors ${rental.has_deposit ? 'bg-blue-400' : 'bg-gray-200'}`}
                onClick={() => saveField('has_deposit', !rental.has_deposit)}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rental.has_deposit ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-600">{rental.has_deposit ? '있음' : '없음'}</span>
            </label>
          </div>

          {rental.has_deposit && (
            <>
              <InlineText field="deposit" label="보증금액" value={rental.deposit ? `${fmt(rental.deposit)}원` : null} type="number" />
              <div className="flex items-center gap-1 py-0.5">
                <span className="text-xs text-gray-400 w-20 shrink-0">보증금 상태</span>
                <div className="flex gap-1 flex-wrap">
                  {DEPOSIT_STATUSES.map(s => (
                    <button key={s}
                      onClick={() => saveField('deposit_status', s)}
                      className={`text-xs px-2 py-0.5 rounded border ${rental.deposit_status === s ? DEPOSIT_BADGE[s] + ' border-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">체크리스트</h3>
        <div className="space-y-4">
          {CHECKLIST_GROUPS.map(group => {
            // 정산 그룹은 has_deposit 있을 때만
            if (group.label === '정산' && !rental.has_deposit) return null
            const groupDone = group.items.every(i => cl[i.key])
            return (
              <div key={group.label}>
                <div className={`flex items-center gap-2 mb-2`}>
                  <span className={`text-xs font-semibold ${group.color}`}>{group.label}</span>
                  {groupDone && <span className="text-xs text-green-500">✓ 완료</span>}
                  {group.autoTrigger && (
                    <span className="text-[10px] text-gray-300 ml-auto">{group.autoTrigger}</span>
                  )}
                </div>
                <div className="space-y-1 pl-1">
                  {group.items.map(item => {
                    const checked = !!cl[item.key]
                    // 이슈없음/이슈조치완료는 inspection_done 체크 후에만
                    const disabled = (item.key === 'no_issue' || item.key === 'issue_resolved') && !cl['inspection_done']
                    return (
                      <label key={item.key} className={`flex items-center gap-2 cursor-pointer group ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300 group-hover:border-yellow-300'}`}
                          onClick={() => !disabled && toggleChecklist(item.key, !checked)}>
                          {checked && <span className="text-white text-[10px]">✓</span>}
                        </div>
                        <span className={`text-sm ${checked ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 소통 이력 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">소통 이력</h3>
        {contacts.length === 0 ? (
          <p className="text-sm text-gray-300 mb-2">소통 내역 없음</p>
        ) : (
          <div className="space-y-2 mb-3">
            {contacts.map((c, i) => {
              const { date, body } = parseContact(c)
              return (
                <div key={i} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  {date && <span className="text-xs text-gray-400 mr-2">{date}</span>}
                  {body}
                </div>
              )
            })}
          </div>
        )}
        {contacts.length < 3 && (
          <div className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-1.5 text-sm flex-1"
              placeholder="소통 내용 입력"
              value={newContactText}
              onChange={e => setNewContactText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddContact()}
            />
            <button onClick={handleAddContact}
              className="text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5">추가</button>
          </div>
        )}
        {contacts.length >= 3 && (
          <p className="text-xs text-gray-300">소통 내역 3개 가득참. 수정에서 직접 편집하세요.</p>
        )}
      </div>

      {/* 대여 품목 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">대여 품목</h3>
        {rental.items.length > 0 && (
          <div className="space-y-2 mb-3">
            {rental.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-700 flex-1">{item.item_name}</span>
                {item.model_code && <span className="text-xs text-gray-400">{item.model_code}</span>}
                <span className="text-xs text-gray-500">{item.quantity}개 × {item.months}개월</span>
                <span className="text-xs font-medium text-gray-700">{fmt(item.total_price)}원</span>
                <button
                  onClick={() => removeRentalItem(item.id, rental.id).then(() => window.location.reload())}
                  className="text-gray-300 hover:text-red-400 ml-1 text-xs">✕</button>
              </div>
            ))}
            <div className="text-right text-sm font-semibold text-gray-700 pr-1">
              합계: {fmt(rental.items.reduce((s,i) => s + i.total_price, 0))}원
            </div>
          </div>
        )}
        {/* 품목 추가 */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="border rounded-lg px-2 py-1.5 text-sm col-span-2"
            placeholder="품목명 (예: 멜로디언)" value={newItem.item_name}
            onChange={e => setNewItem((p: typeof newItem) => ({...p, item_name: e.target.value}))} />
          <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="모델코드"
            value={newItem.model_code} onChange={e => setNewItem((p: typeof newItem) => ({...p, model_code: e.target.value}))} />
          <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="단가"
            type="number" value={newItem.unit_price}
            onChange={e => setNewItem((p: typeof newItem) => ({...p, unit_price: e.target.value}))} />
          <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="수량"
            type="number" value={newItem.quantity}
            onChange={e => setNewItem((p: typeof newItem) => ({...p, quantity: e.target.value}))} />
          <input className="border rounded-lg px-2 py-1.5 text-sm" placeholder="개월수"
            type="number" value={newItem.months}
            onChange={e => setNewItem((p: typeof newItem) => ({...p, months: e.target.value}))} />
        </div>
        <button onClick={handleAddItem}
          className="w-full text-sm border border-dashed border-gray-300 hover:border-yellow-400 rounded-lg py-1.5 text-gray-500 hover:text-yellow-600">
          + 품목 추가
        </button>
      </div>

      {/* 파일 / 드롭박스 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">파일 / 드롭박스</h3>
        {editingField === 'dropbox_url' ? (
          <div className="flex gap-2">
            <input className="border rounded-lg px-3 py-1.5 text-sm flex-1"
              value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter') saveField('dropbox_url', editValue); if(e.key==='Escape') setEditingField(null) }}
              autoFocus placeholder="드롭박스 URL" />
            <button className="text-sm text-blue-600 px-2" onClick={() => saveField('dropbox_url', editValue)}>저장</button>
          </div>
        ) : rental.dropbox_url ? (
          <div className="flex items-center gap-2">
            <a href={rental.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline flex-1 truncate">
              {rental.dropbox_url}
            </a>
            <button onClick={() => { setEditingField('dropbox_url'); setEditValue(rental.dropbox_url ?? '') }}
              className="text-xs text-gray-400 hover:text-gray-600">수정</button>
          </div>
        ) : (
          <button onClick={() => { setEditingField('dropbox_url'); setEditValue('') }}
            className="text-sm text-gray-400 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 rounded-lg px-3 py-2 w-full">
            + 드롭박스 URL 연결
          </button>
        )}
      </div>

      {/* 상담 메모 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">상담 메모</h3>
        {editingField === 'notes' ? (
          <div className="space-y-2">
            <textarea className="w-full border rounded-lg px-3 py-2 text-sm resize-none" rows={4}
              value={editValue} onChange={e => setEditValue(e.target.value)}
              autoFocus />
            <div className="flex gap-2">
              <button className="text-sm text-blue-600 px-3 py-1 border border-blue-200 rounded-lg"
                onClick={() => saveField('notes', editValue)}>저장</button>
              <button className="text-sm text-gray-400 px-3 py-1" onClick={() => setEditingField(null)}>취소</button>
            </div>
          </div>
        ) : (
          <div className="cursor-pointer group" onClick={() => { setEditingField('notes'); setEditValue(rental.notes ?? '') }}>
            {rental.notes ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{rental.notes}</p>
            ) : (
              <p className="text-sm text-gray-300">메모 없음 (클릭하여 입력)</p>
            )}
          </div>
        )}
      </div>

      {/* 삭제 */}
      <div className="flex justify-end pt-2">
        {showDeleteConfirm ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-500">정말 삭제할까요?</span>
            <button onClick={handleDelete} className="bg-red-500 text-white px-3 py-1.5 rounded-lg">삭제</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-400 px-2 py-1.5">취소</button>
          </div>
        ) : (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-gray-300 hover:text-red-400">삭제</button>
        )}
      </div>

    </div>
  )
}

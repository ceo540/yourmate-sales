'use client'
import { useState, useTransition, useEffect } from 'react'
import {
  createRental, updateRental, updateRentalStatus, deleteRental,
  addRentalItem, removeRentalItem, addRentalContact, updateRentalChecklist,
} from './actions'

// ─── 상태 ────────────────────────────────────────────────────────
export const RENTAL_STATUSES = ['전체','유입','견적/조율','렌탈확정','배송완료','진행중','수거완료','완료','취소','보류'] as const
export type RentalStatus = Exclude<typeof RENTAL_STATUSES[number], '전체'>

const STATUS_BADGE: Record<string, string> = {
  유입:       'bg-gray-100 text-gray-500',
  '견적/조율': 'bg-purple-100 text-purple-700',
  렌탈확정:   'bg-yellow-100 text-yellow-700',
  배송완료:   'bg-blue-100 text-blue-700',
  진행중:     'bg-green-100 text-green-700',
  수거완료:   'bg-teal-100 text-teal-700',
  완료:       'bg-gray-100 text-gray-400',
  취소:       'bg-red-100 text-red-400',
  보류:       'bg-orange-100 text-orange-700',
}
const STATUS_BAR: Record<string, string> = {
  유입:       'bg-gray-300',
  '견적/조율': 'bg-purple-400',
  렌탈확정:   'bg-yellow-400',
  배송완료:   'bg-blue-400',
  진행중:     'bg-green-500',
  수거완료:   'bg-teal-400',
  완료:       'bg-gray-200',
  취소:       'bg-red-300',
  보류:       'bg-orange-300',
}
const NEXT_STATUS: Record<string, string> = {
  유입:       '견적/조율',
  '견적/조율': '렌탈확정',
  렌탈확정:   '배송완료',
  배송완료:   '진행중',
  진행중:     '수거완료',
  수거완료:   '완료',
}
const STATUS_FLOW = ['유입','견적/조율','렌탈확정','배송완료','진행중','수거완료','완료']
function statusAtLeast(current: string, target: string) {
  const ci = STATUS_FLOW.indexOf(current)
  const ti = STATUS_FLOW.indexOf(target)
  return ci >= 0 && ti >= 0 && ci >= ti
}

// ─── 부가 상태 ────────────────────────────────────────────────────
const PAYMENT_STATUSES   = ['미결제','부분결제','결제완료','환불완료']
const DEPOSIT_STATUSES   = ['없음','보유중','환급완료']
const INSPECTION_STATUSES = ['검수전','정상','이슈발생']

const PAYMENT_BADGE: Record<string, string> = {
  미결제:   'bg-red-50 text-red-500',
  부분결제: 'bg-yellow-50 text-yellow-700',
  결제완료: 'bg-green-50 text-green-700',
  환불완료: 'bg-gray-100 text-gray-500',
}
const DEPOSIT_BADGE: Record<string, string> = {
  없음:     'bg-gray-100 text-gray-400',
  보유중:   'bg-blue-50 text-blue-600',
  환급완료: 'bg-green-50 text-green-600',
}
const INSPECTION_BADGE: Record<string, string> = {
  검수전:   'bg-gray-100 text-gray-400',
  정상:     'bg-green-50 text-green-600',
  이슈발생: 'bg-red-50 text-red-500',
}

// ─── 체크리스트 ───────────────────────────────────────────────────
const CHECKLIST_GROUPS = [
  {
    label: '계약', color: 'text-purple-600',
    items: [
      { key: 'contract_sent',   label: '견적서 발송' },
      { key: 'contract_signed', label: '계약서 서명' },
      { key: 'docs_received',   label: '서류 수령' },
    ],
  },
  {
    label: '배송', color: 'text-blue-600',
    items: [
      { key: 'pre_inspection', label: '검수 완료' },
      { key: 'packed',         label: '포장 완료' },
      { key: 'shipped',        label: '발송 완료' },
      { key: 'tracking_sent',  label: '송장 전달' },
    ],
  },
  {
    label: '반납', color: 'text-teal-600',
    items: [
      { key: 'return_notified', label: '반납 안내' },
      { key: 'returned',        label: '수거 완료' },
    ],
  },
  {
    label: '검수/정산', color: 'text-green-700',
    items: [
      { key: 'final_inspection', label: '검수 완료' },
      { key: 'deposit_returned', label: '보증금 환급' },
    ],
  },
]

// ─── 기타 상수 ────────────────────────────────────────────────────
const DELIVERY_METHODS = ['착불택배','선불택배','업체배송수거','퀵','방문수령반납']
const INFLOW_SOURCES   = ['네이버','인스타','유튜브','지인','기존고객','채널톡','기타']
const CUSTOMER_TYPES   = ['기관','개인']

// ─── 타입 ────────────────────────────────────────────────────────
interface RentalItem {
  id: string; item_name: string; model_code: string | null
  quantity: number; months: number; unit_price: number; total_price: number
}
interface Rental {
  id: string; customer_name: string; contact_name: string | null; phone: string | null
  email: string | null; customer_type: string; status: string
  rental_start: string | null; rental_end: string | null; payment_due: string | null
  delivery_method: string | null; pickup_method: string | null
  total_amount: number; deposit: number; payment_method: string | null
  assignee_id: string | null; assignee_name: string | null; inflow_source: string | null
  notes: string | null; content: string | null; dropbox_url: string | null
  contact_1: string | null; contact_2: string | null; contact_3: string | null
  items: RentalItem[]
  payment_status: string | null
  deposit_status: string | null
  inspection_status: string | null
  is_exception: boolean | null
  checklist: Record<string, boolean> | null
}
interface Props {
  rentals: Rental[]
  profiles: { id: string; name: string }[]
  customers: { id: string; name: string; type: string }[]
}

// ─── 유틸 ────────────────────────────────────────────────────────
const fmt = (n: number) => (n || 0).toLocaleString()

function daysFrom(d: string) {
  return Math.ceil((new Date(d).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}
function getDDay(dateStr: string | null) {
  if (!dateStr) return null
  const d = daysFrom(dateStr)
  if (d < 0)   return { label:`D+${Math.abs(d)}`, cls:'bg-gray-100 text-gray-400',              row:'' }
  if (d === 0) return { label:'D-day',              cls:'bg-red-500 text-white font-bold',        row:'bg-red-50/60' }
  if (d <= 3)  return { label:`D-${d}`,             cls:'bg-red-100 text-red-600 font-semibold', row:'bg-red-50/40' }
  if (d <= 7)  return { label:`D-${d}`,             cls:'bg-yellow-100 text-yellow-700',         row:'bg-yellow-50/40' }
  return       { label:`D-${d}`,                    cls:'bg-gray-100 text-gray-400',             row:'' }
}
function getDisplayDDay(r: Rental) {
  if (r.status === '렌탈확정') return getDDay(r.rental_start)
  if (['배송완료','진행중'].includes(r.status)) return getDDay(r.rental_end)
  return null
}
function parseContact(text: string) {
  const m = text.match(/^\[(\d{4}-\d{2}-\d{2})\] ([\s\S]+)$/)
  return m ? { date: m[1], body: m[2] } : { date: null, body: text }
}

// ─── 보기 탭 ────────────────────────────────────────────────────
const VIEWS = [
  { key:'전체' as const,     label:'전체',
    filter:(r:Rental)=>!['완료','취소','보류'].includes(r.status),
    sort:(a:Rental,b:Rental)=>(a.rental_end??'9')<(b.rental_end??'9')?-1:1 },
  { key:'배송 예정' as const, label:'배송 예정',
    filter:(r:Rental)=>r.status==='렌탈확정',
    sort:(a:Rental,b:Rental)=>(a.rental_start??'9')<(b.rental_start??'9')?-1:1 },
  { key:'수거 예정' as const, label:'수거 예정',
    filter:(r:Rental)=>['배송완료','진행중'].includes(r.status),
    sort:(a:Rental,b:Rental)=>(a.rental_end??'9')<(b.rental_end??'9')?-1:1 },
  { key:'진행 전' as const,  label:'진행 전',
    filter:(r:Rental)=>['유입','견적/조율'].includes(r.status),
    sort:(_a:Rental,_b:Rental)=>0 },
  { key:'완료 체크' as const, label:'완료 체크',
    filter:(r:Rental)=>['완료','취소','보류'].includes(r.status),
    sort:(a:Rental,b:Rental)=>(a.rental_end??'')>(b.rental_end??'')?-1:1 },
]
type ViewKey = typeof VIEWS[number]['key']

// ─── 메인 컴포넌트 ───────────────────────────────────────────────
export default function RentalsClient({ rentals, profiles, customers }: Props) {
  const [viewKey, setViewKey]         = useState<ViewKey>('전체')
  const [selected, setSelected]       = useState<Rental | null>(null)
  const [isPending, startTransition]  = useTransition()

  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({
    customer_id:'', customer_name:'', contact_name:'', phone:'', customer_type:'기관',
    assignee_id:'', rental_start:'', rental_end:'', delivery_method:'착불택배',
    inflow_source:'', total_amount:'', deposit:'',
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 8)
    : customers.slice(0, 8)

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Record<string,string>>({})

  const [showAddContact, setShowAddContact] = useState(false)
  const [contactText, setContactText]       = useState('')

  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState({ item_name:'', model_code:'', quantity:'1', months:'1', unit_price:'' })

  useEffect(() => {
    if (!selected) return
    const updated = rentals.find(r => r.id === selected.id)
    if (updated) setSelected(updated)
  }, [rentals])

  const view = VIEWS.find(v => v.key === viewKey)!
  const rows = [...rentals].filter(view.filter).sort(view.sort)

  const stats = [
    { label:'전체 진행', value:rentals.filter(r=>!['완료','취소','보류'].includes(r.status)).length, color:'text-gray-800' },
    { label:'배송 예정', value:rentals.filter(r=>r.status==='렌탈확정').length, color:'text-yellow-600' },
    { label:'렌탈중',    value:rentals.filter(r=>r.status==='진행중').length, color:'text-green-600' },
    { label:'수거 임박', value:rentals.filter(r=>r.rental_end&&['배송완료','진행중'].includes(r.status)&&daysFrom(r.rental_end)>=0&&daysFrom(r.rental_end)<=7).length, color:'text-red-600' },
  ]

  const contacts = selected ? [selected.contact_1, selected.contact_2, selected.contact_3]
    .filter(Boolean).map(c => parseContact(c!)) : []
  const itemsTotal = (selected?.items ?? []).reduce((s, i) => s + (i.total_price || 0), 0)

  // ── 핸들러 ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!newForm.customer_name) return
    const result = await createRental({
      customer_id:     newForm.customer_id || undefined,
      customer_name:   newForm.customer_name,
      contact_name:    newForm.contact_name || undefined,
      phone:           newForm.phone || undefined,
      customer_type:   newForm.customer_type,
      assignee_id:     newForm.assignee_id || undefined,
      rental_start:    newForm.rental_start || undefined,
      rental_end:      newForm.rental_end || undefined,
      delivery_method: newForm.delivery_method || undefined,
      inflow_source:   newForm.inflow_source || undefined,
      total_amount:    newForm.total_amount ? parseInt(newForm.total_amount) : undefined,
      deposit:         newForm.deposit ? parseInt(newForm.deposit) : undefined,
    })
    if (result?.error) { alert(result.error); return }
    setShowNew(false)
    setNewForm({ customer_id:'', customer_name:'', contact_name:'', phone:'', customer_type:'기관', assignee_id:'', rental_start:'', rental_end:'', delivery_method:'착불택배', inflow_source:'', total_amount:'', deposit:'' })
    setCustomerSearch('')
  }

  function openEdit() {
    if (!selected) return
    setEditForm({
      customer_name:   selected.customer_name,
      contact_name:    selected.contact_name ?? '',
      phone:           selected.phone ?? '',
      email:           selected.email ?? '',
      customer_type:   selected.customer_type,
      rental_start:    selected.rental_start ?? '',
      rental_end:      selected.rental_end ?? '',
      payment_due:     selected.payment_due ?? '',
      delivery_method: selected.delivery_method ?? '',
      total_amount:    selected.total_amount?.toString() ?? '',
      deposit:         selected.deposit?.toString() ?? '',
      payment_method:  selected.payment_method ?? '',
      assignee_id:     selected.assignee_id ?? '',
      inflow_source:   selected.inflow_source ?? '',
      notes:           selected.notes ?? '',
      contact_1:       selected.contact_1 ?? '',
      contact_2:       selected.contact_2 ?? '',
      contact_3:       selected.contact_3 ?? '',
    })
    setEditMode(true)
  }

  async function handleSave() {
    if (!selected) return
    const result = await updateRental(selected.id, {
      customer_name:   editForm.customer_name,
      contact_name:    editForm.contact_name || null,
      phone:           editForm.phone || null,
      email:           editForm.email || null,
      customer_type:   editForm.customer_type,
      rental_start:    editForm.rental_start || null,
      rental_end:      editForm.rental_end || null,
      payment_due:     editForm.payment_due || null,
      delivery_method: editForm.delivery_method || null,
      total_amount:    editForm.total_amount ? parseInt(editForm.total_amount) : 0,
      deposit:         editForm.deposit ? parseInt(editForm.deposit) : 0,
      payment_method:  editForm.payment_method || null,
      assignee_id:     editForm.assignee_id || null,
      inflow_source:   editForm.inflow_source || null,
      notes:           editForm.notes || null,
      contact_1:       editForm.contact_1 || null,
      contact_2:       editForm.contact_2 || null,
      contact_3:       editForm.contact_3 || null,
    })
    if (result?.error) { alert(result.error); return }
    setEditMode(false)
  }

  async function handleAddContact() {
    if (!selected || !contactText.trim()) return
    const result = await addRentalContact(selected.id, contactText)
    if (result?.error) { alert(result.error); return }
    setContactText(''); setShowAddContact(false)
  }

  async function handleAddItem() {
    if (!selected || !itemForm.item_name || !itemForm.unit_price) return
    const result = await addRentalItem(selected.id, {
      item_name:  itemForm.item_name,
      model_code: itemForm.model_code || undefined,
      quantity:   parseInt(itemForm.quantity) || 1,
      months:     parseInt(itemForm.months) || 1,
      unit_price: parseInt(itemForm.unit_price) || 0,
    })
    if (result?.error) { alert(result.error); return }
    setItemForm({ item_name:'', model_code:'', quantity:'1', months:'1', unit_price:'' })
    setShowAddItem(false)
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`"${selected.customer_name}" 렌탈 건을 삭제하시겠습니까?`)) return
    await deleteRental(selected.id)
    setSelected(null)
  }

  async function handleChecklistToggle(key: string, checked: boolean) {
    if (!selected) return
    const newChecklist = { ...(selected.checklist ?? {}), [key]: checked }
    setSelected(prev => prev ? { ...prev, checklist: newChecklist } : null)
    await updateRentalChecklist(selected.id, newChecklist)
  }

  async function handleMetaUpdate(field: string, value: string | boolean) {
    if (!selected) return
    setSelected(prev => prev ? { ...prev, [field]: value } : null)
    await updateRental(selected.id, { [field]: value })
  }

  function handleMilestone(targetStatus: string) {
    if (!selected || statusAtLeast(selected.status, targetStatus)) return
    startTransition(() => { void updateRentalStatus(selected.id, targetStatus) })
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 탭 + 등록 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setViewKey(v.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${viewKey === v.key ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={viewKey === v.key ? { backgroundColor:'#FFCE00' } : {}}>
              {v.label}
              <span className="ml-1 opacity-50">({rentals.filter(v.filter).length})</span>
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)}
          className="px-4 py-1.5 text-sm font-semibold rounded-lg"
          style={{ backgroundColor:'#FFCE00', color:'#121212' }}>
          + 렌탈 등록
        </button>
      </div>

      {/* 스플릿 패널 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-340px)] md:min-h-[560px]">

        {/* 왼쪽: 목록 */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} md:w-[50%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="w-1 p-0" />
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 w-16">D-Day</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">고객</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">배송→수거</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">담당</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">상태/금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">해당 건이 없습니다.</td></tr>
                )}
                {rows.map(r => {
                  const dday  = getDisplayDDay(r)
                  const isSel = selected?.id === r.id
                  return (
                    <tr key={r.id} onClick={() => { setSelected(isSel ? null : r); setShowAddContact(false); setShowAddItem(false) }}
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${isSel ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' : dday?.row ? `${dday.row} hover:brightness-95` : 'hover:bg-gray-50'}`}>
                      <td className="p-0"><div className={`w-1 min-h-[52px] ${STATUS_BAR[r.status] ?? 'bg-gray-200'}`} /></td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {dday ? <span className={`text-xs px-2 py-0.5 rounded-full ${dday.cls}`}>{dday.label}</span>
                               : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">
                          {r.customer_name}
                          {r.is_exception && <span className="ml-1 text-[10px] text-orange-500">⚠</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.contact_name ?? r.customer_type}</p>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap">
                        <p className="text-xs text-gray-600">{r.rental_start?.slice(5) ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.rental_end?.slice(5) ?? '—'}</p>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.assignee_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-400'}`}>{r.status}</span>
                        {r.payment_status && r.payment_status !== '미결제' && (
                          <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${PAYMENT_BADGE[r.payment_status] ?? 'bg-gray-100 text-gray-400'}`}>{r.payment_status}</span>
                        )}
                        {r.items.length > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{r.items.length}종</p>}
                        {r.total_amount > 0 && <p className="text-[10px] font-semibold text-gray-600 mt-0.5">{fmt(r.total_amount)}원</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">👈</span>
              <p className="text-sm">왼쪽에서 렌탈 건을 선택하세요</p>
            </div>
          ) : (
            <>
              {/* 패널 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100 bg-white shrink-0">
                <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 mb-2">← 목록으로</button>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-bold text-gray-900">{selected.customer_name}</h2>
                    {selected.contact_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{selected.contact_name}{selected.phone && ` · ${selected.phone}`}</p>
                    )}
                    {/* 상태 한 줄 */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status] ?? 'bg-gray-100 text-gray-400'}`}>{selected.status}</span>
                      <span className="text-gray-300 text-[10px]">/</span>
                      {/* 결제상태 */}
                      <select
                        value={selected.payment_status ?? '미결제'}
                        onChange={e => handleMetaUpdate('payment_status', e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer focus:outline-none appearance-none ${PAYMENT_BADGE[selected.payment_status ?? '미결제'] ?? 'bg-gray-100 text-gray-400'}`}>
                        {PAYMENT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {/* 보증금상태 */}
                      <select
                        value={selected.deposit_status ?? '없음'}
                        onChange={e => handleMetaUpdate('deposit_status', e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer focus:outline-none appearance-none ${DEPOSIT_BADGE[selected.deposit_status ?? '없음'] ?? 'bg-gray-100 text-gray-400'}`}>
                        {DEPOSIT_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {/* 검수상태 */}
                      <select
                        value={selected.inspection_status ?? '검수전'}
                        onChange={e => handleMetaUpdate('inspection_status', e.target.value)}
                        className={`text-xs px-2 py-0.5 rounded-full border-0 font-medium cursor-pointer focus:outline-none appearance-none ${INSPECTION_BADGE[selected.inspection_status ?? '검수전'] ?? 'bg-gray-100 text-gray-400'}`}>
                        {INSPECTION_STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                      {/* 예외진행 */}
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox"
                          checked={selected.is_exception ?? false}
                          onChange={e => handleMetaUpdate('is_exception', e.target.checked)}
                          className="w-3 h-3 rounded accent-orange-400" />
                        <span className={`text-xs font-medium ${selected.is_exception ? 'text-orange-500' : 'text-gray-400'}`}>예외</span>
                      </label>
                      {selected.dropbox_url && (
                        <a href={selected.dropbox_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors">
                          폴더 열기
                        </a>
                      )}
                    </div>
                    {selected.is_exception && (
                      <p className="mt-1.5 text-xs text-orange-500 font-medium">⚠ 계약 미완료 상태로 진행중</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-2">
                    <button onClick={openEdit} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">수정</button>
                    <button onClick={handleDelete} className="text-xs px-3 py-1.5 border border-red-100 text-red-400 rounded-lg hover:bg-red-50">삭제</button>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                {/* ── 상태 관리 ── */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  {/* 상태 흐름 */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {STATUS_FLOW.map((s, i) => (
                      <div key={s} className="flex items-center gap-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                          selected.status === s
                            ? (STATUS_BADGE[s] ?? '') + ' ring-1 ring-offset-1 ring-gray-300'
                            : statusAtLeast(selected.status, s)
                              ? 'text-gray-300'
                              : 'text-gray-200'
                        }`}>{s}</span>
                        {i < STATUS_FLOW.length - 1 && <span className="text-gray-200 text-[10px]">›</span>}
                      </div>
                    ))}
                  </div>

                  {/* 마일스톤 요약 체크박스 */}
                  <div className="flex items-center gap-4 py-1">
                    {([
                      { label:'계약완료', target:'렌탈확정' },
                      { label:'배송완료', target:'배송완료' },
                      { label:'수거완료', target:'수거완료' },
                    ]).map(({ label, target }) => {
                      const checked = statusAtLeast(selected.status, target)
                      return (
                        <label key={label} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={() => { if (!checked) handleMilestone(target) }}
                            className="w-3.5 h-3.5 rounded accent-yellow-400" />
                          <span className={`text-xs font-medium ${checked ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
                        </label>
                      )
                    })}
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2 flex-wrap">
                    {NEXT_STATUS[selected.status] && (
                      <button onClick={() => startTransition(() => { void updateRentalStatus(selected.id, NEXT_STATUS[selected.status]) })}
                        disabled={isPending}
                        className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50">
                        다음 단계 → {NEXT_STATUS[selected.status]}
                      </button>
                    )}
                    {!['취소','완료','보류'].includes(selected.status) && (
                      <button onClick={() => startTransition(() => { void updateRentalStatus(selected.id, '완료') })}
                        disabled={isPending}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-50">
                        완료 처리
                      </button>
                    )}
                    {!['취소','완료','보류'].includes(selected.status) && (
                      <button onClick={() => startTransition(() => { void updateRentalStatus(selected.id, '보류') })}
                        disabled={isPending}
                        className="px-3 py-1.5 border border-orange-100 text-orange-400 text-xs rounded-lg hover:bg-orange-50 disabled:opacity-50">
                        보류
                      </button>
                    )}
                    {!['취소','완료','보류'].includes(selected.status) && (
                      <button onClick={() => startTransition(() => { void updateRentalStatus(selected.id, '취소') })}
                        disabled={isPending}
                        className="px-3 py-1.5 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50 disabled:opacity-50">
                        취소
                      </button>
                    )}
                    {['취소','보류'].includes(selected.status) && (
                      <button onClick={() => startTransition(() => { void updateRentalStatus(selected.id, '유입') })}
                        disabled={isPending}
                        className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50 disabled:opacity-50">
                        복구 (유입으로)
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 단계별 체크리스트 ── */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-3">단계별 체크리스트</p>
                  <div className="grid grid-cols-2 gap-3">
                    {CHECKLIST_GROUPS.map(group => {
                      const checkedCount = group.items.filter(i => selected.checklist?.[i.key]).length
                      const allDone = checkedCount === group.items.length
                      return (
                        <div key={group.label} className={`rounded-xl p-3 border ${allDone ? 'bg-green-50/50 border-green-100' : 'bg-gray-50 border-transparent'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className={`text-xs font-semibold ${group.color}`}>{group.label}</p>
                            <span className={`text-[10px] font-medium ${allDone ? 'text-green-600' : 'text-gray-400'}`}>{checkedCount}/{group.items.length}</span>
                          </div>
                          <div className="space-y-1.5">
                            {group.items.map(item => {
                              const checked = selected.checklist?.[item.key] ?? false
                              return (
                                <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                  <input type="checkbox" checked={checked}
                                    onChange={e => handleChecklistToggle(item.key, e.target.checked)}
                                    className="w-3.5 h-3.5 rounded accent-yellow-400 shrink-0" />
                                  <span className={`text-xs transition-colors ${checked ? 'text-gray-300 line-through' : 'text-gray-600 group-hover:text-gray-900'}`}>
                                    {item.label}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── 기본 정보 ── */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2.5">기본 정보</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {([
                      ['배송일',    selected.rental_start],
                      ['수거일',    selected.rental_end],
                      ['결제 시기', selected.payment_due],
                      ['배송 방법', selected.delivery_method],
                      ['총 금액',   selected.total_amount ? fmt(selected.total_amount) + '원' : null],
                      ['보증금',    selected.deposit ? fmt(selected.deposit) + '원' : null],
                      ['결제 방식', selected.payment_method],
                      ['담당 직원', selected.assignee_name],
                      ['유입 경로', selected.inflow_source],
                    ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-gray-800 mt-0.5 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 소통 이력 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-gray-400">소통 이력</p>
                    {contacts.length < 3 && (
                      <button onClick={() => setShowAddContact(!showAddContact)}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                        + 추가
                      </button>
                    )}
                  </div>
                  {showAddContact && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
                      <textarea value={contactText} onChange={e => setContactText(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none bg-white focus:outline-none focus:border-gray-300"
                        rows={3} placeholder="상담 내용, 통화 내역, 이메일 내용 등..." />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowAddContact(false); setContactText('') }}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">취소</button>
                        <button onClick={handleAddContact} disabled={!contactText.trim() || isPending}
                          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50">저장</button>
                      </div>
                    </div>
                  )}
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-300 py-3 text-center">기록된 소통 내역이 없습니다</p>
                  ) : (
                    <div className="space-y-2.5">
                      {contacts.map((c, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center pt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1" />
                            {i < contacts.length - 1 && <div className="w-px flex-1 bg-gray-100 min-h-[16px] mt-1" />}
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="text-[10px] text-gray-400 mb-0.5">{c.date ?? ''}</p>
                            <p className="text-xs text-gray-600 leading-relaxed">{c.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 대여 품목 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-gray-400">대여 품목</p>
                    <button onClick={() => setShowAddItem(!showAddItem)}
                      className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                      + 추가
                    </button>
                  </div>
                  {showAddItem && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">품목명 *</label>
                          <input value={itemForm.item_name} onChange={e => setItemForm(f=>({...f,item_name:e.target.value}))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" placeholder="젬베 10 단기" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">관리코드</label>
                          <input value={itemForm.model_code} onChange={e => setItemForm(f=>({...f,model_code:e.target.value}))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" placeholder="JB24N01" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">수량</label>
                          <input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(f=>({...f,quantity:e.target.value}))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">개월</label>
                          <input type="number" min="1" value={itemForm.months} onChange={e => setItemForm(f=>({...f,months:e.target.value}))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">단가 *</label>
                          <input type="number" value={itemForm.unit_price} onChange={e => setItemForm(f=>({...f,unit_price:e.target.value}))}
                            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                        </div>
                      </div>
                      {itemForm.quantity && itemForm.months && itemForm.unit_price && (
                        <p className="text-xs text-blue-600">소계: {fmt(parseInt(itemForm.quantity||'0')*parseInt(itemForm.months||'0')*parseInt(itemForm.unit_price||'0'))}원</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddItem(false)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">취소</button>
                        <button onClick={handleAddItem} disabled={!itemForm.item_name || !itemForm.unit_price || isPending}
                          className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50">추가</button>
                      </div>
                    </div>
                  )}
                  {selected.items.length === 0 && !showAddItem ? (
                    <p className="text-xs text-gray-300 py-3 text-center">등록된 품목이 없습니다</p>
                  ) : selected.items.length > 0 ? (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-3 py-2 text-gray-400 font-medium">품목</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-medium">수량</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-medium">개월</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium">합계</th>
                            <th className="w-6" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {selected.items.map(item => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-gray-700 font-medium">
                                {item.item_name}
                                {item.model_code && <span className="text-gray-400 ml-1">({item.model_code})</span>}
                              </td>
                              <td className="text-center px-2 py-2 text-gray-500">{item.quantity}</td>
                              <td className="text-center px-2 py-2 text-gray-500">{item.months}개월</td>
                              <td className="text-right px-3 py-2 font-semibold text-gray-700">{fmt(item.total_price)}</td>
                              <td className="text-right pr-2">
                                <button onClick={() => startTransition(() => { void removeRentalItem(item.id, selected.id) })}
                                  className="text-gray-300 hover:text-red-400 transition-colors">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex justify-between">
                        <span className="text-xs text-gray-400">품목 합계</span>
                        <span className="text-xs font-bold text-gray-800">{fmt(itemsTotal)}원</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* ── 파일 · 드롭박스 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-gray-400">파일 · 드롭박스</p>
                    {selected.dropbox_url && (
                      <a href={selected.dropbox_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                        폴더 열기
                      </a>
                    )}
                  </div>
                  {selected.dropbox_url ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                      <p className="text-xs text-gray-500">파일은 드롭박스 폴더에서 직접 관리하세요.</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 truncate">{selected.dropbox_url}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400 mb-0.5">드롭박스 폴더가 없습니다</p>
                      <p className="text-[10px] text-gray-300">렌탈 등록 시 교구대여 경로에 자동 생성됩니다</p>
                    </div>
                  )}
                </div>

                {/* ── 메모 ── */}
                <div className="pb-2">
                  <p className="text-xs font-semibold text-gray-400 mb-2">상담 메모</p>
                  <ContentMemo rentalId={selected.id} initialContent={selected.content ?? ''} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 신규 등록 모달 ── */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">렌탈 등록</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>고객 검색 (고객 DB) *</label>
                <div className="relative">
                  <input
                    value={customerSearch}
                    onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); if (!e.target.value) setNewForm(f=>({...f,customer_id:'',customer_name:'',customer_type:'기관'})) }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className={inputCls}
                    placeholder="기관명 검색..."
                  />
                  {newForm.customer_id && (
                    <span className="absolute right-3 top-2.5 text-xs text-green-600 font-medium">DB 연동</span>
                  )}
                  {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => {
                            setNewForm(f=>({...f, customer_id:c.id, customer_name:c.name, customer_type:c.type==='기타'?'기관':c.type}))
                            setCustomerSearch(c.name)
                            setShowCustomerDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm flex items-center gap-2">
                          <span className="text-gray-800 font-medium">{c.name}</span>
                          <span className="text-xs text-gray-400">{c.type}</span>
                        </button>
                      ))}
                      <button type="button"
                        onClick={() => { setNewForm(f=>({...f, customer_id:'', customer_name:customerSearch})); setShowCustomerDropdown(false) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-yellow-50 text-sm text-yellow-700 border-t border-gray-100">
                        + &quot;{customerSearch}&quot; 새 고객으로 등록
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>고객명 확인</label>
                  <input value={newForm.customer_name} onChange={e=>setNewForm(f=>({...f,customer_name:e.target.value,customer_id:''}))} className={inputCls} placeholder="검색 후 자동 입력" /></div>
                <div><label className={labelCls}>구분</label>
                  <select value={newForm.customer_type} onChange={e=>setNewForm(f=>({...f,customer_type:e.target.value}))} className={inputCls}>
                    {CUSTOMER_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>담당자명</label>
                  <input value={newForm.contact_name} onChange={e=>setNewForm(f=>({...f,contact_name:e.target.value}))} className={inputCls} placeholder="홍길동" /></div>
                <div><label className={labelCls}>연락처</label>
                  <input value={newForm.phone} onChange={e=>setNewForm(f=>({...f,phone:e.target.value}))} className={inputCls} placeholder="010-0000-0000" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>배송일</label>
                  <input type="date" value={newForm.rental_start} onChange={e=>setNewForm(f=>({...f,rental_start:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>수거일</label>
                  <input type="date" value={newForm.rental_end} onChange={e=>setNewForm(f=>({...f,rental_end:e.target.value}))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>배송방법</label>
                  <select value={newForm.delivery_method} onChange={e=>setNewForm(f=>({...f,delivery_method:e.target.value}))} className={inputCls}>
                    {DELIVERY_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
                <div><label className={labelCls}>유입경로</label>
                  <select value={newForm.inflow_source} onChange={e=>setNewForm(f=>({...f,inflow_source:e.target.value}))} className={inputCls}>
                    <option value="">선택</option>
                    {INFLOW_SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>총 금액 (원)</label>
                  <input type="number" value={newForm.total_amount} onChange={e=>setNewForm(f=>({...f,total_amount:e.target.value}))} className={inputCls} placeholder="0" /></div>
                <div><label className={labelCls}>보증금 (원)</label>
                  <input type="number" value={newForm.deposit} onChange={e=>setNewForm(f=>({...f,deposit:e.target.value}))} className={inputCls} placeholder="0" /></div>
              </div>
              <div><label className={labelCls}>담당자</label>
                <select value={newForm.assignee_id} onChange={e=>setNewForm(f=>({...f,assignee_id:e.target.value}))} className={inputCls}>
                  <option value="">선택 안 함</option>
                  {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            </div>
            <p className="text-xs text-gray-400 mt-3">등록 시 드롭박스 교구대여 폴더가 자동 생성됩니다.</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} disabled={!newForm.customer_name || isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor:'#FFCE00', color:'#121212' }}>
                {isPending ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수정 모달 ── */}
      {editMode && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">수정 — {selected.customer_name}</h3>
              <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>고객명</label>
                  <input value={editForm.customer_name} onChange={e=>setEditForm(f=>({...f,customer_name:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>구분</label>
                  <select value={editForm.customer_type} onChange={e=>setEditForm(f=>({...f,customer_type:e.target.value}))} className={inputCls}>
                    {CUSTOMER_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>담당자명</label>
                  <input value={editForm.contact_name} onChange={e=>setEditForm(f=>({...f,contact_name:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>연락처</label>
                  <input value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>배송일</label>
                  <input type="date" value={editForm.rental_start} onChange={e=>setEditForm(f=>({...f,rental_start:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>수거일</label>
                  <input type="date" value={editForm.rental_end} onChange={e=>setEditForm(f=>({...f,rental_end:e.target.value}))} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>결제 시기</label>
                  <input type="date" value={editForm.payment_due} onChange={e=>setEditForm(f=>({...f,payment_due:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>배송방법</label>
                  <select value={editForm.delivery_method} onChange={e=>setEditForm(f=>({...f,delivery_method:e.target.value}))} className={inputCls}>
                    {DELIVERY_METHODS.map(m=><option key={m}>{m}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>총 금액 (원)</label>
                  <input type="number" value={editForm.total_amount} onChange={e=>setEditForm(f=>({...f,total_amount:e.target.value}))} className={inputCls} /></div>
                <div><label className={labelCls}>보증금 (원)</label>
                  <input type="number" value={editForm.deposit} onChange={e=>setEditForm(f=>({...f,deposit:e.target.value}))} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>결제방식</label>
                <input value={editForm.payment_method} onChange={e=>setEditForm(f=>({...f,payment_method:e.target.value}))} className={inputCls} placeholder="계좌이체, 카드 등" /></div>
              <div><label className={labelCls}>담당 직원</label>
                <select value={editForm.assignee_id} onChange={e=>setEditForm(f=>({...f,assignee_id:e.target.value}))} className={inputCls}>
                  <option value="">선택 안 함</option>
                  {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className={labelCls}>유입경로</label>
                <select value={editForm.inflow_source} onChange={e=>setEditForm(f=>({...f,inflow_source:e.target.value}))} className={inputCls}>
                  <option value="">선택</option>
                  {INFLOW_SOURCES.map(s=><option key={s}>{s}</option>)}</select></div>
              <div><label className={labelCls}>메모</label>
                <textarea value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} className={inputCls} rows={2} /></div>
              <div><label className={labelCls}>소통 이력 1</label>
                <textarea value={editForm.contact_1} onChange={e=>setEditForm(f=>({...f,contact_1:e.target.value}))} className={inputCls} rows={2} placeholder="[YYYY-MM-DD] 내용" /></div>
              <div><label className={labelCls}>소통 이력 2</label>
                <textarea value={editForm.contact_2} onChange={e=>setEditForm(f=>({...f,contact_2:e.target.value}))} className={inputCls} rows={2} placeholder="[YYYY-MM-DD] 내용" /></div>
              <div><label className={labelCls}>소통 이력 3</label>
                <textarea value={editForm.contact_3} onChange={e=>setEditForm(f=>({...f,contact_3:e.target.value}))} className={inputCls} rows={2} placeholder="[YYYY-MM-DD] 내용" /></div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor:'#FFCE00', color:'#121212' }}>
                {isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 상담 메모: blur 시 자동저장
function ContentMemo({ rentalId, initialContent }: { rentalId: string; initialContent: string }) {
  const [content, setContent]   = useState(initialContent)
  const [saved, setSaved]       = useState(true)
  const [isPending, startTrans] = useTransition()

  async function handleSave() {
    startTrans(async () => {
      await updateRental(rentalId, { content })
      setSaved(true)
    })
  }

  return (
    <div>
      <textarea
        value={content}
        onChange={e => { setContent(e.target.value); setSaved(false) }}
        onBlur={handleSave}
        className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-700 resize-none bg-gray-50 focus:outline-none focus:border-gray-300 min-h-[72px]"
        rows={4}
        placeholder="기타 메모, 요청사항, 특이사항 등..." />
      <div className="flex justify-end mt-1 h-4">
        {!saved && !isPending && <span className="text-[10px] text-gray-400">저장되지 않음 (입력 후 클릭 이탈 시 자동저장)</span>}
        {saved && content && <span className="text-[10px] text-gray-300">저장됨</span>}
      </div>
    </div>
  )
}

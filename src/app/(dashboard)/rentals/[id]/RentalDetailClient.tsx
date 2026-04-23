'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateRental, updateRentalStatus, deleteRental, addRentalItem, removeRentalItem, addRentalDelivery, updateRentalDelivery, deleteRentalDelivery, updateDeliveryChecklist, linkRentalToParent, unlinkRentalFromParent } from '../actions'
import { RENTAL_STATUSES } from '../RentalsClient'

const STATUS_STYLE: Record<string, string> = {
  유입:      'bg-gray-100 text-gray-600',
  상담:      'bg-purple-100 text-purple-700',
  견적발송:  'bg-blue-100 text-blue-700',
  확정:      'bg-yellow-100 text-yellow-700',
  계약서서명:'bg-orange-100 text-orange-700',
  진행중:    'bg-green-100 text-green-700',
  반납:      'bg-teal-100 text-teal-700',
  완료:      'bg-gray-100 text-gray-500',
  취소:      'bg-red-100 text-red-400',
}

// 다음 상태 흐름
const NEXT_STATUS: Record<string, string> = {
  유입: '상담', 상담: '견적발송', 견적발송: '확정',
  확정: '계약서서명', 계약서서명: '진행중', 진행중: '반납', 반납: '완료',
}

const DELIVERY_METHODS = ['착불택배', '선불택배', '업체배송수거', '퀵', '방문수령반납']
const fmt = (n: number) => (n || 0).toLocaleString()

interface RentalItem {
  id: string
  item_name: string
  model_code: string | null
  quantity: number
  months: number
  unit_price: number
  total_price: number
  notes: string | null
}

interface RentalDelivery {
  id: string
  location: string
  contact_name: string | null
  phone: string | null
  delivery_date: string | null
  pickup_date: string | null
  delivery_method: string | null
  status: string
  checklist: Record<string, boolean>
  notes: string | null
}

interface LinkedRental {
  id: string
  title: string | null
  customer_name: string
  status: string
  rental_start: string | null
  rental_end: string | null
  total_amount: number
}

interface Rental {
  id: string
  customer_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  customer_type: string
  rental_start: string | null
  rental_end: string | null
  payment_due: string | null
  delivery_method: string | null
  pickup_method: string | null
  total_amount: number
  deposit: number
  payment_method: string | null
  status: string
  assignee_id: string | null
  assignee_name: string | null
  inflow_source: string | null
  notes: string | null
  content: string | null
  items: RentalItem[]
  deliveries: RentalDelivery[]
  linkedRentals: LinkedRental[]
}

interface Props {
  rental: Rental
  profiles: { id: string; name: string }[]
  linkableRentals: LinkedRental[]
}

const DELIVERY_STATUS_BADGE: Record<string, string> = {
  '대기':    'bg-gray-100 text-gray-500',
  '배송완료': 'bg-blue-100 text-blue-700',
  '수거완료': 'bg-teal-100 text-teal-700',
  '검수완료': 'bg-green-100 text-green-700',
}

const DELIVERY_CHECKLIST_GROUPS = [
  {
    label: '배송', color: 'text-blue-600',
    items: [
      { key: 'outbound_inspection', label: '출고 전 검수' },
      { key: 'packed',              label: '포장 완료' },
      { key: 'shipping_ready',      label: '발송 준비' },
      { key: 'delivered',           label: '배송 완료' },
      { key: 'delivery_confirmed',  label: '수령 확인' },
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
    label: '검수', color: 'text-orange-600',
    items: [
      { key: 'inspection_done', label: '검수 완료' },
      { key: 'no_issue',        label: '이상 없음' },
      { key: 'issue_resolved',  label: '이슈 조치 완료' },
    ],
  },
]

export default function RentalDetailClient({ rental, profiles, linkableRentals }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(rental.content ?? '')
  const [contentSaved, setContentSaved] = useState(true)

  // 연결된 기존 건
  const [linkedRentals, setLinkedRentals] = useState<LinkedRental[]>(rental.linkedRentals)
  const [showLinkSearch, setShowLinkSearch] = useState(false)
  const [linkSearch, setLinkSearch] = useState('')

  const filteredLinkable = linkableRentals.filter(r =>
    !linkedRentals.find(l => l.id === r.id) &&
    (r.customer_name.includes(linkSearch) || (r.title ?? '').includes(linkSearch))
  )

  // 배송일정
  const [deliveries, setDeliveries] = useState<RentalDelivery[]>(rental.deliveries)
  const [showAddDelivery, setShowAddDelivery] = useState(false)
  const [expandedDelivery, setExpandedDelivery] = useState<string | null>(null)
  const [syncingCalDelivery, setSyncingCalDelivery] = useState<string | null>(null)

  async function handleSyncDeliveryCalendar(d: RentalDelivery) {
    setSyncingCalDelivery(d.id)
    try {
      const events = []
      if (d.delivery_date) events.push({ title: `[배송] ${d.location} (${rental.customer_name})`, date: d.delivery_date })
      if (d.pickup_date) events.push({ title: `[수거] ${d.location} (${rental.customer_name})`, date: d.pickup_date })
      await Promise.all(events.map(ev =>
        fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendarKey: 'rental', ...ev, isAllDay: true }),
        })
      ))
      alert(`캘린더에 ${events.length}개 일정을 등록했어요.`)
    } catch {
      alert('캘린더 등록에 실패했습니다.')
    } finally {
      setSyncingCalDelivery(null)
    }
  }
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  const emptyDeliveryForm = { location: '', contact_name: '', phone: '', delivery_date: '', pickup_date: '', delivery_method: '', notes: '' }
  const [deliveryForm, setDeliveryForm] = useState(emptyDeliveryForm)
  const [editDeliveryForm, setEditDeliveryForm] = useState(emptyDeliveryForm)

  async function handleContentSave() {
    await updateRental(rental.id, { content })
    setContentSaved(true)
  }
  const [editForm, setEditForm] = useState({
    customer_name: rental.customer_name,
    contact_name: rental.contact_name ?? '',
    phone: rental.phone ?? '',
    email: rental.email ?? '',
    customer_type: rental.customer_type,
    rental_start: rental.rental_start ?? '',
    rental_end: rental.rental_end ?? '',
    payment_due: rental.payment_due ?? '',
    delivery_method: rental.delivery_method ?? '',
    pickup_method: rental.pickup_method ?? '',
    total_amount: rental.total_amount?.toString() ?? '',
    deposit: rental.deposit?.toString() ?? '',
    payment_method: rental.payment_method ?? '',
    assignee_id: rental.assignee_id ?? '',
    inflow_source: rental.inflow_source ?? '',
    notes: rental.notes ?? '',
  })

  // 품목 추가 폼
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemForm, setItemForm] = useState({ item_name: '', model_code: '', quantity: '1', months: '1', unit_price: '', notes: '' })

  async function handleStatusChange(newStatus: string) {
    startTransition(() => { updateRentalStatus(rental.id, newStatus) })
  }

  async function handleSave() {
    const result = await updateRental(rental.id, {
      customer_name: editForm.customer_name,
      contact_name: editForm.contact_name || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      customer_type: editForm.customer_type,
      rental_start: editForm.rental_start || null,
      rental_end: editForm.rental_end || null,
      payment_due: editForm.payment_due || null,
      delivery_method: editForm.delivery_method || null,
      pickup_method: editForm.pickup_method || null,
      total_amount: editForm.total_amount ? parseInt(editForm.total_amount) : 0,
      deposit: editForm.deposit ? parseInt(editForm.deposit) : 0,
      payment_method: editForm.payment_method || null,
      assignee_id: editForm.assignee_id || null,
      inflow_source: editForm.inflow_source || null,
      notes: editForm.notes || null,
    })
    if (result?.error) { alert(result.error); return }
    setEditing(false)
  }

  async function handleAddItem() {
    if (!itemForm.item_name || !itemForm.unit_price) return
    const result = await addRentalItem(rental.id, {
      item_name: itemForm.item_name,
      model_code: itemForm.model_code || undefined,
      quantity: parseInt(itemForm.quantity) || 1,
      months: parseInt(itemForm.months) || 1,
      unit_price: parseInt(itemForm.unit_price) || 0,
      notes: itemForm.notes || undefined,
    })
    if (result?.error) { alert(result.error); return }
    setItemForm({ item_name: '', model_code: '', quantity: '1', months: '1', unit_price: '', notes: '' })
    setShowAddItem(false)
  }

  async function handleDelete() {
    if (!confirm(`"${rental.customer_name}" 렌탈 건을 삭제하시겠습니까?`)) return
    await deleteRental(rental.id)
    router.push('/rentals')
  }

  const itemsTotal = rental.items.reduce((s, i) => s + (i.total_price || 0), 0)
  const nextStatus = NEXT_STATUS[rental.status]

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">← 목록</button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{rental.customer_name}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[rental.status]}`}>{rental.status}</span>
          </div>
          {rental.contact_name && <p className="text-sm text-gray-500 mt-0.5">{rental.contact_name} {rental.phone && `· ${rental.phone}`}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            {editing ? '취소' : '수정'}
          </button>
          <button onClick={handleDelete}
            className="text-sm px-3 py-1.5 border border-red-200 text-red-400 rounded-lg hover:bg-red-50">
            삭제
          </button>
        </div>
      </div>

      {/* 상태 진행 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {['유입','상담','견적발송','확정','계약서서명','진행중','반납','완료'].map((s, i, arr) => (
            <div key={s} className="flex items-center gap-1">
              <span className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${rental.status === s ? STATUS_STYLE[s] + ' ring-2 ring-offset-1 ring-gray-300' : 'text-gray-300'}`}>{s}</span>
              {i < arr.length - 1 && <span className="text-gray-200 text-xs">›</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {nextStatus && (
            <button onClick={() => handleStatusChange(nextStatus)} disabled={isPending}
              className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium">
              → {nextStatus}으로 변경
            </button>
          )}
          {rental.status !== '취소' && rental.status !== '완료' && (
            <button onClick={() => handleStatusChange('취소')} disabled={isPending}
              className="px-4 py-2 border border-red-200 text-red-400 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50">
              취소 처리
            </button>
          )}
          {rental.status === '취소' && (
            <button onClick={() => handleStatusChange('유입')} disabled={isPending}
              className="px-4 py-2 border border-gray-200 text-gray-500 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
              복구 (유입으로)
            </button>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">기본 정보</h2>
        {editing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">고객명</label>
                <input value={editForm.customer_name} onChange={e => setEditForm(f => ({...f, customer_name: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">구분</label>
                <select value={editForm.customer_type} onChange={e => setEditForm(f => ({...f, customer_type: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option>기관</option><option>개인</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">담당자</label>
                <input value={editForm.contact_name} onChange={e => setEditForm(f => ({...f, contact_name: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">연락처</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">배송일</label>
                <input type="date" value={editForm.rental_start} onChange={e => setEditForm(f => ({...f, rental_start: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">수거일</label>
                <input type="date" value={editForm.rental_end} onChange={e => setEditForm(f => ({...f, rental_end: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">배송방법</label>
                <select value={editForm.delivery_method} onChange={e => setEditForm(f => ({...f, delivery_method: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">결제시기</label>
                <input type="date" value={editForm.payment_due} onChange={e => setEditForm(f => ({...f, payment_due: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">총 금액 (원)</label>
                <input type="number" value={editForm.total_amount} onChange={e => setEditForm(f => ({...f, total_amount: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">보증금 (원)</label>
                <input type="number" value={editForm.deposit} onChange={e => setEditForm(f => ({...f, deposit: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">결제방식</label>
              <input value={editForm.payment_method} onChange={e => setEditForm(f => ({...f, payment_method: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="계좌이체, 카드 등" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">담당 직원</label>
              <select value={editForm.assignee_id} onChange={e => setEditForm(f => ({...f, assignee_id: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">선택 안 함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">메모</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3} />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleSave} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">저장</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <InfoRow label="고객 구분" value={rental.customer_type} />
            <InfoRow label="담당자" value={rental.contact_name} />
            <InfoRow label="연락처" value={rental.phone} />
            <InfoRow label="이메일" value={rental.email} />
            <InfoRow label="배송일" value={rental.rental_start} />
            <InfoRow label="수거일" value={rental.rental_end} />
            <InfoRow label="결제시기" value={rental.payment_due} />
            <InfoRow label="배송방법" value={rental.delivery_method} />
            <InfoRow label="총 금액" value={rental.total_amount ? fmt(rental.total_amount) + '원' : null} />
            <InfoRow label="보증금" value={rental.deposit ? fmt(rental.deposit) + '원' : null} />
            <InfoRow label="결제방식" value={rental.payment_method} />
            <InfoRow label="담당 직원" value={rental.assignee_name} />
            {rental.notes && <div className="col-span-2"><InfoRow label="메모" value={rental.notes} /></div>}
          </div>
        )}
      </div>

      {/* 품목 목록 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">대여 품목</h2>
          <button onClick={() => setShowAddItem(!showAddItem)}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            + 품목 추가
          </button>
        </div>

        {showAddItem && (
          <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">품목명 *</label>
                <input value={itemForm.item_name} onChange={e => setItemForm(f => ({...f, item_name: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="젬베 10 단기" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">관리코드</label>
                <input value={itemForm.model_code} onChange={e => setItemForm(f => ({...f, model_code: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="JB24N01" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">수량</label>
                <input type="number" value={itemForm.quantity} onChange={e => setItemForm(f => ({...f, quantity: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" min="1" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">개월</label>
                <input type="number" value={itemForm.months} onChange={e => setItemForm(f => ({...f, months: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" min="1" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">단가 (원) *</label>
                <input type="number" value={itemForm.unit_price} onChange={e => setItemForm(f => ({...f, unit_price: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
            </div>
            {itemForm.quantity && itemForm.months && itemForm.unit_price && (
              <p className="text-xs text-blue-600">
                소계: {fmt(parseInt(itemForm.quantity||'0') * parseInt(itemForm.months||'0') * parseInt(itemForm.unit_price||'0'))}원
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowAddItem(false)} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500">취소</button>
              <button onClick={handleAddItem} disabled={!itemForm.item_name || !itemForm.unit_price}
                className="flex-1 py-1.5 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50">추가</button>
            </div>
          </div>
        )}

        {rental.items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">등록된 품목이 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs text-gray-400 font-medium">품목명</th>
                    <th className="text-center py-2 text-xs text-gray-400 font-medium">수량</th>
                    <th className="text-center py-2 text-xs text-gray-400 font-medium">개월</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-medium">단가</th>
                    <th className="text-right py-2 text-xs text-gray-400 font-medium">합계</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rental.items.map(item => (
                    <tr key={item.id}>
                      <td className="py-2.5">
                        <p className="text-gray-800">{item.item_name}</p>
                        {item.model_code && <p className="text-xs text-gray-400">{item.model_code}</p>}
                      </td>
                      <td className="text-center text-gray-600">{item.quantity}</td>
                      <td className="text-center text-gray-600">{item.months}개월</td>
                      <td className="text-right text-gray-600">{fmt(item.unit_price)}</td>
                      <td className="text-right font-medium text-gray-800">{fmt(item.total_price)}</td>
                      <td className="text-right">
                        <button onClick={() => startTransition(() => { void removeRentalItem(item.id, rental.id) })}
                          className="text-gray-300 hover:text-red-400 text-xs transition-colors">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between">
              <span className="text-sm text-gray-500">품목 합계</span>
              <span className="text-sm font-bold text-gray-800">{fmt(itemsTotal)}원</span>
            </div>
          </>
        )}
      </div>

      {/* 연결된 기존 건 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">연결된 기존 건 <span className="text-gray-400 font-normal">({linkedRentals.length})</span></h2>
          <button onClick={() => { setShowLinkSearch(v => !v); setLinkSearch('') }}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            + 기존 건 연결
          </button>
        </div>

        {showLinkSearch && (
          <div className="mb-3 border border-yellow-200 rounded-xl p-3 bg-yellow-50 space-y-2">
            <input
              autoFocus
              value={linkSearch}
              onChange={e => setLinkSearch(e.target.value)}
              placeholder="고객명 또는 건명으로 검색..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
            />
            {filteredLinkable.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">연결 가능한 건이 없습니다.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredLinkable.slice(0, 20).map(r => (
                  <button key={r.id}
                    onClick={async () => {
                      const result = await linkRentalToParent(r.id, rental.id)
                      if ('error' in result) { alert(result.error); return }
                      setLinkedRentals(prev => [...prev, r])
                      setShowLinkSearch(false)
                      setLinkSearch('')
                    }}
                    className="w-full text-left px-3 py-2 bg-white border border-gray-100 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{r.title || r.customer_name}</p>
                        {r.title && <p className="text-[10px] text-gray-400">{r.customer_name}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {r.rental_start && <span className="text-[10px] text-gray-400">{r.rental_start}</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DELIVERY_STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setShowLinkSearch(false); setLinkSearch('') }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">취소</button>
          </div>
        )}

        {linkedRentals.length === 0 && !showLinkSearch ? (
          <p className="text-sm text-gray-400 text-center py-4">연결된 기존 건이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {linkedRentals.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.title || r.customer_name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                    {r.title && <span>{r.customer_name}</span>}
                    {r.rental_start && <span>{r.rental_start}</span>}
                    {r.rental_end && <span>→ {r.rental_end}</span>}
                    {r.total_amount > 0 && <span>{fmt(r.total_amount)}원</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DELIVERY_STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span>
                  <a href={`/rentals/${r.id}`} className="text-xs text-blue-400 hover:text-blue-600 px-2 py-1 border border-blue-100 rounded-lg">보기</a>
                  <button onClick={async () => {
                    if (!confirm(`"${r.title || r.customer_name}" 연결을 해제할까요?`)) return
                    await unlinkRentalFromParent(r.id, rental.id)
                    setLinkedRentals(prev => prev.filter(x => x.id !== r.id))
                  }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 border border-gray-200 rounded-lg">해제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 배송일정 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">배송일정 <span className="text-gray-400 font-normal">({deliveries.length})</span></h2>
          <button onClick={() => setShowAddDelivery(v => !v)}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            + 배송지 추가
          </button>
        </div>

        {showAddDelivery && (
          <div className="border border-yellow-200 rounded-xl p-4 mb-4 bg-yellow-50 space-y-3">
            <p className="text-xs font-semibold text-gray-700">새 배송지</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">배송지명 *</label>
                <input value={deliveryForm.location} onChange={e => setDeliveryForm(f => ({...f, location: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="예: 서울중학교" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">현장 담당자</label>
                <input value={deliveryForm.contact_name} onChange={e => setDeliveryForm(f => ({...f, contact_name: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">연락처</label>
                <input value={deliveryForm.phone} onChange={e => setDeliveryForm(f => ({...f, phone: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">배송일</label>
                <input type="date" value={deliveryForm.delivery_date} onChange={e => setDeliveryForm(f => ({...f, delivery_date: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">수거일</label>
                <input type="date" value={deliveryForm.pickup_date} onChange={e => setDeliveryForm(f => ({...f, pickup_date: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">배송방법</label>
                <select value={deliveryForm.delivery_method} onChange={e => setDeliveryForm(f => ({...f, delivery_method: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                  <option value="">선택</option>
                  {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">메모</label>
                <input value={deliveryForm.notes} onChange={e => setDeliveryForm(f => ({...f, notes: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowAddDelivery(false); setDeliveryForm(emptyDeliveryForm) }}
                className="flex-1 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500 bg-white">취소</button>
              <button
                disabled={!deliveryForm.location.trim()}
                onClick={async () => {
                  const result = await addRentalDelivery(rental.id, {
                    location: deliveryForm.location,
                    contact_name: deliveryForm.contact_name || undefined,
                    phone: deliveryForm.phone || undefined,
                    delivery_date: deliveryForm.delivery_date || null,
                    pickup_date: deliveryForm.pickup_date || null,
                    delivery_method: deliveryForm.delivery_method || undefined,
                    notes: deliveryForm.notes || undefined,
                  })
                  if ('error' in result) { alert(result.error); return }
                  setDeliveries(prev => [...prev, {
                    id: result.id, location: deliveryForm.location,
                    contact_name: deliveryForm.contact_name || null,
                    phone: deliveryForm.phone || null,
                    delivery_date: deliveryForm.delivery_date || null,
                    pickup_date: deliveryForm.pickup_date || null,
                    delivery_method: deliveryForm.delivery_method || null,
                    status: '대기', checklist: {}, notes: deliveryForm.notes || null,
                  }])
                  setDeliveryForm(emptyDeliveryForm)
                  setShowAddDelivery(false)
                  setExpandedDelivery(result.id)
                }}
                className="flex-1 py-1.5 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50">추가</button>
            </div>
          </div>
        )}

        {deliveries.length === 0 && !showAddDelivery ? (
          <p className="text-sm text-gray-400 text-center py-6">배송지를 추가하면 각각의 배송·수거 체크리스트를 관리할 수 있어요.</p>
        ) : (
          <div className="space-y-2">
            {deliveries.map(d => {
              const isExpanded = expandedDelivery === d.id
              const isEditing = editingDeliveryId === d.id
              const cl = d.checklist ?? {}
              const doneCount = Object.values(cl).filter(Boolean).length
              const totalCount = DELIVERY_CHECKLIST_GROUPS.flatMap(g => g.items).length
              return (
                <div key={d.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => setExpandedDelivery(isExpanded ? null : d.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-800">{d.location}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DELIVERY_STATUS_BADGE[d.status] ?? 'bg-gray-100 text-gray-500'}`}>{d.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                        {d.delivery_date && <span>배송 {d.delivery_date}</span>}
                        {d.pickup_date && <span>수거 {d.pickup_date}</span>}
                        {d.contact_name && <span>{d.contact_name}</span>}
                        <span className="text-gray-300">{doneCount}/{totalCount} 완료</span>
                      </div>
                    </div>
                    <span className="text-gray-300 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="px-4 py-4 space-y-4 bg-white">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">배송지명</label>
                              <input value={editDeliveryForm.location} onChange={e => setEditDeliveryForm(f => ({...f, location: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">현장 담당자</label>
                              <input value={editDeliveryForm.contact_name} onChange={e => setEditDeliveryForm(f => ({...f, contact_name: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">연락처</label>
                              <input value={editDeliveryForm.phone} onChange={e => setEditDeliveryForm(f => ({...f, phone: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">배송일</label>
                              <input type="date" value={editDeliveryForm.delivery_date} onChange={e => setEditDeliveryForm(f => ({...f, delivery_date: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">수거일</label>
                              <input type="date" value={editDeliveryForm.pickup_date} onChange={e => setEditDeliveryForm(f => ({...f, pickup_date: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">배송방법</label>
                              <select value={editDeliveryForm.delivery_method} onChange={e => setEditDeliveryForm(f => ({...f, delivery_method: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
                                <option value="">선택</option>
                                {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
                              </select>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">메모</label>
                              <input value={editDeliveryForm.notes} onChange={e => setEditDeliveryForm(f => ({...f, notes: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingDeliveryId(null)}
                              className="flex-1 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-500">취소</button>
                            <button onClick={async () => {
                              await updateRentalDelivery(d.id, rental.id, {
                                location: editDeliveryForm.location,
                                contact_name: editDeliveryForm.contact_name || null,
                                phone: editDeliveryForm.phone || null,
                                delivery_date: editDeliveryForm.delivery_date || null,
                                pickup_date: editDeliveryForm.pickup_date || null,
                                delivery_method: editDeliveryForm.delivery_method || null,
                                notes: editDeliveryForm.notes || null,
                              })
                              setDeliveries(prev => prev.map(x => x.id === d.id ? {
                                ...x,
                                location: editDeliveryForm.location,
                                contact_name: editDeliveryForm.contact_name || null,
                                phone: editDeliveryForm.phone || null,
                                delivery_date: editDeliveryForm.delivery_date || null,
                                pickup_date: editDeliveryForm.pickup_date || null,
                                delivery_method: editDeliveryForm.delivery_method || null,
                                notes: editDeliveryForm.notes || null,
                              } : x))
                              setEditingDeliveryId(null)
                            }} className="flex-1 py-1.5 bg-gray-900 text-white rounded-lg text-sm">저장</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="text-xs text-gray-500 space-y-1">
                            {d.delivery_method && <p>배송방법: {d.delivery_method}</p>}
                            {d.notes && <p>메모: {d.notes}</p>}
                          </div>
                          <div className="flex gap-2">
                            {(d.delivery_date || d.pickup_date) && (
                              <button onClick={() => handleSyncDeliveryCalendar(d)}
                                disabled={syncingCalDelivery === d.id}
                                className="text-xs text-gray-400 hover:text-orange-600 px-2 py-1 border border-gray-200 rounded-lg disabled:opacity-50">
                                {syncingCalDelivery === d.id ? '...' : '📅'}
                              </button>
                            )}
                            <button onClick={() => {
                              setEditDeliveryForm({
                                location: d.location,
                                contact_name: d.contact_name ?? '',
                                phone: d.phone ?? '',
                                delivery_date: d.delivery_date ?? '',
                                pickup_date: d.pickup_date ?? '',
                                delivery_method: d.delivery_method ?? '',
                                notes: d.notes ?? '',
                              })
                              setEditingDeliveryId(d.id)
                            }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-lg">수정</button>
                            <button onClick={async () => {
                              if (!confirm(`"${d.location}" 배송일정을 삭제할까요?`)) return
                              await deleteRentalDelivery(d.id, rental.id)
                              setDeliveries(prev => prev.filter(x => x.id !== d.id))
                            }} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 border border-gray-200 rounded-lg">삭제</button>
                          </div>
                        </div>
                      )}

                      {/* 체크리스트 */}
                      {!isEditing && (
                        <div className="space-y-3 pt-2 border-t border-gray-100">
                          {DELIVERY_CHECKLIST_GROUPS.map(group => (
                            <div key={group.label}>
                              <p className={`text-xs font-semibold mb-1.5 ${group.color}`}>{group.label}</p>
                              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {group.items.map(item => {
                                  const checked = cl[item.key] ?? false
                                  return (
                                    <label key={item.key} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${checked ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                                      <input type="checkbox" checked={checked} className="hidden"
                                        onChange={async () => {
                                          const newCl = { ...cl, [item.key]: !checked }
                                          const result = await updateDeliveryChecklist(d.id, rental.id, newCl)
                                          const newStatus = ('newStatus' in result && result.newStatus) ? result.newStatus : d.status
                                          setDeliveries(prev => prev.map(x => x.id === d.id ? { ...x, checklist: newCl, status: newStatus } : x))
                                        }}
                                      />
                                      <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${checked ? 'bg-white border-white' : 'border-gray-300'}`}>
                                        {checked && <span className="text-gray-900 text-[8px] font-bold">✓</span>}
                                      </span>
                                      {item.label}
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 내용 / 상담 메모 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">내용 · 상담 메모</h2>
          {!contentSaved && (
            <button onClick={handleContentSave}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              저장
            </button>
          )}
          {contentSaved && content && (
            <span className="text-xs text-gray-300">저장됨</span>
          )}
        </div>
        <textarea
          value={content}
          onChange={e => { setContent(e.target.value); setContentSaved(false) }}
          onBlur={handleContentSave}
          placeholder="상담 내용, 요청사항, 특이사항 등 자유롭게 기록하세요.

예)
- 담당자: 홍길동 선생님
- 요청사항: 젬베 채 추가 요청
- 특이사항: 현관 앞 배송 요망"
          className="w-full text-sm text-gray-700 leading-relaxed resize-none outline-none placeholder-gray-300 min-h-[180px]"
          rows={8}
        />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-gray-800 mt-0.5">{value}</p>
    </div>
  )
}

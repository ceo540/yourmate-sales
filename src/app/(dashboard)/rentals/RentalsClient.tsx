'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createRental, updateRentalStatus, deleteRental } from './actions'

export const RENTAL_STATUSES = ['전체', '유입', '상담', '견적발송', '확정', '계약서서명', '진행중', '반납', '완료', '취소'] as const
export type RentalStatus = Exclude<typeof RENTAL_STATUSES[number], '전체'>

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

const DELIVERY_METHODS = ['착불택배', '선불택배', '업체배송수거', '퀵', '방문수령반납']
const INFLOW_SOURCES = ['네이버', '인스타', '유튜브', '지인', '기존고객', '채널톡', '기타']
const CUSTOMER_TYPES = ['기관', '개인']

interface RentalItem {
  id: string
  item_name: string
  quantity: number
  months: number
  unit_price: number
  total_price: number
}

interface Rental {
  id: string
  customer_name: string
  contact_name: string | null
  phone: string | null
  customer_type: string
  rental_start: string | null
  rental_end: string | null
  total_amount: number
  deposit: number
  status: string
  assignee_id: string | null
  assignee_name: string | null
  notes: string | null
  inflow_source: string | null
  items_count: number
  created_at: string
}

interface Props {
  rentals: Rental[]
  profiles: { id: string; name: string }[]
}

const fmt = (n: number) => n.toLocaleString()

function daysFromToday(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0,0,0,0)
  return Math.ceil(diff / 86400000)
}

function DDayBadge({ date, label }: { date: string; label: string }) {
  const d = daysFromToday(date)
  if (d < 0) return <span className="text-xs text-gray-400">{label} 완료</span>
  if (d === 0) return <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">D-day</span>
  if (d <= 3) return <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">D-{d}</span>
  if (d <= 7) return <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">D-{d}</span>
  return <span className="text-xs text-gray-400">D-{d}</span>
}

export default function RentalsClient({ rentals, profiles }: Props) {
  const router = useRouter()
  const [statusTab, setStatusTab] = useState<string>('전체')
  const [showNew, setShowNew] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [form, setForm] = useState({
    customer_name: '', contact_name: '', phone: '', email: '',
    customer_type: '기관', assignee_id: '',
    rental_start: '', rental_end: '', payment_due: '',
    delivery_method: '착불택배', inflow_source: '', notes: '',
    total_amount: '', deposit: '',
  })

  const filtered = statusTab === '전체'
    ? rentals.filter(r => r.status !== '완료' && r.status !== '취소')
    : rentals.filter(r => r.status === statusTab)

  const counts: Record<string, number> = {}
  for (const r of rentals) counts[r.status] = (counts[r.status] || 0) + 1
  const activeCount = rentals.filter(r => r.status === '진행중').length

  async function handleCreate() {
    if (!form.customer_name) return
    const result = await createRental({
      customer_name: form.customer_name,
      contact_name: form.contact_name || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      customer_type: form.customer_type,
      assignee_id: form.assignee_id || undefined,
      rental_start: form.rental_start || undefined,
      rental_end: form.rental_end || undefined,
      payment_due: form.payment_due || undefined,
      delivery_method: form.delivery_method || undefined,
      inflow_source: form.inflow_source || undefined,
      notes: form.notes || undefined,
      total_amount: form.total_amount ? parseInt(form.total_amount) : undefined,
      deposit: form.deposit ? parseInt(form.deposit) : undefined,
    })
    if (result?.error) { alert(result.error); return }
    setShowNew(false)
    setForm({ customer_name: '', contact_name: '', phone: '', email: '', customer_type: '기관', assignee_id: '', rental_start: '', rental_end: '', payment_due: '', delivery_method: '착불택배', inflow_source: '', notes: '', total_amount: '', deposit: '' })
    if (result.id) router.push(`/rentals/${result.id}`)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">렌탈 관리</h1>
          <p className="text-gray-500 text-sm mt-1">교구 렌탈 계약 · 배송 · 반납 트래킹</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          + 렌탈 등록
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: '전체', value: rentals.length, color: 'text-gray-700' },
          { label: '진행중', value: activeCount, color: 'text-green-600' },
          { label: '이번 달 완료', value: rentals.filter(r => r.status === '완료' && r.rental_end?.startsWith(new Date().toISOString().slice(0,7))).length, color: 'text-blue-600' },
          { label: '대기 (유입~확정)', value: rentals.filter(r => ['유입','상담','견적발송','확정','계약서서명'].includes(r.status)).length, color: 'text-yellow-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 상태 탭 */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {RENTAL_STATUSES.map(s => (
          <button key={s} onClick={() => setStatusTab(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusTab === s ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
            {s !== '전체' && counts[s] ? <span className="ml-1 opacity-60">{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl py-12 text-center text-gray-400 text-sm">
            해당 상태의 렌탈 건이 없습니다.
          </div>
        ) : filtered.map(r => (
          <div key={r.id}
            onClick={() => router.push(`/rentals/${r.id}`)}
            className="bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                  <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{r.customer_type}</span>
                  {r.inflow_source && <span className="text-xs text-gray-400">{r.inflow_source}</span>}
                </div>
                <p className="font-semibold text-gray-900">{r.customer_name}</p>
                {r.contact_name && <p className="text-xs text-gray-500 mt-0.5">{r.contact_name} {r.phone && `· ${r.phone}`}</p>}
              </div>
              <div className="text-right shrink-0">
                {r.total_amount > 0 && <p className="text-sm font-semibold text-gray-800">{fmt(r.total_amount)}원</p>}
                {r.deposit > 0 && <p className="text-xs text-gray-400">보증금 {fmt(r.deposit)}원</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {r.rental_start && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">배송</span>
                  <span className="text-xs text-gray-600">{r.rental_start}</span>
                  {['확정','계약서서명'].includes(r.status) && <DDayBadge date={r.rental_start} label="배송" />}
                </div>
              )}
              {r.rental_end && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">수거</span>
                  <span className="text-xs text-gray-600">{r.rental_end}</span>
                  {r.status === '진행중' && <DDayBadge date={r.rental_end} label="수거" />}
                </div>
              )}
              {r.items_count > 0 && <span className="text-xs text-gray-400">품목 {r.items_count}종</span>}
              {r.assignee_name && <span className="text-xs text-gray-400">담당: {r.assignee_name}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* 신규 등록 모달 */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">렌탈 등록</h3>
              <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">고객명 *</label>
                  <input value={form.customer_name} onChange={e => setForm(f => ({...f, customer_name: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="학교명 또는 고객명" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">구분</label>
                  <select value={form.customer_type} onChange={e => setForm(f => ({...f, customer_type: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CUSTOMER_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">담당자명</label>
                  <input value={form.contact_name} onChange={e => setForm(f => ({...f, contact_name: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="홍길동" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">연락처</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="010-0000-0000" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">배송일</label>
                  <input type="date" value={form.rental_start} onChange={e => setForm(f => ({...f, rental_start: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">수거일</label>
                  <input type="date" value={form.rental_end} onChange={e => setForm(f => ({...f, rental_end: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">배송방법</label>
                  <select value={form.delivery_method} onChange={e => setForm(f => ({...f, delivery_method: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {DELIVERY_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">유입경로</label>
                  <select value={form.inflow_source} onChange={e => setForm(f => ({...f, inflow_source: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">선택</option>
                    {INFLOW_SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">총 금액 (원)</label>
                  <input type="number" value={form.total_amount} onChange={e => setForm(f => ({...f, total_amount: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">보증금 (원)</label>
                  <input type="number" value={form.deposit} onChange={e => setForm(f => ({...f, deposit: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">담당자</label>
                <select value={form.assignee_id} onChange={e => setForm(f => ({...f, assignee_id: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">선택 안 함</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">메모</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowNew(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleCreate} disabled={!form.customer_name || isPending}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                등록
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

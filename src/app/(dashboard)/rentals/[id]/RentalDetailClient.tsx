'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateRental, updateRentalStatus, deleteRental, addRentalItem, removeRentalItem, updateRentalProject } from '../actions'
import CustomerPicker, { type CustomerOption } from '@/components/CustomerPicker'

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

interface ProjectOption {
  id: string
  name: string
  project_number: string | null
  customer_name: string | null
  status: string | null
}

interface Rental {
  id: string
  customer_id: string | null
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
  project_id: string | null
  items: RentalItem[]
}

interface Props {
  rental: Rental
  profiles: { id: string; name: string }[]
  projects: ProjectOption[]
  linkedProject: ProjectOption | null
  customers: CustomerOption[]
}

export default function RentalDetailClient({ rental, profiles, projects, linkedProject: initialLinkedProject, customers: initialCustomers }: Props) {
  const [customers, setCustomers] = useState<CustomerOption[]>(initialCustomers)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(rental.content ?? '')
  const [contentSaved, setContentSaved] = useState(true)

  // 연결된 프로젝트
  const [linkedProject, setLinkedProject] = useState<ProjectOption | null>(initialLinkedProject)
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const filteredProjects = (() => {
    const q = projectSearch.trim().toLowerCase()
    const list = q
      ? projects.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.customer_name ?? '').toLowerCase().includes(q) ||
          (p.project_number ?? '').toLowerCase().includes(q)
        )
      : projects
    return list.slice(0, 20)
  })()

  async function handleLinkProject(p: ProjectOption) {
    const res = await updateRentalProject(rental.id, p.id)
    if ('error' in res && res.error) { alert(res.error); return }
    setLinkedProject(p)
    setShowProjectPicker(false)
    setProjectSearch('')
  }

  async function handleUnlinkProject() {
    if (!confirm('프로젝트 연결을 해제할까요?')) return
    const res = await updateRentalProject(rental.id, null)
    if ('error' in res && res.error) { alert(res.error); return }
    setLinkedProject(null)
  }

  async function handleContentSave() {
    await updateRental(rental.id, { content })
    setContentSaved(true)
  }
  const [editForm, setEditForm] = useState({
    customer_id: rental.customer_id ?? '',
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
      customer_id: editForm.customer_id || null,
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
            <div>
              <label className="block text-xs text-gray-500 mb-1">기관</label>
              <CustomerPicker
                value={editForm.customer_id}
                selectedName={editForm.customer_name}
                customers={customers}
                placeholder="🏛 기관 검색 (없으면 + 새 기관 추가)"
                onChange={(id, name) => setEditForm(f => ({...f, customer_id: id, customer_name: name}))}
                onCustomerCreated={(c) => {
                  setCustomers(prev => [...prev, { id: c.id, name: c.name, type: c.type ?? null }])
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">구분</label>
              <select value={editForm.customer_type} onChange={e => setEditForm(f => ({...f, customer_type: e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option>기관</option><option>개인</option>
              </select>
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

      {/* 연결된 프로젝트 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            연결된 프로젝트
            {linkedProject && <span className="text-gray-400 font-normal ml-1">· 1</span>}
          </h2>
          {!linkedProject && !showProjectPicker && (
            <button onClick={() => setShowProjectPicker(true)}
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
              + 프로젝트 연결
            </button>
          )}
          {linkedProject && (
            <button onClick={handleUnlinkProject}
              className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 border border-gray-200 rounded-lg">
              연결 해제
            </button>
          )}
        </div>

        {linkedProject ? (
          <div className="flex items-center gap-3 px-4 py-3 border border-blue-100 bg-blue-50 rounded-xl">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{linkedProject.name}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                {linkedProject.project_number && <span>{linkedProject.project_number}</span>}
                {linkedProject.customer_name && <span>· {linkedProject.customer_name}</span>}
                {linkedProject.status && <span>· {linkedProject.status}</span>}
              </div>
            </div>
            <a href={`/projects/${linkedProject.id}`}
              className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 border border-blue-200 rounded-lg">
              프로젝트 보기
            </a>
          </div>
        ) : showProjectPicker ? (
          <div className="border border-yellow-200 rounded-xl p-3 bg-yellow-50 space-y-2">
            <input
              autoFocus
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              placeholder="프로젝트명/고객명/번호 검색..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400"
            />
            {filteredProjects.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">검색 결과가 없습니다.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1">
                {filteredProjects.map(p => (
                  <button key={p.id}
                    onClick={() => handleLinkProject(p)}
                    className="w-full text-left px-3 py-2 bg-white border border-gray-100 rounded-lg hover:border-yellow-300 hover:bg-yellow-50 transition-colors"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                      {p.project_number && <span>{p.project_number}</span>}
                      {p.customer_name && <span>· {p.customer_name}</span>}
                      {p.status && <span>· {p.status}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { setShowProjectPicker(false); setProjectSearch('') }}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">취소</button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">연결된 프로젝트가 없습니다.</p>
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

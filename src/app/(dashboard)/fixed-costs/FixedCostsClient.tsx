'use client'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertFixedCost, deleteFixedCost } from './actions'

interface FixedCost {
  id: string
  name: string
  category: string | null
  business_entity: string | null
  amount: number
  payment_day: number | null
  payment_method: string | null
  memo: string | null
  is_active: boolean
}

interface Entity { id: string; name: string }

interface Props {
  fixedCosts: FixedCost[]
  entities: Entity[]
}

const CATEGORIES = ['임대료', '통신비', '구독료', '보험료', '유지보수', '기타']

const EMPTY_FORM = {
  id: '',
  name: '',
  category: '',
  business_entity: '',
  amount: 0,
  payment_day: null as number | null,
  payment_method: '',
  memo: '',
  is_active: true,
}

function fmt(n: number) { return n.toLocaleString() }

const CATEGORY_COLORS: Record<string, string> = {
  '임대료': 'bg-purple-50 text-purple-700',
  '통신비': 'bg-blue-50 text-blue-600',
  '구독료': 'bg-cyan-50 text-cyan-600',
  '보험료': 'bg-green-50 text-green-700',
  '유지보수': 'bg-orange-50 text-orange-600',
  '기타': 'bg-gray-100 text-gray-500',
}

export default function FixedCostsClient({ fixedCosts: initial, entities }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [items, setItems] = useState(initial)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [filterEntity, setFilterEntity] = useState('all')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => { setItems(initial) }, [initial])

  const filtered = items.filter(c => {
    if (!showInactive && !c.is_active) return false
    if (filterEntity !== 'all' && c.business_entity !== filterEntity) return false
    return true
  })

  const activeItems = filtered.filter(c => c.is_active)
  const totalMonthly = activeItems.reduce((s, c) => s + c.amount, 0)
  const totalAnnual = totalMonthly * 12

  // 결제수단별 그룹
  const byMethod: Record<string, number> = {}
  for (const c of activeItems) {
    const key = c.payment_method?.trim() || '미지정'
    byMethod[key] = (byMethod[key] ?? 0) + c.amount
  }

  // 카테고리별 그룹
  const byCategory: Record<string, number> = {}
  for (const c of activeItems) {
    const key = c.category || '기타'
    byCategory[key] = (byCategory[key] ?? 0) + c.amount
  }

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(c: FixedCost) {
    setForm({
      id: c.id, name: c.name, category: c.category ?? '',
      business_entity: c.business_entity ?? '',
      amount: c.amount, payment_day: c.payment_day,
      payment_method: c.payment_method ?? '',
      memo: c.memo ?? '', is_active: c.is_active,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return alert('항목명을 입력해주세요.')
    if (!form.amount) return alert('금액을 입력해주세요.')
    setSaving(true)
    await upsertFixedCost({
      ...(form.id ? { id: form.id } : {}),
      name: form.name.trim(),
      category: form.category || null,
      business_entity: form.business_entity || null,
      amount: form.amount,
      payment_day: form.payment_day,
      payment_method: form.payment_method || null,
      memo: form.memo || null,
      is_active: form.is_active,
    })
    setSaving(false)
    setShowModal(false)
    startTransition(() => router.refresh())
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠어요?')) return
    await deleteFixedCost(id)
    setItems(prev => prev.filter(c => c.id !== id))
  }

  async function toggleActive(c: FixedCost) {
    await upsertFixedCost({
      id: c.id, name: c.name, category: c.category,
      business_entity: c.business_entity,
      amount: c.amount, payment_day: c.payment_day,
      payment_method: c.payment_method, memo: c.memo,
      is_active: !c.is_active,
    })
    setItems(prev => prev.map(i => i.id === c.id ? { ...i, is_active: !c.is_active } : i))
  }

  return (
    <>
      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:col-span-2">
          <p className="text-xs text-gray-400 mb-1">월 고정비 합계</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(totalMonthly)}<span className="text-sm font-normal text-gray-400 ml-1">원</span></p>
          <p className="text-xs text-gray-400 mt-1">연간 {fmt(totalAnnual)}원 · {activeItems.length}개 항목</p>
        </div>
        {Object.entries(byMethod).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([method, amount]) => (
          <div key={method} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-400 truncate mb-1">{method}</p>
            <p className="text-lg font-bold text-gray-700">{fmt(amount)}<span className="text-xs font-normal text-gray-400 ml-0.5">원</span></p>
          </div>
        ))}
      </div>

      {/* 카테고리별 바 */}
      {Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
          <p className="text-xs font-semibold text-gray-500 mb-3">카테고리별</p>
          <div className="space-y-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full w-16 text-center flex-shrink-0 ${CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['기타']}`}>{cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full" style={{ backgroundColor: '#FFCE00', width: `${Math.round((amount / totalMonthly) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-28 text-right">{fmt(amount)}원</span>
                <span className="text-xs text-gray-400 w-8 text-right">{Math.round((amount / totalMonthly) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 + 추가 버튼 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={filterEntity} onChange={e => setFilterEntity(e.target.value)}
          className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400">
          <option value="all">전체 사업자</option>
          {entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer ml-1">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
          비활성 포함
        </label>
        <button onClick={openNew}
          className="ml-auto text-sm px-4 py-2 rounded-lg font-semibold hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
          + 항목 추가
        </button>
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">고정비 항목이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(c => (
              <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 ${!c.is_active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                    {c.category && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS['기타']}`}>{c.category}</span>
                    )}
                    {!c.is_active && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">비활성</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {c.business_entity && <span>{c.business_entity}</span>}
                    {c.payment_method && <span className="text-blue-500">{c.payment_method}</span>}
                    {c.payment_day && <span>매월 {c.payment_day}일</span>}
                    {c.memo && <span className="italic">{c.memo}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-base font-bold text-gray-800">{fmt(c.amount)}원</span>
                  <button onClick={() => openEdit(c)}
                    className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-yellow-100 hover:text-yellow-800 transition-colors">수정</button>
                  <button onClick={() => toggleActive(c)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${c.is_active ? 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-400' : 'border-green-200 text-green-500 hover:bg-green-50'}`}>
                    {c.is_active ? '중단' : '활성'}
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors">삭제</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{form.id ? '항목 수정' : '고정비 추가'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-xl">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">

              {/* 항목명 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">항목명 *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 강남 사무실 임대료"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">카테고리</label>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button"
                      onClick={() => setForm(f => ({ ...f, category: f.category === cat ? '' : cat }))}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${form.category === cat ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-semibold' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">월 금액 *</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text" inputMode="numeric"
                    value={form.amount === 0 ? '' : form.amount.toLocaleString()}
                    onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 }))}
                    placeholder="0"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400"
                  />
                  <span className="text-sm text-gray-400">원</span>
                </div>
                {form.amount > 0 && (
                  <p className="text-xs text-gray-400 mt-1 text-right">연간 {(form.amount * 12).toLocaleString()}원</p>
                )}
              </div>

              {/* 결제일 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">결제일</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">매월</span>
                  <input
                    type="number" min={1} max={31}
                    value={form.payment_day ?? ''}
                    onChange={e => setForm(f => ({ ...f, payment_day: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="예: 25"
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-yellow-400"
                  />
                  <span className="text-sm text-gray-500">일</span>
                </div>
              </div>

              {/* 결제수단 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">결제수단 (계좌 / 카드)</label>
                <input
                  value={form.payment_method}
                  onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                  placeholder="예: 국민은행 법인카드 / 기업은행 123-456"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* 사업자 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">사업자</label>
                <select
                  value={form.business_entity}
                  onChange={e => setForm(f => ({ ...f, business_entity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                  <option value="">미지정</option>
                  {entities.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">메모</label>
                <input
                  value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  placeholder="참고사항"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* 활성 여부 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded" />
                <span className="text-sm text-gray-700">활성 (월 합계에 포함)</span>
              </label>
            </div>

            <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

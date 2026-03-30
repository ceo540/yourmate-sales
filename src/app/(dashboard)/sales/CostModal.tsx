'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface CostItem {
  id: string
  item: string
  amount: number
  memo?: string | null
  category: string
  vendor_id?: string | null
  is_paid?: boolean
}

interface Vendor {
  id: string
  name: string
  type: string
}

interface Props {
  saleId: string
  saleName: string
  revenue: number
  initialItems: CostItem[]
  vendors: Vendor[]
  onClose: () => void
}

// 부가세만 자동 삽입, 감가상각비/지급수수료는 사용자가 비율 선택
const AUTO_INNER = [{ item: '부가세', rate: 0.10 }]
const RATE_ITEMS = [
  { item: '감가상각비', presets: [3, 5, 6, 8, 10] },
  { item: '지급수수료', presets: [1, 2, 3, 5] },
]
const OUTER_TEMPLATES = ['프리랜서', '외주용역(업체)', '재료비(제작, 구입비 등)']
const VENDOR_TYPES = ['프리랜서', '업체', '기타']

type Category = '내부원가' | '외부원가'
const EMPTY_FORM = { item: '', amount: '', memo: '', vendorId: '' }

export default function CostModal({ saleId, saleName, revenue, initialItems, vendors: initialVendors, onClose }: Props) {
  const [items, setItems] = useState<CostItem[]>(
    initialItems.map(i => ({ ...i, category: i.category ?? '외부원가' }))
  )
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [addingIn, setAddingIn] = useState<Category | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)

  // 비율 선택기 상태
  const [ratePickerFor, setRatePickerFor] = useState<string | null>(null)
  const [customRate, setCustomRate] = useState('')

  // 인라인 금액 수정 상태
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')

  // 새 거래처 추가 상태
  const [addingVendor, setAddingVendor] = useState(false)
  const [newVendorName, setNewVendorName] = useState('')
  const [newVendorType, setNewVendorType] = useState('업체')
  const [vendorLoading, setVendorLoading] = useState(false)

  const router = useRouter()
  const autoInserted = useRef(false)

  useEffect(() => {
    if (autoInserted.current) return
    autoInserted.current = true
    const alreadyExists = initialItems.some(i => AUTO_INNER.some(a => a.item === i.item))
    if (revenue > 0 && !alreadyExists) autoInsertInner()
  }, [])

  const autoInsertInner = async () => {
    setAutoLoading(true)
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('sale_costs').select('item').eq('sale_id', saleId)
      .in('item', AUTO_INNER.map(a => a.item))
    if (existing && existing.length > 0) { setAutoLoading(false); return }
    const rows = AUTO_INNER.map(d => ({
      sale_id: saleId, item: d.item,
      amount: Math.round(revenue * d.rate), category: '내부원가',
    }))
    const { data } = await supabase.from('sale_costs')
      .upsert(rows, { onConflict: 'sale_id,item', ignoreDuplicates: true }).select()
    if (data) setItems(prev => [...prev, ...data])
    setAutoLoading(false)
  }

  // 비율 항목 삽입 (감가상각비/지급수수료)
  const handleRateInsert = async (itemName: string, rate: number) => {
    if (revenue <= 0) { alert('매출액이 없어서 비율 계산이 불가해요.'); return }
    const amount = Math.round(revenue * (rate / 100))
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('sale_costs').insert({
      sale_id: saleId, item: itemName, amount, category: '내부원가',
    }).select().single()
    if (!error && data) {
      setItems(prev => [...prev, { ...data, category: '내부원가' }])
    }
    setRatePickerFor(null)
    setCustomRate('')
    setLoading(false)
  }

  // 새 거래처 저장
  const handleAddVendor = async () => {
    if (!newVendorName.trim()) return
    setVendorLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('vendors').insert({
      name: newVendorName.trim(), type: newVendorType,
    }).select('id, name, type').single()
    if (!error && data) {
      setVendors(prev => [...prev, data])
      setForm(f => ({ ...f, vendorId: data.id, item: data.name }))
      setAddingVendor(false)
      setNewVendorName('')
    }
    setVendorLoading(false)
  }

  const inner = items.filter(i => i.category === '내부원가')
  const outer = items.filter(i => i.category === '외부원가')
  const totalCost = items.reduce((s, i) => s + i.amount, 0)
  const profit = revenue - totalCost
  const profitRate = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

  const handleAdd = async (category: Category) => {
    if (!form.item || !form.amount) return
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('sale_costs').insert({
      sale_id: saleId, item: form.item, amount: Number(form.amount),
      memo: form.memo || null, category,
      vendor_id: form.vendorId || null,
    }).select().single()
    if (!error && data) {
      setItems(prev => [...prev, { ...data, category }])
      setForm(EMPTY_FORM)
      setAddingIn(null)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('sale_costs').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const startEdit = (item: CostItem) => {
    setEditingItemId(item.id)
    setEditAmount(String(item.amount))
    setAddingIn(null)
    setRatePickerFor(null)
  }

  const handleAmountEdit = async (id: string) => {
    const amount = Number(editAmount)
    if (!editAmount || isNaN(amount)) { setEditingItemId(null); return }
    const supabase = createClient()
    await supabase.from('sale_costs').update({ amount }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, amount } : i))
    setEditingItemId(null)
  }

  const togglePaid = async (id: string, isPaid: boolean) => {
    const supabase = createClient()
    await supabase.from('sale_costs').update({
      is_paid: !isPaid, paid_at: !isPaid ? new Date().toISOString() : null,
    }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, is_paid: !isPaid } : i))
  }

  const handleClose = () => { router.refresh(); onClose() }

  const renderSection = (category: Category, sectionItems: CostItem[]) => {
    const subtotal = sectionItems.reduce((s, i) => s + i.amount, 0)
    const existingLabels = sectionItems.map(i => i.item)
    const templates = category === '외부원가' ? OUTER_TEMPLATES.filter(t => !existingLabels.includes(t)) : []

    return (
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{category}</h3>
          {subtotal > 0 && <span className="text-xs text-gray-400">소계 {subtotal.toLocaleString()}원</span>}
        </div>

        {/* 내부원가: 비율 선택 항목 (감가상각비/지급수수료) */}
        {category === '내부원가' && (
          <div className="space-y-2 mb-2">
            {RATE_ITEMS.filter(r => !existingLabels.includes(r.item)).map(r => (
              <div key={r.item}>
                {ratePickerFor === r.item ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-800 mb-2">{r.item} 비율 선택</p>
                    <div className="flex gap-1.5 flex-wrap mb-2">
                      {r.presets.map(p => (
                        <button key={p}
                          onClick={() => handleRateInsert(r.item, p)}
                          disabled={loading}
                          className="text-xs px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 font-medium transition-colors disabled:opacity-40"
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          placeholder="직접 입력"
                          value={customRate}
                          onChange={e => setCustomRate(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && customRate && handleRateInsert(r.item, Number(customRate))}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white pr-6"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                      </div>
                      <button
                        onClick={() => customRate && handleRateInsert(r.item, Number(customRate))}
                        disabled={loading || !customRate}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 bg-blue-500 text-white"
                      >
                        적용
                      </button>
                      <button
                        onClick={() => { setRatePickerFor(null); setCustomRate('') }}
                        className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 bg-white border border-gray-200"
                      >
                        취소
                      </button>
                    </div>
                    {revenue > 0 && customRate && (
                      <p className="text-xs text-blue-600 mt-1.5">
                        {revenue.toLocaleString()}원 × {customRate}% = {Math.round(revenue * Number(customRate) / 100).toLocaleString()}원
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => { setRatePickerFor(r.item); setAddingIn(null) }}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    + {r.item} (%)
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 외부원가: 템플릿 버튼 */}
        {templates.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {templates.map(t => (
              <button key={t}
                onClick={() => { setAddingIn(category); setRatePickerFor(null); setForm({ item: t, amount: '', memo: '', vendorId: '' }) }}
                className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-yellow-400 hover:text-yellow-700 transition-colors"
              >
                + {t}
              </button>
            ))}
          </div>
        )}

        {/* 외부원가: 거래처 빠른 선택 */}
        {category === '외부원가' && vendors.length > 0 && (
          <div className="flex gap-1.5 mb-2 flex-wrap">
            {vendors.map(v => (
              <button key={v.id}
                onClick={() => { setAddingIn(category); setRatePickerFor(null); setForm({ item: v.name, amount: '', memo: '', vendorId: v.id }) }}
                className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-yellow-400 hover:text-yellow-700 transition-colors bg-white"
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1.5 mb-2">
          {autoLoading && category === '내부원가' && (
            <p className="text-xs text-gray-400 py-2">자동 계산 중...</p>
          )}
          {sectionItems.length === 0 && !autoLoading && addingIn !== category && (
            <p className="text-xs text-gray-300 py-1">항목이 없어요</p>
          )}
          {sectionItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-800">{item.item}</span>
                {item.memo && <span className="text-xs text-gray-400 ml-2">{item.memo}</span>}
                {category === '내부원가' && revenue > 0 && editingItemId !== item.id && (
                  <span className="text-xs text-gray-300 ml-1.5">{Math.round((item.amount / revenue) * 100)}%</span>
                )}
              </div>
              {editingItemId === item.id ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input
                    autoFocus
                    type="number"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAmountEdit(item.id); if (e.key === 'Escape') setEditingItemId(null) }}
                    onBlur={() => handleAmountEdit(item.id)}
                    className="w-28 px-2 py-0.5 border border-yellow-400 rounded text-sm text-right focus:outline-none bg-white"
                  />
                  <span className="text-xs text-gray-400">원</span>
                </div>
              ) : (
                <button
                  onClick={() => startEdit(item)}
                  className="text-sm font-medium text-gray-700 flex-shrink-0 hover:text-yellow-700 hover:underline decoration-dashed underline-offset-2 transition-colors"
                  title="클릭해서 수정"
                >
                  {item.amount.toLocaleString()}원
                </button>
              )}
              {category === '외부원가' && editingItemId !== item.id && (
                <button
                  onClick={() => togglePaid(item.id, item.is_paid ?? false)}
                  className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${
                    item.is_paid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
                  }`}
                >
                  {item.is_paid ? '지급완료' : '미지급'}
                </button>
              )}
              <button
                onClick={() => handleDelete(item.id)}
                className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        {addingIn === category ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
            {category === '외부원가' && (
              <>
                {addingVendor ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
                    <p className="text-xs font-medium text-gray-700">새 거래처 추가</p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        placeholder="거래처명"
                        value={newVendorName}
                        onChange={e => setNewVendorName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddVendor()}
                        className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                      />
                      <select
                        value={newVendorType}
                        onChange={e => setNewVendorType(e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
                      >
                        {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddVendor}
                        disabled={vendorLoading || !newVendorName.trim()}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-all"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                      >
                        {vendorLoading ? '저장 중...' : '거래처 저장'}
                      </button>
                      <button
                        onClick={() => { setAddingVendor(false); setNewVendorName('') }}
                        className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 bg-white border border-gray-200 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={form.vendorId}
                      onChange={e => {
                        const v = vendors.find(v => v.id === e.target.value)
                        setForm(f => ({ ...f, vendorId: e.target.value, item: v ? v.name : f.item }))
                      }}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
                    >
                      <option value="">거래처 선택 (선택사항)</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.type})</option>)}
                    </select>
                    <button
                      onClick={() => setAddingVendor(true)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-yellow-400 hover:text-yellow-700 whitespace-nowrap transition-colors"
                    >
                      + 새 거래처
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="flex gap-2">
              <input autoFocus={category === '내부원가'} placeholder="항목명" value={form.item}
                onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              />
              <input placeholder="금액" type="number" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd(category)}
                className="w-28 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              />
            </div>
            <div className="flex gap-2">
              <input placeholder="메모 (선택)" value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              />
              <button onClick={() => handleAdd(category)} disabled={loading || !form.item || !form.amount}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >추가</button>
              <button onClick={() => { setAddingIn(null); setForm(EMPTY_FORM); setAddingVendor(false) }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 bg-white border border-gray-200 transition-colors"
              >취소</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setAddingIn(category); setRatePickerFor(null); setForm(EMPTY_FORM) }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
          >
            <span>+</span> 항목 직접 추가
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">세부 원가</h2>
            <p className="text-xs text-gray-400 mt-0.5">{saleName}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {renderSection('내부원가', inner)}
          <div className="border-t border-gray-100 mb-5" />
          {renderSection('외부원가', outer)}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-gray-500">
                총 원가 <span className="font-semibold text-gray-800">{totalCost.toLocaleString()}원</span>
              </p>
              {revenue > 0 && (
                <p className="text-xs text-gray-500">
                  이익 <span className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{profit.toLocaleString()}원</span>
                  <span className="text-gray-400 ml-1">({profitRate}%)</span>
                </p>
              )}
              {outer.some(i => !i.is_paid) && (
                <p className="text-xs text-orange-500 font-medium">
                  미지급 {outer.filter(i => !i.is_paid).reduce((s, i) => s + i.amount, 0).toLocaleString()}원
                </p>
              )}
            </div>
            <button onClick={handleClose} className="px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              완료
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

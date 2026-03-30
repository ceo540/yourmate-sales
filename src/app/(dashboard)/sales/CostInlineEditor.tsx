'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CostItem {
  id: string
  item: string
  amount: number
  unit_price?: number | null
  quantity?: number | null
  unit?: string | null
  memo?: string | null
  category: string
  vendor_id?: string | null
  is_paid?: boolean
}

interface Vendor { id: string; name: string; type: string }

interface Props {
  saleId: string
  revenue: number
  initialItems: CostItem[]
  vendors: Vendor[]
  onItemsChange: (items: CostItem[]) => void
}

const RATE_ITEMS = [
  { item: '감가상각비', presets: [3, 5, 6, 8, 10] },
  { item: '지급수수료', presets: [1, 2, 3, 5] },
]
const UNITS = ['명', '회', '개', '식', '건', '일', '시간', '세트', '팀']

function calcAmount(unitPrice: string, quantity: string) {
  const p = Number(unitPrice), q = Number(quantity)
  if (!p || !q || isNaN(p) || isNaN(q)) return null
  return Math.round(p * q)
}

function formatMoney(n: number) { return n.toLocaleString() + '원' }

// ── 항목 행 표시 ──────────────────────────────────────────
function ItemRow({ item, revenue, isRateItem, onEdit, onDelete, onTogglePaid }: {
  item: CostItem
  revenue: number
  isRateItem: boolean
  onEdit: () => void
  onDelete: () => void
  onTogglePaid?: () => void
}) {
  const hasBreakdown = item.unit_price && item.quantity
  const currentRate = revenue > 0 ? Math.round((item.amount / revenue) * 100) : 0

  return (
    <div className="flex items-center gap-2 group px-2 py-2 rounded-lg hover:bg-white transition-colors text-sm">
      <span className="flex-1 text-gray-800 truncate">{item.item}</span>

      {/* 단가×수량 표시 or 금액 직접 */}
      <button onClick={onEdit} className="flex items-center gap-1.5 hover:text-yellow-700 transition-colors" title="클릭해서 수정">
        {hasBreakdown ? (
          <span className="text-gray-500 text-xs">
            {item.unit_price!.toLocaleString()}원 × {item.quantity}{item.unit || ''} =&nbsp;
            <span className="font-medium text-gray-800">{formatMoney(item.amount)}</span>
          </span>
        ) : (
          <span className="font-medium text-gray-700 hover:underline decoration-dashed underline-offset-2">
            {formatMoney(item.amount)}
            {isRateItem && revenue > 0 && <span className="text-xs text-gray-300 ml-1">({currentRate}%)</span>}
          </span>
        )}
      </button>

      {onTogglePaid && (
        <button onClick={onTogglePaid}
          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${
            item.is_paid ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-500 hover:bg-orange-100'
          }`}
        >{item.is_paid ? '지급완료' : '미지급'}</button>
      )}

      <button onClick={onDelete}
        className="text-gray-300 hover:text-red-400 hover:bg-red-50 rounded w-6 h-6 flex items-center justify-center text-base flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
      >×</button>
    </div>
  )
}

// ── 항목 편집 행 ──────────────────────────────────────────
function EditRow({ item, revenue, isRateItem, onSave, onCancel }: {
  item: CostItem
  revenue: number
  isRateItem: boolean
  onSave: (vals: { item: string; amount: number; unit_price: number|null; quantity: number|null; unit: string|null }) => void
  onCancel: () => void
}) {
  const hasBreakdown = !!(item.unit_price && item.quantity)
  const [itemName, setItemName] = useState(item.item)
  const [mode, setMode] = useState<'breakdown' | 'amount' | 'rate'>(
    hasBreakdown ? 'breakdown' : isRateItem && revenue > 0 ? 'rate' : 'amount'
  )
  const [unitPrice, setUnitPrice] = useState(item.unit_price ? String(item.unit_price) : '')
  const [quantity, setQuantity] = useState(item.quantity ? String(item.quantity) : '')
  const [unit, setUnit] = useState(item.unit || '명')
  const [amount, setAmount] = useState(String(item.amount))
  const [rate, setRate] = useState(revenue > 0 ? String(Math.round((item.amount / revenue) * 100)) : '')

  const previewAmount = mode === 'breakdown' ? calcAmount(unitPrice, quantity)
    : mode === 'rate' ? (revenue > 0 && rate ? Math.round(revenue * Number(rate) / 100) : null)
    : Number(amount) || null

  const handleSave = () => {
    const finalAmount = mode === 'breakdown' ? (calcAmount(unitPrice, quantity) ?? 0)
      : mode === 'rate' ? (previewAmount ?? 0)
      : Number(amount)
    if (!finalAmount || !itemName.trim()) return
    onSave({
      item: itemName.trim(),
      amount: finalAmount,
      unit_price: mode === 'breakdown' ? Number(unitPrice) || null : null,
      quantity: mode === 'breakdown' ? Number(quantity) || null : null,
      unit: mode === 'breakdown' ? unit || null : null,
    })
  }

  return (
    <div className="bg-white border border-yellow-300 rounded-xl px-3 py-2.5 space-y-2 my-1">
      <div className="flex items-center gap-1.5">
        <input
          value={itemName}
          onChange={e => setItemName(e.target.value)}
          className="text-sm font-medium text-gray-700 flex-1 border-b border-gray-200 focus:outline-none focus:border-yellow-400 bg-transparent pb-0.5"
          placeholder="항목명"
        />
        {/* 모드 선택 */}
        <div className="flex rounded overflow-hidden border border-gray-200 text-xs">
          <button type="button" onClick={() => setMode('breakdown')}
            className={`px-2 py-0.5 ${mode === 'breakdown' ? 'bg-yellow-400 font-semibold text-gray-900' : 'bg-white text-gray-400'}`}
          >단가×수량</button>
          <button type="button" onClick={() => setMode('amount')}
            className={`px-2 py-0.5 ${mode === 'amount' ? 'bg-yellow-400 font-semibold text-gray-900' : 'bg-white text-gray-400'}`}
          >금액</button>
          {isRateItem && revenue > 0 && (
            <button type="button" onClick={() => setMode('rate')}
              className={`px-2 py-0.5 ${mode === 'rate' ? 'bg-yellow-400 font-semibold text-gray-900' : 'bg-white text-gray-400'}`}
            >%</button>
          )}
        </div>
      </div>

      {mode === 'breakdown' && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <input autoFocus type="number" placeholder="단가" value={unitPrice}
              onChange={e => setUnitPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              className="w-28 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 pr-5"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">원</span>
          </div>
          <span className="text-gray-400 text-sm">×</span>
          <input type="number" placeholder="수량" value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
          />
          <select value={unit} onChange={e => setUnit(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 bg-white"
          >
            {UNITS.map(u => <option key={u}>{u}</option>)}
            <option value="">직접입력</option>
          </select>
          {previewAmount !== null && (
            <span className="text-xs text-gray-500">= <strong className="text-gray-800">{previewAmount.toLocaleString()}원</strong></span>
          )}
        </div>
      )}

      {mode === 'amount' && (
        <div className="flex items-center gap-1.5">
          <input autoFocus type="number" placeholder="금액" value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-36 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
          />
          <span className="text-xs text-gray-400">원</span>
        </div>
      )}

      {mode === 'rate' && (
        <div className="flex items-center gap-1.5">
          <input autoFocus type="number" placeholder="%" value={rate}
            onChange={e => setRate(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
          />
          <span className="text-xs text-gray-400">%</span>
          {previewAmount !== null && (
            <span className="text-xs text-gray-500">= <strong className="text-gray-800">{previewAmount.toLocaleString()}원</strong></span>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={!previewAmount}
          className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >저장</button>
        <button onClick={onCancel} className="px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-600 border border-gray-200">취소</button>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function CostInlineEditor({ saleId, revenue, initialItems, vendors: initVendors, onItemsChange }: Props) {
  const [items, setItems] = useState<CostItem[]>(
    initialItems.map(i => ({ ...i, category: i.category ?? '외부원가' }))
  )
  const [vendors, setVendors] = useState(initVendors)
  const [editingId, setEditingId] = useState<string | null>(null)

  // 빠른 추가 바
  const [quickCat, setQuickCat] = useState<'내부원가' | '외부원가'>('외부원가')
  const [quickVendorText, setQuickVendorText] = useState('')
  const [quickItem, setQuickItem] = useState('')
  const [quickUnitPrice, setQuickUnitPrice] = useState('')
  const [quickQuantity, setQuickQuantity] = useState('')
  const [quickUnit, setQuickUnit] = useState('명')
  const [quickLoading, setQuickLoading] = useState(false)
  const itemRef = useRef<HTMLInputElement>(null)
  const unitPriceRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)

  // 비율 선택기
  const [ratePickerFor, setRatePickerFor] = useState<string | null>(null)
  const [customRate, setCustomRate] = useState('')
  const [rateLoading, setRateLoading] = useState(false)

  // 새 거래처 폼
  const [newVendorForm, setNewVendorForm] = useState(false)
  const [newVendorData, setNewVendorData] = useState({ name: '', type: '업체', email: '', phone: '', id_number: '' })
  const [newVendorLoading, setNewVendorLoading] = useState(false)

  const update = (next: CostItem[]) => { setItems(next); onItemsChange(next) }
  const RATE_ITEM_NAMES = RATE_ITEMS.map(r => r.item)

  const resolveVendorId = async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return null
    const found = vendors.find(v => v.name.toLowerCase() === trimmed.toLowerCase())
    if (found) return found.id
    const supabase = createClient()
    const { data } = await supabase.from('vendors').insert({ name: trimmed, type: '업체' }).select('id, name, type').single()
    if (data) setVendors(prev => [...prev, data])
    return data?.id ?? null
  }

  const handleNewVendorSave = async () => {
    if (!newVendorData.name.trim()) return
    setNewVendorLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('vendors').insert({
      name: newVendorData.name.trim(), type: newVendorData.type,
      email: newVendorData.email || null, phone: newVendorData.phone || null,
      id_number: newVendorData.id_number || null,
    }).select('id, name, type').single()
    if (data) {
      setVendors(prev => [...prev, data])
      setQuickVendorText(data.name)
      setQuickItem(data.name)
    }
    setNewVendorForm(false)
    setNewVendorData({ name: '', type: '업체', email: '', phone: '', id_number: '' })
    setNewVendorLoading(false)
  }

  const isNewVendor = quickVendorText.trim().length > 0 &&
    !vendors.some(v => v.name.toLowerCase() === quickVendorText.trim().toLowerCase())

  // 빠른 추가
  const handleQuickAdd = async () => {
    const computedAmount = calcAmount(quickUnitPrice, quickQuantity)
    if (!quickItem.trim() || computedAmount === null) return
    setQuickLoading(true)
    const vendorId = quickCat === '외부원가' ? await resolveVendorId(quickVendorText) : null
    const supabase = createClient()
    const { data, error } = await supabase.from('sale_costs').insert({
      sale_id: saleId, item: quickItem.trim(), amount: computedAmount, category: quickCat,
      vendor_id: vendorId,
      unit_price: Number(quickUnitPrice) || null,
      quantity: Number(quickQuantity) || null,
      unit: quickUnit || null,
    }).select().single()
    if (!error && data) {
      update([...items, { ...data, category: quickCat }])
      setQuickItem('')
      setQuickUnitPrice('')
      setQuickQuantity('')
      setQuickVendorText('')
      setTimeout(() => itemRef.current?.focus(), 50)
    }
    setQuickLoading(false)
  }

  // 비율 삽입
  const handleRateInsert = async (itemName: string, rate: number) => {
    if (revenue <= 0) { alert('매출액이 없어요.'); return }
    const amount = Math.round(revenue * (rate / 100))
    setRateLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.from('sale_costs').insert({
      sale_id: saleId, item: itemName, amount, category: '내부원가',
    }).select().single()
    if (!error && data) update([...items, { ...data, category: '내부원가' }])
    setRatePickerFor(null)
    setCustomRate('')
    setRateLoading(false)
  }

  // 항목 수정 저장
  const handleEditSave = async (id: string, vals: { item: string; amount: number; unit_price: number|null; quantity: number|null; unit: string|null }) => {
    const supabase = createClient()
    await supabase.from('sale_costs').update(vals).eq('id', id)
    update(items.map(i => i.id === id ? { ...i, ...vals } : i))
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('sale_costs').delete().eq('id', id)
    update(items.filter(i => i.id !== id))
  }

  const togglePaid = async (id: string, isPaid: boolean) => {
    const supabase = createClient()
    await supabase.from('sale_costs').update({
      is_paid: !isPaid, paid_at: !isPaid ? new Date().toISOString() : null,
    }).eq('id', id)
    update(items.map(i => i.id === id ? { ...i, is_paid: !isPaid } : i))
  }

  const inner = items.filter(i => i.category === '내부원가')
  const outer = items.filter(i => i.category === '외부원가')
  const existingRateLabels = inner.map(i => i.item)
  const vatAmount = revenue > 0 ? Math.round(revenue * 0.1) : 0
  const totalCost = items.reduce((s, i) => s + i.amount, 0) + vatAmount
  const profit = revenue - totalCost
  const profitRate = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
  const previewQuickAmount = calcAmount(quickUnitPrice, quickQuantity)

  return (
    <div className="border-l-4 border-yellow-400 bg-yellow-50/30">

      {/* ── 빠른 추가 바 ── */}
      <div className="px-5 py-3 border-b border-yellow-200 bg-yellow-50">
        <p className="text-xs font-semibold text-yellow-700 mb-2">원가 입력</p>
        <div className="flex items-center gap-2 flex-wrap">

          {/* 카테고리 토글 */}
          <div className="flex rounded-lg overflow-hidden border border-yellow-300 flex-shrink-0">
            {(['외부원가', '내부원가'] as const).map(cat => (
              <button key={cat} type="button" onClick={() => setQuickCat(cat)}
                className={`text-xs px-2.5 py-1.5 transition-colors ${quickCat === cat ? 'bg-yellow-400 text-gray-900 font-semibold' : 'bg-white text-gray-500 hover:bg-yellow-50'}`}
              >{cat}</button>
            ))}
          </div>

          {/* 거래처 */}
          {quickCat === '외부원가' && (
            <>
              <div className="flex items-center gap-1.5">
                <input list={`vendors-${saleId}`} placeholder="거래처"
                  value={quickVendorText}
                  onChange={e => { setQuickVendorText(e.target.value); setNewVendorForm(false); if (!quickItem) setQuickItem(e.target.value) }}
                  onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); itemRef.current?.focus() } }}
                  className={`w-36 text-sm px-2.5 py-1.5 border rounded-lg bg-white focus:outline-none focus:border-yellow-400 ${isNewVendor ? 'border-yellow-400' : 'border-gray-200'}`}
                />
                {isNewVendor && !newVendorForm && (
                  <button type="button"
                    onClick={() => { setNewVendorForm(true); setNewVendorData(d => ({ ...d, name: quickVendorText.trim() })) }}
                    className="text-xs px-2 py-1.5 bg-yellow-400 text-gray-900 rounded-lg font-semibold whitespace-nowrap hover:opacity-80 transition-all"
                  >신규 등록</button>
                )}
              </div>
              <datalist id={`vendors-${saleId}`}>
                {vendors.map(v => <option key={v.id} value={v.name} label={v.type} />)}
              </datalist>
            </>
          )}

          {/* 항목명 */}
          <input ref={itemRef} placeholder="항목명" value={quickItem}
            onChange={e => setQuickItem(e.target.value)}
            onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); unitPriceRef.current?.focus() } if (e.key === 'Enter') handleQuickAdd() }}
            className="flex-1 min-w-[80px] text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
          />

          {/* 단가 */}
          <div className="relative">
            <input ref={unitPriceRef} type="number" placeholder="단가"
              value={quickUnitPrice}
              onChange={e => setQuickUnitPrice(e.target.value)}
              onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); qtyRef.current?.focus() } if (e.key === 'Enter') handleQuickAdd() }}
              className="w-28 text-sm px-2.5 py-1.5 pr-5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">원</span>
          </div>

          <span className="text-gray-400 text-sm font-medium">×</span>

          {/* 수량 */}
          <input ref={qtyRef} type="number" placeholder="수량"
            value={quickQuantity}
            onChange={e => setQuickQuantity(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleQuickAdd()}
            className="w-16 text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
          />

          {/* 단위 */}
          <select value={quickUnit} onChange={e => setQuickUnit(e.target.value)}
            className="text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
          >
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>

          {/* 자동 계산 미리보기 */}
          {previewQuickAmount !== null && (
            <span className="text-xs text-gray-600">= <strong>{previewQuickAmount.toLocaleString()}원</strong></span>
          )}

          <button onClick={handleQuickAdd}
            disabled={quickLoading || !quickItem.trim() || previewQuickAmount === null}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40 whitespace-nowrap hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >{quickLoading ? '...' : '추가 ↵'}</button>
          <span className="text-xs text-gray-300 hidden lg:block">Tab 이동 · Enter 추가</span>
        </div>

        {/* 새 거래처 인라인 등록 폼 */}
        {newVendorForm && (
          <div className="mt-3 bg-white border border-yellow-300 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-800 mb-3">새 거래처 등록</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">이름 *</label>
                <input autoFocus value={newVendorData.name}
                  onChange={e => setNewVendorData(d => ({ ...d, name: e.target.value }))}
                  placeholder="홍길동 / ○○디자인"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">구분</label>
                <div className="flex gap-1.5">
                  {['프리랜서', '업체', '기타'].map(t => (
                    <button key={t} type="button" onClick={() => setNewVendorData(d => ({ ...d, type: t }))}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${newVendorData.type === t ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-semibold' : 'border-gray-200 text-gray-500'}`}
                    >{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">이메일</label>
                <input type="email" value={newVendorData.email}
                  onChange={e => setNewVendorData(d => ({ ...d, email: e.target.value }))}
                  placeholder="example@email.com"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-0.5 block">연락처</label>
                <input value={newVendorData.phone}
                  onChange={e => setNewVendorData(d => ({ ...d, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500 mb-0.5 block">주민등록번호 / 사업자번호</label>
                <input value={newVendorData.id_number}
                  onChange={e => setNewVendorData(d => ({ ...d, id_number: e.target.value }))}
                  placeholder="000000-0000000 또는 000-00-00000"
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 font-mono"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={handleNewVendorSave}
                disabled={newVendorLoading || !newVendorData.name.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >{newVendorLoading ? '등록 중...' : '거래처 등록'}</button>
              <button type="button"
                onClick={() => { setNewVendorForm(false); setNewVendorData({ name: '', type: '업체', email: '', phone: '', id_number: '' }) }}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-gray-200 hover:text-gray-600 transition-colors"
              >취소</button>
            </div>
          </div>
        )}
      </div>

      {/* ── 내부원가 ── */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">내부원가</span>
        </div>

        {/* 부가세 고정 항목 */}
        {revenue > 0 && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-gray-50 text-sm mb-1">
            <span className="flex-1 text-gray-700 flex items-center gap-1.5">
              부가세
              <span className="text-xs text-gray-400 bg-white border border-gray-100 px-1.5 py-0.5 rounded">자동 · 매출 10%</span>
            </span>
            <span className="font-medium text-gray-700">{vatAmount.toLocaleString()}원</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {RATE_ITEMS.filter(r => !existingRateLabels.includes(r.item)).map(r => (
            <div key={r.item}>
              {ratePickerFor === r.item ? (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 flex-wrap">
                  <span className="text-xs font-medium text-blue-800">{r.item}</span>
                  {r.presets.map(p => (
                    <button key={p} onClick={() => handleRateInsert(r.item, p)} disabled={rateLoading}
                      className="text-xs px-2 py-0.5 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-100 font-medium disabled:opacity-40"
                    >{p}%</button>
                  ))}
                  <div className="relative">
                    <input type="number" placeholder="직접" value={customRate}
                      onChange={e => setCustomRate(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && customRate && handleRateInsert(r.item, Number(customRate))}
                      className="w-14 text-xs px-1.5 py-0.5 border border-gray-200 rounded focus:outline-none focus:border-blue-400 bg-white pr-4"
                    />
                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  {revenue > 0 && customRate && (
                    <span className="text-xs text-blue-600">= {Math.round(revenue * Number(customRate) / 100).toLocaleString()}원</span>
                  )}
                  <button onClick={() => { setRatePickerFor(null); setCustomRate('') }} className="text-xs text-gray-400 hover:text-gray-600 ml-1 transition-colors">✕</button>
                </div>
              ) : (
                <button onClick={() => setRatePickerFor(r.item)}
                  className="text-xs px-2 py-0.5 rounded border border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >+ {r.item} %</button>
              )}
            </div>
          ))}
        </div>

        {inner.length === 0 && <p className="text-xs text-gray-300 py-1">항목 없음</p>}
        <div className="space-y-0.5">
          {inner.map(item => editingId === item.id ? (
            <EditRow key={item.id} item={item} revenue={revenue} isRateItem={RATE_ITEM_NAMES.includes(item.item)}
              onSave={vals => handleEditSave(item.id, vals)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ItemRow key={item.id} item={item} revenue={revenue} isRateItem={RATE_ITEM_NAMES.includes(item.item)}
              onEdit={() => setEditingId(item.id)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      </div>

      {/* ── 외부원가 ── */}
      <div className="px-5 py-3 border-t border-yellow-200">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">외부원가</span>
        {outer.length === 0 && <p className="text-xs text-gray-300 py-1">항목 없음</p>}
        <div className="space-y-0.5">
          {outer.map(item => editingId === item.id ? (
            <EditRow key={item.id} item={item} revenue={revenue} isRateItem={false}
              onSave={vals => handleEditSave(item.id, vals)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ItemRow key={item.id} item={item} revenue={revenue} isRateItem={false}
              onEdit={() => setEditingId(item.id)}
              onDelete={() => handleDelete(item.id)}
              onTogglePaid={() => togglePaid(item.id, item.is_paid ?? false)}
            />
          ))}
        </div>
      </div>

      {/* ── 요약 ── */}
      <div className="px-5 py-2.5 border-t border-yellow-200 bg-yellow-100/60 flex items-center gap-6">
        <span className="text-xs text-gray-500">총 원가 <strong className="text-gray-800">{totalCost.toLocaleString()}원</strong></span>
        {revenue > 0 && (
          <span className="text-xs text-gray-500">
            이익 <strong className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>{profit.toLocaleString()}원</strong>
            <span className="text-gray-400 ml-1">({profitRate}%)</span>
          </span>
        )}
        {outer.some(i => !i.is_paid) && (
          <span className="text-xs text-orange-500 font-medium">
            미지급 {outer.filter(i => !i.is_paid).reduce((s, i) => s + i.amount, 0).toLocaleString()}원
          </span>
        )}
      </div>
    </div>
  )
}

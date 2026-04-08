'use client'
import { useState, useRef, KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CostItem {
  id: string
  item: string
  amount: number
  unit_price?: number | null
  quantity?: number | null
  unit?: string | null
  category: string
  vendor_id?: string | null
  memo?: string | null
}

interface SheetRow {
  key: string
  id: string | null
  vendor_id: string | null
  vendor_name: string
  item: string
  unit_price: string
  quantity: string
  unit: string
  amount: string
  memo: string
}

interface Vendor { id: string; name: string; type: string }

interface Props {
  saleId: string
  revenue: number
  initialItems: CostItem[]
  vendors: Vendor[]
  showInternalCosts?: boolean
  onItemsChange: (items: CostItem[]) => void
}

const COLS = 7 // item, unit_price, qty, unit, amount, vendor(ext only), memo

const UNITS = ['인', 'ea', '식', '차시', '일', 'set']

const INT_PRESETS = [
  { label: '부가세', single: true, items: [{ pct: 10, name: '부가세' }] },
  { label: '지급수수료', single: false, items: [1, 2, 3, 5].map(p => ({ pct: p, name: '지급수수료' })) },
  { label: '감가상각', single: false, items: [3, 5, 6, 8, 10].map(p => ({ pct: p, name: '감가상각비' })) },
]

function newRow(): SheetRow {
  return { key: Math.random().toString(36).slice(2), id: null, vendor_id: null, vendor_name: '', item: '', unit_price: '', quantity: '', unit: '', amount: '', memo: '' }
}

// 금액 콤마 포맷
function fmtAmt(raw: string): string {
  if (!raw) return ''
  const n = Number(raw)
  return isNaN(n) ? raw : n.toLocaleString('ko-KR')
}

// ── 신규 거래처 등록 패널 ──────────────────────────────────
function NewVendorPanel({
  name,
  onSave,
  onCancel,
  saving,
}: {
  name: string
  onSave: (data: { type: string; phone: string; id_number: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [type, setType] = useState('업체')
  const [phone, setPhone] = useState('')
  const [idNum, setIdNum] = useState('')

  return (
    <div className="border-t border-blue-100 bg-blue-50/50 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-blue-700">
          신규 거래처 등록
          <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 rounded text-blue-600">{name}</span>
        </span>
        <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400"
        >
          <option>업체</option>
          <option>프리랜서</option>
          <option>개인</option>
        </select>
        <input
          placeholder="연락처"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400 w-32"
        />
        <input
          placeholder="사업자번호 / 주민번호"
          value={idNum}
          onChange={e => setIdNum(e.target.value)}
          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-yellow-400 w-44"
        />
        <button
          onClick={() => onSave({ type, phone, id_number: idNum })}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
        >
          {saving ? '등록 중...' : '등록'}
        </button>
        <span className="text-xs text-gray-400">※ 연락처·번호 없이 이름만 등록 가능</span>
      </div>
    </div>
  )
}

// ── 거래처 입력 셀 ──────────────────────────────────────────
function VendorInput({
  value, rowKey, section, rowIdx, vendors,
  onChange, onKeyDown, onNewVendorRequest,
}: {
  value: string
  rowKey: string
  section: 'ext' | 'int'
  rowIdx: number
  vendors: Vendor[]
  onChange: (name: string, vendorId: string | null) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>, s: 'ext' | 'int', r: number, c: number) => void
  onNewVendorRequest: (rowIdx: number, name: string) => void
}) {
  const isExisting = vendors.some(v => v.name.toLowerCase() === value.trim().toLowerCase())
  const isNew = value.trim().length > 0 && !isExisting

  return (
    <div className="relative flex items-center">
      <input
        data-section={section} data-row={rowIdx} data-col={2}
        list={`vlist-${section}-${rowKey}`}
        value={value}
        onChange={e => {
          const name = e.target.value
          const found = vendors.find(v => v.name.toLowerCase() === name.toLowerCase())
          onChange(name, found?.id ?? null)
        }}
        onKeyDown={e => onKeyDown(e, section, rowIdx, 2)}
        placeholder="거래처"
        className="w-full px-2 py-1.5 text-sm focus:outline-none focus:bg-yellow-50/80 focus:ring-1 focus:ring-inset focus:ring-yellow-400 rounded-sm transition-colors bg-transparent placeholder:text-gray-200"
      />
      <datalist id={`vlist-${section}-${rowKey}`}>
        {vendors.map(v => <option key={v.id} value={v.name} />)}
      </datalist>
      {isNew && (
        <button
          onMouseDown={e => { e.preventDefault(); onNewVendorRequest(rowIdx, value.trim()) }}
          className="absolute right-1.5 text-[10px] text-blue-500 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors font-medium"
        >
          신규 +
        </button>
      )}
    </div>
  )
}

// ── 섹션 테이블 ───────────────────────────────────────────
function SectionTable({
  title, rows, section, vendors, revenue, showPresets, showVendor,
  deletedIds, setDeletedIds, setRows, setSavedAt, onKeyDown, onFocusCell, onNewVendorRequest,
}: {
  title: string
  rows: SheetRow[]
  section: 'ext' | 'int'
  vendors: Vendor[]
  revenue: number
  showPresets?: boolean
  showVendor?: boolean
  deletedIds: string[]
  setDeletedIds: React.Dispatch<React.SetStateAction<string[]>>
  setRows: React.Dispatch<React.SetStateAction<SheetRow[]>>
  setSavedAt: () => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>, s: 'ext' | 'int', r: number, c: number) => void
  onFocusCell: (s: 'ext' | 'int', r: number, c: number) => void
  onNewVendorRequest?: (section: 'ext' | 'int', rowIdx: number, name: string) => void
}) {
  const [openPreset, setOpenPreset] = useState<string | null>(null)
  const [customPct, setCustomPct] = useState('')
  const subtotal = rows.reduce((s, r) => {
    const isAuto = !!r.unit_price && !!r.quantity
    return s + (isAuto ? Number(r.unit_price) * Number(r.quantity) : (Number(r.amount) || 0))
  }, 0)

  const updateRow = (idx: number, field: keyof SheetRow, val: string | null) => {
    setSavedAt()
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r))
  }

  const deleteRow = (idx: number) => {
    const row = rows[idx]
    if (row.id) setDeletedIds(prev => [...prev, row.id!])
    setRows(prev => {
      const next = prev.filter((_, i) => i !== idx)
      const last = next[next.length - 1]
      if (!last || last.item || last.amount) return [...next, newRow()]
      return next
    })
    setSavedAt()
  }

  const addPresetRow = (name: string, pct: number) => {
    if (revenue <= 0 || pct <= 0) return
    const amt = Math.round(revenue * pct / 100)
    setSavedAt()
    setRows(prev => {
      const withoutTrail = prev.filter(r => r.item || r.amount)
      return [...withoutTrail, { ...newRow(), item: name, amount: String(amt) }, newRow()]
    })
    setOpenPreset(null)
    setCustomPct('')
  }

  const togglePreset = (label: string) => {
    setOpenPreset(prev => prev === label ? null : label)
    setCustomPct('')
  }

  const isExt = section === 'ext'
  const hasVendor = showVendor !== false
  // # | 항목명 | 단가 | 수량 | 단위 | 금액 | [거래처] | 메모 | ×
  const gridCls = hasVendor
    ? 'grid-cols-[28px_1fr_85px_50px_62px_100px_120px_1fr_28px]'
    : 'grid-cols-[28px_1fr_85px_50px_62px_100px_1fr_28px]'
  const memoCol = hasVendor ? 6 : 5
  const cellCls = 'w-full px-2 py-1.5 text-sm focus:outline-none focus:bg-yellow-50/80 focus:ring-1 focus:ring-inset focus:ring-yellow-400 rounded-sm transition-colors bg-transparent placeholder:text-gray-200'

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className={`flex items-center justify-between px-3 py-2 ${
        isExt ? 'bg-orange-50 border-b border-orange-100' : 'bg-blue-50 border-b border-blue-100 border-t border-t-gray-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isExt ? 'bg-orange-400' : 'bg-blue-400'}`} />
          <span className={`text-xs font-semibold ${isExt ? 'text-orange-700' : 'text-blue-700'}`}>{title}</span>
        </div>
        {subtotal > 0 && (
          <span className={`text-xs font-medium ${isExt ? 'text-orange-600' : 'text-blue-600'}`}>
            소계 {subtotal.toLocaleString()}원
          </span>
        )}
      </div>

      {/* 내부원가 프리셋 */}
      {showPresets && revenue > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-blue-50/40 border-b border-blue-50 flex-wrap">
          <span className="text-[10px] text-blue-300 font-medium mr-0.5">빠른 추가</span>
          {INT_PRESETS.map(group => (
            <div key={group.label} className="relative">
              {group.single ? (
                <button
                  onClick={() => addPresetRow(group.items[0].name, group.items[0].pct)}
                  className="text-xs px-2.5 py-1 rounded-full border border-blue-200 text-blue-600 bg-white hover:bg-blue-50 transition-colors"
                >
                  {group.label} {group.items[0].pct}%
                </button>
              ) : (
                <>
                  <button
                    onClick={() => togglePreset(group.label)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                      openPreset === group.label
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-blue-200 text-blue-600 bg-white hover:bg-blue-50'
                    }`}
                  >
                    {group.label}
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openPreset === group.label && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                      {group.items.map(item => (
                        <button
                          key={item.pct}
                          onClick={() => addPresetRow(item.name, item.pct)}
                          className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between gap-4"
                        >
                          <span className="font-medium">{item.pct}%</span>
                          <span className="text-gray-400">{Math.round(revenue * item.pct / 100).toLocaleString()}원</span>
                        </button>
                      ))}
                      {/* 직접 입력 */}
                      <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-1.5">
                        <input
                          type="number"
                          placeholder="직접 입력"
                          value={customPct}
                          onChange={e => setCustomPct(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customPct) addPresetRow(group.items[0].name, Number(customPct))
                          }}
                          className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400 text-right"
                          min="0" max="100" step="0.1"
                        />
                        <span className="text-xs text-gray-400">%</span>
                        {customPct && (
                          <span className="text-xs text-gray-400 ml-1">
                            = {Math.round(revenue * Number(customPct) / 100).toLocaleString()}원
                          </span>
                        )}
                        <button
                          onClick={() => { if (customPct) addPresetRow(group.items[0].name, Number(customPct)) }}
                          disabled={!customPct}
                          className="ml-auto text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 transition-colors"
                        >추가</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 컬럼 헤더 */}
      <div className={`grid ${gridCls} bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400`}>
        <div className="px-2 py-1.5 text-center">#</div>
        <div className="px-2 py-1.5">항목명</div>
        <div className="px-2 py-1.5 text-right">단가</div>
        <div className="px-2 py-1.5 text-right">수량</div>
        <div className="px-2 py-1.5 text-center">단위</div>
        <div className="px-2 py-1.5 text-right">금액 (원)</div>
        {hasVendor && <div className="px-2 py-1.5">거래처</div>}
        <div className="px-2 py-1.5">메모</div>
        <div />
      </div>

      {/* 행들 */}
      {rows.map((row, rowIdx) => {
        const isAutoAmt = !!row.unit_price && !!row.quantity
        const autoAmt = isAutoAmt ? Number(row.unit_price) * Number(row.quantity) : null
        const displayAmt = isAutoAmt ? fmtAmt(String(autoAmt)) : fmtAmt(row.amount)
        const hasContent = row.item || row.amount || row.unit_price
        return (
        <div key={row.key} className={`grid ${gridCls} border-b border-gray-50 group hover:bg-gray-50/50`}>
          <div className="px-2 py-1.5 text-center text-xs text-gray-200 self-center">
            {hasContent ? rowIdx + 1 : ''}
          </div>
          <div className="px-1 py-0.5">
            <input
              data-section={section} data-row={rowIdx} data-col={0}
              value={row.item}
              onChange={e => updateRow(rowIdx, 'item', e.target.value)}
              onKeyDown={e => onKeyDown(e, section, rowIdx, 0)}
              placeholder={rowIdx === rows.length - 1 ? '항목 추가...' : ''}
              className={cellCls}
            />
          </div>
          {/* 단가 */}
          <div className="px-1 py-0.5">
            <input
              data-section={section} data-row={rowIdx} data-col={1}
              type="text" inputMode="numeric"
              value={fmtAmt(row.unit_price)}
              onChange={e => updateRow(rowIdx, 'unit_price', e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={e => onKeyDown(e, section, rowIdx, 1)}
              placeholder="단가"
              className={cellCls + ' text-right'}
            />
          </div>
          {/* 수량 */}
          <div className="px-1 py-0.5">
            <input
              data-section={section} data-row={rowIdx} data-col={2}
              type="text" inputMode="numeric"
              value={row.quantity}
              onChange={e => updateRow(rowIdx, 'quantity', e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={e => onKeyDown(e, section, rowIdx, 2)}
              placeholder="수량"
              className={cellCls + ' text-right'}
            />
          </div>
          {/* 단위 */}
          <div className="relative px-1 py-0.5 group/unit">
            <input
              data-section={section} data-row={rowIdx} data-col={3}
              value={row.unit}
              onChange={e => updateRow(rowIdx, 'unit', e.target.value)}
              onKeyDown={e => onKeyDown(e, section, rowIdx, 3)}
              placeholder="-"
              className={cellCls + ' text-center'}
            />
            {/* 포커스시 preset 버튼 */}
            <div className="absolute top-full left-0 z-30 hidden group-focus-within/unit:flex flex-wrap gap-0.5 bg-white border border-gray-200 rounded-lg shadow-md p-1.5 min-w-[100px]">
              {UNITS.map(u => (
                <button
                  key={u}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); updateRow(rowIdx, 'unit', u) }}
                  className="px-1.5 py-0.5 text-xs rounded bg-gray-100 hover:bg-yellow-100 hover:text-yellow-800 transition-colors"
                >{u}</button>
              ))}
            </div>
          </div>
          {/* 금액 */}
          <div className="px-1 py-0.5">
            <input
              data-section={section} data-row={rowIdx} data-col={4}
              type="text" inputMode="numeric"
              value={displayAmt}
              readOnly={isAutoAmt}
              onChange={e => {
                if (isAutoAmt) return
                updateRow(rowIdx, 'amount', e.target.value.replace(/[^0-9]/g, ''))
              }}
              onKeyDown={e => onKeyDown(e, section, rowIdx, 4)}
              placeholder="0"
              className={cellCls + ' text-right' + (isAutoAmt ? ' text-blue-600 font-medium bg-blue-50/30' : '')}
            />
          </div>
          {hasVendor && (
            <div className="px-1 py-0.5">
              <VendorInput
                value={row.vendor_name}
                rowKey={row.key}
                section={section}
                rowIdx={rowIdx}
                vendors={vendors}
                onChange={(name, id) => { updateRow(rowIdx, 'vendor_name', name); updateRow(rowIdx, 'vendor_id', id) }}
                onKeyDown={onKeyDown}
                onNewVendorRequest={(ri, name) => onNewVendorRequest?.(section, ri, name)}
              />
            </div>
          )}
          <div className="px-1 py-0.5">
            <input
              data-section={section} data-row={rowIdx} data-col={memoCol}
              value={row.memo}
              onChange={e => updateRow(rowIdx, 'memo', e.target.value)}
              onKeyDown={e => onKeyDown(e, section, rowIdx, memoCol)}
              placeholder="메모"
              className={cellCls}
            />
          </div>
          <div className="flex items-center justify-center py-0.5">
            {hasContent && (
              <button
                onClick={() => deleteRow(rowIdx)}
                className="w-5 h-5 rounded flex items-center justify-center text-gray-200 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 text-base mx-auto"
              >×</button>
            )}
          </div>
        </div>
        )
      })}

      {/* 행 추가 */}
      <button
        onClick={() => {
          setRows(prev => {
            const last = prev[prev.length - 1]
            if (!last.item && !last.amount) return prev
            return [...prev, newRow()]
          })
          setTimeout(() => onFocusCell(section, rows.length, 0), 0)
        }}
        className={`w-full text-left px-4 py-1.5 text-xs transition-colors ${
          isExt ? 'text-orange-300 hover:text-orange-600 hover:bg-orange-50/50' : 'text-blue-300 hover:text-blue-600 hover:bg-blue-50/50'
        }`}
      >
        + 행 추가
      </button>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function CostSheetEditor({ saleId, revenue, initialItems, vendors: initVendors, showInternalCosts = true, onItemsChange }: Props) {
  const [vendorsList, setVendorsList] = useState<Vendor[]>(initVendors)

  const toSheetRows = (items: CostItem[]): SheetRow[] => {
    const vMap = Object.fromEntries(vendorsList.map(v => [v.id, v.name]))
    return [
      ...items.map(i => ({
        key: i.id, id: i.id,
        vendor_id: i.vendor_id ?? null,
        vendor_name: i.vendor_id ? (vMap[i.vendor_id] ?? '') : '',
        item: i.item,
        unit_price: i.unit_price ? String(i.unit_price) : '',
        quantity: i.quantity ? String(i.quantity) : '',
        unit: i.unit ?? '',
        amount: String(i.amount),
        memo: i.memo ?? '',
      })),
      newRow(),
    ]
  }

  const [extRows, setExtRows] = useState<SheetRow[]>(() =>
    toSheetRows(initialItems.filter(i => i.category === '외부원가' || i.category === '기타'))
  )
  const [intRows, setIntRows] = useState<SheetRow[]>(() =>
    toSheetRows(initialItems.filter(i => i.category === '내부원가'))
  )
  const [deletedIds, setDeletedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // 신규 거래처 등록 패널
  const [newVendorCtx, setNewVendorCtx] = useState<{ section: 'ext' | 'int'; rowIdx: number; name: string } | null>(null)
  const [newVendorSaving, setNewVendorSaving] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const calcRowAmt = (r: SheetRow) => (r.unit_price && r.quantity) ? Number(r.unit_price) * Number(r.quantity) : (Number(r.amount) || 0)
  const extTotal = extRows.reduce((s, r) => s + calcRowAmt(r), 0)
  const intTotal = intRows.reduce((s, r) => s + calcRowAmt(r), 0)
  const totalAmount = extTotal + intTotal
  const profitRate = revenue > 0 && totalAmount > 0
    ? Math.round(((revenue - totalAmount) / revenue) * 100)
    : null

  const focusCell = (section: 'ext' | 'int', rowIdx: number, colIdx: number) => {
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector(
        `[data-section="${section}"][data-row="${rowIdx}"][data-col="${colIdx}"]`
      ) as HTMLElement
      el?.focus()
    })
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>, section: 'ext' | 'int', rowIdx: number, colIdx: number) => {
    const rows = section === 'ext' ? extRows : intRows
    const setter = section === 'ext' ? setExtRows : setIntRows
    const numCols = section === 'ext' ? COLS : COLS - 1
    const isLastRow = rowIdx === rows.length - 1
    const isLastCol = colIdx === numCols - 1

    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        if (colIdx > 0) focusCell(section, rowIdx, colIdx - 1)
        else if (rowIdx > 0) focusCell(section, rowIdx - 1, numCols - 1)
        else if (section === 'int') focusCell('ext', extRows.length - 1, COLS - 1)
      } else {
        if (!isLastCol) focusCell(section, rowIdx, colIdx + 1)
        else if (!isLastRow) focusCell(section, rowIdx + 1, 0)
        else if (section === 'ext') focusCell('int', 0, 0)
        else { setter(prev => [...prev, newRow()]); focusCell('int', rows.length, 0) }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isLastRow) setter(prev => [...prev, newRow()])
      focusCell(section, rowIdx + 1, colIdx)
    }
  }

  const handleNewVendorRequest = (section: 'ext' | 'int', rowIdx: number, name: string) => {
    setNewVendorCtx({ section, rowIdx, name })
  }

  const handleNewVendorSave = async (data: { type: string; phone: string; id_number: string }) => {
    if (!newVendorCtx) return
    setNewVendorSaving(true)
    const supabase = createClient()
    const { data: vendor } = await supabase.from('vendors').insert({
      name: newVendorCtx.name.trim(),
      type: data.type,
      phone: data.phone || null,
      id_number: data.id_number || null,
    }).select('id, name, type').single()

    if (vendor) {
      setVendorsList(prev => [...prev, vendor])
      const setter = newVendorCtx.section === 'ext' ? setExtRows : setIntRows
      setter(prev => prev.map((r, i) =>
        i === newVendorCtx.rowIdx ? { ...r, vendor_id: vendor.id, vendor_name: vendor.name } : r
      ))
    }
    setNewVendorCtx(null)
    setNewVendorSaving(false)
  }

  const resolveVendorId = async (vendorName: string, existingId: string | null): Promise<string | null> => {
    if (!vendorName.trim()) return null
    const found = vendorsList.find(v => v.name.toLowerCase() === vendorName.trim().toLowerCase())
    if (found) return found.id
    if (existingId) return existingId
    const supabase = createClient()
    const { data } = await supabase.from('vendors').insert({ name: vendorName.trim(), type: '업체' }).select('id').single()
    return data?.id ?? null
  }

  const handleSave = async () => {
    setSaving(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ops: any[] = []
    const newIds: { key: string; id: string }[] = []

    if (deletedIds.length > 0) {
      ops.push(supabase.from('sale_costs').delete().in('id', deletedIds))
    }

    const saveRows = async (rows: SheetRow[], category: string) => {
      for (const row of rows) {
        if (!row.item.trim()) continue
        const isAutoAmt = !!row.unit_price && !!row.quantity
        const amt = isAutoAmt
          ? Number(row.unit_price) * Number(row.quantity)
          : (Number(row.amount) || 0)
        const vendorId = await resolveVendorId(row.vendor_name, row.vendor_id)
        const fields = {
          item: row.item.trim(), amount: amt, category, vendor_id: vendorId, memo: row.memo || null,
          unit_price: row.unit_price ? Number(row.unit_price) : null,
          quantity: row.quantity ? Number(row.quantity) : null,
          unit: row.unit || null,
        }
        if (row.id) {
          ops.push(supabase.from('sale_costs').update(fields).eq('id', row.id))
        } else {
          ops.push(
            supabase.from('sale_costs').insert({ sale_id: saleId, ...fields })
              .select('id').single().then(({ data }: { data: { id: string } | null }) => {
                if (data) newIds.push({ key: row.key, id: data.id })
              })
          )
        }
      }
    }

    await saveRows(extRows, '외부원가')
    await saveRows(intRows, '내부원가')
    await Promise.all(ops)

    const applyIds = (prev: SheetRow[]) => prev.map(r => {
      const found = newIds.find(n => n.key === r.key)
      return found ? { ...r, id: found.id } : r
    })
    setExtRows(applyIds)
    setIntRows(applyIds)
    setDeletedIds([])
    setSaving(false)
    setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))

    const toItem = (r: SheetRow, category: string): CostItem => {
      const isAutoAmt = !!r.unit_price && !!r.quantity
      const amt = isAutoAmt ? Number(r.unit_price) * Number(r.quantity) : Number(r.amount)
      return {
        id: newIds.find(n => n.key === r.key)?.id ?? r.id ?? '',
        item: r.item.trim(), amount: amt, category,
        unit_price: r.unit_price ? Number(r.unit_price) : null,
        quantity: r.quantity ? Number(r.quantity) : null,
        unit: r.unit || null,
        vendor_id: r.vendor_id, memo: r.memo || null,
      }
    }
    const updated: CostItem[] = [
      ...extRows.filter(r => r.item.trim()).map(r => toItem(r, '외부원가')),
      ...intRows.filter(r => r.item.trim()).map(r => toItem(r, '내부원가')),
    ]
    onItemsChange(updated)
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-gray-200 overflow-hidden">
      <SectionTable
        title="외부원가" rows={extRows} section="ext"
        vendors={vendorsList} revenue={revenue} showVendor
        deletedIds={deletedIds} setDeletedIds={setDeletedIds}
        setRows={setExtRows} setSavedAt={() => setSavedAt(null)}
        onKeyDown={handleKeyDown} onFocusCell={focusCell}
        onNewVendorRequest={handleNewVendorRequest}
      />

      {/* 신규 거래처 등록 패널 - 외부원가 아래, 내부원가 위 */}
      {newVendorCtx && (
        <NewVendorPanel
          name={newVendorCtx.name}
          onSave={handleNewVendorSave}
          onCancel={() => setNewVendorCtx(null)}
          saving={newVendorSaving}
        />
      )}

      {showInternalCosts && (
        <SectionTable
          title="내부원가" rows={intRows} section="int"
          vendors={vendorsList} revenue={revenue} showPresets showVendor={false}
          deletedIds={deletedIds} setDeletedIds={setDeletedIds}
          setRows={setIntRows} setSavedAt={() => setSavedAt(null)}
          onKeyDown={handleKeyDown} onFocusCell={focusCell}
        />
      )}

      {/* 합계 + 저장 */}
      <div className="border-t-2 border-gray-200 bg-gray-50/50 px-3 py-2.5 flex items-center gap-4 flex-wrap">
        {totalAmount > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="text-xs text-gray-400 mr-1">합계</span>
              <span className="font-bold text-gray-800">{totalAmount.toLocaleString()}원</span>
            </span>
            {profitRate !== null && (
              <span className={`text-xs font-medium ${profitRate >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                이익률 {profitRate}%
              </span>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {savedAt} 저장됨
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 hover:opacity-80"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

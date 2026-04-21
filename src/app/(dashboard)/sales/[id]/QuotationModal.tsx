'use client'

import { useState } from 'react'
import {
  buildRentalHtml, buildCategoryHtml,
  getQuotationTemplateType, getCategoryServiceType,
  type RentalItem, type Category, type CategoryItem,
} from '@/lib/quotation-html'

type Props = {
  serviceType: string | null
  clientOrg: string | null
  onClose: () => void
}

// ── 날짜 포맷 헬퍼 ──────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 견적서 오픈 ──────────────────────────────────────────────────

function openHtml(html: string, title: string) {
  const w = window.open('', '_blank')
  if (!w) { alert('팝업이 차단되었습니다. 허용 후 다시 시도하세요.'); return }
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 400)
}

// ── 교구대여 폼 ──────────────────────────────────────────────────

function RentalForm({ clientOrg, onClose }: { clientOrg: string | null; onClose: () => void }) {
  const [docType, setDocType] = useState<'quotation' | 'contract'>('contract')
  const [issueDate, setIssueDate] = useState(todayStr())
  const [clientName, setClientName] = useState(clientOrg ?? '')
  const [clientAddress, setClientAddress] = useState('')
  const [manager, setManager] = useState('')
  const [phone, setPhone] = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('')
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [pickupFee, setPickupFee] = useState(0)
  const [deposit, setDeposit] = useState(0)
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<RentalItem[]>([{ name: '', detail: '', qty: 1, months: 1, price: 0 }])

  function addItem() {
    setItems(prev => [...prev, { name: '', detail: '', qty: 1, months: 1, price: 0 }])
  }

  function removeItem(i: number) {
    setItems(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, field: keyof RentalItem, value: string | number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }

  function generate() {
    if (!clientName.trim()) { alert('거래처명을 입력하세요.'); return }
    if (!items.some(it => it.name.trim())) { alert('품목을 하나 이상 입력하세요.'); return }
    const html = buildRentalHtml({
      docType, issueDate, clientName, clientAddress, manager, phone,
      rentalPeriod, deliveryFee, pickupFee, deposit, notes,
      items: items.filter(it => it.name.trim()),
    })
    openHtml(html, `${docType === 'contract' ? '임대차계약서' : '견적서'}_${clientName}`)
  }

  const totalAmt = items.reduce((s, it) => s + it.qty * it.months * it.price, 0) + deliveryFee + pickupFee + deposit

  return (
    <div className="space-y-4">
      {/* 서류 유형 */}
      <div className="flex gap-3">
        {(['contract', 'quotation'] as const).map(t => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
            <input type="radio" checked={docType === t} onChange={() => setDocType(t)} className="accent-yellow-400" />
            {t === 'contract' ? '임대차 계약서 (조항 포함)' : '견적서 (간이)'}
          </label>
        ))}
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">거래처명 *</label>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">발행일</label>
          <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">주소</label>
          <input value={clientAddress} onChange={e => setClientAddress(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="경기도 ..." />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">대여기간</label>
          <input value={rentalPeriod} onChange={e => setRentalPeriod(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="2026.05.01 ~ 2027.04.30" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">담당자</label>
          <input value={manager} onChange={e => setManager(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">연락처</label>
          <input value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* 품목 */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-2">품목 *</p>
        <div className="text-xs text-gray-400 grid grid-cols-[2fr_1.5fr_60px_60px_120px_28px] gap-1.5 px-1 mb-1">
          <span>품목명</span><span>세부내용</span><span className="text-center">수량</span>
          <span className="text-center">개월</span><span className="text-right">단가(원)</span><span></span>
        </div>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[2fr_1.5fr_60px_60px_120px_28px] gap-1.5 items-center">
              <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="예: 젬베10" />
              <input value={item.detail} onChange={e => updateItem(i, 'detail', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="세부내용" />
              <input type="number" min="1" value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-center" />
              <input type="number" min="1" value={item.months} onChange={e => updateItem(i, 'months', Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-center" />
              <input type="number" min="0" value={item.price} onChange={e => updateItem(i, 'price', Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-right" />
              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          ))}
        </div>
        <button onClick={addItem}
          className="mt-2 w-full py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-yellow-400 hover:text-yellow-600">
          + 품목 추가
        </button>
      </div>

      {/* 배송/수거/보증금 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '배송비', val: deliveryFee, set: setDeliveryFee },
          { label: '수거비', val: pickupFee, set: setPickupFee },
          { label: '보증금', val: deposit, set: setDeposit },
        ].map(({ label, val, set }) => (
          <div key={label}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
            <input type="number" min="0" value={val} onChange={e => set(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right" />
          </div>
        ))}
      </div>

      {/* 특이사항 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">특이사항</label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="반납 안내 등 추가 안내사항" />
      </div>

      {/* 합계 미리보기 + 버튼 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm text-gray-600">
          예상 총액: <span className="font-bold text-gray-900">₩{totalAmt.toLocaleString('ko-KR')}</span>
        </span>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            취소
          </button>
          <button onClick={generate}
            className="px-5 py-2 text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg">
            견적서 생성
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 카테고리형 폼 (학교상점 / 002Creative / 아트키움 / SOS) ─────

function CategoryForm({ serviceType, clientOrg, onClose }: { serviceType: string | null; clientOrg: string | null; onClose: () => void }) {
  const [issueDate, setIssueDate] = useState(todayStr())
  const [clientName, setClientName] = useState(clientOrg ?? '')
  const [manager, setManager] = useState('')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [categories, setCategories] = useState<Category[]>([
    { name: '', items: [{ name: '', detail: '', unit: '식', qty: 1, price: 0 }] },
  ])

  function addCategory() {
    setCategories(prev => [...prev, { name: '', items: [{ name: '', detail: '', unit: '식', qty: 1, price: 0 }] }])
  }

  function removeCategory(ci: number) {
    setCategories(prev => prev.filter((_, i) => i !== ci))
  }

  function updateCategoryName(ci: number, name: string) {
    setCategories(prev => prev.map((c, i) => i === ci ? { ...c, name } : c))
  }

  function addItemToCategory(ci: number) {
    setCategories(prev => prev.map((c, i) => i === ci
      ? { ...c, items: [...c.items, { name: '', detail: '', unit: '식', qty: 1, price: 0 }] }
      : c))
  }

  function removeItem(ci: number, ii: number) {
    setCategories(prev => prev.map((c, i) => i === ci
      ? { ...c, items: c.items.filter((_, j) => j !== ii) }
      : c))
  }

  function updateItem(ci: number, ii: number, field: keyof CategoryItem, value: string | number) {
    setCategories(prev => prev.map((c, i) => i === ci
      ? { ...c, items: c.items.map((it, j) => j === ii ? { ...it, [field]: value } : it) }
      : c))
  }

  function generate() {
    if (!clientName.trim()) { alert('거래처명을 입력하세요.'); return }
    const svType = getCategoryServiceType(serviceType)
    const html = buildCategoryHtml({
      serviceType: svType,
      issueDate, clientName, manager, discount, notes,
      categories: categories.filter(c => c.items.some(it => it.name.trim())),
    })
    openHtml(html, `견적서_${clientName}`)
  }

  const supplyTotal = categories.reduce((s, c) =>
    s + c.items.reduce((ss, it) => ss + it.qty * it.price, 0), 0)
  const vat = Math.round(supplyTotal * 0.1)
  const total = supplyTotal + vat - (discount ?? 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">거래처명 *</label>
          <input value={clientName} onChange={e => setClientName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">발행일</label>
          <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">담당자</label>
          <input value={manager} onChange={e => setManager(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">할인 금액</label>
          <input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-right" />
        </div>
      </div>

      {/* 카테고리별 항목 */}
      {categories.map((cat, ci) => (
        <div key={ci} className="border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={cat.name} onChange={e => updateCategoryName(ci, e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-semibold"
              placeholder="카테고리명 (예: Pre-Production, 음향장비, 강사료)" />
            {categories.length > 1 && (
              <button onClick={() => removeCategory(ci)} className="text-red-400 hover:text-red-600 text-sm">삭제</button>
            )}
          </div>

          <div className="text-xs text-gray-400 grid grid-cols-[2fr_1.5fr_60px_60px_130px_28px] gap-1.5 px-1">
            <span>품명</span><span>세부내역</span><span className="text-center">단위</span>
            <span className="text-center">수량</span><span className="text-right">단가(원)</span><span></span>
          </div>

          {cat.items.map((item, ii) => (
            <div key={ii} className="grid grid-cols-[2fr_1.5fr_60px_60px_130px_28px] gap-1.5 items-center">
              <input value={item.name} onChange={e => updateItem(ci, ii, 'name', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="품명" />
              <input value={item.detail} onChange={e => updateItem(ci, ii, 'detail', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm" placeholder="세부내역" />
              <input value={item.unit} onChange={e => updateItem(ci, ii, 'unit', e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-center" />
              <input type="number" min="1" value={item.qty} onChange={e => updateItem(ci, ii, 'qty', Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-center" />
              <input type="number" min="0" value={item.price} onChange={e => updateItem(ci, ii, 'price', Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm text-right" />
              <button onClick={() => removeItem(ci, ii)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          ))}

          <button onClick={() => addItemToCategory(ci)}
            className="w-full py-1 border border-dashed border-gray-200 rounded text-xs text-gray-400 hover:border-yellow-400 hover:text-yellow-600">
            + 항목 추가
          </button>
        </div>
      ))}

      <button onClick={addCategory}
        className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-yellow-400 hover:text-yellow-600">
        + 카테고리 추가
      </button>

      {/* 특이사항 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">안내사항</label>
        <input value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          placeholder="추가 안내사항" />
      </div>

      {/* 합계 미리보기 + 버튼 */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-sm text-gray-600">
          공급가 ₩{supplyTotal.toLocaleString()} + 부가세 ₩{vat.toLocaleString()}
          {discount > 0 && ` - 할인 ₩${discount.toLocaleString()}`}
          {' = '}
          <span className="font-bold text-gray-900">₩{total.toLocaleString()}</span>
        </span>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            취소
          </button>
          <button onClick={generate}
            className="px-5 py-2 text-sm font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg">
            견적서 생성
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 모달 ────────────────────────────────────────────────────

export default function QuotationModal({ serviceType, clientOrg, onClose }: Props) {
  const templateType = getQuotationTemplateType(serviceType)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 pb-10 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">견적서 생성</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {serviceType ?? '서비스 미지정'} · {templateType === 'rental' ? '임대차 계약서 형식' : '카테고리형 견적서'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {templateType === 'rental'
          ? <RentalForm clientOrg={clientOrg} onClose={onClose} />
          : <CategoryForm serviceType={serviceType} clientOrg={clientOrg} onClose={onClose} />
        }
      </div>
    </div>
  )
}

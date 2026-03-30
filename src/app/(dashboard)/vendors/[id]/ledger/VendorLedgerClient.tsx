'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addVendorPayment, deleteVendorPayment } from '../../actions'

interface SaleCost {
  id: string
  item: string
  amount: number
  category: string
  memo: string | null
  sale: { id: string; name: string; inflow_date: string | null; payment_status: string | null }
}

interface Payment {
  id: string
  amount: number
  paid_date: string
  memo: string | null
}

interface Vendor {
  id: string
  name: string
  type: string
  phone: string | null
  bank_info: string | null
  memo: string | null
}

interface Props {
  vendor: Vendor
  costs: SaleCost[]
  payments: Payment[]
}

function formatMoney(n: number) {
  return n.toLocaleString() + '원'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function VendorLedgerClient({ vendor, costs, payments: initialPayments }: Props) {
  const router = useRouter()
  const [payments, setPayments] = useState(initialPayments)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ amount: '', paid_date: new Date().toISOString().split('T')[0], memo: '' })
  const [saving, setSaving] = useState(false)
  const [filterStart, setFilterStart] = useState('')
  const [filterEnd, setFilterEnd] = useState('')

  const isFreelancer = vendor.type === '프리랜서'
  const net = (amount: number) => Math.round(amount * 0.967) // 원천세 3.3% 차감

  const filteredPayments = payments.filter(p => {
    if (filterStart && p.paid_date < filterStart) return false
    if (filterEnd && p.paid_date > filterEnd) return false
    return true
  })

  const totalOwed = costs.reduce((s, c) => s + c.amount, 0)
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0)
  const periodPaid = filteredPayments.reduce((s, p) => s + p.amount, 0)
  const balance = totalOwed - totalPaid
  const isFiltered = filterStart || filterEnd

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    try {
      const result = await addVendorPayment(vendor.id, Number(form.amount), form.paid_date, form.memo)
      setPayments(prev => [result, ...prev].sort((a, b) => b.paid_date.localeCompare(a.paid_date)))
      setForm({ amount: '', paid_date: new Date().toISOString().split('T')[0], memo: '' })
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm('이 입금 내역을 삭제하시겠어요?')) return
    await deleteVendorPayment(id, vendor.id)
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  // 계약/매출건 기준으로 원가 그룹화
  const grouped = costs.reduce<Record<string, { sale: SaleCost['sale']; items: SaleCost[] }>>((acc, c) => {
    const key = c.sale.id
    if (!acc[key]) acc[key] = { sale: c.sale, items: [] }
    acc[key].items.push(c)
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/vendors" className="text-gray-400 hover:text-gray-600 text-sm">← 거래처 DB</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">{vendor.name}</span>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-bold text-gray-900">{vendor.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{vendor.type}</span>
            </div>
            {vendor.phone && <p className="text-sm text-gray-500">{vendor.phone}</p>}
            {vendor.bank_info && <p className="text-xs text-gray-400 mt-0.5">{vendor.bank_info}</p>}
            {vendor.memo && <p className="text-xs text-gray-400 mt-1 italic">{vendor.memo}</p>}
          </div>
          <Link
            href={`/vendors/${vendor.id}`}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-800 transition-colors"
          >
            정보 수정
          </Link>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">총 지급 예정</p>
          <p className="text-lg font-bold text-gray-900">{totalOwed.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">원</span></p>
          {isFreelancer && (
            <p className="text-xs text-blue-500 mt-1">실지급 {net(totalOwed).toLocaleString()}원</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">총 입금</p>
          <p className="text-lg font-bold text-green-600">{totalPaid.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">원</span></p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${balance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
          <p className="text-xs text-gray-400 mb-1">잔액 (미지급)</p>
          <p className={`text-lg font-bold ${balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
            {balance.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">원</span>
          </p>
          {isFreelancer && balance > 0 && (
            <p className="text-xs text-blue-500 mt-1">실지급 {net(balance).toLocaleString()}원</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* 지급 예정 (원가 항목) */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">지급 예정 내역</h2>
          </div>
          {costs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">연결된 원가 항목이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {Object.values(grouped).map(({ sale, items }) => {
                const saleTotal = items.reduce((s, c) => s + c.amount, 0)
                return (
                  <div key={sale.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{sale.name}</span>
                        {sale.inflow_date && (
                          <span className="ml-2 text-xs text-gray-400">{formatDate(sale.inflow_date)}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-gray-700">{saleTotal.toLocaleString()}원</span>
                        {isFreelancer && <span className="text-xs text-blue-500 ml-1.5">→ {net(saleTotal).toLocaleString()}원</span>}
                      </div>
                    </div>
                    <div className="space-y-1 pl-2">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{item.category}</span>
                            <span className="text-gray-600">{item.item}</span>
                            {item.memo && <span className="text-gray-400 italic">{item.memo}</span>}
                          </div>
                          <div className="text-right">
                            <span className="text-gray-700 font-medium">{item.amount.toLocaleString()}원</span>
                            {isFreelancer && <span className="text-blue-400 ml-1.5">→ {net(item.amount).toLocaleString()}원</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 입금 내역 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              입금 내역 ({isFiltered ? `${filteredPayments.length}건 / 전체 ${payments.length}건` : `${payments.length}건`})
            </h2>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >
              + 입금 추가
            </button>
          </div>
          {/* 기간 필터 */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/50 flex-wrap">
            <span className="text-xs text-gray-400">기간</span>
            <input
              type="date"
              value={filterStart}
              onChange={e => setFilterStart(e.target.value)}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-yellow-400"
              style={{ appearance: 'auto' } as React.CSSProperties}
            />
            <span className="text-xs text-gray-300">~</span>
            <input
              type="date"
              value={filterEnd}
              onChange={e => setFilterEnd(e.target.value)}
              className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-yellow-400"
              style={{ appearance: 'auto' } as React.CSSProperties}
            />
            {isFiltered && (
              <>
                <button
                  onClick={() => { setFilterStart(''); setFilterEnd('') }}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 transition-colors"
                >초기화</button>
                <span className="text-xs text-blue-600 font-medium ml-1">
                  기간 합계 {periodPaid.toLocaleString()}원
                  {isFreelancer && <span className="text-gray-400 ml-1">(실지급 {net(periodPaid).toLocaleString()}원)</span>}
                </span>
              </>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleAddPayment} className="px-5 py-3.5 border-b border-yellow-100 bg-yellow-50/40 flex items-center gap-2 flex-wrap">
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="금액 (원)"
                required
                className="w-36 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
              <input
                type="date"
                value={form.paid_date}
                onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))}
                required
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties}
              />
              <input
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                placeholder="메모 (선택)"
                className="flex-1 min-w-[120px] px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
              <button
                type="submit"
                disabled={saving}
                className="text-xs px-4 py-1.5 rounded-lg font-semibold disabled:opacity-60 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >취소</button>
            </form>
          )}

          {filteredPayments.length === 0 && !showForm ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">{isFiltered ? '해당 기간 입금 내역이 없습니다.' : '입금 내역이 없습니다.'}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-24">{formatDate(p.paid_date)}</span>
                    <span className="text-sm font-semibold text-green-600">{p.amount.toLocaleString()}원</span>
                    {p.memo && <span className="text-xs text-gray-400">{p.memo}</span>}
                  </div>
                  <button
                    onClick={() => handleDeletePayment(p.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                  >삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

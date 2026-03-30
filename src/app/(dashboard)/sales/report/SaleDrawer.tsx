'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS } from '@/types'
import CostInlineEditor from '../CostInlineEditor'
import { updateSaleInline, deleteSale } from '../actions'

interface CostItem {
  id: string
  item: string
  amount: number
  memo?: string | null
  category: string
}

interface Sale {
  id: string
  name: string
  department: string | null
  revenue: number | null
  payment_status: string | null
  contract_type: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
  created_at: string
  assignee: { id: string; name: string } | null
  entity: { id: string; name: string } | null
  sale_costs: CostItem[]
}

interface Profile { id: string; name: string }
interface BusinessEntity { id: string; name: string }
interface Vendor { id: string; name: string; type: string }

interface Props {
  sale: Sale
  entities: BusinessEntity[]
  vendors: Vendor[]
  profiles: Profile[]
  isAdmin: boolean
  onClose: () => void
  onSaved: (updated: Sale) => void
  onDeleted: (id: string) => void
}

const PAYMENT_STATUSES = ['계약전', '계약완료', '선금수령', '중도금수령', '완납']
const CONTRACT_TYPES = ['나라장터', '세금계산서', '카드결제', '기타']

export default function SaleDrawer({ sale, entities, vendors, profiles, isAdmin, onClose, onSaved, onDeleted }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(sale.name)
  const [department, setDepartment] = useState(sale.department ?? '')
  const [entityId, setEntityId] = useState(sale.entity?.id ?? '')
  const [contractType, setContractType] = useState(sale.contract_type ?? '')
  const [assigneeId, setAssigneeId] = useState(sale.assignee?.id ?? '')
  const [revenue, setRevenue] = useState(String(sale.revenue ?? ''))
  const [paymentStatus, setPaymentStatus] = useState(sale.payment_status ?? '계약전')
  const [inflowDate, setInflowDate] = useState(sale.inflow_date ? sale.inflow_date.split('T')[0] : '')
  const [paymentDate, setPaymentDate] = useState(sale.payment_date ? sale.payment_date.split('T')[0] : '')
  const [dropboxUrl, setDropboxUrl] = useState(sale.dropbox_url ?? '')
  const [memo, setMemo] = useState(sale.memo ?? '')
  const [localCosts, setLocalCosts] = useState<CostItem[]>(sale.sale_costs)

  const rev = revenue ? Number(revenue) : 0
  const cost = localCosts.reduce((s, c) => s + c.amount, 0)
  const profit = rev - cost

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await updateSaleInline(sale.id, {
      name: name.trim(),
      department: department || null,
      assignee_id: assigneeId || null,
      entity_id: entityId || null,
      revenue: rev,
      payment_status: paymentStatus,
      contract_type: contractType || null,
      memo: memo || null,
      inflow_date: inflowDate || null,
      payment_date: paymentDate || null,
      dropbox_url: dropboxUrl || null,
    })
    setSaving(false)
    onSaved({
      ...sale,
      name: name.trim(),
      department: department || null,
      assignee: profiles.find(p => p.id === assigneeId) ?? null,
      entity: entities.find(e => e.id === entityId) ?? null,
      revenue: rev,
      payment_status: paymentStatus,
      contract_type: contractType || null,
      memo: memo || null,
      inflow_date: inflowDate || null,
      payment_date: paymentDate || null,
      dropbox_url: dropboxUrl || null,
      sale_costs: localCosts,
    })
    startTransition(() => router.refresh())
  }

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠어요?')) return
    await deleteSale(sale.id)
    onDeleted(sale.id)
    router.refresh()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-[95vw] bg-white shadow-2xl flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs text-gray-400 mb-0.5">매출 건 상세</p>
            <h2 className="text-sm font-bold text-gray-900 truncate">{sale.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1.5 transition-colors text-lg leading-none">×</button>
        </div>

        {/* 본문 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* 건명 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">건명 *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">사업부</label>
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">담당자</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">계약 사업자</label>
              <select value={entityId} onChange={e => setEntityId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                <option value="">선택 안함</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">계약 방법</label>
              <select value={contractType} onChange={e => setContractType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white">
                <option value="">선택 안함</option>
                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* 매출액 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">매출액 (원)</label>
            <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">유입일자</label>
              <input type="date" value={inflowDate} onChange={e => setInflowDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">결제일자</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          {/* 수금상태 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">수금 상태</label>
            <div className="flex gap-1.5 flex-wrap">
              {PAYMENT_STATUSES.map(s => (
                <button key={s} type="button" onClick={() => setPaymentStatus(s)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    paymentStatus === s
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* 드롭박스 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">드롭박스 링크</label>
            <input type="url" value={dropboxUrl} onChange={e => setDropboxUrl(e.target.value)}
              placeholder="https://www.dropbox.com/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">메모</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 resize-none" />
          </div>

          {/* 수익 요약 */}
          {rev > 0 && (
            <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between text-sm">
              <div className="text-gray-500">매출 <span className="font-semibold text-gray-900">{rev.toLocaleString()}</span></div>
              <span className="text-gray-300">−</span>
              <div className="text-gray-500">원가 <span className="font-semibold text-gray-900">{cost.toLocaleString()}</span></div>
              <span className="text-gray-300">=</span>
              <div className="text-gray-500">이익 <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{profit.toLocaleString()}</span></div>
            </div>
          )}

          {/* 원가 항목 */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">원가 항목</label>
            <CostInlineEditor
              saleId={sale.id}
              revenue={rev}
              initialItems={localCosts}
              vendors={vendors}
              onItemsChange={items => setLocalCosts(items as CostItem[])}
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
          {isAdmin && (
            <button onClick={handleDelete}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
              삭제
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
            닫기
          </button>
        </div>
      </div>
    </>
  )
}

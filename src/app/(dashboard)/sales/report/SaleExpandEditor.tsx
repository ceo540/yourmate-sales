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
  colSpan: number
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

export default function SaleExpandEditor({ sale, colSpan, entities, vendors, profiles, isAdmin, onClose, onSaved, onDeleted }: Props) {
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
  const cost = localCosts.reduce((s, c) => s + c.amount, 0) + (rev > 0 ? Math.round(rev * 0.1) : 0)
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

  const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5'
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 bg-white'

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-b-2 border-yellow-300">
        <div className="px-6 py-5 bg-gradient-to-b from-yellow-50/60 to-white">

          {/* 필드 그리드 */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {/* 건명 */}
            <div className="col-span-2">
              <label className={labelCls}>건명 *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>

            {/* 사업부 */}
            <div>
              <label className={labelCls}>사업부</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} className={inputCls}>
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* 담당자 */}
            <div>
              <label className={labelCls}>담당자</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={inputCls}>
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* 사업자 */}
            <div>
              <label className={labelCls}>계약 사업자</label>
              <select value={entityId} onChange={e => setEntityId(e.target.value)} className={inputCls}>
                <option value="">선택 안함</option>
                {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {/* 계약방법 */}
            <div>
              <label className={labelCls}>계약 방법</label>
              <select value={contractType} onChange={e => setContractType(e.target.value)} className={inputCls}>
                <option value="">선택 안함</option>
                {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* 매출액 */}
            <div>
              <label className={labelCls}>매출액 (원)</label>
              <input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} className={inputCls} />
            </div>

            {/* 수익 요약 */}
            {rev > 0 && (
              <div className="flex items-end pb-0.5">
                <div className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <span className="text-gray-400">원가 <span className="font-medium text-gray-700">{cost.toLocaleString()}</span></span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-400">이익 <span className={`font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{profit.toLocaleString()}</span></span>
                </div>
              </div>
            )}

            {/* 유입일 */}
            <div>
              <label className={labelCls}>유입일자</label>
              <input type="date" value={inflowDate} onChange={e => setInflowDate(e.target.value)}
                className={inputCls} style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>

            {/* 결제일 */}
            <div>
              <label className={labelCls}>결제일자</label>
              <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
                className={inputCls} style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>

            {/* 수금상태 */}
            <div className="col-span-2">
              <label className={labelCls}>수금 상태</label>
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
            <div className="col-span-2">
              <label className={labelCls}>드롭박스 링크</label>
              <input type="url" value={dropboxUrl} onChange={e => setDropboxUrl(e.target.value)}
                placeholder="https://www.dropbox.com/..." className={inputCls} />
            </div>

            {/* 메모 */}
            <div className="col-span-2">
              <label className={labelCls}>메모</label>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 resize-none bg-white" />
            </div>
          </div>

          {/* 원가 항목 */}
          <div className="mb-4">
            <label className={labelCls}>원가 항목</label>
            <CostInlineEditor
              saleId={sale.id}
              revenue={rev}
              initialItems={localCosts}
              vendors={vendors}
              onItemsChange={items => setLocalCosts(items as CostItem[])}
            />
          </div>

          {/* 하단 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            {isAdmin && (
              <button onClick={handleDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                삭제
              </button>
            )}
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
              닫기
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

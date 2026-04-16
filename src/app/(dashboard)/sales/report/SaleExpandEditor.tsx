'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEPT_SERVICE_GROUPS, SERVICE_TO_DEPT } from '@/types'
import CostInlineEditor from '../CostInlineEditor'
import CostSheetEditor from '../CostSheetEditor'
import { updateSaleInline, deleteSale, toggleCostConfirmed } from '../actions'

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
  client_org: string | null
  client_dept: string | null
  customer_id: string | null
  service_type: string | null
  revenue: number | null
  contract_stage: string | null
  contract_type: string | null
  cost_confirmed?: boolean | null
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
interface Customer { id: string; name: string; type: string }

interface Props {
  sale: Sale
  colSpan: number
  entities: BusinessEntity[]
  vendors: Vendor[]
  profiles: Profile[]
  customers: Customer[]
  isAdmin: boolean
  onClose: () => void
  onSaved: (updated: Sale) => void
  onDeleted: (id: string) => void
}

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
const CONTRACT_TYPES = ['나라장터', '세금계산서', '카드결제', '기타']

export default function SaleExpandEditor({ sale, colSpan, entities, vendors, profiles, customers, isAdmin, onClose, onSaved, onDeleted }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(sale.name)
  const [serviceType, setServiceType] = useState(sale.service_type ?? '')
  const [clientOrg, setClientOrg] = useState(sale.client_org ?? '')
  const [clientDept, setClientDept] = useState(sale.client_dept ?? '')
  const [customerId, setCustomerId] = useState(sale.customer_id ?? '')
  const [entityId, setEntityId] = useState(sale.entity?.id ?? '')
  const [contractType, setContractType] = useState(sale.contract_type ?? '')
  const [assigneeId, setAssigneeId] = useState(sale.assignee?.id ?? '')
  const [revenue, setRevenue] = useState(String(sale.revenue ?? ''))
  const [contractStage, setPaymentStatus] = useState(sale.contract_stage ?? '계약')
  const [inflowDate, setInflowDate] = useState(sale.inflow_date ? sale.inflow_date.split('T')[0] : '')
  const [paymentDate, setPaymentDate] = useState(sale.payment_date ? sale.payment_date.split('T')[0] : '')
  const [dropboxUrl, setDropboxUrl] = useState(sale.dropbox_url ?? '')
  const [memo, setMemo] = useState(sale.memo ?? '')
  const [localCosts, setLocalCosts] = useState<CostItem[]>(sale.sale_costs)
  const [costConfirmed, setCostConfirmed] = useState(sale.cost_confirmed ?? false)
  const [confirmingCost, setConfirmingCost] = useState(false)
  const [costMode, setCostMode] = useState<'inline' | 'sheet'>('sheet')

  const rev = revenue ? Number(revenue) : 0
  const cost = localCosts.reduce((s, c) => s + c.amount, 0) + (rev > 0 ? Math.round(rev * 0.1) : 0)
  const profit = rev - cost

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const derivedDept = (serviceType && SERVICE_TO_DEPT[serviceType]) || sale.department || null
    try {
      await updateSaleInline(sale.id, {
        name: name.trim(),
        department: derivedDept,
        client_org: clientOrg || null,
        client_dept: clientDept || null,
        customer_id: customerId || null,
        service_type: serviceType || null,
        assignee_id: assigneeId || null,
        entity_id: entityId || null,
        revenue: rev,
        contract_stage: contractStage,
        contract_type: contractType || null,
        memo: memo || null,
        inflow_date: inflowDate || null,
        payment_date: paymentDate || null,
        dropbox_url: dropboxUrl || null,
      })
    } catch (e) {
      alert('저장 실패: ' + (e instanceof Error ? e.message : String(e)))
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved({
      ...sale,
      name: name.trim(),
      department: derivedDept,
      client_org: clientOrg || null,
      client_dept: clientDept || null,
      customer_id: customerId || null,
      service_type: serviceType || null,
      assignee: profiles.find(p => p.id === assigneeId) ?? null,
      entity: entities.find(e => e.id === entityId) ?? null,
      revenue: rev,
      contract_stage: contractStage,
      contract_type: contractType || null,
      cost_confirmed: costConfirmed,
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

            {/* 서비스 */}
            <div>
              <label className={labelCls}>서비스</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} className={inputCls}>
                <option value="">선택 안함</option>
                {DEPT_SERVICE_GROUPS.filter(g => g.services.length > 0).map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.services.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                ))}
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

            {/* 발주처 */}
            <div className="col-span-2">
              <label className={labelCls}>발주처</label>
              {customers.length > 0 && (
                <select
                  value={customerId}
                  onChange={e => {
                    setCustomerId(e.target.value)
                    const c = customers.find(c => c.id === e.target.value)
                    if (c) setClientOrg(c.name)
                  }}
                  className={inputCls + ' mb-1.5'}
                >
                  <option value="">고객 DB에서 선택</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
              )}
              <input
                value={clientOrg}
                onChange={e => setClientOrg(e.target.value)}
                placeholder="예: 용인교육지원청 지역교육과"
                className={inputCls}
              />
            </div>

            {/* 부서 */}
            <div>
              <label className={labelCls}>발주 부서</label>
              <input
                value={clientDept}
                onChange={e => setClientDept(e.target.value)}
                placeholder="예: 지역교육과"
                className={inputCls}
              />
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
              <label className={labelCls}>계약 단계</label>
              <div className="flex gap-1.5 flex-wrap">
                {CONTRACT_STAGES.map(s => (
                  <button key={s} type="button" onClick={() => setContractStage(s)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                      contractStage === s
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
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <label className={labelCls} style={{ marginBottom: 0 }}>원가 항목</label>
                {/* 입력 모드 토글 */}
                <div className="flex text-xs rounded-lg border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCostMode('sheet')}
                    className={`px-2.5 py-1 transition-colors ${costMode === 'sheet' ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:bg-gray-50'}`}
                  >시트</button>
                  <button
                    type="button"
                    onClick={() => setCostMode('inline')}
                    className={`px-2.5 py-1 transition-colors ${costMode === 'inline' ? 'bg-gray-800 text-white font-medium' : 'text-gray-400 hover:bg-gray-50'}`}
                  >기존</button>
                </div>
              </div>
              <button
                type="button"
                disabled={confirmingCost}
                onClick={async () => {
                  setConfirmingCost(true)
                  const next = !costConfirmed
                  setCostConfirmed(next)
                  try { await toggleCostConfirmed(sale.id, next) } catch { setCostConfirmed(!next) }
                  setConfirmingCost(false)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                  costConfirmed
                    ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {costConfirmed ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    원가 입력 완료
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    원가 입력 완료 표시
                  </>
                )}
              </button>
            </div>
            {costMode === 'sheet' ? (
              <CostSheetEditor
                saleId={sale.id}
                revenue={rev}
                initialItems={localCosts}
                vendors={vendors}
                onItemsChange={items => setLocalCosts(items as CostItem[])}
              />
            ) : (
              <CostInlineEditor
                saleId={sale.id}
                revenue={rev}
                initialItems={localCosts}
                vendors={vendors}
                onItemsChange={items => setLocalCosts(items as CostItem[])}
              />
            )}
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
            <button
              onClick={e => { e.stopPropagation(); router.push(`/sales/${sale.id}?from=/sales/report`) }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              업무 관리
            </button>
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

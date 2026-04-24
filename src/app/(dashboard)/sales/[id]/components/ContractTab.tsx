'use client'

import { useState, useTransition } from 'react'
import { updateSaleDetail } from '../contract-action'
import { updateProgressStatus } from '../../actions'
import { syncSaleName, type SyncResult } from '../sync-name-action'
import { DEPARTMENT_LABELS, PROGRESS_STATUSES, ProgressStatus } from '@/types'

const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const
const CONTRACT_STAGE_MAP: Record<string, number> = {
  '계약': 0, '착수': 1, '선금': 2, '중도금': 3, '완수': 4, '계산서발행': 5, '잔금': 6,
}

interface Profile { id: string; name: string }
interface BusinessEntity { id: string; name: string }
interface Customer { id: string; name: string; contact_name: string | null; type: string | null }
interface Sale {
  id: string; name: string
  contract_stage: string | null; progress_status: string | null
  department: string | null; dropbox_url: string | null
  client_org: string | null; customer_id: string | null
  revenue: number | null; inflow_date: string | null
  payment_date: string | null; contract_type: string | null
  entity_id: string | null; assignee_id: string | null
  contract_assignee_id: string | null
  notion_page_id: string | null
}

interface Props {
  sale: Sale
  profiles: Profile[]
  entities: BusinessEntity[]
  customers: Customer[]
}

export default function ContractTab({ sale, profiles, entities, customers }: Props) {
  const stageIdx = CONTRACT_STAGE_MAP[sale.contract_stage ?? '계약'] ?? 0
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>((sale.progress_status as ProgressStatus) ?? '착수전')

  function handleProgressChange(status: ProgressStatus) {
    setProgressStatus(status)
    startTransition(async () => {
      await updateProgressStatus(sale.id, status)
    })
  }
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(sale.customer_id ?? '')
  const [clientOrgText, setClientOrgText] = useState(sale.client_org ?? '')

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact_name ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  async function handleSubmit(formData: FormData) {
    formData.set('customer_id', selectedCustomerId)
    formData.set('client_org', selectedCustomer?.name ?? clientOrgText)
    startTransition(async () => {
      await updateSaleDetail(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* 수금 파이프라인 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">수금 단계</p>
        <div className="flex items-center">
          {CONTRACT_STAGES.map((status, i) => {
            const done = i < stageIdx; const current = i === stageIdx
            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center px-0.5 ${current ? 'text-gray-900 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
                </div>
                {i < CONTRACT_STAGES.length - 1 && <div className={`h-0.5 flex-1 -mt-4 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 운영 진행 트랙 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">운영 진행</p>
        <div className="flex gap-2">
          {PROGRESS_STATUSES.map(status => (
            <button key={status} type="button"
              onClick={() => handleProgressChange(status)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                progressStatus === status
                  ? status === '완수'   ? 'bg-teal-500 text-white border-teal-500'
                  : status === '착수중' ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
              }`}>{status}</button>
          ))}
        </div>
      </div>

      {/* 이름 동기화 */}
      {(sale.dropbox_url || sale.notion_page_id) && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">이름 동기화</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                건명 변경 후 드롭박스 폴더{sale.notion_page_id ? ' · 노션 페이지' : ''}를 현재 이름으로 업데이트
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSyncing(true)
                setSyncResult(null)
                const result = await syncSaleName(sale.id)
                setSyncResult(result)
                setSyncing(false)
              }}
              disabled={syncing}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              {syncing ? '동기화 중...' : '🔄 동기화'}
            </button>
          </div>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.success ? 'text-green-600' : 'text-red-500'}`}>
              {syncResult.message}
            </p>
          )}
        </div>
      )}

      {/* 수정 폼 */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={sale.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">건명 *</label>
            <input name="name" required defaultValue={sale.name}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>

          {/* 발주처 — 고객 DB 연결 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">발주처 (고객 DB)</label>
            <div className="relative">
              <div
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer flex items-center justify-between focus:outline-none focus:border-yellow-400 bg-white"
                onClick={() => setShowCustomerDropdown(v => !v)}
              >
                <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedCustomer ? selectedCustomer.name : '고객 선택 또는 직접 입력'}
                </span>
                <span className="text-gray-400 text-xs">▼</span>
              </div>
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="검색..."
                      className="w-full text-sm px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setSelectedCustomerId(''); setClientOrgText(''); setShowCustomerDropdown(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50">
                      선택 안함 (직접 입력)
                    </button>
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomerId(c.id); setShowCustomerDropdown(false); setCustomerSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors">
                        <span className="font-medium text-gray-800">{c.name}</span>
                        {c.contact_name && <span className="text-xs text-gray-400 ml-2">{c.contact_name}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!selectedCustomer && (
              <input value={clientOrgText} onChange={e => setClientOrgText(e.target.value)}
                placeholder="직접 입력"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사업부</label>
              <select name="department" defaultValue={sale.department ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">업무 실무자</label>
              <select name="assignee_id" defaultValue={sale.assignee_id ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 실무자</label>
            <select name="contract_assignee_id" defaultValue={sale.contract_assignee_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
              <input type="number" name="revenue" defaultValue={sale.revenue ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">계약 방법</label>
              <select name="contract_type" defaultValue={sale.contract_type ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {['나라장터','세금계산서','카드결제','기타'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">유입일자</label>
              <input type="date" name="inflow_date" defaultValue={sale.inflow_date ? sale.inflow_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">결제일자</label>
              <input type="date" name="payment_date" defaultValue={sale.payment_date ? sale.payment_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 사업자</label>
            <select name="entity_id" defaultValue={sale.entity_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 단계</label>
            <div className="flex gap-2 flex-wrap">
              {CONTRACT_STAGES.map(status => (
                <label key={status} className="cursor-pointer">
                  <input type="radio" name="contract_stage" value={status}
                    defaultChecked={(sale.contract_stage ?? '계약') === status} className="sr-only peer" />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">드롭박스 폴더 링크</label>
            <input name="dropbox_url" type="url" defaultValue={sale.dropbox_url ?? ''}
              placeholder="https://www.dropbox.com/home/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            <p className="text-[10px] text-gray-400 mt-1">Finder 우클릭 링크(/scl/fo/...)는 안 됩니다. 드롭박스 웹 → 폴더 열기 → 주소창 URL 복사</p>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {saved ? '✓ 저장됨' : isPending ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>
    </div>
  )
}

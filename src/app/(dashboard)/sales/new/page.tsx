import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DEPARTMENT_LABELS } from '@/types'
import { createSale } from '../actions'
import SubmitButton from '@/components/ui/SubmitButton'

interface BusinessEntity { id: string; name: string }

const PAYMENT_STATUSES = ['계약전', '계약완료', '선금수령', '중도금수령', '완납'] as const

export default async function NewSalePage() {
  const supabase = await createClient()
  const [{ data: profiles }, { data: entities }] = await Promise.all([
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('business_entities').select('id, name').order('name'),
  ])

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/sales" className="text-gray-400 hover:text-gray-600 text-sm">← 매출 관리</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">새 매출 건</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">새 매출 건 등록</h1>

        <form action={createSale} className="space-y-5">
          {/* 건명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">건명 *</label>
            <input
              name="name"
              required
              placeholder="예: 2024 ○○학교 졸업앨범"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 사업부 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사업부</label>
              <select
                name="department"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* 담당자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">담당자</label>
              <select
                name="assignee_id"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="">선택 안함</option>
                {profiles?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 사업자 */}
          {(entities ?? []).length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">계약 사업자</label>
              <select
                name="entity_id"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="">선택 안함</option>
                {(entities as BusinessEntity[]).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 계약방법 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">계약 방법</label>
            <select
              name="contract_type"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
            >
              <option value="">선택 안함</option>
              {['나라장터', '세금계산서', '카드결제', '기타'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 매출액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              매출액 <span className="text-gray-400 font-normal text-xs">(원, 숫자만)</span>
            </label>
            <input
              type="number"
              name="revenue"
              placeholder="예: 5000000"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
            <p className="text-xs text-gray-400 mt-1">원가는 저장 후 보고서에서 세부 항목으로 입력할 수 있어요.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 유입일자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">유입일자</label>
              <input
                type="date"
                name="inflow_date"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties}
              />
            </div>
            {/* 결제일자 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                결제일자 <span className="text-gray-400 font-normal text-xs">결제 후 입력 가능</span>
              </label>
              <input
                type="date"
                name="payment_date"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties}
              />
            </div>
          </div>

          {/* 수금상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">수금 상태</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_STATUSES.map((status, i) => (
                <label key={status} className="cursor-pointer">
                  <input
                    type="radio"
                    name="payment_status"
                    value={status}
                    defaultChecked={i === 0}
                    className="sr-only peer"
                  />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 드롭박스 URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              드롭박스 폴더 링크 <span className="text-gray-400 font-normal text-xs">(선택)</span>
            </label>
            <input
              name="dropbox_url"
              type="url"
              placeholder="https://www.dropbox.com/..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
            <p className="text-xs text-gray-400 mt-1">드롭박스 폴더에서 "링크 복사" 후 붙여넣기</p>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              메모 <span className="text-gray-400 font-normal text-xs">(선택)</span>
            </label>
            <textarea
              name="memo"
              placeholder="특이사항, 수금 일정 등"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <SubmitButton label="등록" loadingLabel="등록 중..." fullWidth />
            <Link
              href="/sales"
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

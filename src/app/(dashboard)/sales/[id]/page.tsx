import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { DEPARTMENT_LABELS } from '@/types'
import { updateSale } from '../actions'

const PAYMENT_STATUSES = ['계약전', '계약완료', '선금수령', '중도금수령', '완납'] as const

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: sale } = await supabase
    .from('sales')
    .select('*, assignee:profiles(id, name)')
    .eq('id', id)
    .single()

  if (!sale) notFound()

  const { data: profiles } = await supabase.from('profiles').select('id, name').order('name')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/sales" className="text-gray-400 hover:text-gray-600 text-sm">← 매출 관리</Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-600 font-medium">{sale.name}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">매출 건 수정</h1>

        <form action={updateSale} className="space-y-5">
          <input type="hidden" name="id" value={sale.id} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">건명 *</label>
            <input
              name="name"
              required
              defaultValue={sale.name}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">사업부</label>
              <select
                name="department"
                defaultValue={sale.department ?? ''}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">담당자</label>
              <select
                name="assignee_id"
                defaultValue={(sale.assignee as any)?.id ?? ''}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="">선택 안함</option>
                {profiles?.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              매출액 <span className="text-gray-400 font-normal text-xs">(원)</span>
            </label>
            <input
              type="number"
              name="revenue"
              defaultValue={sale.revenue ?? ''}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">유입일자</label>
              <input
                type="date"
                name="inflow_date"
                defaultValue={sale.inflow_date ? sale.inflow_date.split('T')[0] : ''}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                결제일자 <span className="text-gray-400 font-normal text-xs">결제 후 입력 가능</span>
              </label>
              <input
                type="date"
                name="payment_date"
                defaultValue={sale.payment_date ? sale.payment_date.split('T')[0] : ''}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">수금 상태</label>
            <div className="flex gap-2 flex-wrap">
              {PAYMENT_STATUSES.map(status => (
                <label key={status} className="cursor-pointer">
                  <input
                    type="radio"
                    name="payment_status"
                    value={status}
                    defaultChecked={(sale.payment_status ?? '계약전') === status}
                    className="sr-only peer"
                  />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">드롭박스 폴더 링크</label>
            <input
              name="dropbox_url"
              type="url"
              defaultValue={sale.dropbox_url ?? ''}
              placeholder="https://www.dropbox.com/..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">메모</label>
            <textarea
              name="memo"
              defaultValue={sale.memo ?? ''}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >
              저장
            </button>
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

'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteVendor } from './actions'

interface CostRef {
  amount: number
  is_paid: boolean
}

interface Vendor {
  id: string
  name: string
  type: string
  phone: string | null
  bank_info: string | null
  memo: string | null
  sale_costs: CostRef[]
}

export default function VendorList({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter()
  const freelancers = vendors.filter(v => v.type === '프리랜서')
  const companies = vendors.filter(v => v.type === '업체')

  const unpaidTotal = (v: Vendor) =>
    v.sale_costs.filter(c => !c.is_paid).reduce((s, c) => s + c.amount, 0)

  const renderGroup = (title: string, list: Vendor[]) => (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 mb-3">{title} ({list.length})</h2>
      {list.length === 0 ? (
        <p className="text-sm text-gray-300 py-4">등록된 {title}이 없어요.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">이름</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">연락처</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">계좌정보</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">미지급</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">메모</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(v => {
                const unpaid = unpaidTotal(v)
                return (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-gray-900">{v.name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500">{v.phone || '-'}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[160px] truncate">{v.bank_info || '-'}</td>
                    <td className="px-4 py-3.5 text-right">
                      {unpaid > 0 ? (
                        <span className="text-sm font-semibold text-red-500">{unpaid.toLocaleString()}원</span>
                      ) : (
                        <span className="text-xs text-gray-300">없음</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[120px] truncate">{v.memo || '-'}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/vendors/${v.id}`}
                          className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800 transition-colors"
                        >
                          수정
                        </Link>
                        <button
                          onClick={async () => {
                            if (!confirm('정말 삭제하시겠어요?')) return
                            await deleteVendor(v.id)
                            router.refresh()
                          }}
                          className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      {renderGroup('프리랜서', freelancers)}
      {renderGroup('업체', companies)}
      {vendors.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-sm">
          거래처를 추가해보세요.
        </div>
      )}
    </div>
  )
}

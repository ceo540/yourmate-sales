'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Cost {
  id: string
  item: string
  amount: number
  is_paid: boolean
  paid_at: string | null
  created_at: string
  memo: string | null
  sale: { name: string; department: string | null } | null
  vendor: { name: string; type: string; phone: string | null; bank_info: string | null } | null
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const CURRENT_MONTH = new Date().getMonth() + 1
const CURRENT_YEAR = new Date().getFullYear()

function calcWithholding(amount: number) {
  return Math.round(amount * 0.033)
}

export default function PaymentsClient({ costs }: { costs: Cost[] }) {
  const [tab, setTab] = useState<'unpaid' | 'paid'>('unpaid')
  const [filterMonth, setFilterMonth] = useState<number | null>(CURRENT_MONTH)
  const [filterYear] = useState(CURRENT_YEAR)
  const router = useRouter()

  const togglePaid = async (id: string, isPaid: boolean) => {
    const supabase = createClient()
    await supabase.from('sale_costs').update({
      is_paid: !isPaid,
      paid_at: !isPaid ? new Date().toISOString() : null,
    }).eq('id', id)
    router.refresh()
  }

  const filtered = costs.filter(c => {
    if (filterMonth) {
      const d = new Date(c.created_at)
      if (d.getFullYear() !== filterYear || d.getMonth() + 1 !== filterMonth) return false
    }
    return tab === 'unpaid' ? !c.is_paid : c.is_paid
  })

  const unpaidTotal = costs.filter(c => !c.is_paid).reduce((s, c) => s + c.amount, 0)
  const paidTotal = costs.filter(c => c.is_paid).reduce((s, c) => s + c.amount, 0)
  const monthUnpaid = costs.filter(c => {
    if (!filterMonth) return !c.is_paid
    const d = new Date(c.created_at)
    return !c.is_paid && d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth
  }).reduce((s, c) => s + c.amount, 0)

  const handleExcelExport = async () => {
    const XLSX = await import('xlsx')

    const label = filterMonth ? `${filterYear}년 ${filterMonth}월` : `${filterYear}년 전체`
    const exportData = filtered.map(c => {
      const isFreelancer = c.vendor?.type === '프리랜서'
      const withholding = isFreelancer ? calcWithholding(c.amount) : 0
      const net = c.amount - withholding
      return {
        '거래처명': c.vendor?.name ?? '미등록',
        '구분': c.vendor?.type ?? '-',
        '항목': c.item,
        '매출 건': c.sale?.name ?? '-',
        '지급액': c.amount,
        '원천징수(3.3%)': isFreelancer ? withholding : '-',
        '실수령액': isFreelancer ? net : c.amount,
        '계좌정보': c.vendor?.bank_info ?? '-',
        '연락처': c.vendor?.phone ?? '-',
        '지급상태': c.is_paid ? '지급완료' : '미지급',
        '지급일': c.paid_at ? new Date(c.paid_at).toLocaleDateString('ko-KR') : '-',
        '메모': c.memo ?? '',
      }
    })

    const ws = XLSX.utils.json_to_sheet(exportData)

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 20 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 28 },
      { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 16 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, label)
    XLSX.writeFile(wb, `지급관리_${label}.xlsx`)
  }

  return (
    <>
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">전체 미지급</p>
          <p className="text-2xl font-bold text-red-500">{unpaidTotal.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">{filterMonth ? `${filterMonth}월` : '전체'} 미지급</p>
          <p className="text-2xl font-bold text-orange-500">{monthUnpaid.toLocaleString()}원</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 mb-1">전체 지급 완료</p>
          <p className="text-2xl font-bold text-green-500">{paidTotal.toLocaleString()}원</p>
        </div>
      </div>

      {/* 월 필터 + 엑셀 버튼 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterMonth(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filterMonth ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'}`}
        >
          전체
        </button>
        {MONTHS.map(m => (
          <button
            key={m}
            onClick={() => setFilterMonth(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterMonth === m ? 'text-yellow-800 font-semibold' : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'}`}
            style={filterMonth === m ? { backgroundColor: '#FFCE00' } : {}}
          >
            {m}월
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={handleExcelExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
        >
          <span>📥</span>
          엑셀 다운로드
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {([['unpaid', '미지급'], ['paid', '지급완료']] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${tab === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {l}
            {v === 'unpaid' && unpaidTotal > 0 && (
              <span className="ml-1.5 text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full">
                {costs.filter(c => !c.is_paid).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5">거래처</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">항목</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">매출 건</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">계좌정보</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">지급액</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">원천징수</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">실수령액</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">
                  {tab === 'paid' ? '지급일' : ''}
                </th>
                <th className="px-4 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-sm text-gray-400">
                    {tab === 'unpaid' ? '미지급 항목이 없어요 🎉' : '지급 완료 항목이 없어요.'}
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const isFreelancer = c.vendor?.type === '프리랜서'
                const withholding = isFreelancer ? calcWithholding(c.amount) : 0
                const net = c.amount - withholding
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      {c.vendor ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900">{c.vendor.name}</p>
                            {isFreelancer && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">프리랜서</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{c.vendor.phone ? c.vendor.phone : ''}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">미등록 거래처</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700">{c.item}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-500">{c.sale?.name ?? '-'}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-400 max-w-[160px] truncate">
                      {c.vendor?.bank_info ?? '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-900 whitespace-nowrap">
                      {c.amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {isFreelancer ? (
                        <span className="text-xs text-red-400">-{withholding.toLocaleString()}</span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {isFreelancer ? (
                        <span className="text-sm font-semibold text-green-600">{net.toLocaleString()}원</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-400">
                      {tab === 'paid' && c.paid_at
                        ? new Date(c.paid_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                        : ''}
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => togglePaid(c.id, c.is_paid)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          c.is_paid
                            ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            : 'text-yellow-800 hover:opacity-80'
                        }`}
                        style={!c.is_paid ? { backgroundColor: '#FFCE00' } : {}}
                      >
                        {c.is_paid ? '지급취소' : '지급완료'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

'use client'

import { useState } from 'react'

interface PayrollRecord {
  id: string
  year: number
  month: number
  employee_name: string
  employee_type: string
  business_entity: string | null
  base_salary: number
  income_tax: number
  resident_id: string | null
  bank_info: string | null
  payment_confirmed: boolean
  payment_date: string | null
}

interface Props {
  payroll: PayrollRecord[]
  businessEntities: { id: string; name: string }[]
}

function fmt(n: number) { return n.toLocaleString() }
function maskId(id: string | null) {
  if (!id) return '-'
  const clean = id.replace(/[^0-9]/g, '')
  if (clean.length < 7) return id
  return clean.slice(0, 6) + '-' + '*'.repeat(7)
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function TaxReportTab({ payroll, businessEntities }: Props) {
  const [year, setYear] = useState(CURRENT_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [filterBiz, setFilterBiz] = useState('all')
  const [showFullId, setShowFullId] = useState(false)

  const freelancers = payroll.filter(r =>
    r.employee_type === 'freelancer' &&
    r.year === year &&
    r.month === month &&
    (filterBiz === 'all' || r.business_entity === filterBiz)
  )

  const totalGross = freelancers.reduce((s, r) => s + r.base_salary, 0)
  const totalIncomeTax = freelancers.reduce((s, r) => s + Math.round(r.base_salary * 0.03), 0)
  const totalLocalTax = freelancers.reduce((s, r) => s + Math.round(r.base_salary * 0.003), 0)
  const totalNet = totalGross - totalIncomeTax - totalLocalTax

  function exportCsv() {
    const headers = ['이름', '사업자', '주민번호', '지급금액', '소득세(3%)', '주민세(0.3%)', '실지급액', '지급일', '지급확인']
    const dataRows = freelancers.map(r => {
      const incomeTax = Math.round(r.base_salary * 0.03)
      const localTax = Math.round(r.base_salary * 0.003)
      return [
        r.employee_name,
        r.business_entity ?? '',
        r.resident_id ?? '',
        r.base_salary,
        incomeTax,
        localTax,
        r.base_salary - incomeTax - localTax,
        r.payment_date ?? '',
        r.payment_confirmed ? 'Y' : 'N',
      ]
    })
    const csv = [headers, ...dataRows].map(row => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${year}년${month}월_프리랜서_원천징수.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
          {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
          {MONTHS.map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400">
          <option value="all">전체 사업자</option>
          {businessEntities.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
        <button
          onClick={() => setShowFullId(v => !v)}
          className="text-xs px-3 py-1.5 border border-gray-200 rounded-full text-gray-500 hover:bg-gray-50 ml-auto">
          주민번호 {showFullId ? '가리기' : '보기'}
        </button>
        <button onClick={exportCsv} disabled={freelancers.length === 0}
          className="text-xs px-3 py-1.5 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100 disabled:opacity-40 transition-all">
          CSV 다운로드
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '프리랜서 수', value: freelancers.length, unit: '명', color: 'text-gray-900' },
          { label: '총 지급액', value: totalGross, unit: '원', color: 'text-gray-900' },
          { label: '원천징수(3.3%)', value: totalIncomeTax + totalLocalTax, unit: '원', color: 'text-red-500' },
          { label: '총 실지급액', value: totalNet, unit: '원', color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>
              {fmt(s.value)}<span className="text-xs font-normal ml-0.5">{s.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 리포트 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {freelancers.length === 0 ? (
          <div className="py-14 text-center text-sm text-gray-400">
            {year}년 {month}월 프리랜서 지급 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-100">
                  {['이름', '사업자', '주민번호', '지급금액', '소득세 3%', '주민세 0.3%', '실지급액', '지급확인'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {freelancers.map(r => {
                  const incomeTax = Math.round(r.base_salary * 0.03)
                  const localTax = Math.round(r.base_salary * 0.003)
                  const net = r.base_salary - incomeTax - localTax
                  return (
                    <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{r.employee_name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.business_entity ?? '-'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {showFullId ? (r.resident_id ?? '-') : maskId(r.resident_id)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-right">{fmt(r.base_salary)}</td>
                      <td className="px-4 py-3 text-red-500 text-right">{fmt(incomeTax)}</td>
                      <td className="px-4 py-3 text-orange-500 text-right">{fmt(localTax)}</td>
                      <td className="px-4 py-3 font-semibold text-green-600 text-right">{fmt(net)}</td>
                      <td className="px-4 py-3">
                        {r.payment_confirmed
                          ? <span className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded-full font-medium">
                              {r.payment_date ?? '확인완료'}
                            </span>
                          : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">미확인</span>}
                      </td>
                    </tr>
                  )
                })}
                {/* 합계 행 */}
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-4 py-3 text-gray-700" colSpan={3}>합계</td>
                  <td className="px-4 py-3 text-gray-900 text-right">{fmt(totalGross)}</td>
                  <td className="px-4 py-3 text-red-500 text-right">{fmt(totalIncomeTax)}</td>
                  <td className="px-4 py-3 text-orange-500 text-right">{fmt(totalLocalTax)}</td>
                  <td className="px-4 py-3 text-green-600 text-right">{fmt(totalNet)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {freelancers.filter(r => r.payment_confirmed).length}/{freelancers.length}명 확인
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">
        * 원천징수 계산: 소득세 3% + 지방소득세 0.3% = 3.3% 공제. 세무사 제출 전 반드시 확인하세요.
      </p>
    </div>
  )
}

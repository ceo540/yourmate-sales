'use client'

import { useState } from 'react'

type Month = { ym: string; accounting: number; tax: number; cash: number }
type ViewMode = 'all' | 'accounting' | 'tax' | 'cash'

function fmtMan(n: number) {
  return (n / 10000).toFixed(0)
}

const COLORS = {
  accounting: '#3b82f6',  // blue
  tax: '#a3a3a3',         // gray
  cash: '#10b981',        // green
}

const LABELS: Record<ViewMode, string> = {
  all: '3종 비교',
  accounting: '회계 매출',
  tax: '세무 매출',
  cash: '현금 매출',
}

export default function RevenueClient({ months, totals }: {
  months: Month[]
  totals: { accounting: number; tax: number; cash: number }
}) {
  const [view, setView] = useState<ViewMode>('all')

  const max = Math.max(
    ...months.map(m => Math.max(m.accounting, m.tax, m.cash)),
    1
  )

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">📊 매출 3종 분석</h1>
        <p className="text-sm text-gray-500">
          최근 12개월. 회계 = 서비스 인도, 세무 = 세금계산서, 현금 = 입금. (yourmate-spec.md §3.4.1)
        </p>
      </header>

      {/* 합계 카드 3종 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 mb-1">📘 회계 매출</p>
          <p className="text-2xl font-bold text-blue-900">{fmtMan(totals.accounting)}만원</p>
          <p className="text-[11px] text-blue-500 mt-1">서비스 인도 시점 (progress_status=완수)</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 mb-1">🧾 세무 매출</p>
          <p className="text-2xl font-bold text-gray-900">{fmtMan(totals.tax)}만원</p>
          <p className="text-[11px] text-gray-500 mt-1">세금계산서 발행 시점 (payment_date)</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600 mb-1">💰 현금 매출</p>
          <p className="text-2xl font-bold text-green-900">{fmtMan(totals.cash)}만원</p>
          <p className="text-[11px] text-green-500 mt-1">실제 입금 시점 (payment_schedules)</p>
        </div>
      </div>

      {/* 시점 차이 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-6 text-sm">
        <p className="font-medium text-yellow-800 mb-1">📌 시점 차이</p>
        <ul className="space-y-0.5 text-xs text-yellow-700">
          <li>회계 - 현금 = <b>{fmtMan(totals.accounting - totals.cash)}만원</b> 미수금 (입금 대기)</li>
          <li>회계 - 세무 = <b>{fmtMan(totals.accounting - totals.tax)}만원</b> 세금계산서 미발행 의심</li>
        </ul>
      </div>

      {/* 토글 */}
      <div className="flex gap-1 mb-4">
        {(['all', 'accounting', 'tax', 'cash'] as ViewMode[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 text-sm rounded-lg ${view === v ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
          >{LABELS[v]}</button>
        ))}
      </div>

      {/* 월별 막대 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="space-y-2">
          {months.map(m => (
            <div key={m.ym} className="grid grid-cols-[60px_1fr_120px] items-center gap-3 text-xs">
              <span className="text-gray-500 font-mono">{m.ym}</span>
              <div className="space-y-0.5">
                {(view === 'all' || view === 'accounting') && (
                  <Bar value={m.accounting} max={max} color={COLORS.accounting} label="회계" />
                )}
                {(view === 'all' || view === 'tax') && (
                  <Bar value={m.tax} max={max} color={COLORS.tax} label="세무" />
                )}
                {(view === 'all' || view === 'cash') && (
                  <Bar value={m.cash} max={max} color={COLORS.cash} label="현금" />
                )}
              </div>
              <div className="text-right text-gray-700 font-semibold">
                {view === 'all' && (
                  <div className="text-[11px] space-y-0.5">
                    <div className="text-blue-600">{fmtMan(m.accounting)}만</div>
                    <div className="text-gray-500">{fmtMan(m.tax)}만</div>
                    <div className="text-green-600">{fmtMan(m.cash)}만</div>
                  </div>
                )}
                {view === 'accounting' && <span>{fmtMan(m.accounting)}만</span>}
                {view === 'tax' && <span>{fmtMan(m.tax)}만</span>}
                {view === 'cash' && <span>{fmtMan(m.cash)}만</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        💡 빵빵이로도 가능: <code className="bg-gray-50 px-1 rounded">"이번달 매출 회계·현금 비교해줘"</code>
      </p>
    </div>
  )
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-8">{label}</span>
      <div className="flex-1 h-3 bg-gray-50 rounded overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

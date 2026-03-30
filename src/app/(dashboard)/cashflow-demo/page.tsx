'use client'
import { useState } from 'react'

const DUMMY_ACCOUNTS = [
  { id: '1', name: '국민은행 8066', account_number: '123-456-78-9066', type: 'checking', balance: 24500000, biz: '유어메이트' },
  { id: '2', name: '기업은행 3241', account_number: '456-789-01-3241', type: 'checking', balance: 8200000, biz: '유어메이트' },
  { id: '3', name: '농협 7712', account_number: '789-012-34-7712', type: 'checking', balance: 3100000, biz: '유어메이트' },
  { id: '4', name: '국민은행 대출', account_number: '001-002-003-004', type: 'loan', balance: -50000000, biz: '유어메이트' },
  { id: '5', name: '신한은행 5509', account_number: '321-654-98-5509', type: 'checking', balance: 12000000, biz: '(주)002코리에이션' },
  { id: '6', name: '하나은행 2234', account_number: '654-987-65-2234', type: 'checking', balance: 5500000, biz: '(주)002코리에이션' },
]

const DUMMY_TXS = [
  { id: '1', type: 'income', account: '국민은행 8066', amount: 5500000, desc: '유인쌤 교육청 계약금', cat: '매출수금' },
  { id: '2', type: 'expense', account: '기업은행 3241', amount: 1979410, desc: '방준영 3월 급여', cat: '인건비' },
  { id: '3', type: 'expense', account: '국민은행 8066', amount: 330000, desc: '사무실 임대료', cat: '임대료' },
  { id: '4', type: 'income', account: '신한은행 5509', amount: 3300000, desc: '콘텐츠 제작비 수금', cat: '매출수금' },
  { id: '5', type: 'expense', account: '농협 7712', amount: 88000, desc: 'AWS 서버비', cat: '운영비' },
]

const TX_COLORS: Record<string, string> = {
  income: 'bg-blue-50 text-blue-600',
  expense: 'bg-red-50 text-red-500',
  transfer: 'bg-purple-50 text-purple-600',
}
const TX_LABELS: Record<string, string> = { income: '수입', expense: '지출', transfer: '이체' }

function fmt(n: number) { return Math.abs(n).toLocaleString() }

// ── 옵션 A: 2컬럼 (현재 적용된 디자인) ──────────────────────────
function OptionA() {
  const totalAssets = DUMMY_ACCOUNTS.filter(a => a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = DUMMY_ACCOUNTS.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
  const bizList = [...new Set(DUMMY_ACCOUNTS.map(a => a.biz))]
  return (
    <div className="flex gap-4 items-start">
      {/* 왼쪽 계좌 패널 */}
      <div className="w-64 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">계좌 현황</p>
          <button className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>+ 추가</button>
        </div>
        <div className="divide-y divide-gray-50">
          {bizList.map(biz => (
            <div key={biz} className="px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">{biz}</p>
              <div className="space-y-2">
                {DUMMY_ACCOUNTS.filter(a => a.biz === biz).map(a => (
                  <div key={a.id} className="rounded-lg px-2 py-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-gray-800 font-medium">{a.name}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-1 rounded">{a.type === 'loan' ? '대출' : '보통'}</span>
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{a.account_number}</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${a.type === 'loan' ? 'text-red-500' : 'text-gray-900'}`}>
                        {a.type === 'loan' ? '-' : ''}{fmt(a.balance)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">총 자산</span>
            <span className="font-semibold text-blue-600">{fmt(totalAssets)}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">총 부채</span>
            <span className="font-semibold text-red-500">-{fmt(totalLiabilities)}원</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
            <span className="font-semibold text-gray-700">순자산</span>
            <span className="font-bold text-green-600">{fmt(totalAssets - totalLiabilities)}원</span>
          </div>
        </div>
      </div>
      {/* 오른쪽 거래 */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <button className="p-1 text-gray-400">←</button>
          <span className="flex-1 text-center text-sm font-semibold text-gray-900">2026년 3월 30일 (월)</span>
          <button className="p-1 text-gray-400">→</button>
          <button className="text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600">오늘</button>
        </div>
        <div className="divide-y divide-gray-50">
          {DUMMY_TXS.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${TX_COLORS[t.type]}`}>{TX_LABELS[t.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{t.account}</p>
                <p className="text-xs text-gray-400">{t.desc} · {t.cat}</p>
              </div>
              <span className={`text-base font-bold ${t.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
              </span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-6 text-sm">
          <span className="text-gray-500">수입 <span className="font-semibold text-blue-600">+8,800,000원</span></span>
          <span className="text-gray-500">지출 <span className="font-semibold text-red-500">-2,397,410원</span></span>
        </div>
      </div>
    </div>
  )
}

// ── 옵션 B: 카드형 대시보드 ─────────────────────────────────────
function OptionB() {
  const [selectedAcct, setSelectedAcct] = useState('all')
  const totalAssets = DUMMY_ACCOUNTS.filter(a => a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = DUMMY_ACCOUNTS.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)
  return (
    <div className="space-y-4">
      {/* 요약 배너 */}
      <div className="bg-gray-900 rounded-2xl px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs mb-1">순자산</p>
          <p className="text-white text-2xl font-bold">{fmt(totalAssets - totalLiabilities)}원</p>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <p className="text-gray-500 text-xs mb-1">총 자산</p>
            <p className="text-blue-400 text-lg font-bold">{fmt(totalAssets)}원</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">총 부채</p>
            <p className="text-red-400 text-lg font-bold">-{fmt(totalLiabilities)}원</p>
          </div>
        </div>
      </div>
      {/* 계좌 카드 수평 스크롤 */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedAcct('all')}
          className={`flex-shrink-0 rounded-xl border px-4 py-3 text-left min-w-[140px] transition-all ${selectedAcct === 'all' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
          <p className="text-xs text-gray-400 mb-1">전체</p>
          <p className="text-sm font-bold text-gray-900">{fmt(totalAssets)}원</p>
        </button>
        {DUMMY_ACCOUNTS.filter(a => a.type !== 'loan').map(a => (
          <button key={a.id}
            onClick={() => setSelectedAcct(a.id)}
            className={`flex-shrink-0 rounded-xl border px-4 py-3 text-left min-w-[160px] transition-all ${selectedAcct === a.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs text-gray-400 mb-0.5">{a.name}</p>
            <p className="text-xs text-gray-300 font-mono mb-1">{a.account_number}</p>
            <p className={`text-sm font-bold ${a.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>{fmt(a.balance)}원</p>
          </button>
        ))}
      </div>
      {/* 거래 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">2026년 3월 30일 거래</span>
          <div className="flex gap-2">
            <button className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">← 전날</button>
            <button className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600">다음날 →</button>
          </div>
        </div>
        {DUMMY_TXS.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${t.type === 'income' ? 'bg-blue-50' : 'bg-red-50'}`}>
              <span className="text-sm">{t.type === 'income' ? '↓' : '↑'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{t.desc}</p>
              <p className="text-xs text-gray-400">{t.account} · {t.cat}</p>
            </div>
            <span className={`text-sm font-bold ${t.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
              {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 옵션 C: 테이블형 (월간 뷰) ───────────────────────────────────
function OptionC() {
  const [selectedDay, setSelectedDay] = useState(30)
  const days = [27, 28, 29, 30, 31]
  const dayData: Record<number, { income: number; expense: number }> = {
    27: { income: 0, expense: 450000 },
    28: { income: 3300000, expense: 88000 },
    29: { income: 0, expense: 0 },
    30: { income: 8800000, expense: 2397410 },
    31: { income: 0, expense: 220000 },
  }
  const totalAssets = DUMMY_ACCOUNTS.filter(a => a.type !== 'loan').reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = DUMMY_ACCOUNTS.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(a.balance), 0)

  return (
    <div className="space-y-4">
      {/* 순자산 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
          <p className="text-xs text-gray-400 mb-1">총 자산</p>
          <p className="text-lg font-bold text-blue-600">{fmt(totalAssets)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
          <p className="text-xs text-gray-400 mb-1">총 부채</p>
          <p className="text-lg font-bold text-red-500">-{fmt(totalLiabilities)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3.5">
          <p className="text-xs text-gray-400 mb-1">순자산</p>
          <p className="text-lg font-bold text-green-600">{fmt(totalAssets - totalLiabilities)}원</p>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* 왼쪽: 날짜별 수입/지출 타임라인 */}
        <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <p className="text-sm font-semibold text-gray-800 px-4 py-3 border-b border-gray-100">3월 거래 일정</p>
          <div className="divide-y divide-gray-50">
            {days.map(day => {
              const d = dayData[day]
              const isSelected = day === selectedDay
              const hasActivity = d.income > 0 || d.expense > 0
              return (
                <button key={day} onClick={() => setSelectedDay(day)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}
                    style={isSelected ? { backgroundColor: '#FFCE00' } : {}}>
                    {day}
                  </div>
                  <div className="flex-1 min-w-0">
                    {hasActivity ? (
                      <>
                        {d.income > 0 && <p className="text-xs text-blue-600 font-medium">+{fmt(d.income)}</p>}
                        {d.expense > 0 && <p className="text-xs text-red-500">-{fmt(d.expense)}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-300">거래 없음</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 오른쪽: 선택 날짜 거래 + 계좌 목록 */}
        <div className="flex-1 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <p className="text-sm font-semibold text-gray-800 px-5 py-3 border-b border-gray-100">3월 {selectedDay}일 거래</p>
            {selectedDay === 30 ? DUMMY_TXS.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${TX_COLORS[t.type]}`}>{TX_LABELS[t.type]}</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-800 font-medium">{t.desc}</p>
                  <p className="text-xs text-gray-400">{t.account}</p>
                </div>
                <span className={`text-sm font-bold ${t.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}원
                </span>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-8">거래 내역이 없어요.</p>
            )}
          </div>

          {/* 계좌 목록 (간략) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <p className="text-sm font-semibold text-gray-800 px-5 py-3 border-b border-gray-100">계좌 잔액</p>
            <div className="divide-y divide-gray-50">
              {DUMMY_ACCOUNTS.map(a => (
                <div key={a.id} className="flex items-center px-5 py-2.5">
                  <div className="flex-1">
                    <span className="text-sm text-gray-800">{a.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{a.account_number}</span>
                  </div>
                  <span className={`text-sm font-bold ${a.type === 'loan' || a.balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                    {a.type === 'loan' ? '-' : ''}{fmt(a.balance)}원
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CashflowDemoPage() {
  const [selected, setSelected] = useState<'A' | 'B' | 'C'>('A')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">자금일보 UI 비교</h1>
        <p className="text-gray-500 text-sm mt-1">마음에 드는 레이아웃을 선택해주세요 — 더미 데이터입니다</p>
      </div>

      {/* 옵션 선택 탭 */}
      <div className="flex gap-3 mb-6">
        {([
          { key: 'A', label: 'A안', desc: '2컬럼 — 계좌 패널 + 거래 내역' },
          { key: 'B', label: 'B안', desc: '카드형 — 계좌 선택 후 거래 확인' },
          { key: 'C', label: 'C안', desc: '캘린더형 — 날짜 타임라인 + 거래' },
        ] as const).map(opt => (
          <button key={opt.key} onClick={() => setSelected(opt.key)}
            className={`flex-1 px-4 py-3 rounded-xl border text-left transition-all ${selected === opt.key ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
            <p className={`text-sm font-bold mb-0.5 ${selected === opt.key ? 'text-gray-900' : 'text-gray-600'}`}>{opt.label}</p>
            <p className="text-xs text-gray-400">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* 선택된 레이아웃 */}
      {selected === 'A' && <OptionA />}
      {selected === 'B' && <OptionB />}
      {selected === 'C' && <OptionC />}
    </div>
  )
}

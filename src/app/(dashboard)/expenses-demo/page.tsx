'use client'
import { useState } from 'react'

type ApprovalStatus = '승인대기' | '승인' | '반려'
type ExpenseCategory = '교통비' | '식비' | '업무용품' | '접대비' | '통신비' | '기타'

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  승인대기: 'bg-yellow-100 text-yellow-700',
  승인:     'bg-green-100 text-green-700',
  반려:     'bg-red-100 text-red-500',
}

interface Expense {
  id: string; date: string; member: string
  category: ExpenseCategory; title: string
  amount: number; memo: string; status: ApprovalStatus
}

const INITIAL_EXPENSES: Expense[] = [
  { id: '1', date: '2026-04-02', member: '조민현', category: '교통비', title: 'SOS 사전 미팅 KTX', amount: 42600, memo: '서울→부산 왕복', status: '승인대기' },
  { id: '2', date: '2026-04-01', member: '유제민', category: '식비', title: '클라이언트 미팅 점심', amount: 38000, memo: '2인 식사', status: '승인대기' },
  { id: '3', date: '2026-03-31', member: '임지영', category: '업무용품', title: 'A4용지 2박스', amount: 18000, memo: '복합기용', status: '승인' },
  { id: '4', date: '2026-03-28', member: '조민현', category: '접대비', title: '고객사 저녁 식사', amount: 124000, memo: '경기도교육청 담당자 3인', status: '승인' },
  { id: '5', date: '2026-03-27', member: '유제민', category: '교통비', title: '납품설치 현장 이동 택시', amount: 15400, memo: '인천 A학교 왕복', status: '승인' },
  { id: '6', date: '2026-03-25', member: '임지영', category: '통신비', title: '클라이언트용 유심 구입', amount: 12000, memo: '현장 핫스팟용', status: '반려' },
  { id: '7', date: '2026-03-24', member: '조민현', category: '기타', title: '공연 소품 구입', amount: 31500, memo: '학교 SOS 공연용', status: '승인' },
]

const CATEGORIES: ExpenseCategory[] = ['교통비', '식비', '업무용품', '접대비', '통신비', '기타']
const CAT_ICON: Record<ExpenseCategory, string> = {
  교통비:'🚌', 식비:'🍽️', 업무용품:'🖊️', 접대비:'🤝', 통신비:'📱', 기타:'📦'
}

export default function ExpensesDemoPage() {
  const [view, setView] = useState<'내 경비' | '전체 경비'>('내 경비')
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ date: '2026-04-03', category: '교통비' as ExpenseCategory, title: '', amount: '', memo: '' })

  const myExpenses = expenses.filter(e => e.member === '방준영')
  const pending = expenses.filter(e => e.status === '승인대기')

  const totalPending = pending.reduce((s, e) => s + e.amount, 0)
  const totalApproved = expenses.filter(e => e.status === '승인').reduce((s, e) => s + e.amount, 0)

  function approve(id: string) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: '승인' } : e))
  }
  function reject(id: string) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: '반려' } : e))
  }
  function submit() {
    if (!form.title || !form.amount) return
    const newExp: Expense = {
      id: Date.now().toString(), date: form.date, member: '방준영',
      category: form.category, title: form.title,
      amount: parseInt(form.amount.replace(/,/g, '')), memo: form.memo, status: '승인대기',
    }
    setExpenses(prev => [newExp, ...prev])
    setForm({ date: '2026-04-03', category: '교통비', title: '', amount: '', memo: '' })
    setShowForm(false)
  }

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">경비 처리</h1>
          <p className="text-gray-500 text-sm mt-1">업무 지출 신청 · 승인 · 정산</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">데모</span>
          <button onClick={() => setShowForm(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            + 경비 신청
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '승인 대기', value: `${fmt(totalPending)}원`, count: `${pending.length}건`, color: 'text-yellow-600' },
          { label: '이번 달 승인', value: `${fmt(totalApproved)}원`, count: `${expenses.filter(e=>e.status==='승인').length}건`, color: 'text-green-600' },
          { label: '반려', value: `${expenses.filter(e=>e.status==='반려').length}건`, count: '', color: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            {s.count && <p className="text-xs text-gray-400">{s.count}</p>}
          </div>
        ))}
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {(['내 경비', '전체 경비'] as const).map(t => (
          <button key={t} onClick={() => setView(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t} {t === '전체 경비' && pending.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{pending.length}</span>}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="divide-y divide-gray-50">
          {(view === '내 경비' ? myExpenses : expenses).map(e => (
            <div key={e.id} className="flex items-center px-5 py-4 hover:bg-gray-50">
              <div className="text-2xl mr-4">{CAT_ICON[e.category]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-gray-800">{e.title}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                </div>
                <p className="text-xs text-gray-400">{e.date} · {e.member} · {e.category}
                  {e.memo && ` · ${e.memo}`}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-800 text-sm">{fmt(e.amount)}원</p>
                {view === '전체 경비' && e.status === '승인대기' && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => approve(e.id)} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">승인</button>
                    <button onClick={() => reject(e.id)} className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">반려</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {(view === '내 경비' ? myExpenses : expenses).length === 0 && (
            <div className="py-12 text-center text-gray-400 text-sm">신청 내역이 없습니다.</div>
          )}
        </div>
      </div>

      {/* 신청 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">경비 신청</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">날짜</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value as ExpenseCategory}))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">항목명</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예: 클라이언트 미팅 식대" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">금액 (원)</label>
                <input value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0" type="number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">메모</label>
                <input value={form.memo} onChange={e => setForm(f => ({...f, memo: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="선택 입력" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={submit}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">신청</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

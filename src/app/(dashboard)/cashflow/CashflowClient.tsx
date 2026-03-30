'use client'
import { useState, useMemo, useRef } from 'react'
import { upsertAccount, deleteAccount, upsertTransaction, deleteTransaction, importGranterTransactions } from './actions'

interface Account {
  id: string
  business_entity: string
  name: string
  account_number: string | null
  type: 'checking' | 'savings' | 'loan' | 'cash'
  initial_balance: number
  is_active: boolean
}

interface Transaction {
  id: string
  date: string
  account_id: string
  type: 'income' | 'expense' | 'transfer' | 'loan_repayment' | 'interest'
  amount: number
  transfer_account_id: string | null
  category: string | null
  description: string | null
  memo: string | null
}

interface Props {
  accounts: Account[]
  transactions: Transaction[]
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: '보통예금', savings: '정기예금', loan: '대출', cash: '현금',
}
const TX_TYPE_LABELS: Record<string, string> = {
  income: '수입', expense: '지출', transfer: '계좌이체',
  loan_repayment: '대출상환', interest: '이자납부',
}
const TX_TYPE_COLORS: Record<string, string> = {
  income: 'bg-blue-50 text-blue-600',
  expense: 'bg-red-50 text-red-500',
  transfer: 'bg-purple-50 text-purple-600',
  loan_repayment: 'bg-orange-50 text-orange-600',
  interest: 'bg-yellow-50 text-yellow-700',
}
const INCOME_CATEGORIES = ['매출수금', '대출수령', '보증금수령', '투자유치', '기타수입']
const EXPENSE_CATEGORIES = ['인건비', '임대료', '운영비', '광고비', '세금/공과금', '외주비', '기타지출']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function fmt(n: number) { return Math.abs(n).toLocaleString() }
function today() { return new Date().toISOString().split('T')[0] }

function calcAllBalances(accounts: Account[], transactions: Transaction[]) {
  const b: Record<string, number> = {}
  for (const a of accounts) b[a.id] = a.initial_balance
  for (const t of transactions) {
    if (t.account_id in b) {
      if (t.type === 'income') b[t.account_id] += t.amount
      else b[t.account_id] -= t.amount
    }
    if (t.transfer_account_id && t.transfer_account_id in b) b[t.transfer_account_id] += t.amount
  }
  return b
}

const EMPTY_TX = {
  id: '', date: today(), type: 'income' as Transaction['type'],
  account_id: '', transfer_account_id: '', amount: 0, category: '', description: '', memo: '',
}
const EMPTY_ACCOUNT = {
  id: '', business_entity: '', name: '', account_number: '',
  type: 'checking' as Account['type'], initial_balance: 0,
}

function parseGranterCSV(text: string) {
  const lines = text.trim().split('\n')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/"([^"]*)"/g)?.map(v => v.slice(1, -1)) ?? []
    if (cols.length < 17) continue
    rows.push({
      date: cols[0], accountNo: cols[13], accountNick: cols[14], bank: cols[15], company: cols[16],
      description: cols[4], expense: Number(cols[5]) || 0, income: Number(cols[6]) || 0,
      status: cols[7], category: cols[8], include: cols[12], memo: cols[21] || '',
    })
  }
  return rows
}

export default function CashflowClient({ accounts, transactions }: Props) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [showTxModal, setShowTxModal] = useState(false)
  const [showAcctModal, setShowAcctModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [txForm, setTxForm] = useState({ ...EMPTY_TX })
  const [acctForm, setAcctForm] = useState({ ...EMPTY_ACCOUNT })
  const [savingTx, setSavingTx] = useState(false)
  const [savingAcct, setSavingAcct] = useState(false)
  const [uploadRows, setUploadRows] = useState<ReturnType<typeof parseGranterCSV>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const balances = useMemo(() => calcAllBalances(accounts, transactions), [accounts, transactions])
  const bizList = useMemo(() => [...new Set(accounts.map(a => a.business_entity))].sort(), [accounts])
  const todayStr = today()

  // 오늘 거래 수
  const todayTxCount = transactions.filter(t => t.date === todayStr).length

  // 월별 수입/지출
  const monthlyStats = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      const prefix = `${currentYear}-${m}`
      const monthTxs = transactions.filter(t => t.date.startsWith(prefix))
      const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
      const expense = monthTxs.filter(t => ['expense', 'interest', 'loan_repayment'].includes(t.type)).reduce((s, t) => s + t.amount, 0)
      return { month: i + 1, income, expense }
    })
  }, [transactions, currentYear])

  const maxMonthVal = useMemo(() =>
    Math.max(...monthlyStats.flatMap(m => [m.income, m.expense]), 1),
  [monthlyStats])

  // 선택 월 거래 (날짜 역순)
  const selectedMonthTxs = useMemo(() => {
    const prefix = `${currentYear}-${String(selectedMonth).padStart(2, '0')}`
    return transactions.filter(t => t.date.startsWith(prefix))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, selectedMonth, currentYear])

  // 선택 월 거래 날짜별 그룹
  const groupedTxs = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    for (const t of selectedMonthTxs) {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [selectedMonthTxs])

  function openNewTx() {
    setTxForm({ ...EMPTY_TX, account_id: accounts[0]?.id ?? '' })
    setShowTxModal(true)
  }
  function openEditTx(t: Transaction) {
    setTxForm({
      id: t.id, date: t.date, type: t.type, account_id: t.account_id,
      transfer_account_id: t.transfer_account_id ?? '', amount: t.amount,
      category: t.category ?? '', description: t.description ?? '', memo: t.memo ?? '',
    })
    setShowTxModal(true)
  }
  function openEditAcct(a: Account) {
    setAcctForm({ id: a.id, business_entity: a.business_entity, name: a.name, account_number: a.account_number ?? '', type: a.type, initial_balance: a.initial_balance })
    setShowAcctModal(true)
  }

  async function handleSaveTx() {
    if (!txForm.account_id) return alert('계좌를 선택해주세요.')
    if (txForm.amount <= 0) return alert('금액을 입력해주세요.')
    if (['transfer', 'loan_repayment'].includes(txForm.type) && !txForm.transfer_account_id) return alert('대상 계좌를 선택해주세요.')
    setSavingTx(true)
    await upsertTransaction({
      ...(txForm.id ? { id: txForm.id } : {}),
      date: txForm.date, type: txForm.type, account_id: txForm.account_id,
      transfer_account_id: ['transfer', 'loan_repayment'].includes(txForm.type) ? txForm.transfer_account_id || null : null,
      amount: txForm.amount, category: txForm.category || null, description: txForm.description || null, memo: txForm.memo || null,
    })
    setSavingTx(false)
    setShowTxModal(false)
  }

  async function handleSaveAcct() {
    if (!acctForm.business_entity.trim() || !acctForm.name.trim()) return alert('사업자와 계좌명을 입력해주세요.')
    setSavingAcct(true)
    await upsertAccount({
      ...(acctForm.id ? { id: acctForm.id } : {}),
      business_entity: acctForm.business_entity, name: acctForm.name,
      account_number: acctForm.account_number || null, type: acctForm.type, initial_balance: acctForm.initial_balance,
    })
    setSavingAcct(false)
    setShowAcctModal(false)
  }

  async function handleDeleteTx(id: string) {
    if (!confirm('삭제하시겠어요?')) return
    await deleteTransaction(id)
  }
  async function handleDeleteAcct(id: string) {
    if (!confirm('계좌를 삭제하면 관련 거래 내역도 모두 삭제돼요. 계속하시겠어요?')) return
    await deleteAccount(id)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setUploadRows(parseGranterCSV(ev.target?.result as string))
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    if (!uploadRows.length) return
    setImporting(true)
    const result = await importGranterTransactions(uploadRows)
    const skipped = result.skipped ?? 0
    setImportResult(skipped > 0
      ? `${result.count}건 추가 완료 (중복 ${skipped}건 스킵)`
      : `${result.count}건 가져오기 완료!`
    )
    setImporting(false)
    setUploadRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const numF = (val: number, onChange: (v: number) => void) => ({
    value: val === 0 ? '' : val.toLocaleString(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value.replace(/[^0-9]/g, '')) || 0),
  })

  const txCategories = txForm.type === 'income' ? INCOME_CATEGORIES : txForm.type === 'expense' ? EXPENSE_CATEGORIES : []

  return (
    <>
      {/* ── 상단: 사업자별 계좌 카드 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {bizList.map(biz => {
          const bizAccounts = accounts.filter(a => a.business_entity === biz)
          const assets = bizAccounts.filter(a => a.type !== 'loan').reduce((s, a) => s + (balances[a.id] ?? 0), 0)
          const liabilities = bizAccounts.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(balances[a.id] ?? 0), 0)
          const todayCount = transactions.filter(t => t.date === todayStr && bizAccounts.some(a => a.id === t.account_id)).length
          return (
            <div key={biz} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{biz}</p>
                  {todayCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                      오늘 {todayCount}건
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{fmt(assets - liabilities)}원</p>
                {liabilities > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">자산 {fmt(assets)}원 · 부채 -{fmt(liabilities)}원</p>
                )}
              </div>
              <div className="px-5 py-3 space-y-2">
                {bizAccounts.map(a => {
                  const bal = balances[a.id] ?? 0
                  const isLoan = a.type === 'loan'
                  return (
                    <div key={a.id} className="flex items-center gap-2 group">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700">{a.name}</span>
                        {a.account_number && (
                          <span className="ml-2 text-xs text-gray-400 font-mono">{a.account_number}</span>
                        )}
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${isLoan ? 'text-red-500' : bal < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                        {isLoan ? '-' : ''}{fmt(bal)}원
                      </span>
                      <button onClick={() => openEditAcct(a)} className="text-xs text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">수정</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* 계좌 추가 카드 */}
        <button onClick={() => { setAcctForm({ ...EMPTY_ACCOUNT }); setShowAcctModal(true) }}
          className="bg-white rounded-xl border border-dashed border-gray-300 p-5 text-gray-400 hover:border-yellow-400 hover:text-yellow-600 transition-colors text-sm flex items-center justify-center gap-2 min-h-[120px]">
          <span className="text-lg">+</span> 계좌 추가
        </button>
      </div>

      {/* ── 월별 흐름 차트 ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">{currentYear}년 월별 흐름</p>
            <p className="text-xs text-gray-400 mt-0.5">월을 클릭하면 거래 내역을 볼 수 있어요</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200 inline-block" />수입</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 inline-block" />지출</span>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {monthlyStats.map(m => {
            const incomeH = maxMonthVal > 0 ? Math.round((m.income / maxMonthVal) * 96) : 0
            const expenseH = maxMonthVal > 0 ? Math.round((m.expense / maxMonthVal) * 96) : 0
            const isSelected = m.month === selectedMonth
            const isFuture = m.month > currentMonth
            return (
              <button
                key={m.month}
                onClick={() => setSelectedMonth(m.month)}
                className={`flex-1 flex flex-col items-center gap-0.5 group transition-opacity ${isFuture ? 'opacity-30' : ''}`}
              >
                <div className="w-full flex items-end gap-0.5 justify-center" style={{ height: 96 }}>
                  <div
                    className={`flex-1 rounded-t transition-all ${isSelected ? 'bg-blue-400' : 'bg-blue-100 group-hover:bg-blue-200'}`}
                    style={{ height: incomeH || 2 }}
                  />
                  <div
                    className={`flex-1 rounded-t transition-all ${isSelected ? 'bg-red-400' : 'bg-red-100 group-hover:bg-red-200'}`}
                    style={{ height: expenseH || 2 }}
                  />
                </div>
                <span className={`text-xs transition-colors ${isSelected ? 'text-gray-900 font-bold' : 'text-gray-400'}`}>
                  {MONTHS[m.month - 1]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 선택 월 거래 내역 ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-800">{MONTHS[selectedMonth - 1]} 거래 내역</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {selectedMonthTxs.length > 0
                ? `${selectedMonthTxs.length}건 · 수입 ${fmt(selectedMonthTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0))}원 · 지출 ${fmt(selectedMonthTxs.filter(t=>['expense','interest','loan_repayment'].includes(t.type)).reduce((s,t)=>s+t.amount,0))}원`
                : '거래 없음'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowUploadModal(true); setImportResult(null) }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              📂 Granter 가져오기
            </button>
            <button onClick={openNewTx}
              className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 거래 추가
            </button>
          </div>
        </div>

        {groupedTxs.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-gray-400">{MONTHS[selectedMonth - 1]} 거래 내역이 없어요.</p>
            <button onClick={() => { setShowUploadModal(true); setImportResult(null) }}
              className="mt-3 text-sm text-yellow-700 font-medium hover:underline">
              Granter CSV로 가져오기
            </button>
          </div>
        ) : (
          <div>
            {groupedTxs.map(([date, txs]) => {
              const d = new Date(date)
              const dateLabel = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
              const dayIncome = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
              const dayExpense = txs.filter(t => ['expense', 'interest', 'loan_repayment'].includes(t.type)).reduce((s, t) => s + t.amount, 0)
              return (
                <div key={date}>
                  <div className="flex items-center justify-between px-5 py-2 bg-gray-50 border-y border-gray-100">
                    <span className="text-xs font-semibold text-gray-500">{dateLabel}</span>
                    <span className="text-xs text-gray-400">
                      {dayIncome > 0 && <span className="text-blue-500">+{fmt(dayIncome)}</span>}
                      {dayIncome > 0 && dayExpense > 0 && <span className="mx-1">·</span>}
                      {dayExpense > 0 && <span className="text-red-400">-{fmt(dayExpense)}</span>}
                    </span>
                  </div>
                  {txs.map(t => {
                    const account = accounts.find(a => a.id === t.account_id)
                    const transferAccount = t.transfer_account_id ? accounts.find(a => a.id === t.transfer_account_id) : null
                    const isIncoming = t.type === 'income'
                    const isOutgoing = ['expense', 'interest'].includes(t.type)
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 group transition-colors">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${TX_TYPE_COLORS[t.type]}`}>
                          {TX_TYPE_LABELS[t.type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{account?.name ?? '-'}</span>
                            {transferAccount && (
                              <><span className="text-xs text-gray-400">→</span><span className="text-sm text-gray-800">{transferAccount.name}</span></>
                            )}
                            {t.category && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.category}</span>}
                          </div>
                          {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                        </div>
                        <span className={`text-sm font-bold flex-shrink-0 ${isIncoming ? 'text-blue-600' : isOutgoing ? 'text-red-500' : 'text-purple-600'}`}>
                          {isIncoming ? '+' : isOutgoing ? '-' : ''}{fmt(t.amount)}원
                        </span>
                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEditTx(t)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-800">수정</button>
                          <button onClick={() => handleDeleteTx(t.id)} className="text-xs px-2.5 py-1 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500">삭제</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 거래 입력 모달 ── */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTxModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{txForm.id ? '거래 수정' : '거래 추가'}</h2>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">거래 유형</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['income', 'expense', 'transfer', 'loan_repayment', 'interest'] as const).map(t => (
                    <button key={t} onClick={() => setTxForm(f => ({ ...f, type: t, category: '', transfer_account_id: '' }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${txForm.type === t ? `${TX_TYPE_COLORS[t]} border-current` : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}>
                      {TX_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">날짜</label>
                <input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {['transfer', 'loan_repayment'].includes(txForm.type) ? '출금 계좌' : '계좌'}
                </label>
                <select value={txForm.account_id} onChange={e => setTxForm(f => ({ ...f, account_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                  <option value="">계좌 선택</option>
                  {bizList.map(biz => (
                    <optgroup key={biz} label={biz}>
                      {accounts.filter(a => a.business_entity === biz && a.type !== 'loan').map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {['transfer', 'loan_repayment'].includes(txForm.type) && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">
                    {txForm.type === 'loan_repayment' ? '대출 계좌' : '입금 계좌'}
                  </label>
                  <select value={txForm.transfer_account_id} onChange={e => setTxForm(f => ({ ...f, transfer_account_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                    <option value="">계좌 선택</option>
                    {bizList.map(biz => (
                      <optgroup key={biz} label={biz}>
                        {accounts.filter(a => a.business_entity === biz && a.id !== txForm.account_id && (txForm.type === 'loan_repayment' ? a.type === 'loan' : true)).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}
              {txCategories.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">카테고리</label>
                  <select value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                    <option value="">선택 안 함</option>
                    {txCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">금액 *</label>
                <div className="relative">
                  <input type="text" inputMode="numeric"
                    {...numF(txForm.amount, v => setTxForm(f => ({ ...f, amount: v })))}
                    placeholder="0"
                    className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">내용</label>
                <input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="거래 내용 (선택)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">메모</label>
                <textarea value={txForm.memo} onChange={e => setTxForm(f => ({ ...f, memo: e.target.value }))}
                  rows={2} placeholder="메모 (선택)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowTxModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">취소</button>
              <button onClick={handleSaveTx} disabled={savingTx}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {savingTx ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 계좌 추가/수정 모달 ── */}
      {showAcctModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAcctModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{acctForm.id ? '계좌 수정' : '계좌 추가'}</h2>
              <button onClick={() => setShowAcctModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">사업자 *</label>
                <input value={acctForm.business_entity} onChange={e => setAcctForm(f => ({ ...f, business_entity: e.target.value }))}
                  list="biz-list" placeholder="사업자명"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                <datalist id="biz-list">{bizList.map(b => <option key={b} value={b} />)}</datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">계좌명 *</label>
                <input value={acctForm.name} onChange={e => setAcctForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 국민은행 보통예금"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">계좌번호</label>
                <input value={acctForm.account_number} onChange={e => setAcctForm(f => ({ ...f, account_number: e.target.value }))}
                  placeholder="123-456-789012 (선택)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">유형</label>
                <select value={acctForm.type} onChange={e => setAcctForm(f => ({ ...f, type: e.target.value as Account['type'] }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 text-gray-700">
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  {acctForm.type === 'loan' ? '대출 잔액' : '초기 잔액'}
                </label>
                <div className="relative">
                  <input type="text" inputMode="numeric"
                    {...numF(Math.abs(acctForm.initial_balance), v => setAcctForm(f => ({ ...f, initial_balance: acctForm.type === 'loan' ? -v : v })))}
                    placeholder="0"
                    className="w-full px-3 py-2 pr-8 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
                {acctForm.type === 'loan' && <p className="text-xs text-gray-400 mt-1">현재 대출 잔액을 입력해주세요.</p>}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              {acctForm.id && (
                <button onClick={() => handleDeleteAcct(acctForm.id)} className="px-4 py-2 rounded-lg text-sm text-red-400 hover:bg-red-50 mr-auto">삭제</button>
              )}
              <button onClick={() => setShowAcctModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">취소</button>
              <button onClick={handleSaveAcct} disabled={savingAcct}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {savingAcct ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Granter 업로드 모달 ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Granter 거래내역 가져오기</h2>
                <p className="text-xs text-gray-400 mt-0.5">Granter → 계좌 → 다운로드(CSV)</p>
              </div>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-800 hover:file:bg-yellow-100" />
              {uploadRows.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-xs text-gray-500">
                  <p className="font-semibold text-gray-700 mb-2">파싱 결과</p>
                  <p>전체 행: <strong className="text-gray-800">{uploadRows.length}건</strong></p>
                  <p>가져올 거래: <strong className="text-green-700">{uploadRows.filter(r => r.include === '포함').length}건</strong></p>
                  <p>계좌 수: <strong className="text-gray-800">{new Set(uploadRows.map(r => r.accountNo)).size}개</strong></p>
                  <p>사업자: <strong className="text-gray-800">{[...new Set(uploadRows.map(r => r.company))].join(', ')}</strong></p>
                </div>
              )}
              {importResult && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">✓ {importResult}</div>
              )}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={handleImport} disabled={importing || uploadRows.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {importing ? '가져오는 중...' : `${uploadRows.filter(r => r.include === '포함').length}건 가져오기`}
              </button>
              <button onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

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

function fmt(n: number) { return Math.abs(n).toLocaleString() }
function today() { return new Date().toISOString().split('T')[0] }
function addDays(date: string, d: number) {
  const dt = new Date(date); dt.setDate(dt.getDate() + d)
  return dt.toISOString().split('T')[0]
}
function fmtDateKo(date: string) {
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function calcAllBalances(accounts: Account[], transactions: Transaction[]) {
  const balances: Record<string, number> = {}
  for (const a of accounts) balances[a.id] = a.initial_balance
  for (const t of transactions) {
    if (t.account_id in balances) {
      if (t.type === 'income') balances[t.account_id] += t.amount
      else balances[t.account_id] -= t.amount
    }
    if (t.transfer_account_id && t.transfer_account_id in balances) {
      balances[t.transfer_account_id] += t.amount
    }
  }
  return balances
}

const EMPTY_TX = {
  id: '', date: today(),
  type: 'income' as Transaction['type'],
  account_id: '', transfer_account_id: '',
  amount: 0, category: '', description: '', memo: '',
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
      date: cols[0],
      accountNo: cols[13],
      accountNick: cols[14],
      bank: cols[15],
      company: cols[16],
      description: cols[4],
      expense: Number(cols[5]) || 0,
      income: Number(cols[6]) || 0,
      status: cols[7],
      category: cols[8],
      include: cols[12],
      memo: cols[21] || '',
    })
  }
  return rows
}

export default function CashflowClient({ accounts, transactions }: Props) {
  const [selectedDate, setSelectedDate] = useState(today())
  const [filterBiz, setFilterBiz] = useState('all')
  const [showTxModal, setShowTxModal] = useState(false)
  const [txForm, setTxForm] = useState({ ...EMPTY_TX })
  const [acctForm, setAcctForm] = useState({ ...EMPTY_ACCOUNT })
  const [savingTx, setSavingTx] = useState(false)
  const [savingAcct, setSavingAcct] = useState(false)
  const [showAcctModal, setShowAcctModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadRows, setUploadRows] = useState<ReturnType<typeof parseGranterCSV>>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const balances = useMemo(() => calcAllBalances(accounts, transactions), [accounts, transactions])
  const bizList = useMemo(() => [...new Set(accounts.map(a => a.business_entity))].sort(), [accounts])
  const filteredAccounts = filterBiz === 'all' ? accounts : accounts.filter(a => a.business_entity === filterBiz)

  const dayTransactions = transactions.filter(t => t.date === selectedDate &&
    (filterBiz === 'all' || accounts.find(a => a.id === t.account_id)?.business_entity === filterBiz)
  )

  const totalAssets = filteredAccounts.filter(a => a.type !== 'loan').reduce((s, a) => s + (balances[a.id] ?? 0), 0)
  const totalLiabilities = filteredAccounts.filter(a => a.type === 'loan').reduce((s, a) => s + Math.abs(balances[a.id] ?? 0), 0)

  function openNewTx() {
    setTxForm({ ...EMPTY_TX, date: selectedDate, account_id: filteredAccounts[0]?.id ?? '' })
    setShowTxModal(true)
  }
  function openEditTx(t: Transaction) {
    setTxForm({
      id: t.id, date: t.date, type: t.type,
      account_id: t.account_id, transfer_account_id: t.transfer_account_id ?? '',
      amount: t.amount, category: t.category ?? '', description: t.description ?? '', memo: t.memo ?? '',
    })
    setShowTxModal(true)
  }
  function openNewAcct() {
    setAcctForm({ ...EMPTY_ACCOUNT })
    setShowAcctModal(true)
  }
  function openEditAcct(a: Account) {
    setAcctForm({ id: a.id, business_entity: a.business_entity, name: a.name, account_number: a.account_number ?? '', type: a.type, initial_balance: a.initial_balance })
    setShowAcctModal(true)
  }

  async function handleSaveTx() {
    if (!txForm.account_id) return alert('계좌를 선택해주세요.')
    if (txForm.amount <= 0) return alert('금액을 입력해주세요.')
    if (['transfer', 'loan_repayment'].includes(txForm.type) && !txForm.transfer_account_id)
      return alert('대상 계좌를 선택해주세요.')
    setSavingTx(true)
    await upsertTransaction({
      ...(txForm.id ? { id: txForm.id } : {}),
      date: txForm.date, type: txForm.type,
      account_id: txForm.account_id,
      transfer_account_id: ['transfer', 'loan_repayment'].includes(txForm.type) ? txForm.transfer_account_id || null : null,
      amount: txForm.amount,
      category: txForm.category || null,
      description: txForm.description || null,
      memo: txForm.memo || null,
    })
    setSavingTx(false)
    setShowTxModal(false)
  }

  async function handleSaveAcct() {
    if (!acctForm.business_entity.trim() || !acctForm.name.trim()) return alert('사업자와 계좌명을 입력해주세요.')
    setSavingAcct(true)
    await upsertAccount({
      ...(acctForm.id ? { id: acctForm.id } : {}),
      business_entity: acctForm.business_entity,
      name: acctForm.name,
      account_number: acctForm.account_number || null,
      type: acctForm.type,
      initial_balance: acctForm.initial_balance,
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
      const text = ev.target?.result as string
      setUploadRows(parseGranterCSV(text))
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    if (!uploadRows.length) return
    setImporting(true)
    const result = await importGranterTransactions(uploadRows)
    setImportResult(`${result.count}건 가져오기 완료!`)
    setImporting(false)
    setUploadRows([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const numF = (val: number, onChange: (v: number) => void) => ({
    value: val === 0 ? '' : val.toLocaleString(),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value.replace(/[^0-9]/g, '')) || 0),
  })

  const txCategories = txForm.type === 'income' ? INCOME_CATEGORIES
    : txForm.type === 'expense' ? EXPENSE_CATEGORIES : []

  // 표시할 사업자 목록 (필터 적용)
  const visibleBizList = filterBiz === 'all' ? bizList : [filterBiz]

  return (
    <>
      {/* 상단 액션 바 */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <select value={filterBiz} onChange={e => setFilterBiz(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-yellow-400 text-gray-700">
          <option value="all">전체 사업자</option>
          {bizList.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <div className="flex-1" />
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

      {/* 2컬럼 메인 레이아웃 */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── 왼쪽: 계좌 현황 패널 ── */}
        <div className="w-full lg:w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">계좌 현황</p>
            <button onClick={openNewAcct}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 계좌 추가
            </button>
          </div>

          {accounts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">등록된 계좌가 없어요.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {visibleBizList.map(biz => {
                const bizAccounts = accounts.filter(a => a.business_entity === biz)
                return (
                  <div key={biz} className="px-4 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{biz}</p>
                    <div className="space-y-1.5">
                      {bizAccounts.map(a => {
                        const bal = balances[a.id] ?? 0
                        const isLoan = a.type === 'loan'
                        return (
                          <div key={a.id} className="group rounded-lg hover:bg-gray-50 px-2 py-1.5 -mx-2 transition-colors">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm text-gray-800 font-medium">{a.name}</span>
                                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ACCOUNT_TYPE_LABELS[a.type]}</span>
                                </div>
                                {a.account_number && (
                                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{a.account_number}</p>
                                )}
                              </div>
                              <span className={`text-sm font-bold flex-shrink-0 ${isLoan ? 'text-red-500' : bal < 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                {isLoan ? '-' : ''}{fmt(bal)}
                              </span>
                            </div>
                            <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditAcct(a)} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-800 transition-colors">수정</button>
                              <button onClick={() => handleDeleteAcct(a.id)} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">삭제</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 하단 합계 */}
          {accounts.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-1.5 bg-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">총 자산</span>
                <span className="font-semibold text-blue-600">{fmt(totalAssets)}원</span>
              </div>
              {totalLiabilities > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">총 부채</span>
                  <span className="font-semibold text-red-500">-{fmt(totalLiabilities)}원</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                <span className="font-semibold text-gray-700">순자산</span>
                <span className={`font-bold ${totalAssets - totalLiabilities >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {fmt(totalAssets - totalLiabilities)}원
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── 오른쪽: 거래 내역 ── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* 날짜 네비게이션 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <button onClick={() => setSelectedDate(d => addDays(d, -1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">←</button>
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="flex-1 text-center text-sm font-semibold text-gray-900 border-none outline-none cursor-pointer" />
            <button onClick={() => setSelectedDate(d => addDays(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">→</button>
            <button onClick={() => setSelectedDate(today())}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-yellow-50 hover:text-yellow-800 transition-colors">
              오늘
            </button>
          </div>

          {/* 거래 목록 */}
          <div className="divide-y divide-gray-50">
            {dayTransactions.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-sm text-gray-400">{fmtDateKo(selectedDate)} 거래 내역이 없어요.</p>
                <button onClick={openNewTx} className="mt-3 text-sm text-yellow-700 font-medium hover:underline">
                  + 거래 추가하기
                </button>
              </div>
            )}
            {dayTransactions.map(t => {
              const account = accounts.find(a => a.id === t.account_id)
              const transferAccount = t.transfer_account_id ? accounts.find(a => a.id === t.transfer_account_id) : null
              const isIncoming = t.type === 'income'
              const isOutgoing = ['expense', 'interest'].includes(t.type)
              const isMove = ['transfer', 'loan_repayment'].includes(t.type)

              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${TX_TYPE_COLORS[t.type]}`}>
                    {TX_TYPE_LABELS[t.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{account?.name ?? '-'}</span>
                      {isMove && transferAccount && (
                        <>
                          <span className="text-xs text-gray-400">→</span>
                          <span className="text-sm font-medium text-gray-800">{transferAccount.name}</span>
                        </>
                      )}
                      {t.category && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.category}</span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>}
                  </div>
                  <span className={`text-base font-bold flex-shrink-0 ${isIncoming ? 'text-blue-600' : isOutgoing ? 'text-red-500' : 'text-purple-600'}`}>
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

          {/* 하단 일계 */}
          {dayTransactions.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex gap-6 text-sm">
              <span className="text-gray-500">수입 <span className="font-semibold text-blue-600">+{fmt(dayTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0))}원</span></span>
              <span className="text-gray-500">지출 <span className="font-semibold text-red-500">-{fmt(dayTransactions.filter(t => ['expense', 'interest'].includes(t.type)).reduce((s, t) => s + t.amount, 0))}원</span></span>
            </div>
          )}
        </div>
      </div>

      {/* ── 거래 입력 모달 ── */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTxModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{txForm.id ? '거래 수정' : '거래 추가'}</h2>
              <button onClick={() => setShowTxModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-2xl leading-none">×</button>
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
                  placeholder="거래 내용 입력 (선택)"
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
              <button onClick={() => setShowTxModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
              <button onClick={handleSaveTx} disabled={savingTx}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
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
              <button onClick={() => setShowAcctModal(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">사업자 *</label>
                <input value={acctForm.business_entity} onChange={e => setAcctForm(f => ({ ...f, business_entity: e.target.value }))}
                  list="biz-list" placeholder="사업자명 입력"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                <datalist id="biz-list">
                  {bizList.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">계좌명 *</label>
                <input value={acctForm.name} onChange={e => setAcctForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="예: 기업은행 보통예금"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">계좌번호</label>
                <input value={acctForm.account_number} onChange={e => setAcctForm(f => ({ ...f, account_number: e.target.value }))}
                  placeholder="예: 123-456-789012 (선택)"
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
                {acctForm.type === 'loan' && (
                  <p className="text-xs text-gray-400 mt-1">현재 대출 잔액을 입력해주세요. 자동으로 부채로 처리돼요.</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowAcctModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">취소</button>
              <button onClick={handleSaveAcct} disabled={savingAcct}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
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
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-800 hover:file:bg-yellow-100"
              />
              {uploadRows.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">파싱 결과 미리보기</p>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p>전체 행: <strong className="text-gray-800">{uploadRows.length}건</strong></p>
                    <p>가져올 거래 (금액포함): <strong className="text-green-700">{uploadRows.filter(r => r.include === '포함').length}건</strong></p>
                    <p>내부이체 제외: <strong className="text-gray-400">{uploadRows.filter(r => r.include === '미포함').length}건</strong></p>
                    <p>계좌 수: <strong className="text-gray-800">{new Set(uploadRows.map(r => r.accountNo)).size}개</strong></p>
                    <p>사업자: <strong className="text-gray-800">{[...new Set(uploadRows.map(r => r.company))].join(', ')}</strong></p>
                  </div>
                </div>
              )}
              {importResult && (
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
                  ✓ {importResult}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={handleImport} disabled={importing || uploadRows.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {importing ? '가져오는 중...' : `${uploadRows.filter(r => r.include === '포함').length}건 가져오기`}
              </button>
              <button onClick={() => setShowUploadModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

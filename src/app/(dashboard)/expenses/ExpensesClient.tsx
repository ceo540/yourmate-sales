'use client'
import { useState, useTransition, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createExpense, approveExpense, rejectExpense, markAsPaid, deleteExpense } from './actions'

type PaymentType = '개인카드' | '법인카드'
type ExpenseStatus = '대기' | '승인' | '반려' | '지급완료' | '확인완료'
type Category = '교통비' | '식비' | '업무용품' | '접대비' | '통신비' | '기타'

const CAT_ICON: Record<Category, string> = {
  교통비: '🚌', 식비: '🍽️', 업무용품: '🖊️', 접대비: '🤝', 통신비: '📱', 기타: '📦',
}

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  대기:    'bg-yellow-100 text-yellow-700',
  승인:    'bg-blue-100 text-blue-700',
  반려:    'bg-red-100 text-red-500',
  지급완료: 'bg-green-100 text-green-700',
  확인완료: 'bg-green-100 text-green-700',
}

interface Expense {
  id: string
  employee_id: string
  employee_name: string
  payment_type: PaymentType
  category: Category
  title: string
  amount: number
  expense_date: string
  memo: string | null
  receipt_url: string | null
  status: ExpenseStatus
  reject_reason: string | null
  created_at: string
}

interface Props {
  expenses: Expense[]
  isManager: boolean
  currentUserId: string
}

const CATEGORIES: Category[] = ['교통비', '식비', '업무용품', '접대비', '통신비', '기타']
const fmt = (n: number) => n.toLocaleString()

const today = new Date().toISOString().slice(0, 10)

export default function ExpensesClient({ expenses, isManager, currentUserId }: Props) {
  const [tab, setTab] = useState<'내 경비' | '전체 경비'>('내 경비')
  const [showForm, setShowForm] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [receiptModal, setReceiptModal] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)

  // 신청 폼 상태
  const [form, setForm] = useState({
    payment_type: '개인카드' as PaymentType,
    category: '교통비' as Category,
    title: '',
    amount: '',
    expense_date: today,
    memo: '',
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const myExpenses = expenses.filter(e => e.employee_id === currentUserId)
  const pendingExpenses = expenses.filter(e => e.status === '대기')

  // 이번 달 기준 요약
  const thisMonth = today.slice(0, 7)
  const myThisMonth = myExpenses.filter(e => e.expense_date.startsWith(thisMonth))
  const pendingAmount = myThisMonth.filter(e => ['대기', '승인'].includes(e.status) && e.payment_type === '개인카드').reduce((s, e) => s + e.amount, 0)
  const paidAmount = myThisMonth.filter(e => e.status === '지급완료').reduce((s, e) => s + e.amount, 0)
  const corpAmount = myThisMonth.filter(e => e.payment_type === '법인카드').reduce((s, e) => s + e.amount, 0)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  function resetForm() {
    setForm({ payment_type: '개인카드', category: '교통비', title: '', amount: '', expense_date: today, memo: '' })
    setReceiptFile(null)
    setReceiptPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!form.title || !form.amount) return
    setUploading(true)

    let receipt_url: string | undefined
    if (receiptFile) {
      const supabase = createClient()
      const ext = receiptFile.name.split('.').pop() ?? 'jpg'
      const path = `${currentUserId}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('receipts').upload(path, receiptFile)
      if (uploadError) {
        alert('영수증 업로드 실패: ' + uploadError.message)
        setUploading(false)
        return
      }
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)
      receipt_url = publicUrl
    }

    const result = await createExpense({
      payment_type: form.payment_type,
      category: form.category,
      title: form.title,
      amount: parseInt(form.amount.replace(/,/g, '')),
      expense_date: form.expense_date,
      memo: form.memo || undefined,
      receipt_url,
    })

    setUploading(false)
    if (result?.error) {
      alert(result.error)
    } else {
      resetForm()
      setShowForm(false)
    }
  }

  async function handleApprove(id: string) {
    startTransition(() => { approveExpense(id) })
  }

  async function handleReject() {
    if (!rejectTarget) return
    startTransition(async () => {
      await rejectExpense(rejectTarget, rejectReason)
      setRejectTarget(null)
      setRejectReason('')
    })
  }

  async function handleMarkPaid(id: string) {
    startTransition(() => { markAsPaid(id) })
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    startTransition(() => { deleteExpense(id) })
  }

  const listData = tab === '내 경비' ? myExpenses : expenses

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">경비 처리</h1>
          <p className="text-gray-500 text-sm mt-1">업무 지출 신청 · 승인 · 정산</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors">
          + 경비 신청
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">정산 대기 (이번 달)</p>
          <p className="text-lg font-bold text-yellow-600">{fmt(pendingAmount)}원</p>
          <p className="text-xs text-gray-400">개인카드 미정산</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">지급 완료 (이번 달)</p>
          <p className="text-lg font-bold text-green-600">{fmt(paidAmount)}원</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">법인카드 사용 (이번 달)</p>
          <p className="text-lg font-bold text-blue-600">{fmt(corpAmount)}원</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        {(['내 경비', ...(isManager ? ['전체 경비'] : [])] as const).map(t => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t}
            {t === '전체 경비' && pendingExpenses.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingExpenses.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {listData.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">신청 내역이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {listData.map(e => (
              <div key={e.id} className="flex items-center px-5 py-4 hover:bg-gray-50 gap-3">
                <div className="text-2xl shrink-0">{CAT_ICON[e.category]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium text-gray-800">{e.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${e.payment_type === '법인카드' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.payment_type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {e.expense_date} · {tab === '전체 경비' ? `${e.employee_name} · ` : ''}{e.category}
                    {e.memo ? ` · ${e.memo}` : ''}
                  </p>
                  {e.status === '반려' && e.reject_reason && (
                    <p className="text-xs text-red-400 mt-0.5">반려 사유: {e.reject_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {e.receipt_url && (
                    <button onClick={() => setReceiptModal(e.receipt_url!)}
                      className="text-xs text-blue-500 hover:text-blue-700 underline">영수증</button>
                  )}
                  <p className="font-semibold text-gray-800 text-sm text-right">{fmt(e.amount)}원</p>
                </div>
                {/* 관리자 액션 */}
                {isManager && (
                  <div className="flex flex-col gap-1 shrink-0">
                    {e.status === '대기' && (
                      <>
                        <button onClick={() => handleApprove(e.id)} disabled={isPending}
                          className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50">
                          {e.payment_type === '법인카드' ? '확인' : '승인'}
                        </button>
                        <button onClick={() => setRejectTarget(e.id)}
                          className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                          반려
                        </button>
                      </>
                    )}
                    {e.status === '승인' && e.payment_type === '개인카드' && (
                      <button onClick={() => handleMarkPaid(e.id)} disabled={isPending}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">
                        지급완료
                      </button>
                    )}
                  </div>
                )}
                {/* 본인 삭제 (대기 상태만) */}
                {e.employee_id === currentUserId && e.status === '대기' && (
                  <button onClick={() => handleDelete(e.id)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors shrink-0">✕</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 신청 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">경비 신청</h3>
              <button onClick={() => { resetForm(); setShowForm(false) }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              {/* 결제 수단 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">결제 수단</label>
                <div className="flex gap-2">
                  {(['개인카드', '법인카드'] as PaymentType[]).map(pt => (
                    <button key={pt} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_type: pt }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${form.payment_type === pt ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                      {pt}
                    </button>
                  ))}
                </div>
                {form.payment_type === '개인카드' && (
                  <p className="text-xs text-yellow-600 mt-1.5">💡 승인 후 정산 입금됩니다.</p>
                )}
                {form.payment_type === '법인카드' && (
                  <p className="text-xs text-purple-600 mt-1.5">💳 영수증 제출 후 확인 처리됩니다.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">날짜</label>
                  <input type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">카테고리</label>
                  <select value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">항목명</label>
                <input value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="예: 클라이언트 미팅 식대" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">금액 (원)</label>
                <input value={form.amount} type="number"
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="0" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">메모 (선택)</label>
                <input value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="간단한 메모" />
              </div>

              {/* 영수증 첨부 */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">영수증 첨부 (선택)</label>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                  onChange={handleFileChange}
                  className="hidden" id="receipt-upload" />
                <label htmlFor="receipt-upload"
                  className="flex items-center justify-center gap-2 w-full border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">
                  📷 사진 촬영 또는 파일 선택
                </label>
                {receiptPreview && (
                  <div className="mt-2 relative">
                    <img src={receiptPreview} alt="영수증 미리보기"
                      className="w-full max-h-48 object-contain rounded-lg border border-gray-200" />
                    <button type="button"
                      onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                      className="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 shadow text-xs">✕</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => { resetForm(); setShowForm(false) }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button type="button" onClick={handleSubmit}
                disabled={uploading || !form.title || !form.amount}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50">
                {uploading ? '업로드 중...' : '신청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-bold text-gray-900 mb-3">반려 사유 입력</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3}
              placeholder="반려 사유를 입력하세요" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setRejectTarget(null); setRejectReason('') }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
              <button onClick={handleReject} disabled={isPending}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 disabled:opacity-50">반려</button>
            </div>
          </div>
        </div>
      )}

      {/* 영수증 이미지 모달 */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setReceiptModal(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setReceiptModal(null)}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300">×</button>
            <img src={receiptModal} alt="영수증" className="w-full rounded-xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  )
}

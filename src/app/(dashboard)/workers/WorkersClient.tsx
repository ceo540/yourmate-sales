'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ExternalWorker, WorkerEngagement, WorkerPayment, WorkerPaymentStatus } from '@/types'

const TYPE_OPTIONS: ExternalWorker['type'][] = ['강사', '아티스트', '스태프', '기술', '복합']
const REUSE_LABEL: Record<ExternalWorker['reuse_status'], string> = {
  preferred: '⭐ 선호',
  normal: '보통',
  avoid: '회피',
}
const STATUS_LABEL: Record<WorkerPaymentStatus, string> = {
  pending: '⏳ 대기',
  paid: '✅ 지급 완료',
  failed: '❌ 실패',
  cancelled: '취소',
}

function fmtMoney(n: number | null | undefined) {
  return ((n ?? 0) / 10000).toFixed(0)
}

export default function WorkersClient({
  workers, engagements, payments, projectMap,
}: {
  workers: ExternalWorker[]
  engagements: WorkerEngagement[]
  payments: WorkerPayment[]
  projectMap: Record<string, { name: string; number: string | null }>
  isAdmin: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [paymentMonth, setPaymentMonth] = useState<Record<string, string>>({})  // worker_id → YYYY-MM

  const defaultMonth = new Date().toISOString().slice(0, 7)

  const filtered = useMemo(() => {
    return workers.filter(w => {
      if (searchQ && !w.name.toLowerCase().includes(searchQ.toLowerCase())) return false
      if (typeFilter !== 'all' && w.type !== typeFilter) return false
      return true
    })
  }, [workers, searchQ, typeFilter])

  const engagementsByWorker = useMemo(() => {
    const map: Record<string, WorkerEngagement[]> = {}
    for (const e of engagements) {
      if (!map[e.worker_id]) map[e.worker_id] = []
      map[e.worker_id].push(e)
    }
    return map
  }, [engagements])

  const paymentsByWorker = useMemo(() => {
    const map: Record<string, WorkerPayment[]> = {}
    for (const p of payments) {
      if (!map[p.worker_id]) map[p.worker_id] = []
      map[p.worker_id].push(p)
    }
    return map
  }, [payments])

  const handleMarkPaid = (paymentId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    if (!confirm(`이 정산 묶음을 지급 완료(${today})로 표시할까요?`)) return
    startTransition(async () => {
      const { markPaymentPaidAction } = await import('@/lib/worker-payments-actions')
      const r = await markPaymentPaidAction({ payment_id: paymentId, paid_date: today })
      if ('error' in r) {
        alert(`실패: ${r.error}`)
        return
      }
      router.refresh()
    })
  }

  const handleCancelPayment = (paymentId: string, amount: number) => {
    if (!confirm(`정산 묶음 (${(amount / 10000).toFixed(0)}만원)을 취소할까요?\n(삭제 X — 데이터는 보존, archive_status=cancelled. 새로 만들려면 [+ 정산 추가] 다시.)`)) return
    startTransition(async () => {
      const { cancelWorkerPaymentAction } = await import('@/lib/worker-payments-actions')
      const r = await cancelWorkerPaymentAction({ payment_id: paymentId })
      if ('error' in r) {
        alert(`실패: ${r.error}`)
        return
      }
      router.refresh()
    })
  }

  const handleCreateMonthly = (workerId: string) => {
    const ym = paymentMonth[workerId] ?? defaultMonth
    startTransition(async () => {
      const { createMonthlyPaymentAction } = await import('@/lib/worker-payments-actions')
      const r = await createMonthlyPaymentAction({ worker_id: workerId, year_month: ym })
      if ('error' in r) {
        alert(`실패: ${r.error}`)
        return
      }
      alert(`✅ ${ym} 정산 묶음 생성: ${(r.total / 10000).toFixed(0)}만원 (${r.engagement_count}건)`)
      router.refresh()
    })
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">👥 외부 인력 풀</h1>
        <p className="text-sm text-gray-500">강사·아티스트·스태프·기술 통합. 빵빵이 자연어로도 등록·정산 가능.</p>
      </header>

      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="이름 검색"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 min-w-[200px]"
        />
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">전체 유형</option>
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="ml-auto text-sm text-gray-500 self-center">
          {filtered.length} / {workers.length}명
        </span>
      </div>

      {workers.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <p className="text-base font-medium text-yellow-800 mb-2">아직 외부 인력이 등록되지 않았습니다</p>
          <p className="text-sm text-yellow-700">
            빵빵이에게 자연어로: <code className="bg-yellow-100 px-1 rounded">"강사 OOO 등록해줘 — 010-xxxx-xxxx, 시급 N원"</code>
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">이름</th>
                <th className="px-3 py-2 text-left">유형</th>
                <th className="px-3 py-2 text-left">단가</th>
                <th className="px-3 py-2 text-right">참여</th>
                <th className="px-3 py-2 text-right">총 지급</th>
                <th className="px-3 py-2 text-center">평가</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => {
                const expanded = expandedId === w.id
                const myEngagements = engagementsByWorker[w.id] ?? []
                const myPayments = paymentsByWorker[w.id] ?? []
                return (
                  <>
                    <tr
                      key={w.id}
                      onClick={() => setExpandedId(expanded ? null : w.id)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-3 py-2 font-medium">
                        {w.name}
                        {w.phone && <div className="text-[11px] text-gray-400">{w.phone}</div>}
                      </td>
                      <td className="px-3 py-2 text-gray-700">{w.type}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {w.default_rate ? (
                          <span>{(w.default_rate / 10000).toFixed(0)}만 / {w.default_rate_type === 'per_hour' ? '시간' : w.default_rate_type === 'per_session' ? '회' : '프로젝트'}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">{w.total_engagements}건</td>
                      <td className="px-3 py-2 text-right text-gray-700">{fmtMoney(w.total_paid)}만</td>
                      <td className="px-3 py-2 text-center">{REUSE_LABEL[w.reuse_status]}</td>
                      <td className="px-3 py-2 text-gray-400 text-center">{expanded ? '▲' : '▼'}</td>
                    </tr>
                    {expanded && (
                      <tr key={`${w.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 참여 기록 */}
                            <div>
                              <h3 className="text-xs font-semibold text-gray-700 mb-2">📋 참여 기록 ({myEngagements.length}건)</h3>
                              {myEngagements.length === 0 ? (
                                <p className="text-xs text-gray-400">참여 기록 없음. 빵빵이: <code>"이 프로젝트에 {w.name} N시간 참여 기록해줘"</code></p>
                              ) : (
                                <div className="space-y-1 max-h-48 overflow-auto">
                                  {myEngagements.slice(0, 20).map(e => {
                                    const project = projectMap[e.project_id]
                                    return (
                                      <div key={e.id} className="text-xs flex items-center justify-between bg-white rounded px-2 py-1">
                                        <span className="truncate flex-1" title={project?.name}>
                                          {e.date_start ?? '날짜?'} · {project?.name ?? e.project_id.slice(0, 8)}
                                        </span>
                                        <span className="text-gray-500 ml-2">{e.role ?? '—'} · {fmtMoney(e.amount)}만</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 정산 묶음 */}
                            <div>
                              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                                <h3 className="text-xs font-semibold text-gray-700">💰 월 정산 ({myPayments.length}건)</h3>
                                <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                                  <input
                                    type="month"
                                    value={paymentMonth[w.id] ?? defaultMonth}
                                    onChange={(ev) => setPaymentMonth(prev => ({ ...prev, [w.id]: ev.target.value }))}
                                    className="text-[11px] px-1.5 py-0.5 border border-gray-200 rounded"
                                  />
                                  <button
                                    onClick={() => handleCreateMonthly(w.id)}
                                    disabled={pending}
                                    title={`${paymentMonth[w.id] ?? defaultMonth} 정산 묶음 생성. 다른 월도 만들려면 월 변경 후 다시 +`}
                                    className="text-[11px] px-2 py-0.5 bg-yellow-400 hover:bg-yellow-500 text-white rounded whitespace-nowrap"
                                  >+ 정산 추가</button>
                                </div>
                              </div>
                              {myPayments.length === 0 ? (
                                <p className="text-xs text-gray-400">정산 묶음 없음. 위 [+ 월 정산 묶음] 또는 빵빵이.</p>
                              ) : (
                                <div className="space-y-1 max-h-48 overflow-auto">
                                  {myPayments.map(p => (
                                    <div key={p.id} className="text-xs bg-white rounded px-2 py-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium">{fmtMoney(p.total_amount)}만원</span>
                                        <span>{STATUS_LABEL[p.status]}</span>
                                      </div>
                                      <div className="text-[10px] text-gray-500 flex items-center justify-between mt-0.5">
                                        <span>{p.note ?? '—'}</span>
                                        <span>
                                          {p.paid_date ?? p.scheduled_date ?? p.created_at.slice(0, 10)}
                                        </span>
                                      </div>
                                      {p.status === 'pending' && (
                                        <div className="mt-1 flex items-center gap-1">
                                          <button
                                            onClick={(ev) => { ev.stopPropagation(); handleMarkPaid(p.id) }}
                                            disabled={pending}
                                            className="text-[10px] px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded"
                                          >지급 완료 표시</button>
                                          <button
                                            onClick={(ev) => { ev.stopPropagation(); handleCancelPayment(p.id, p.total_amount) }}
                                            disabled={pending}
                                            title="이 정산 묶음 취소 (삭제 X, 보류 폴더 이동)"
                                            className="text-[10px] px-2 py-0.5 bg-gray-200 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded"
                                          >✕ 취소</button>
                                        </div>
                                      )}
                                      {p.tax_form_sent_at && (
                                        <div className="text-[10px] text-blue-500 mt-0.5">📧 세무사 발송됨 · {p.tax_form_sent_at.slice(0, 10)}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 정산 가능 여부 */}
                          {(!w.bank_account_text || !w.ssn_text) && (
                            <div className="mt-3 text-[11px] text-orange-600 bg-orange-50 px-2 py-1 rounded">
                              ⚠️ 정산 누락:
                              {!w.bank_account_text && ' 계좌번호'}
                              {!w.ssn_text && ' 주민번호'}
                              {' '}— 빵빵이로 보강 가능
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        💡 빵빵이 자연어로도 다 가능: 등록·검색·참여 기록·월 정산·세무사 .xlsx
      </p>
    </div>
  )
}
